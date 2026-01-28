use std::sync::Arc;

use tokio::process::Child;
use tokio::sync::{Mutex, RwLock};
use tauri::async_runtime::JoinHandle;
use tokio_util::sync::CancellationToken;

use crate::mcp::McpManager;
use crate::storage::Storage;
use crate::types::ServerConfig;

#[derive(Clone)]
pub struct AppState {
    pub server_config: Arc<RwLock<Option<ServerConfig>>>,
    pub storage: Storage,
    pub mcp_manager: McpManager,
    pub event_stream: Arc<Mutex<Option<EventStreamHandle>>>,
    pub opencode_process: Arc<Mutex<Option<Child>>>,
}

pub struct EventStreamHandle {
    pub cancel: CancellationToken,
    pub task: JoinHandle<()>,
}
