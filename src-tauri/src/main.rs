// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_sql::{Migration, MigrationKind};

fn migrations() -> Vec<Migration> {
    vec![
        // v1：整合建表（plan.db 已删除，从全新库起步）。一次性创建全部表结构与索引，
        // 包含 tasks / pomodoro_records / app_settings / user_pomo_schedule，无历史迁移包袱。
        Migration {
            version: 1,
            description: "create_all_tables",
            sql: "CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                quarter_id TEXT DEFAULT NULL,
                month_id TEXT DEFAULT NULL,
                week_id TEXT DEFAULT NULL,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                period_type INTEGER NOT NULL,
                total_pomodoro_quota INTEGER NOT NULL DEFAULT 0,
                pomodoro_per_occurrence INTEGER NOT NULL DEFAULT 0,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                is_cyclic INTEGER NOT NULL DEFAULT 0,
                cycle_rule TEXT DEFAULT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                deleted_at DATETIME DEFAULT NULL
            );
            CREATE TABLE IF NOT EXISTS pomodoro_records (
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
            );
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS user_pomo_schedule (
                id TEXT PRIMARY KEY,
                start_date TEXT NOT NULL,
                end_date TEXT DEFAULT NULL,
                pomodoro_work_minutes INTEGER NOT NULL,
                daily_pomo_count INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_user_pomo_schedule_start_end ON user_pomo_schedule(start_date, end_date);
            CREATE INDEX IF NOT EXISTS idx_tasks_period_type ON tasks(period_type);
            CREATE INDEX IF NOT EXISTS idx_tasks_date_range ON tasks(start_date, end_date);
            CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at);
            CREATE INDEX IF NOT EXISTS idx_tasks_cyclic ON tasks(is_cyclic);
            CREATE INDEX IF NOT EXISTS idx_tasks_period_date ON tasks(period_type, start_date, end_date);
            CREATE INDEX IF NOT EXISTS idx_tasks_quarter_id ON tasks(quarter_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_month_id ON tasks(month_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_week_id ON tasks(week_id);
            CREATE INDEX IF NOT EXISTS idx_pomo_task_id ON pomodoro_records(task_id);
            CREATE INDEX IF NOT EXISTS idx_pomo_record_date ON pomodoro_records(record_date);
            CREATE INDEX IF NOT EXISTS idx_pomo_status ON pomodoro_records(status);",
            kind: MigrationKind::Up,
        },
    ]
}

fn main() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations("sqlite:plan.db", migrations())
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}