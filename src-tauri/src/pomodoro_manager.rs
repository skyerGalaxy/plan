//! 全局单例番茄钟管理器：唯一状态源。
//! 负责单例约束、计时 tick、状态流转、打断计数与事件广播。
//! 前端（主页面 / 桌宠）均为纯渲染层，通过命令 + 事件与此处同步。

use std::sync::{Arc, Mutex};
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::oneshot;

use crate::pomodoro_db::{Db, NewSession, RestoredSession};
use crate::state::{PomodoroStatePayload, PomodoroStatus};

/// 完成一个番茄可获得的金币：按专注分钟数计（1 分钟 = 1 金币）
fn reward_for(effective_seconds: u32) -> u32 {
    effective_seconds / 60
}

/// 内部会话状态（受 `Arc<Mutex<Inner>>` 保护）
struct Inner {
    status: PomodoroStatus,
    record_id: Option<String>,
    task_id: Option<String>,
    occurrence_date: Option<String>,
    task_title: String,
    target_seconds: u32,
    effective_seconds: u32,
    resume_count: u32,
    reward_gold: u32,
    cancel: Option<oneshot::Sender<()>>,
    ticker: Option<tauri::async_runtime::JoinHandle<()>>,
}

impl Inner {
    fn idle() -> Self {
        Self {
            status: PomodoroStatus::Abandoned,
            record_id: None,
            task_id: None,
            occurrence_date: None,
            task_title: String::new(),
            target_seconds: 0,
            effective_seconds: 0,
            resume_count: 0,
            reward_gold: 0,
            cancel: None,
            ticker: None,
        }
    }

    fn payload(&self) -> PomodoroStatePayload {
        let mut p = PomodoroStatePayload {
            task_id: self.task_id.clone(),
            occurrence_date: self.occurrence_date.clone(),
            task_title: self.task_title.clone(),
            status: if self.task_id.is_none() {
                "idle".to_string()
            } else {
                self.status.as_str().to_string()
            },
            remain_seconds: 0,
            resume_count: self.resume_count,
            target_seconds: self.target_seconds,
            effective_seconds: self.effective_seconds,
            reward_gold: self.reward_gold,
        };
        p.with_remaining();
        p
    }

    /// 停止 tick（cancel + abort），需先持有锁
    fn stop_ticker(&mut self) {
        if let Some(tx) = self.cancel.take() {
            let _ = tx.send(());
        }
        if let Some(h) = self.ticker.take() {
            h.abort();
        }
    }
}

pub struct PomodoroManager {
    inner: Arc<Mutex<Inner>>,
    db: Arc<Db>,
    app: AppHandle,
}

impl PomodoroManager {
    pub fn new(db: Arc<Db>, app: AppHandle) -> Self {
        Self {
            inner: Arc::new(Mutex::new(Inner::idle())),
            db,
            app,
        }
    }

    /// 当前状态负载（供命令返回 / 初始化读取）
    pub fn payload(&self) -> PomodoroStatePayload {
        self.inner.lock().unwrap().payload()
    }

    /// 应用启动时恢复 running/paused/interrupted_saved 会话，running 则继续计时并广播
    pub fn restore(&self) -> Result<(), String> {
        if let Some(rs) = self.db.load_active_record()? {
            self.overwrite_session(&rs);
        }
        let p = self.payload();
        sync_windows(&self.app, &self.db, &p.status);
        let _ = self.app.emit("pomodoro_state_update", p);
        Ok(())
    }

    /// 用恢复出来的会话覆盖当前内存状态；若为 running 则启动 tick
    fn overwrite_session(&self, rs: &RestoredSession) {
        let mut g = self.inner.lock().unwrap();
        g.stop_ticker();
        g.status = rs.status;
        g.record_id = Some(rs.id.clone());
        g.task_id = Some(rs.task_id.clone());
        g.occurrence_date = rs.occurrence_date.clone();
        g.task_title = rs.task_title.clone();
        g.effective_seconds = rs.effective_seconds;
        g.resume_count = rs.resume_count;
        g.reward_gold = rs.reward_gold;
        g.target_seconds = if rs.target_seconds > 0 {
            rs.target_seconds
        } else {
            self.db.load_work_minutes() * 60
        };
        let should_tick = g.status == PomodoroStatus::Running;
        drop(g);
        if should_tick {
            self.start_ticker();
        }
    }

    // ============ 对外命令 ============

