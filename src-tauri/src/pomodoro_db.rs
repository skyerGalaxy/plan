//! 后端番茄记录数据库访问封装（rusqlite）。
//! 与前端展示读取（tauri-plugin-sql / sqlx 连接）共用同一个 `plan.db`，
//! 通过 WAL + busy_timeout 保证并发安全，全部写操作经 `Mutex<Connection>` 串行化。

use rusqlite::{params, Connection};
use std::path::Path;
use std::sync::Mutex;

use crate::state::{PomodoroRecordSync, PomodoroStatus};

/// 启动一个全新 `running` 会话所需的字段
pub struct NewSession {
    pub id: String,
    pub task_id: String,
    pub task_title: String,
    /// 循环任务的具体实例日期（YYYY-MM-DD）；非循环任务为 None
    pub occurrence_date: Option<String>,
    pub target_seconds: u32,
}

/// 恢复出的活动会话
pub struct RestoredSession {
    pub id: String,
    pub task_id: String,
    pub task_title: String,
    pub occurrence_date: Option<String>,
    pub effective_seconds: u32,
    pub resume_count: u32,
    pub reward_gold: u32,
    pub target_seconds: u32,
    pub status: PomodoroStatus,
}

pub struct Db(Mutex<Connection>);

impl Db {
    /// 打开（必要时先创建目录）`dir/plan.db`，配置 WAL 与 busy_timeout
    pub fn open(dir: &Path) -> Result<Self, String> {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        let path = dir.join("plan.db");
        let conn = Connection::open(&path).map_err(|e| e.to_string())?;
        conn.pragma_update(None, "journal_mode", "WAL")
            .map_err(|e| e.to_string())?;
        conn.pragma_update(None, "busy_timeout", 5000)
            .map_err(|e| e.to_string())?;
        conn.pragma_update(None, "foreign_keys", true)
            .map_err(|e| e.to_string())?;
        let db = Self(Mutex::new(conn));
        db.ensure_schema()?;
        Ok(db)
    }

    /// 幂等确保 pomodoro_records 表存在并补齐后端化所需列。
    /// 后端在 setup 阶段即打开连接，早于前端触发 plugin-sql 迁移（Database.load 时才执行），
    /// 因此空库时必须先建表，否则对不存在的表 ALTER 会报「no such table」。
    /// 列补齐逻辑与已移除的迁移 v2/v3 对齐，避免「duplicate column」冲突。
    fn ensure_schema(&self) -> Result<(), String> {
        let conn = self.get();
        conn.execute(
            "CREATE TABLE IF NOT EXISTS pomodoro_records (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                record_date TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NULL,
                effective_total_seconds INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL,
                resume_count INTEGER NOT NULL DEFAULT 0,
                interrupt_duration_seconds INTEGER NULL,
                reward_gold INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            )",
            [],
        )
        .map_err(|e| e.to_string())?;
        if !column_exists(&conn, "task_title")? {
            conn.execute(
                "ALTER TABLE pomodoro_records ADD COLUMN task_title TEXT NOT NULL DEFAULT ''",
                [],
            )
            .map_err(|e| e.to_string())?;
        }
        if !column_exists(&conn, "target_seconds")? {
            conn.execute(
                "ALTER TABLE pomodoro_records ADD COLUMN target_seconds INTEGER NOT NULL DEFAULT 1500",
                [],
            )
            .map_err(|e| e.to_string())?;
        }
        if !column_exists(&conn, "occurrence_date")? {
            conn.execute(
                "ALTER TABLE pomodoro_records ADD COLUMN occurrence_date TEXT",
                [],
            )
            .map_err(|e| e.to_string())?;
        }
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_pomo_task_occurrence ON pomodoro_records(task_id, occurrence_date)",
            [],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    fn get(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.0.lock().unwrap()
    }

    /// 恢复运行中的活动会话（running/paused/interrupted_saved，取最新一条）
    pub fn load_active_record(&self) -> Result<Option<RestoredSession>, String> {
        let conn = self.get();
        let mut stmt = conn
            .prepare(
                "SELECT id, task_id, task_title, occurrence_date, effective_total_seconds, resume_count, reward_gold, status, target_seconds
                 FROM pomodoro_records
                 WHERE status IN ('running','paused','interrupted_saved')
                 ORDER BY created_at DESC LIMIT 1",
            )
            .map_err(|e| e.to_string())?;
        let mut rows = stmt
            .query_map([], |r| {
                Ok(RestoredSession {
                    id: r.get(0)?,
                    task_id: r.get(1)?,
                    task_title: r.get(2)?,
                    occurrence_date: r.get(3)?,
                    effective_seconds: r.get::<_, i64>(4)? as u32,
                    resume_count: r.get::<_, i64>(5)? as u32,
                    reward_gold: r.get::<_, i64>(6)? as u32,
                    status: PomodoroStatus::from_db(&r.get::<_, String>(7)?),
                    target_seconds: r.get::<_, i64>(8)? as u32,
                })
            })
            .map_err(|e| e.to_string())?;
        let mut out = None;
        if let Some(row) = rows.next() {
            out = Some(row.map_err(|e| e.to_string())?);
        }
        Ok(out)
    }

