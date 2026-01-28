use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use serde_json::{json, Value};
use tauri::State;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::sync::{Mutex, RwLock};
use tokio::time::{timeout, Duration};
use url::Url;

use crate::state::AppState;
use crate::types::{McpServerConfig, McpToolDefinition, McpToolResult};

const PROTOCOL_VERSION: &str = "2025-11-25";

#[derive(Clone)]
pub struct McpManager {
    configs: Arc<RwLock<HashMap<String, McpServerConfig>>>,
    clients: Arc<Mutex<HashMap<String, Arc<McpClient>>>>,
}

impl McpManager {
    pub fn new() -> Self {
        Self {
            configs: Arc::new(RwLock::new(HashMap::new())),
            clients: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn set_configs(&self, configs: HashMap<String, McpServerConfig>) {
        *self.configs.write().await = configs;
    }

    pub async fn get_client(&self, server_name: &str) -> Result<Arc<McpClient>, String> {
        if let Some(client) = self.clients.lock().await.get(server_name).cloned() {
            return Ok(client);
        }
        let config = self
            .configs
            .read()
            .await
            .get(server_name)
            .cloned()
            .ok_or_else(|| format!("Missing MCP config for {server_name}"))?;
        let client = McpClient::new(server_name.to_string(), config).await?;
        let client = Arc::new(client);
        self.clients
            .lock()
            .await
            .insert(server_name.to_string(), client.clone());
        Ok(client)
    }
}

#[tauri::command]
pub async fn mcp_set_configs(
    state: State<'_, AppState>,
    configs: HashMap<String, McpServerConfig>,
) -> Result<(), String> {
    state.mcp_manager.set_configs(configs).await;
    Ok(())
}

#[tauri::command]
pub async fn mcp_list_tools(
    state: State<'_, AppState>,
    server_name: String,
) -> Result<Vec<McpToolDefinition>, String> {
    let client = state.mcp_manager.get_client(&server_name).await?;
    client.list_tools().await
}

#[tauri::command]
pub async fn mcp_call_tool(
    state: State<'_, AppState>,
    server_name: String,
    tool_name: String,
    arguments: Value,
) -> Result<McpToolResult, String> {
    let client = state.mcp_manager.get_client(&server_name).await?;
    client.call_tool(tool_name, arguments).await
}

#[derive(Clone)]
pub struct McpClient {
    server_name: String,
    transport: McpTransport,
    request_id: Arc<AtomicU64>,
    protocol_version: Arc<RwLock<String>>,
    timeout: Duration,
}

impl McpClient {
    pub async fn new(server_name: String, config: McpServerConfig) -> Result<Self, String> {
        let timeout = Duration::from_millis(match &config {
            McpServerConfig::Local(local) => local.timeout.unwrap_or(5000),
            McpServerConfig::Remote(remote) => remote.timeout.unwrap_or(5000),
        });
        let transport = match config {
            McpServerConfig::Local(local) => {
                McpTransport::stdio(local.command, local.environment).await?
            }
            McpServerConfig::Remote(remote) => {
                McpTransport::http(remote.url, remote.headers.unwrap_or_default()).await?
            }
        };
        let client = Self {
            server_name,
            transport,
            request_id: Arc::new(AtomicU64::new(1)),
            protocol_version: Arc::new(RwLock::new(PROTOCOL_VERSION.to_string())),
            timeout,
        };
        client.initialize().await?;
        Ok(client)
    }

    async fn initialize(&self) -> Result<(), String> {
        let params = json!({
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": {
                "tools": { "listChanged": true }
            },
            "clientInfo": {
                "name": "OpenCode Replay",
                "version": "0.1.0",
                "title": "OpenCode Replay"
            }
        });
        let response = self.send_request("initialize", params).await?;
        if let Some(version) = response
            .get("protocolVersion")
            .and_then(|value| value.as_str())
        {
            *self.protocol_version.write().await = version.to_string();
        }
        self.send_notification("notifications/initialized", json!({}))
            .await
    }

    async fn send_notification(&self, method: &str, params: Value) -> Result<(), String> {
        let payload = json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params
        });
        self.transport.send(payload, None).await.map(|_| ())
    }

    async fn send_request(&self, method: &str, params: Value) -> Result<Value, String> {
        let id = self.request_id.fetch_add(1, Ordering::SeqCst);
        let payload = json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params
        });
        let response = self
            .transport
            .send(payload, Some((id, self.timeout, self.protocol_version.clone())))
            .await?;
        if let Some(result) = response.get("result") {
            return Ok(result.clone());
        }
        Err("Missing JSON-RPC result".to_string())
    }

    pub async fn list_tools(&self) -> Result<Vec<McpToolDefinition>, String> {
        let mut tools = Vec::new();
        let mut cursor: Option<String> = None;
        loop {
            let mut params = json!({});
            if let Some(cursor_value) = cursor.clone() {
                params["cursor"] = Value::String(cursor_value);
            }
            let response = self.send_request("tools/list", params).await?;
            let next_tools: Vec<McpToolDefinition> = serde_json::from_value(
                response
                    .get("tools")
                    .cloned()
                    .unwrap_or_else(|| Value::Array(Vec::new())),
            )
            .map_err(|error| error.to_string())?;
            tools.extend(next_tools);
            cursor = response
                .get("nextCursor")
                .and_then(|value| value.as_str())
                .map(|value| value.to_string());
            if cursor.is_none() {
                break;
            }
        }
        Ok(tools)
    }

    pub async fn call_tool(
        &self,
        tool_name: String,
        arguments: Value,
    ) -> Result<McpToolResult, String> {
        let params = json!({
            "name": tool_name,
            "arguments": arguments
        });
        let response = self.send_request("tools/call", params).await?;
        serde_json::from_value(response).map_err(|error| error.to_string())
    }
}

