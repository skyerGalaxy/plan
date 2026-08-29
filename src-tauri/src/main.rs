// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_sql::{Migration, MigrationKind};

fn migrations() -> Vec<Migration> {
    vec![
        // v1（保留兼容历史）：旧的自增 INTEGER 结构，仅历史库会命中
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: "CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                parent_id INTEGER DEFAULT NULL REFERENCES tasks(id),
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                period_type INTEGER NOT NULL,
                total_pomodoro_quota INTEGER NOT NULL DEFAULT 0,
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
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER NOT NULL REFERENCES tasks(id),
                record_date DATE NOT NULL,
                start_time DATETIME NOT NULL,
                end_time DATETIME DEFAULT NULL,
                duration_minutes INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'completed',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_period_type ON tasks(period_type);
            CREATE INDEX IF NOT EXISTS idx_tasks_date_range ON tasks(start_date, end_date);
            CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at);
            CREATE INDEX IF NOT EXISTS idx_tasks_cyclic ON tasks(is_cyclic);
            CREATE INDEX IF NOT EXISTS idx_pomodoro_task_id ON pomodoro_records(task_id);
            CREATE INDEX IF NOT EXISTS idx_pomodoro_record_date ON pomodoro_records(record_date);",
            kind: MigrationKind::Up,
        },
        // v2：删除旧数据并重建为 UUID 结构，与云端 Supabase 表结构保持一致。
        // 主键 id 为 TEXT，UUID 由应用层生成后写入，保证云端与本地主键一致。
        Migration {
            version: 2,
            description: "recreate_tables_with_uuid",
            sql: "DROP TABLE IF EXISTS pomodoro_records;
            DROP TABLE IF EXISTS tasks;
            DROP TABLE IF EXISTS app_settings;
            CREATE TABLE tasks (
                id TEXT PRIMARY KEY,
                parent_id TEXT DEFAULT NULL REFERENCES tasks(id),
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                period_type INTEGER NOT NULL,
                total_pomodoro_quota INTEGER NOT NULL DEFAULT 0,
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
            CREATE TABLE pomodoro_records (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL REFERENCES tasks(id),
                record_date DATE NOT NULL,
                start_time DATETIME NOT NULL,
                end_time DATETIME DEFAULT NULL,
                duration_minutes INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'completed',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_period_type ON tasks(period_type);
            CREATE INDEX IF NOT EXISTS idx_tasks_date_range ON tasks(start_date, end_date);
            CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at);
            CREATE INDEX IF NOT EXISTS idx_tasks_cyclic ON tasks(is_cyclic);
            CREATE INDEX IF NOT EXISTS idx_pomodoro_task_id ON pomodoro_records(task_id);
            CREATE INDEX IF NOT EXISTS idx_pomodoro_record_date ON pomodoro_records(record_date);",
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