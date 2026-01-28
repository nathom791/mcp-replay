use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerConfig {
    pub base_url: String,
    pub username: Option<String>,
    pub password: Option<String>,
    pub directory: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenCodeMessageWithParts {
    pub info: Value,
    pub parts: Vec<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenCodeSession {
    pub id: String,
    pub title: String,
    pub time: Value,
    #[serde(flatten)]
    pub rest: std::collections::HashMap<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpLocalConfig {
    pub r#type: String,
    pub command: Vec<String>,
    pub environment: Option<std::collections::HashMap<String, String>>,
    pub enabled: Option<bool>,
    pub timeout: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpRemoteConfig {
    pub r#type: String,
    pub url: String,
    pub headers: Option<std::collections::HashMap<String, String>>,
    pub oauth: Option<Value>,
    pub enabled: Option<bool>,
    pub timeout: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum McpServerConfig {
    Local(McpLocalConfig),
    Remote(McpRemoteConfig),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpToolResult {
    pub content: Vec<Value>,
    pub structured_content: Option<Value>,
    pub is_error: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpToolDefinition {
    pub name: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub input_schema: Option<Value>,
    pub output_schema: Option<Value>,
    pub annotations: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct RecordedSession {
    pub id: String,
    pub opencode_session_id: String,
    pub title: String,
    pub source: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordedMessage {
    pub id: String,
    pub opencode_session_id: String,
    pub role: String,
    pub content: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordedToolCall {
    pub id: String,
    pub opencode_session_id: String,
    pub message_id: String,
    pub part_id: Option<String>,
    pub sequence_index: i64,
    pub tool_kind: String,
    pub mcp_server_name: Option<String>,
    pub tool_name: String,
    pub arguments_json: Value,
    pub recorded_result_json: Option<McpToolResult>,
    pub live_result_json: Option<McpToolResult>,
    pub diff_json: Option<Value>,
    pub timing: Option<Value>,
    pub status: String,
    pub disabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordedSessionPayload {
    pub session: RecordedSession,
    pub messages: Vec<RecordedMessage>,
    pub tool_calls: Vec<RecordedToolCall>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplayRunToolCall {
    pub id: String,
    pub recorded_tool_call_id: String,
    pub status: String,
    pub started_at: Option<i64>,
    pub completed_at: Option<i64>,
    pub duration_ms: Option<i64>,
    pub live_result_json: Option<McpToolResult>,
    pub diff_json: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplayRun {
    pub id: String,
    pub recorded_session_id: String,
    pub mode: String,
    pub created_at: i64,
    pub completed_at: Option<i64>,
    pub summary: Option<Value>,
    pub tool_calls: Vec<ReplayRunToolCall>,
}
