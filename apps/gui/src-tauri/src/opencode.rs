use std::collections::HashMap;
use std::time::Duration;

use futures::StreamExt;
use reqwest::{Client, Url};
use reqwest_eventsource::{Event, EventSource};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, State};
use tokio::time::sleep;

use crate::state::{AppState, EventStreamHandle};
use crate::types::{
    McpServerConfig, OpenCodeMessageWithParts, OpenCodeSession, ServerConfig,
};

#[derive(Debug, Serialize, Deserialize)]
pub struct HealthResponse {
    pub healthy: bool,
    pub version: String,
}

fn build_client(config: &ServerConfig) -> Result<(Client, Url), String> {
    let base_url = Url::parse(&config.base_url).map_err(|error| error.to_string())?;
    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| error.to_string())?;
    Ok((client, base_url))
}

fn apply_auth(config: &ServerConfig, request: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
    match (&config.username, &config.password) {
        (_, Some(password)) => request.basic_auth(
            config.username.clone().unwrap_or_else(|| "opencode".to_string()),
            Some(password.clone()),
        ),
        _ => request,
    }
}

async fn opencode_get(
    config: &ServerConfig,
    path: &str,
    query: Option<Vec<(&str, String)>>,
) -> Result<Value, String> {
    let (client, base_url) = build_client(config)?;
    let url = base_url.join(path).map_err(|error| error.to_string())?;
    let mut request = client.get(url);
    if let Some(query) = query {
        request = request.query(&query);
    }
    let response = apply_auth(config, request)
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?;
    response
        .json::<Value>()
        .await
        .map_err(|error| error.to_string())
}

async fn opencode_post(
    config: &ServerConfig,
    path: &str,
    body: Value,
    query: Option<Vec<(&str, String)>>,
) -> Result<Value, String> {
    let (client, base_url) = build_client(config)?;
    let url = base_url.join(path).map_err(|error| error.to_string())?;
    let mut request = client.post(url).json(&body);
    if let Some(query) = query {
        request = request.query(&query);
    }
    let response = apply_auth(config, request)
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?;
    response
        .json::<Value>()
        .await
        .map_err(|error| error.to_string())
}

fn session_query(config: &ServerConfig) -> Option<Vec<(&str, String)>> {
    config
        .directory
        .as_ref()
        .map(|directory| vec![("directory", directory.clone())])
}

#[tauri::command]
pub async fn get_server_config(state: State<'_, AppState>) -> Result<Option<ServerConfig>, String> {
    Ok(state.server_config.read().await.clone())
}

#[tauri::command]
pub async fn set_server_config(
    state: State<'_, AppState>,
    config: ServerConfig,
) -> Result<ServerConfig, String> {
    *state.server_config.write().await = Some(config.clone());
    Ok(config)
}

#[tauri::command]
pub async fn opencode_health(state: State<'_, AppState>) -> Result<HealthResponse, String> {
    let config = state
        .server_config
        .read()
        .await
        .clone()
        .ok_or_else(|| "Server config missing".to_string())?;
    let response = opencode_get(&config, "/global/health", session_query(&config)).await?;
    Ok(serde_json::from_value(response).map_err(|error| error.to_string())?)
}

