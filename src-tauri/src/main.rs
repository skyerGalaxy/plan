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
        // v3：为 tasks 增加上级 id 冗余列 quarter_id/month_id/week_id，
        // 使每条任务记录其全部上级任务 id（月→季、周→月、日→周），并对存量数据回填。
        Migration {
            version: 3,
            description: "add_ancestor_ids_to_tasks",
            sql: "ALTER TABLE tasks ADD COLUMN quarter_id TEXT DEFAULT NULL REFERENCES tasks(id);
            ALTER TABLE tasks ADD COLUMN month_id TEXT DEFAULT NULL REFERENCES tasks(id);
            ALTER TABLE tasks ADD COLUMN week_id TEXT DEFAULT NULL REFERENCES tasks(id);

            -- 月任务：其直接父任务即季任务
            UPDATE tasks SET quarter_id = parent_id WHERE period_type = 2;

            -- 周任务：父任务为月（month_id）；其 quarter_id 沿用父（月）任务的 quarter_id
            UPDATE tasks SET
                month_id = parent_id,
                quarter_id = (SELECT p.quarter_id FROM tasks p WHERE p.id = tasks.parent_id)
            WHERE period_type = 3;

            -- 日任务：父任务为周（week_id）；month_id/quarter_id 沿用父（周）任务的对应字段
            UPDATE tasks SET
                week_id = parent_id,
                month_id = (SELECT p.month_id FROM tasks p WHERE p.id = tasks.parent_id),
                quarter_id = (SELECT p.quarter_id FROM tasks p WHERE p.id = tasks.parent_id)
            WHERE period_type = 4;

            CREATE INDEX IF NOT EXISTS idx_tasks_quarter_id ON tasks(quarter_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_month_id ON tasks(month_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_week_id ON tasks(week_id);",
            kind: MigrationKind::Up,
        },
        // v4：移除 parent_id 列（任务层级改由 quarter_id/month_id/week_id 三列冗余表达），并补高价值复合索引。
        // SQLite 不支持 DROP COLUMN，故采用「建新表→迁移数据→替换旧表」重建。
        // 关键：tauri-plugin-sql 在单事务内执行迁移，PRAGMA foreign_keys=OFF 在事务内是 no-op，外键仍保持 ON。
        // 此时 DROP TABLE tasks 会对旧表隐式 DELETE，凡被外键引用的行都会触发 FOREIGN KEY constraint failed (787)。
        // 因此新表一律不加外键，并先删子表 pomodoro_records 再删父表 tasks，保证无表引用父表即可安全重建。
        // 本项目删除任务为软删除（deleted_at 递归），从不硬删 tasks，去掉外键不影响业务与数据完整性。
        Migration {
            version: 4,
            description: "drop_parent_id_and_add_composite_indexes",
            sql: "CREATE TABLE tasks_new (
                id TEXT PRIMARY KEY,
                quarter_id TEXT DEFAULT NULL,
                month_id TEXT DEFAULT NULL,
                week_id TEXT DEFAULT NULL,
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
            INSERT INTO tasks_new (
                id, quarter_id, month_id, week_id, title, description, period_type,
                total_pomodoro_quota, start_date, end_date, is_cyclic, cycle_rule,
                sort_order, status, created_at, updated_at, deleted_at
            )
            SELECT
                id, quarter_id, month_id, week_id, title, description, period_type,
                total_pomodoro_quota, start_date, end_date, is_cyclic, cycle_rule,
                sort_order, status, created_at, updated_at, deleted_at
            FROM tasks;

            CREATE TABLE pomodoro_new (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                record_date DATE NOT NULL,
                start_time DATETIME NOT NULL,
                end_time DATETIME DEFAULT NULL,
                duration_minutes INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'completed',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            INSERT INTO pomodoro_new (
                id, task_id, record_date, start_time, end_time,
                duration_minutes, status, created_at
            )
            SELECT
                id, task_id, record_date, start_time, end_time,
                duration_minutes, status, created_at
            FROM pomodoro_records;

            -- 先删子表（无表引用 pomodoro_records），再删父表（此时无表引用 tasks），安全重建
            DROP TABLE pomodoro_records;
            DROP TABLE tasks;
            ALTER TABLE tasks_new RENAME TO tasks;
            ALTER TABLE pomodoro_new RENAME TO pomodoro_records;

            CREATE INDEX IF NOT EXISTS idx_tasks_period_type ON tasks(period_type);
            CREATE INDEX IF NOT EXISTS idx_tasks_date_range ON tasks(start_date, end_date);
            CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at);
            CREATE INDEX IF NOT EXISTS idx_tasks_cyclic ON tasks(is_cyclic);
            CREATE INDEX IF NOT EXISTS idx_tasks_period_date ON tasks(period_type, start_date, end_date);
            CREATE INDEX IF NOT EXISTS idx_tasks_quarter_id ON tasks(quarter_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_month_id ON tasks(month_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_week_id ON tasks(week_id);
            CREATE INDEX IF NOT EXISTS idx_pomodoro_task_id ON pomodoro_records(task_id);
            CREATE INDEX IF NOT EXISTS idx_pomodoro_record_date ON pomodoro_records(record_date);
            CREATE INDEX IF NOT EXISTS idx_pomodoro_task_status_date ON pomodoro_records(task_id, status, record_date);",
            kind: MigrationKind::Up,
        },
        // v5：为 tasks 增加「单次任务番茄数」列 pomodoro_per_occurrence（仅循环任务使用）。
        // 循环任务记录单次所需番茄数，总配额 total_pomodoro_quota 由「单次×触发次数」派生。
        // SQLite 用 ADD COLUMN 即可安全加列，不影响既有外键/约束。
        Migration {
            version: 5,
            description: "add_pomodoro_per_occurrence",
            sql: "ALTER TABLE tasks ADD COLUMN pomodoro_per_occurrence INTEGER NOT NULL DEFAULT 0;",
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