    /// 检查是否存在「其它任务」的 running/paused 活跃记录（用于单例冲突判断）
    pub fn has_other_active(&self, task_id: &str) -> Result<bool, String> {
        let conn = self.get();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM pomodoro_records
                 WHERE status IN ('running','paused') AND task_id <> ?1",
                params![task_id],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        Ok(count > 0)
    }

    /// 是否存在本任务的 interrupted_saved 记录（用于恢复继续）
    pub fn load_interrupted_by_task(
        &self,
        task_id: &str,
        occurrence_date: &Option<String>,
    ) -> Result<Option<RestoredSession>, String> {
        let conn = self.get();
        let mut stmt = conn
            .prepare(
                "SELECT id, task_id, task_title, occurrence_date, effective_total_seconds, resume_count, reward_gold, status, target_seconds
                 FROM pomodoro_records
                 WHERE status IN ('interrupted_saved','interrupted') AND task_id = ?1
                   AND (occurrence_date = ?2 OR (?2 IS NULL AND occurrence_date IS NULL))
                 ORDER BY created_at DESC LIMIT 1",
            )
            .map_err(|e| e.to_string())?;
        let mut rows = stmt
            .query_map(params![task_id, occurrence_date], |r| {
                Ok(RestoredSession {
                    id: r.get(0)?,
                    task_id: r.get(1)?,
                    task_title: r.get(2)?,
                    occurrence_date: r.get(3)?,
                    effective_seconds: r.get::<_, i64>(4)? as u32,
                    resume_count: r.get::<_, i64>(5)? as u32,
                    reward_gold: r.get::<_, i64>(6)? as u32,
                    status: PomodoroStatus::from_db(&r.get::<_, String>(7)?),
                    target_seconds: r.get::<_, i64>(8)? as u32,
                })
            })
            .map_err(|e| e.to_string())?;
        let mut out = None;
        if let Some(row) = rows.next() {
            out = Some(row.map_err(|e| e.to_string())?);
        }
        Ok(out)
    }