#[tauri::command]
pub async fn opencode_list_sessions(
    state: State<'_, AppState>,
) -> Result<Vec<OpenCodeSession>, String> {
    let config = state
        .server_config
        .read()
        .await
        .clone()
        .ok_or_else(|| "Server config missing".to_string())?;
    let response = opencode_get(&config, "/session", session_query(&config)).await?;
    serde_json::from_value(response).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn opencode_create_session(
    state: State<'_, AppState>,
    title: Option<String>,
) -> Result<OpenCodeSession, String> {
    let config = state
        .server_config
        .read()
        .await
        .clone()
        .ok_or_else(|| "Server config missing".to_string())?;
    let mut body = json!({});
    if let Some(title) = title {
        body["title"] = Value::String(title);
    }
    let response = opencode_post(&config, "/session", body, session_query(&config)).await?;
    serde_json::from_value(response).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn opencode_list_session_messages(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<Vec<OpenCodeMessageWithParts>, String> {
    let config = state
        .server_config
        .read()
        .await
        .clone()
        .ok_or_else(|| "Server config missing".to_string())?;
    let path = format!("/session/{}/message", session_id);
    let response = opencode_get(&config, &path, session_query(&config)).await?;
    serde_json::from_value(response).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn opencode_send_message(
    state: State<'_, AppState>,
    session_id: String,
    text: String,
) -> Result<OpenCodeMessageWithParts, String> {
    let config = state
        .server_config
        .read()
        .await
        .clone()
        .ok_or_else(|| "Server config missing".to_string())?;
    let path = format!("/session/{}/message", session_id);
    let body = json!({
        "parts": [{ "type": "text", "text": text }]
    });
    let response = opencode_post(&config, &path, body, session_query(&config)).await?;
    serde_json::from_value(response).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn opencode_get_mcp(
    state: State<'_, AppState>,
) -> Result<HashMap<String, McpServerConfig>, String> {
    let config = state
        .server_config
        .read()
        .await
        .clone()
        .ok_or_else(|| "Server config missing".to_string())?;
    let response = opencode_get(&config, "/config", session_query(&config)).await?;
    let mcp = response
        .get("mcp")
        .cloned()
        .unwrap_or_else(|| Value::Object(serde_json::Map::new()));
    serde_json::from_value(mcp).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn opencode_start_event_stream(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let config = state
        .server_config
        .read()
        .await
        .clone()
        .ok_or_else(|| "Server config missing".to_string())?;
    let mut guard = state.event_stream.lock().await;
    if guard.is_some() {
        return Ok(());
    }

    let (client, base_url) = build_client(&config)?;
    let url = base_url
        .join("/global/event")
        .map_err(|error| error.to_string())?;
    let cancel = tokio_util::sync::CancellationToken::new();
    let cancel_token = cancel.clone();

    let task = tauri::async_runtime::spawn(async move {
        let mut backoff = 1u64;
        let mut last_event_id: Option<String> = None;
        loop {
            if cancel_token.is_cancelled() {
                break;
            }
            let mut request = apply_auth(
                &config,
                client.get(url.clone()).header("Accept", "text/event-stream"),
            );
            if let Some(event_id) = &last_event_id {
                request = request.header("Last-Event-ID", event_id);
            }

            let mut stream = match EventSource::new(request) {
                Ok(stream) => stream,
                Err(_) => {
                    backoff = (backoff * 2).min(30);
                    sleep(Duration::from_secs(backoff)).await;
                    continue;
                }
            };
            while let Some(message) = stream.next().await {
                if cancel_token.is_cancelled() {
                    stream.close();
                    break;
                }
                match message {
                    Ok(Event::Message(event)) => {
                        if !event.id.is_empty() {
                            last_event_id = Some(event.id.clone());
                        }
                        let payload: Value = serde_json::from_str(&event.data)
                            .unwrap_or_else(|_| Value::String(event.data));
                        let _ = app_handle.emit("opencode:event", payload);
                    }
                    Ok(Event::Open) => {
                        backoff = 1;
                    }
                    Err(_) => {
                        break;
                    }
                }
            }
            if cancel_token.is_cancelled() {
                break;
            }
            backoff = (backoff * 2).min(30);
            sleep(Duration::from_secs(backoff)).await;
        }
    });

    *guard = Some(EventStreamHandle { cancel, task });
    Ok(())
}

#[tauri::command]
pub async fn opencode_stop_event_stream(state: State<'_, AppState>) -> Result<(), String> {
    let mut guard = state.event_stream.lock().await;
    if let Some(handle) = guard.take() {
        handle.cancel.cancel();
        handle.task.abort();
    }
    Ok(())
}
