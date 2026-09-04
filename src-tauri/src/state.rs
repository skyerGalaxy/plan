use serde::Serialize;

/// 番茄钟运行状态枚举
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PomodoroStatus {
    Running,
    Paused,
    InterruptedSaved,
    Completed,
    /// 无会话占位（payload 在 task_id 为空时统一呈现为 "idle"）
    Idle,
}

impl PomodoroStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Running => "running",
            Self::Paused => "paused",
            Self::InterruptedSaved => "interrupted_saved",
            Self::Completed => "completed",
            Self::Idle => "idle",
        }
    }

    /// 从数据库状态文本恢复。
    /// load_active_record 只查询 running/paused/interrupted_saved，
    /// 其余未知值兜底为 Idle（不会作为活动会话恢复）。
    pub fn from_db(s: &str) -> Self {
        match s {
            "running" => Self::Running,
            "paused" => Self::Paused,
            "interrupted_saved" => Self::InterruptedSaved,
            "completed" => Self::Completed,
            _ => Self::Idle,
        }
    }
}

/// 通过全局事件 `pomodoro_state_update` 广播的统一负载，供主页面 / 桌宠纯渲染
#[derive(Clone, Debug, Serialize)]
pub struct PomodoroStatePayload {
    /// 当前任务 id；空闲时为 None
    pub task_id: Option<String>,
    /// 循环任务具体实例日期（YYYY-MM-DD）；非循环/空闲为 None
    pub occurrence_date: Option<String>,
    pub task_title: String,
    /// running | paused | interrupted_saved | completed | idle
    pub status: String,
    pub remain_seconds: u32,
    pub resume_count: u32,
    pub target_seconds: u32,
    pub effective_seconds: u32,
    pub reward_gold: u32,
}

impl PomodoroStatePayload {
    /// 依据累计有效秒数与目标秒数计算剩余秒数
    pub fn with_remaining(&mut self) {
        self.remain_seconds = self.target_seconds.saturating_sub(self.effective_seconds);
    }
}

/// 通过全局事件 `pomodoro_record_sync` 广播的记录全量快照。
/// 后端每次对 pomodoro_records 写库成功后广播一次，供前端幂等 upsert 到云端。
/// 字段与前端 src/api/types.ts 的 PomodoroRecordSync 一一对应（snake_case）。
#[derive(Clone, Debug, Serialize)]
pub struct PomodoroRecordSync {
    pub id: String,
    pub task_id: String,
    /// 循环任务的具体实例日期（YYYY-MM-DD）；非循环任务为 None
    pub occurrence_date: Option<String>,
    pub record_date: String,
    pub start_time: String,
    pub end_time: Option<String>,
    pub effective_total_seconds: u32,
    /// running | paused | interrupted_saved | completed
    pub status: String,
    pub resume_count: u32,
    pub interrupt_duration_seconds: Option<u32>,
    pub reward_gold: u32,
}