    /// 开始番茄钟（新建 / 继续中断 / 单例冲突）
    pub fn start(
        &self,
        task_id: String,
        occurrence_date: Option<String>,
    ) -> Result<PomodoroStatePayload, String> {
        if self.db.has_other_active(&task_id)? {
            return Err("已有进行中的番茄钟会话".to_string());
        }

        let task_title = self.db.load_task_title(&task_id);
        let target_seconds = self.db.load_work_minutes() * 60;

        // 优先恢复本任务同一实例的中断保存记录
        if let Some(rs) = self.db.load_interrupted_by_task(&task_id, &occurrence_date)? {
            let record_id = rs.id.clone();
            let title = rs.task_title.clone();
            let eff = rs.effective_seconds;
            let rc = rs.resume_count;
            {
                let mut g = self.inner.lock().unwrap();
                g.stop_ticker();
                g.status = PomodoroStatus::Running;
                g.record_id = Some(record_id.clone());
                g.task_id = Some(task_id.clone());
                g.occurrence_date = rs.occurrence_date.clone();
                g.task_title = if title.is_empty() { task_title } else { title };
                g.target_seconds = if rs.target_seconds > 0 {
                    rs.target_seconds
                } else {
                    target_seconds
                };
                g.effective_seconds = eff;
                g.resume_count = rc;
                g.reward_gold = rs.reward_gold;
            }
            self.db.update_transition(&record_id, "running", eff, rc)?;
            emit_record_sync(&self.db, &self.app, &record_id);
            self.start_ticker();
        } else {
            // 新建会话
            let record_id = {
                let mut g = self.inner.lock().unwrap();
                g.stop_ticker();
                g.status = PomodoroStatus::Running;
                g.record_id = None;
                g.task_id = Some(task_id.clone());
                g.occurrence_date = occurrence_date.clone();
                g.task_title = task_title.clone();
                g.target_seconds = target_seconds;
                g.effective_seconds = 0;
                g.resume_count = 0;
                g.reward_gold = 0;

                let id = uuid::Uuid::new_v4().to_string();
                self.db.insert_running(&NewSession {
                    id: id.clone(),
                    task_id: task_id.clone(),
                    task_title: task_title.clone(),
                    occurrence_date: occurrence_date.clone(),
                    target_seconds,
                })?;
                g.record_id = Some(id.clone());
                id
            };
            emit_record_sync(&self.db, &self.app, &record_id);
            self.start_ticker();
        }

        let p = self.payload();
        self.broadcast(p.clone());
        Ok(p)
    }

    /// 暂停（仅 running → paused），触发瞬间打断计数 +1
    pub fn pause(&self) -> Result<PomodoroStatePayload, String> {
        let (id, eff, rc) = {
            let mut g = self.inner.lock().unwrap();
            if g.status != PomodoroStatus::Running {
                return Err("当前状态不允许暂停".to_string());
            }
            g.stop_ticker();
            g.status = PomodoroStatus::Paused;
            g.resume_count += 1;
            self.required_snapshot(&g)?
        };
        self.db.update_transition(&id, "paused", eff, rc)?;
        emit_record_sync(&self.db, &self.app, &id);
        let p = self.payload();
        self.broadcast(p.clone());
        Ok(p)
    }

    /// 继续运行（仅 paused → running），打断计数不变
    pub fn resume(&self) -> Result<PomodoroStatePayload, String> {
        let record_id = {
            let mut g = self.inner.lock().unwrap();
            if g.status != PomodoroStatus::Paused {
                return Err("当前状态不允许继续".to_string());
            }
            g.status = PomodoroStatus::Running;
            let (id, eff, rc) = self.required_snapshot(&g)?;
            self.db.update_transition(&id, "running", eff, rc)?;
            id
        };
        emit_record_sync(&self.db, &self.app, &record_id);
        self.start_ticker();
        let p = self.payload();
        self.broadcast(p.clone());
        Ok(p)
    }

    /// 中断保存（仅 running → interrupted_saved），触发瞬间打断计数 +1
    pub fn interrupt_save(&self) -> Result<PomodoroStatePayload, String> {
        let (id, eff, rc, remaining) = {
            let mut g = self.inner.lock().unwrap();
            if g.status != PomodoroStatus::Running {
                return Err("当前状态不允许中断保存".to_string());
            }
            g.stop_ticker();
            g.status = PomodoroStatus::InterruptedSaved;
            g.resume_count += 1;
            let (id, eff, rc) = self.required_snapshot(&g)?;
            let remaining = g.target_seconds.saturating_sub(g.effective_seconds);
            (id, eff, rc, remaining)
        };
        self.db.update_interrupt_saved(&id, eff, rc, remaining)?;
        emit_record_sync(&self.db, &self.app, &id);
        let p = self.payload();
        self.broadcast(p.clone());
        Ok(p)
    }

    // ============ 内部 ============

    /// 专注模式（桌面宠物）开关
    pub fn focus_mode(&self) -> bool {
        self.db.focus_mode()
    }

    /// 设置专注模式：立即同步桌宠窗口显隐
    pub fn set_focus_mode(&self, enabled: bool) -> Result<(), String> {
        self.db
            .set_setting("settings.focusMode", if enabled { "true" } else { "false" })?;
        let p = self.payload();
        sync_windows(&self.app, &self.db, &p.status);
        Ok(())
    }

    /// 保存桌宠窗口位置（拖拽松开时持久化）
    pub fn save_pet_position(&self, x: f64, y: f64) -> Result<(), String> {
        self.db.save_pet_position(x, y)
    }

