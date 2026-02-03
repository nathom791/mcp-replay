mod mcp;
mod opencode;
mod state;
mod storage;
mod types;

use state::AppState;
use tauri::{Emitter, Manager};

#[cfg(target_os = "linux")]
fn set_default_env(key: &str, value: &str) {
    if std::env::var_os(key).is_none() {
        std::env::set_var(key, value);
    }
}

#[cfg(target_os = "linux")]
fn has_usable_dri() -> bool {
    for path in ["/dev/dri/renderD128", "/dev/dri/card0"] {
        if std::fs::OpenOptions::new().read(true).open(path).is_ok() {
            return true;
        }
    }
    false
}

#[cfg(target_os = "linux")]
fn append_env_list(key: &str, values: &[&str]) {
    let mut entries: Vec<String> = std::env::var(key)
        .ok()
        .unwrap_or_default()
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_string())
        .collect();
    for value in values {
        if !entries.iter().any(|entry| entry == value) {
            entries.push((*value).to_string());
        }
    }
    if !entries.is_empty() {
        std::env::set_var(key, entries.join(","));
    }
}

#[cfg(target_os = "linux")]
fn configure_linux_rendering() {
    let disable_gpu = std::env::var_os("OPENCODE_DISABLE_GPU").is_some();
    let force_gpu = std::env::var_os("OPENCODE_ENABLE_GPU").is_some();
    let has_dri = has_usable_dri();
    if (disable_gpu || !has_dri) && !force_gpu {
        set_default_env("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        set_default_env("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        set_default_env("LIBGL_ALWAYS_SOFTWARE", "1");
        append_env_list("GDK_DISABLE", &["gl", "egl", "dmabuf"]);
        if std::env::var_os("DISPLAY").is_some() {
            set_default_env("GDK_BACKEND", "x11");
        }
    }
}

#[cfg(desktop)]
fn build_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<tauri::menu::Menu<R>> {
    use tauri::menu::{Menu, MenuItem, MenuItemKind, PredefinedMenuItem, Submenu};

    let menu = Menu::default(app)?;
    let go_home = MenuItem::with_id(app, "go_home", "Home", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;

    let mut file_menu = None;
    for item in menu.items()? {
        if let MenuItemKind::Submenu(submenu) = item {
            if submenu.text().ok().as_deref() == Some("File") {
                file_menu = Some(submenu);
                break;
            }
        }
    }

    if let Some(file_menu) = file_menu {
        file_menu.prepend(&go_home)?;
        file_menu.insert(&separator, 1)?;
    } else {
        let file_menu = Submenu::with_items(app, "File", true, &[&go_home])?;
        menu.append(&file_menu)?;
    }

    Ok(menu)
}

fn main() {
    #[cfg(target_os = "linux")]
    configure_linux_rendering();

    tracing_subscriber::fmt()
        .with_env_filter("info")
        .init();

    tauri::Builder::default()
        .menu(build_menu)
        .on_menu_event(|app, event| {
            if event.id() == "go_home" {
                let _ = app.emit("app:go-home", ());
            }
        })
        .setup(|app| {
            let storage = tauri::async_runtime::block_on(storage::Storage::new(&app.handle()))
                .map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error))?;
            let state = AppState {
                server_config: std::sync::Arc::new(tokio::sync::RwLock::new(None)),
                storage,
                mcp_manager: mcp::McpManager::new(),
                event_stream: std::sync::Arc::new(tokio::sync::Mutex::new(None)),
                opencode_process: std::sync::Arc::new(tokio::sync::Mutex::new(None)),
            };
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            opencode::get_server_config,
            opencode::set_server_config,
            opencode::opencode_health,
            opencode::opencode_list_sessions,
            opencode::opencode_create_session,
            opencode::opencode_list_session_messages,
            opencode::opencode_send_message,
            opencode::opencode_get_mcp,
            opencode::opencode_start_event_stream,
            opencode::opencode_stop_event_stream,
            mcp::mcp_set_configs,
            mcp::mcp_list_tools,
            mcp::mcp_call_tool,
            storage::storage_list_sessions,
            storage::storage_list_sessions_page,
            storage::storage_list_suites,
            storage::storage_create_suite,
            storage::storage_delete_suite,
            storage::storage_assign_suite,
            storage::storage_unassign_suite,
            storage::storage_list_session_suites,
            storage::storage_get_session_payload,
            storage::storage_save_session,
            storage::storage_duplicate_session,
            storage::storage_delete_session,
            storage::storage_replace_tool_calls,
            storage::storage_update_tool_call_request,
            storage::storage_save_replay_run,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