#[derive(Clone)]
enum McpTransport {
    Stdio(Arc<StdioTransport>),
    Http(Arc<HttpTransport>),
}

impl McpTransport {
    async fn stdio(
        command: Vec<String>,
        environment: Option<HashMap<String, String>>,
    ) -> Result<Self, String> {
        let executable = command
            .first()
            .ok_or_else(|| "Missing MCP command".to_string())?
            .to_string();
        let args = command.iter().skip(1);
        let mut cmd = Command::new(executable);
        cmd.args(args)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());
        if let Some(environment) = environment {
            cmd.envs(environment);
        }
        let mut child = cmd.spawn().map_err(|error| error.to_string())?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Failed to open MCP stdin".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Failed to open MCP stdout".to_string())?;
        let transport = StdioTransport::new(child, stdin, stdout);
        Ok(McpTransport::Stdio(Arc::new(transport)))
    }

    async fn http(url: String, headers: HashMap<String, String>) -> Result<Self, String> {
        Ok(McpTransport::Http(Arc::new(HttpTransport::new(
            url, headers,
        )?)))
    }

    async fn send(
        &self,
        payload: Value,
        request: Option<(u64, Duration, Arc<RwLock<String>>)>,
    ) -> Result<Value, String> {
        match self {
            McpTransport::Stdio(transport) => transport.send(payload, request).await,
            McpTransport::Http(transport) => transport.send(payload, request).await,
        }
    }
}

struct StdioTransport {
    _child: Mutex<Child>,
    stdin: Mutex<ChildStdin>,
    pending: Arc<Mutex<HashMap<u64, tokio::sync::oneshot::Sender<Value>>>>,
}

impl StdioTransport {
    fn new(child: Child, stdin: ChildStdin, stdout: ChildStdout) -> Self {
        let transport = Self {
            _child: Mutex::new(child),
            stdin: Mutex::new(stdin),
            pending: Arc::new(Mutex::new(HashMap::new())),
        };
        transport.start_reader(stdout);
        transport
    }

    fn start_reader(&self, stdout: ChildStdout) {
        let pending = self.pending.clone();
        tauri::async_runtime::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let value: Value = match serde_json::from_str(&line) {
                    Ok(value) => value,
                    Err(_) => continue,
                };
                let id = value.get("id").and_then(|id| id.as_u64());
                if let Some(id) = id {
                    if let Some(sender) = pending.lock().await.remove(&id) {
                        let _ = sender.send(value);
                    }
                }
            }
        });
    }

    async fn send(
        &self,
        payload: Value,
        request: Option<(u64, Duration, Arc<RwLock<String>>)>,
    ) -> Result<Value, String> {
        let payload_line = serde_json::to_string(&payload).map_err(|error| error.to_string())?;
        if let Some((id, timeout_duration, _)) = request {
            let (sender, receiver) = tokio::sync::oneshot::channel();
            self.pending.lock().await.insert(id, sender);
            self.stdin
                .lock()
                .await
                .write_all(format!("{}\n", payload_line).as_bytes())
                .await
                .map_err(|error| error.to_string())?;
            let response = timeout(timeout_duration, receiver)
                .await
                .map_err(|_| "MCP request timed out".to_string())?
                .map_err(|_| "MCP response dropped".to_string())?;
            return Ok(response);
        }

        self.stdin
            .lock()
            .await
            .write_all(format!("{}\n", payload_line).as_bytes())
            .await
            .map_err(|error| error.to_string())?;
        Ok(Value::Null)
    }
}

struct HttpTransport {
    client: reqwest::Client,
    url: Url,
    headers: HashMap<String, String>,
    session_id: Mutex<Option<String>>,
}

impl HttpTransport {
    fn new(url: String, headers: HashMap<String, String>) -> Result<Self, String> {
        Ok(Self {
            client: reqwest::Client::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .map_err(|error| error.to_string())?,
            url: Url::parse(&url).map_err(|error| error.to_string())?,
            headers,
            session_id: Mutex::new(None),
        })
    }

    async fn send(
        &self,
        payload: Value,
        request: Option<(u64, Duration, Arc<RwLock<String>>)>,
    ) -> Result<Value, String> {
        let mut builder = self
            .client
            .post(self.url.clone())
            .header("Accept", "application/json")
            .json(&payload);
        for (key, value) in &self.headers {
            builder = builder.header(key, value);
        }
        if let Some(session_id) = self.session_id.lock().await.clone() {
            builder = builder.header("MCP-Session-Id", session_id);
        }
        if let Some((_, _, version)) = &request {
            builder = builder.header("MCP-Protocol-Version", version.read().await.as_str());
        }

        let response = builder
            .send()
            .await
            .map_err(|error| error.to_string())?;
        if let Some(session_id) = response
            .headers()
            .get("MCP-Session-Id")
            .and_then(|value| value.to_str().ok())
        {
            *self.session_id.lock().await = Some(session_id.to_string());
        }
        let status = response.status();
        if !status.is_success() {
            return Err(format!("MCP HTTP error: {status}"));
        }
        let body = response.text().await.map_err(|error| error.to_string())?;
        if body.trim().is_empty() {
            return Ok(Value::Null);
        }
        serde_json::from_str(&body).map_err(|error| error.to_string())
    }
}