    /// 广播状态并同步窗口显隐（运行/暂停 + 专注模式 → 显示桌宠；否则隐藏桌宠并唤起主窗口）
    fn broadcast(&self, p: PomodoroStatePayload) {
        sync_windows(&self.app, &self.db, &p.status);
        let _ = self.app.emit("pomodoro_state_update", p);
    }

    /// 读取 id / effective / resume_count（需已持有锁）
    fn required_snapshot(&self, g: &Inner) -> Result<(String, u32, u32), String> {
        let id = g
            .record_id
            .clone()
            .ok_or_else(|| "没有进行中的番茄记录".to_string())?;
        Ok((id, g.effective_seconds, g.resume_count))
    }

    /// 启动每秒 tick（先停旧任务）
    fn start_ticker(&self) {
        let (inner, db, app) = {
            let mut g = self.inner.lock().unwrap();
            if g.status != PomodoroStatus::Running {
                return;
            }
            g.stop_ticker();
            (
                Arc::clone(&self.inner),
                Arc::clone(&self.db),
                self.app.clone(),
            )
        };
        let (tx, mut rx) = oneshot::channel();
        let handle = tauri::async_runtime::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(1));
            interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
            interval.tick().await; // 跳过首次即时触发
            loop {
                tokio::select! {
                    _ = &mut rx => break,
                    _ = interval.tick() => {
                        if tick_once(&inner, &db, &app) { break; }
                    }
                }
            }
        });
        self.inner.lock().unwrap().ticker = Some(handle);
        self.inner.lock().unwrap().cancel = Some(tx);
    }
}

/// 写库成功后广播记录全量快照（供前端幂等 upsert 到云端）；加载失败仅日志，不阻塞主流程
fn emit_record_sync(db: &Db, app: &AppHandle, id: &str) {
    match db.load_record(id) {
        Ok(Some(rec)) => {
            let _ = app.emit("pomodoro_record_sync", rec);
        }
        Ok(None) => {}
        Err(e) => eprintln!("load_record({id}) failed: {e}"),
    }
}

/// 每秒回调：累计秒数、完成判定 / 落库，并广播状态；返回 true 表示会话已完成
fn tick_once(inner: &Arc<Mutex<Inner>>, db: &Db, app: &AppHandle) -> bool {
    let (completed, sync_id) = {
        let mut g = inner.lock().unwrap();
        if g.status != PomodoroStatus::Running {
            return false;
        }
        g.effective_seconds += 1;
        if g.effective_seconds >= g.target_seconds {
            g.reward_gold = reward_for(g.effective_seconds);
            g.status = PomodoroStatus::Completed;
            let id = g.record_id.clone().unwrap_or_default();
            let eff = g.effective_seconds;
            let gold = g.reward_gold;
            g.stop_ticker();
            // 完成时落库；仅落库成功才同步云端
            let sync_id = if db.update_completed(&id, eff, gold).is_ok() {
                Some(id)
            } else {
                None
            };
            (true, sync_id)
        } else {
            // 运行中不再每秒落库，仅在暂停/中断/完成等状态流转时写入
            (false, None)
        }
    };
    if let Some(id) = sync_id.as_deref() {
        emit_record_sync(db, app, id);
    }
    let p = inner.lock().unwrap().payload();
    // 仅「完成」这一 tick 内同步窗口（收起桌宠、唤起主窗口）；
    // 运行中的每秒 tick 不再强制隐藏主窗口，避免用户从托盘恢复后再被藏起。
    if completed {
        sync_windows(app, db, &p.status);
    }
    let _ = app.emit("pomodoro_state_update", p);
    completed
}

/// 同步窗口显隐（仅在状态流转时调用，不要在每秒 tick 里调用，避免覆盖用户从托盘恢复的状态）。
/// 桌宠：running/paused 且专注模式开启 → 显示，否则隐藏。
/// 主窗口：
/// - 专注模式开启且开始番茄（running）→ 隐藏主窗口，由桌宠接管；
/// - 暂停 / 中断保存（paused / interrupted_saved）→ 不强制操作（不自动隐藏，也不强制唤起）；
/// - 完成 / 放弃 / 空闲，或关闭专注模式 → 唤起主窗口，回到任务列表。
/// 是否「最小化到托盘」由用户点击窗口关闭按钮时按 close_to_tray 设置决定。
fn sync_windows(app: &AppHandle, db: &Db, status: &str) {
    let focus = db.focus_mode();
    let show_pet = matches!(status, "running" | "paused") && focus;
    if let Some(w) = app.get_webview_window("pet") {
        if show_pet {
            let _ = w.show();
        } else {
            let _ = w.hide();
        }
    }
    if status == "running" && focus {
        if let Some(w) = app.get_webview_window("main") {
            let _ = w.hide();
        }
    } else if !focus || matches!(status, "completed" | "abandoned" | "idle") {
        crate::reveal_main_window(app);
    }
}