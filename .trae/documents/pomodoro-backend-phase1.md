# 番茄钟后端核心改造（Phase 1：Rust 后端 + 主页面）

## Context（背景与目标）

当前番茄钟实现是**前端驱动**：计时逻辑、状态流转、打断计数、数据库写入全在 Vue (`PomodoroTimer.vue` / `PetTimerWindow.vue`) 里用 JS `setInterval` 完成，状态无法跨窗口共享、易失真，也不满足"后端唯一状态源"的架构要求。

按 [1.md](file:///e:/code/Vue/plan/src/components/PlanSwiper/1.md) 的规则，本次**分阶段**推进：
- **Phase 1（本次）**：把计时核心、状态流转、打断计数、番茄记录写入全部搬入 Rust 后端（全局单例 `PomodoroManager` + `rusqlite`），通过全局事件 `pomodoro_state_update` 广播；主番茄钟页面改为纯渲染层（`invoke` 命令 + 订阅事件）。
- **Phase 2（后续）**：桌宠窗口重构为共享状态源的纯渲染层（240×130、透明置顶、悬停/拖拽/右键菜单）。本次仅预留阶段，不实现。

已确认决策：后端新增 `rusqlite`（按文档）；桌宠最终以共享状态源渲染。

## 后端改动（Phase 1 主体）

### 1. `Cargo.toml`
- 新增依赖：`rusqlite = { version = "0.31", features = ["bundled"] }`、`tokio = { version = "1", features = ["time"] }`。
- 新增 `[lib]`：`name = "app_lib"`，`crate-type = ["staticlib","cdylib","rlib"]`。
- `rust-version` 措辞可保留（工具链实际 1.94）。

### 2. 新增 `src/state.rs`
- `enum PomodoroStatus { Running, Paused, InterruptedSaved, Completed, Abandoned }` + `as_str()`。
- `from_db(s)`：容错 `"interrupted"` → `InterruptedSaved`（遗留前端写入过 `'interrupted'`）。
- `#[derive(Serialize)] struct PomodoroStatePayload`：`task_id: Option<String>`, `task_title`, `status: String`, `remain_seconds`, `resume_count`, `target_seconds`, `effective_seconds`, `reward_gold`。含 `idle()` 与 `remain = target.saturating_sub(effective)`。

### 3. 新增 `src/pomodoro_db.rs`
- `pub struct Db(Mutex<rusqlite::Connection>)`，`Db::open(dir)`：`create_dir_all`、开 `plan.db`、设 `PRAGMA journal_mode=WAL`、`busy_timeout=5000`、`foreign_keys=true`。
- 方法：`load_active_record()`（查 `status IN ('running','paused','interrupted_saved')` 按 `created_at DESC LIMIT 1` 恢复）；`insert_running(NewSession)`；`update_transition(...)`；tick 落库 `effective_total_seconds`。

### 4. 新增 `src/pomodoro_manager.rs`
- `struct PomodoroManager { inner: Arc<Mutex<Inner>>, db: Arc<Db>, app: AppHandle }`。
- `Inner`：`status, record_id, task_id, task_title, target_seconds, effective_seconds, resume_count, reward_gold, cancel: Option<oneshot::Sender<()>>, ticker: Option<JoinHandle<()>>`。
- `restore()`：应用启动时恢复 running/paused/interrupted_saved 记录，running 则启动 tick，并广播。
- Ticker：`tauri::async_runtime::spawn` + `tokio::time::interval(1s)` + `MissedTickBehavior::Delay` + `tokio::select!`（OneShot 取消）。每秒 `effective_seconds+1`，达 `target_seconds` 自动完成（写 end_time/status=completed/reward_gold，停 tick，广播）。每 tick 广播 `pomodoro_state_update`。
- 锁纪律：`inner` 锁内只做 payload 构建与字段更新，**锁外** `emit`；DB 写走 `Mutex<Connection>`。

### 5. 新增 `src/lib.rs`（并替换 `main.rs`）
- `main.rs` 缩为 shim：`fn main(){ app_lib::run() }`。
- `lib.rs`：把现有 v1 `migrations()` 原样迁移过来，并**追加 v2 迁移**：
  ```sql
  ALTER TABLE pomodoro_records ADD COLUMN task_title TEXT NOT NULL DEFAULT '';
  ALTER TABLE pomodoro_records ADD COLUMN target_seconds INTEGER NOT NULL DEFAULT 1500;
  ```
  （复用现有 `effective_total_seconds` 作为运行中累计秒数，`resume_count`/`reward_gold` 照旧，避免新增多余列。）
- 命令（**同步**命令，阻塞式 rusqlite 不占 tokio worker）：`start_pomodoro(task_id)`, `pause_pomodoro`, `resume_pomodoro`, `interrupt_save_pomodoro`, `get_pomodoro_state`, 均返回 `Result<PomodoroStatePayload, String>`。
- `.setup`：`Db::open(app.path().app_data_dir()?)` → 构造 manager → `restore()` → `app.manage(manager)`。
- `.invoke_handler(generate_handler![...5 命令])`。
- 单例冲突：`start_pomodoro` 若存在**其它任务**的 running/paused 记录，返回冲突错误（供前端弹窗）。

### 6. `src-tauri/capabilities/*`（如有）
- 若 capabilities 限制了 `core:event:default`/IPC 命令，需放行新命令与 `pomodoro_state_update` 订阅。视现状调整。

## 前端改动（Phase 1）

### 7. `src/api/pomodoro.ts`（新增）
- 类型化封装：`startPomodoro(taskId)`, `pausePomodoro()`, `resumePomodoro()`, `interruptSavePomodoro()`, `getPomodoroState()`（`invoke('xx')`）+ `PomodoroStatePayload` 类型 + 事件类型定义。

### 8. `src/components/PlanSwiper/PomodoroTimer.vue`（重构）
- 移除 JS 计时器/写库逻辑。
- 挂载时 `listen('pomodoro_state_update')` + `getPomodoroState()` 初始化；卸载时 `unlisten`。
- 按状态渲染（见 [1.md](file:///e:/code/Vue/plan/src/components/PlanSwiper/1.md#L99-L107)）：running 显示剩余 + 进度 +「暂停/中断保存」；paused 置灰 +「继续运行」；completed 显示完成提示/金币/休息倒计时 +「返回任务列表」；interrupted_saved 自动退出页面。

### 9. `src/components/PlanSwiper/TaskListItem.vue` + 冲突弹窗
- 把「开始番茄钟」`router.push(...)` 改为 `await startPomodoro(taskId)`。
- 冲突处理：若返回"已有进行中"错误，弹出确认弹窗（提示当前任务，确认后先 `interrupt_save_pomodoro()` 再 `start_pomodoro(newId)`）。
- 启动成功后由全局事件驱动跳转番茄钟页。

### 10. 主窗口全局事件订阅
- 在合适的全局作用域（如 `PlanView` 或 `App` 容器）订阅 `pomodoro_state_update`：状态进入 `running` 时自动导航到番茄钟页；进入 `interrupted_saved`/`completed` 时按需跳回。
- 路由：`/pomodoro/:id/:taskName/:totalPomodoros` 仍可复用（页面改为从事件读数据，参数仅作兜底）。

## 不改动
- `src/api/localRepository.ts` / `index.ts` / `cloudRepository.ts` 的展示读取逻辑（列表番茄数、当日统计仍用 plugin-sql 读取 `pomodoro_records`）；新写入统一走后端命令。
- 桌宠窗口在 Phase 1 保持现状，仅预留后续对接事件接口。

## 验证（Verification）
1. `cd src-tauri && cargo build`（`rusqlite` bundled 需 MSVC C 工具链）。
2. 运行 `npm run tauri dev`，确认：
   - 点击任务「开始」→ 后端广播，主窗口自动切入番茄钟页，计时走秒。
   - 暂停/继续/中断保存：按钮行为、界面状态、`interrupted_saved` 自动退出页面对应正确。
   - 完成一个番茄：`pomodoro_records` 出现 `status='completed'` 记录、正确 `effective_total_seconds`/`reward_gold`/`end_time`，列表番茄数随之变化。
   - 中断时再次启动同一任务：复用 `interrupted_saved` 记录继续计时，`resume_count` 保持。
   - 已在运行其它任务时点开始：弹出冲突弹窗，确认后切换。
   - 重启应用：恢复上次 running/paused 状态并继续计时广播。
3. `pause/resume/interrupt` 触发瞬间 `resume_count +1` 逻辑正确（代码走查 + DB 校验）。