    /// 新建 running 会话
    pub fn insert_running(&self, s: &NewSession) -> Result<(), String> {
        let conn = self.get();
        conn.execute(
            "INSERT INTO pomodoro_records\n                (id, task_id, task_title, occurrence_date, record_date, start_time, end_time,\n                 effective_total_seconds, status, resume_count, interrupt_duration_seconds, reward_gold, target_seconds, created_at)\n             VALUES (?1,?2,?3,?4,date('now'),datetime('now'),NULL,0,'running',0,NULL,0,?5,datetime('now'))",
            params![s.id, s.task_id, s.task_title, s.occurrence_date, s.target_seconds as i64,],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// 状态流转更新（running→paused 等）
    pub fn update_transition(
        &self,
        id: &str,
        status: &str,
        effective_seconds: u32,
        resume_count: u32,
    ) -> Result<(), String> {
        let conn = self.get();
        conn.execute(
            "UPDATE pomodoro_records
             SET status=?1, effective_total_seconds=?2, resume_count=?3
             WHERE id=?4",
            params![status, effective_seconds as i64, resume_count as i64, id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// 中断保存：状态流转外，把剩余时间写入 interrupt_duration_seconds 并记录 end_time 快照
    pub fn update_interrupt_saved(
        &self,
        id: &str,
        effective_seconds: u32,
        resume_count: u32,
        remaining_seconds: u32,
    ) -> Result<(), String> {
        let conn = self.get();
        conn.execute(
            "UPDATE pomodoro_records
             SET status='interrupted_saved', effective_total_seconds=?1, resume_count=?2,
                 interrupt_duration_seconds=?3, end_time=datetime('now')
             WHERE id=?4",
            params![
                effective_seconds as i64,
                resume_count as i64,
                remaining_seconds as i64,
                id
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// 完成：写入 end_time、completed 状态与金币
    pub fn update_completed(
        &self,
        id: &str,
        effective_seconds: u32,
        reward_gold: u32,
    ) -> Result<(), String> {
        let conn = self.get();
        conn.execute(
            "UPDATE pomodoro_records
             SET status='completed', effective_total_seconds=?1, reward_gold=?2, end_time=datetime('now')
             WHERE id=?4",
            params![effective_seconds as i64, reward_gold as i64, id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// 读取一条记录的完整快照（供写库后事件驱动同步到云端）
    pub fn load_record(&self, id: &str) -> Result<Option<PomodoroRecordSync>, String> {
        let conn = self.get();
        let mut stmt = conn
            .prepare(
                "SELECT id, task_id, occurrence_date, record_date, start_time, end_time,
                        effective_total_seconds, status, resume_count,
                        interrupt_duration_seconds, reward_gold
                 FROM pomodoro_records WHERE id = ?1",
            )
            .map_err(|e| e.to_string())?;
        let mut rows = stmt
            .query_map(params![id], |r| {
                Ok(PomodoroRecordSync {
                    id: r.get(0)?,
                    task_id: r.get(1)?,
                    occurrence_date: r.get(2)?,
                    record_date: r.get(3)?,
                    start_time: r.get(4)?,
                    end_time: r.get(5)?,
                    effective_total_seconds: r.get::<_, i64>(6)? as u32,
                    status: r.get(7)?,
                    resume_count: r.get::<_, i64>(8)? as u32,
                    interrupt_duration_seconds: r.get::<_, Option<i64>>(9)?.map(|v| v as u32),
                    reward_gold: r.get::<_, i64>(10)? as u32,
                })
            })
            .map_err(|e| e.to_string())?;
        let mut out = None;
        if let Some(row) = rows.next() {
            out = Some(row.map_err(|e| e.to_string())?);
        }
        Ok(out)
    }

    /// 读取当前生效的专注时长（分钟）：优先 user_pomo_schedule 生效段，
    /// 其次 app_settings 的 settings.workMinutes，缺省 25。
    pub fn load_work_minutes(&self) -> u32 {
        let conn = self.get();
        // user_pomo_schedule 当前生效段（今天在 start_date~end_date 区间内）
        let v: Option<i64> = conn
            .query_row(
                "SELECT pomodoro_work_minutes FROM user_pomo_schedule
                 WHERE start_date <= date('now')
                   AND (end_date IS NULL OR end_date >= date('now'))
                 ORDER BY created_at DESC LIMIT 1",
                [],
                |r| r.get(0),
            )
            .ok();
        if let Some(v) = v {
            return v.max(1) as u32;
        }
        // app_settings 兜底
        let v: Option<String> = conn
            .query_row(
                "SELECT value FROM app_settings WHERE key='settings.workMinutes'",
                [],
                |r| r.get(0),
            )
            .ok();
        if let Some(v) = v {
            if let Ok(n) = v.parse::<u32>() {
                return n.max(1);
            }
        }
        25
    }

    /// 根据任务 id 读取任务标题（缺省空字符串）
    pub fn load_task_title(&self, task_id: &str) -> String {
        let conn = self.get();
        conn.query_row("SELECT title FROM tasks WHERE id=?1", params![task_id], |r| {
            r.get::<_, String>(0)
        })
        .unwrap_or_default()
    }

    /// 读取设置项（app_settings），无则返回 None
    pub fn get_setting(&self, key: &str) -> Option<String> {
        let conn = self.get();
        conn.query_row(
            "SELECT value FROM app_settings WHERE key=?1",
            params![key],
            |r| r.get::<_, String>(0),
        )
        .ok()
    }

    /// 主窗口「点叉」策略：是否最小化到托盘（默认是）；否则关闭即退出应用
    pub fn close_to_tray(&self) -> bool {
        self.get_setting("settings.closeToTray")
            .map(|v| v == "true")
            .unwrap_or(true)
    }

    /// 写入/更新设置项（app_settings）
    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), String> {
        let conn = self.get();
        conn.execute(
            "INSERT INTO app_settings(key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')",
            params![key, value],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// 专注模式（桌面宠物）开关状态
    pub fn focus_mode(&self) -> bool {
        self.get_setting("settings.focusMode").map(|v| v == "true").unwrap_or(false)
    }

    /// 读取桌宠保存位置（"x,y"），无则 None
    pub fn read_pet_position(&self) -> Option<(f64, f64)> {
        let raw = self.get_setting("settings.petPos")?;
        let mut it = raw.split(',');
        let x = it.next()?.trim().parse::<f64>().ok()?;
        let y = it.next()?.trim().parse::<f64>().ok()?;
        Some((x, y))
    }

    /// 保存桌宠位置
    pub fn save_pet_position(&self, x: f64, y: f64) -> Result<(), String> {
        self.set_setting("settings.petPos", &format!("{x},{y}"))
    }
}

/// 判断 pomodoro_records 表是否包含指定列
fn column_exists(conn: &Connection, name: &str) -> Result<bool, String> {
    let mut stmt = conn
        .prepare("PRAGMA table_info(pomodoro_records)")
        .map_err(|e| e.to_string())?;
    let cols = stmt
        .query_map([], |r| r.get::<_, String>(1))
        .map_err(|e| e.to_string())?;
    for col in cols {
        if col.map_err(|e| e.to_string())? == name {
            return Ok(true);
        }
    }
    Ok(false)
}