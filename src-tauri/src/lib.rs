// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, State};
use tauri_plugin_sql::{Migration, MigrationKind};

mod pomodoro_db;
mod pomodoro_manager;
mod state;

use pomodoro_manager::PomodoroManager;
use state::PomodoroStatePayload;

#[tauri::command]
fn start_pomodoro(
    state: State<'_, PomodoroManager>,
    task_id: String,
    occurrence_date: Option<String>,
) -> Result<PomodoroStatePayload, String> {
    state.start(task_id, occurrence_date)
}

#[tauri::command]
fn pause_pomodoro(state: State<'_, PomodoroManager>) -> Result<PomodoroStatePayload, String> {
    state.pause()
}

#[tauri::command]
fn resume_pomodoro(state: State<'_, PomodoroManager>) -> Result<PomodoroStatePayload, String> {
    state.resume()
}

#[tauri::command]
fn interrupt_save_pomodoro(
    state: State<'_, PomodoroManager>,
) -> Result<PomodoroStatePayload, String> {
    state.interrupt_save()
}

#[tauri::command]
fn get_pomodoro_state(
    state: State<'_, PomodoroManager>,
) -> Result<PomodoroStatePayload, String> {
    Ok(state.payload())
}

#[tauri::command]
fn get_focus_mode(state: State<'_, PomodoroManager>) -> Result<bool, String> {
    Ok(state.focus_mode())
}

#[tauri::command]
fn set_focus_mode(state: State<'_, PomodoroManager>, enabled: bool) -> Result<(), String> {
    state.set_focus_mode(enabled)
}

#[tauri::command]
fn save_pet_position(
    state: State<'_, PomodoroManager>,
    x: f64,
    y: f64,
) -> Result<(), String> {
    state.save_pet_position(x, y)
}

#[tauri::command]
fn show_main_window(app: tauri::AppHandle) -> Result<(), String> {
    reveal_main_window(&app);
    Ok(())
}

/// 唤起并聚焦主窗口
pub(crate) fn reveal_main_window(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// 预创建托盘图标（常驻）：主窗口最小化到托盘时可借此恢复；菜单含「显示主窗口 / 退出」。
fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let show = MenuItem::with_id(app, "show_main", "显示主窗口", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[&show, &PredefinedMenuItem::separator(app)?, &quit],
    )?;

    let icon = app.default_window_icon().cloned();
    TrayIconBuilder::with_id("main-tray")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("Plan")
        .icon(icon.unwrap_or_else(|| default_tray_icon()))
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                reveal_main_window(tray.app_handle());
            }
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show_main" => reveal_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;
    Ok(())
}

/// 兜底图标：无应用图标时使用 1x1 透明像素（仅保证程序不崩溃）
fn default_tray_icon() -> tauri::image::Image<'static> {
    tauri::image::Image::new_owned(vec![0u8; 4], 1, 1)
}

/// 预创建桌宠窗口：隐藏、240x130、无边框、透明、置顶、跳过任务栏、不可缩放。
/// 位置默认主屏右下角（距右/下 20px），若有保存坐标则使用保存值。
fn create_pet_window(
    app: &tauri::App,
    db: &pomodoro_db::Db,
) -> Result<(), Box<dyn std::error::Error>> {
    let pet = tauri::WebviewWindowBuilder::new(
        app,
        "pet",
        tauri::WebviewUrl::App("index.html".into()),
    )
    .title("Plan Pet")
    .inner_size(240.0, 130.0)
    .resizable(false)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .shadow(false)
    .visible(false)
    .build()?;

    if let Some((x, y)) = db.read_pet_position() {
        pet.set_position(tauri::PhysicalPosition::new(x as i32, y as i32))
            .ok();
    } else if let Some(m) = app.primary_monitor()? {
        let sz = m.size();
        pet.set_position(tauri::PhysicalPosition::new(
            sz.width as i32 - 240 - 20,
            sz.height as i32 - 130 - 20,
        ))
        .ok();
    }
    Ok(())
}

fn migrations() -> Vec<Migration> {
    vec![
        // v1：整合建表（plan.db 已删除，从全新库起步）。一次性创建全部表结构与索引。
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
        // v2、v3 已移除：task_title/target_seconds/occurrence_date 及
        // idx_pomo_task_occurrence 索引由后端 Db::ensure_schema() 幂等补齐，
        // 避免与 plugin-sql 迁移顺序耦合触发「duplicate column」错误。
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations("sqlite:plan.db", migrations())
                .build(),
        )
        .setup(|app| {
            let db_dir = app.path().app_data_dir()?;
            let db = Arc::new(pomodoro_db::Db::open(&db_dir)?);
            app.manage(db.clone()); // 供关闭事件按设置决策
            create_pet_window(app, &db)?;
            setup_tray(app)?;
            let manager = PomodoroManager::new(db.clone(), app.handle().clone());
            manager.restore()?;
            app.manage(manager);
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // 「点叉」策略：最小化到托盘（隐藏窗口、保留进程）还是退出应用
                let to_tray = window.state::<Arc<pomodoro_db::Db>>().close_to_tray();
                api.prevent_close();
                if to_tray {
                    let _ = window.hide(); // 隐藏即可经托盘恢复
                } else {
                    window.app_handle().exit(0); // 退出应用
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            start_pomodoro,
            pause_pomodoro,
            resume_pomodoro,
            interrupt_save_pomodoro,
            get_pomodoro_state,
            get_focus_mode,
            set_focus_mode,
            save_pet_position,
            show_main_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}