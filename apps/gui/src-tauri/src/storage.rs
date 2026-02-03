use sqlx::{
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    QueryBuilder, SqlitePool,
};
use serde::de::DeserializeOwned;
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

use crate::state::AppState;
use crate::types::{
    McpToolResult, PagedSessions, RecordedMessage, RecordedSession,
    RecordedSessionDuplicateRequest, RecordedSessionPayload, RecordedToolCall,
    RecordedToolCallRequestUpdate, ReplayRun, ReplayRunToolCall, SessionListParams,
    SessionSuite, Suite,
};

#[derive(Clone)]
pub struct Storage {
    pool: SqlitePool,
}

#[derive(sqlx::FromRow)]
struct RecordedMessageRow {
    id: String,
    opencode_session_id: String,
    role: String,
    content: String,
    created_at: i64,
}

#[derive(sqlx::FromRow)]
struct RecordedToolCallRow {
    id: String,
    opencode_session_id: String,
    message_id: String,
    part_id: Option<String>,
    sequence_index: i64,
    tool_kind: String,
    mcp_server_name: Option<String>,
    tool_name: String,
    arguments_json: String,
    recorded_result_json: Option<String>,
    live_result_json: Option<String>,
    diff_json: Option<String>,
    timing_json: Option<String>,
    status: String,
    disabled: i64,
}

#[derive(sqlx::FromRow)]
struct RecordedToolCallUpdateRow {
    tool_kind: String,
    status: String,
    disabled: i64,
}

impl Storage {
    pub async fn new(app_handle: &AppHandle) -> Result<Self, String> {
        let base_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|error| error.to_string())?;
        let db_dir = base_dir.join("opencode-replay");
        std::fs::create_dir_all(&db_dir).map_err(|error| error.to_string())?;
        let db_path = db_dir.join("library.sqlite");
        let connect_options = SqliteConnectOptions::new()
            .filename(&db_path)
            .create_if_missing(true);

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(connect_options)
            .await
            .map_err(|error| error.to_string())?;

        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .map_err(|error| error.to_string())?;

        Ok(Self { pool })
    }

    pub async fn list_sessions(&self) -> Result<Vec<RecordedSession>, String> {
        let sessions = sqlx::query_as::<_, RecordedSession>(
            r#"
            SELECT id, opencode_session_id, title, source, created_at, updated_at
            FROM recorded_sessions
            ORDER BY updated_at DESC
            "#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|error| error.to_string())?;

        Ok(sessions)
    }

    pub async fn list_sessions_page(
        &self,
        params: SessionListParams,
    ) -> Result<PagedSessions, String> {
        let SessionListParams {
            limit,
            offset,
            search,
            suite_id,
        } = params;

        if limit < 0 {
            return Err("Limit must be non-negative".to_string());
        }
        if offset < 0 {
            return Err("Offset must be non-negative".to_string());
        }

        let search_pattern = search
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(|value| format!("%{}%", value.to_lowercase()));
        let suite_id = suite_id.as_deref();

        let mut builder = QueryBuilder::<sqlx::Sqlite>::new(
            "SELECT recorded_sessions.id, recorded_sessions.opencode_session_id, \
             recorded_sessions.title, recorded_sessions.source, recorded_sessions.created_at, \
             recorded_sessions.updated_at FROM recorded_sessions",
        );
        if suite_id.is_some() {
            builder.push(" INNER JOIN session_tags ON session_tags.session_id = recorded_sessions.id");
        }
        builder.push(" WHERE 1=1");
        if let Some(suite_id) = suite_id {
            builder.push(" AND session_tags.tag_id = ");
            builder.push_bind(suite_id);
        }
        if let Some(pattern) = &search_pattern {
            builder.push(" AND (LOWER(recorded_sessions.title) LIKE ");
            builder.push_bind(pattern);
            builder.push(" OR LOWER(recorded_sessions.source) LIKE ");
            builder.push_bind(pattern);
            builder.push(")");
        }
        builder.push(" ORDER BY recorded_sessions.updated_at DESC LIMIT ");
        builder.push_bind(limit);
        builder.push(" OFFSET ");
        builder.push_bind(offset);

        let items = builder
            .build_query_as::<RecordedSession>()
            .fetch_all(&self.pool)
            .await
            .map_err(|error| error.to_string())?;

        let mut count_builder = QueryBuilder::<sqlx::Sqlite>::new(
            "SELECT COUNT(*) FROM recorded_sessions",
        );
        if suite_id.is_some() {
            count_builder
                .push(" INNER JOIN session_tags ON session_tags.session_id = recorded_sessions.id");
        }
        count_builder.push(" WHERE 1=1");
        if let Some(suite_id) = suite_id {
            count_builder.push(" AND session_tags.tag_id = ");
            count_builder.push_bind(suite_id);
        }
        if let Some(pattern) = &search_pattern {
            count_builder.push(" AND (LOWER(recorded_sessions.title) LIKE ");
            count_builder.push_bind(pattern);
            count_builder.push(" OR LOWER(recorded_sessions.source) LIKE ");
            count_builder.push_bind(pattern);
            count_builder.push(")");
        }

        let total = count_builder
            .build_query_scalar::<i64>()
            .fetch_one(&self.pool)
            .await
            .map_err(|error| error.to_string())?;

        Ok(PagedSessions { items, total })
    }

    pub async fn list_suites(&self) -> Result<Vec<Suite>, String> {
        let suites = sqlx::query_as::<_, Suite>(
            r#"
            SELECT id, name, created_at
            FROM tags
            ORDER BY name ASC
            "#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|error| error.to_string())?;

        Ok(suites)
    }

    pub async fn create_suite(&self, name: String) -> Result<Suite, String> {
        let trimmed = name.trim();
        if trimmed.is_empty() {
            return Err("Suite name cannot be empty".to_string());
        }

        let suite = Suite {
            id: Uuid::new_v4().to_string(),
            name: trimmed.to_string(),
            created_at: current_timestamp_ms()?,
        };

        sqlx::query(
            r#"
            INSERT INTO tags (id, name, created_at)
            VALUES (?1, ?2, ?3)
            "#,
        )
        .bind(&suite.id)
        .bind(&suite.name)
        .bind(suite.created_at)
        .execute(&self.pool)
        .await
        .map_err(|error| error.to_string())?;

        Ok(suite)
    }

    pub async fn delete_suite(&self, suite_id: String) -> Result<(), String> {
        let mut transaction = self
            .pool
            .begin()
            .await
            .map_err(|error| error.to_string())?;

        sqlx::query(
            r#"
            DELETE FROM session_tags
            WHERE tag_id = ?1
            "#,
        )
        .bind(&suite_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;

        let result = sqlx::query(
            r#"
            DELETE FROM tags
            WHERE id = ?1
            "#,
        )
        .bind(&suite_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;

        if result.rows_affected() == 0 {
            return Err("Suite not found".to_string());
        }

        transaction
            .commit()
            .await
            .map_err(|error| error.to_string())?;

        Ok(())
    }

    pub async fn assign_suite(&self, session_id: String, suite_id: String) -> Result<(), String> {
        sqlx::query(
            r#"
            INSERT INTO session_tags (session_id, tag_id)
            VALUES (?1, ?2)
            ON CONFLICT(session_id, tag_id) DO NOTHING
            "#,
        )
        .bind(&session_id)
        .bind(&suite_id)
        .execute(&self.pool)
        .await
        .map_err(|error| error.to_string())?;

        Ok(())
    }

    pub async fn unassign_suite(
        &self,
        session_id: String,
        suite_id: String,
    ) -> Result<(), String> {
        sqlx::query(
            r#"
            DELETE FROM session_tags
            WHERE session_id = ?1 AND tag_id = ?2
            "#,
        )
        .bind(&session_id)
        .bind(&suite_id)
        .execute(&self.pool)
        .await
        .map_err(|error| error.to_string())?;

        Ok(())
    }

    pub async fn list_session_suites(
        &self,
        session_ids: Vec<String>,
    ) -> Result<Vec<SessionSuite>, String> {
        if session_ids.is_empty() {
            return Ok(Vec::new());
        }

        let mut builder = QueryBuilder::<sqlx::Sqlite>::new(
            "SELECT session_id, tag_id as suite_id FROM session_tags WHERE session_id IN (",
        );
        {
            let mut separated = builder.separated(", ");
            for session_id in session_ids {
                separated.push_bind(session_id);
            }
        }
        builder.push(") ORDER BY session_id");

        let suites = builder
            .build_query_as::<SessionSuite>()
            .fetch_all(&self.pool)
            .await
            .map_err(|error| error.to_string())?;

        Ok(suites)
    }

    pub async fn get_session_payload(
        &self,
        session_id: String,
    ) -> Result<RecordedSessionPayload, String> {
        let session = sqlx::query_as::<_, RecordedSession>(
            r#"
            SELECT id, opencode_session_id, title, source, created_at, updated_at
            FROM recorded_sessions
            WHERE id = ?1
            "#,
        )
        .bind(&session_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "Recorded session not found".to_string())?;

        let message_rows = sqlx::query_as::<_, RecordedMessageRow>(
            r#"
            SELECT id, opencode_session_id, role, content, created_at
            FROM recorded_messages
            WHERE recorded_session_id = ?1
            ORDER BY created_at ASC
            "#,
        )
        .bind(&session_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|error| error.to_string())?;

        let messages = message_rows
            .into_iter()
            .map(|row| RecordedMessage {
                id: row.id,
                opencode_session_id: row.opencode_session_id,
                role: row.role,
                content: row.content,
                created_at: row.created_at,
            })
            .collect();

        let tool_call_rows = sqlx::query_as::<_, RecordedToolCallRow>(
            r#"
            SELECT
              id,
              opencode_session_id,
              message_id,
              part_id,
              sequence_index,
              tool_kind,
              mcp_server_name,
              tool_name,
              arguments_json,
              recorded_result_json,
              live_result_json,
              diff_json,
              timing_json,
              status,
              disabled
            FROM recorded_tool_calls
            WHERE recorded_session_id = ?1
            ORDER BY sequence_index ASC
            "#,
        )
        .bind(&session_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|error| error.to_string())?;

        let tool_calls = tool_call_rows
            .into_iter()
            .map(|row| {
                let arguments_json = parse_json_required(row.arguments_json)?;
                let recorded_result_json = parse_json_optional(row.recorded_result_json)?;
                let live_result_json = parse_json_optional(row.live_result_json)?;
                let diff_json = parse_json_optional(row.diff_json)?;
                let timing = parse_json_optional(row.timing_json)?;

                Ok(RecordedToolCall {
                    id: row.id,
                    opencode_session_id: row.opencode_session_id,
                    message_id: row.message_id,
                    part_id: row.part_id,
                    sequence_index: row.sequence_index,
                    tool_kind: row.tool_kind,
                    mcp_server_name: row.mcp_server_name,
                    tool_name: row.tool_name,
                    arguments_json,
                    recorded_result_json,
                    live_result_json,
                    diff_json,
                    timing,
                    status: row.status,
                    disabled: Some(row.disabled != 0),
                })
            })
            .collect::<Result<Vec<_>, String>>()?;

        Ok(RecordedSessionPayload {
            session,
            messages,
            tool_calls,
        })
    }

    pub async fn save_session(
        &self,
        payload: RecordedSessionPayload,
    ) -> Result<RecordedSession, String> {
        let mut transaction = self
            .pool
            .begin()
            .await
            .map_err(|error| error.to_string())?;

        sqlx::query(
            r#"
            INSERT INTO recorded_sessions (id, opencode_session_id, title, source, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ON CONFLICT(opencode_session_id) DO UPDATE SET
              title = excluded.title,
              source = excluded.source,
              updated_at = excluded.updated_at
            "#,
        )
        .bind(&payload.session.id)
        .bind(&payload.session.opencode_session_id)
        .bind(&payload.session.title)
        .bind(&payload.session.source)
        .bind(payload.session.created_at)
        .bind(payload.session.updated_at)
        .execute(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;

        for message in payload.messages {
            sqlx::query(
                r#"
                INSERT INTO recorded_messages (id, recorded_session_id, opencode_session_id, role, content, created_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                ON CONFLICT(id) DO UPDATE SET
                  role = excluded.role,
                  content = excluded.content,
                  created_at = excluded.created_at
                "#,
            )
            .bind(&message.id)
            .bind(&payload.session.id)
            .bind(&message.opencode_session_id)
            .bind(&message.role)
            .bind(&message.content)
            .bind(message.created_at)
            .execute(&mut *transaction)
            .await
            .map_err(|error| error.to_string())?;
        }

        for tool_call in payload.tool_calls {
            let arguments_json = serde_json::to_string(&tool_call.arguments_json)
                .map_err(|error| error.to_string())?;
            let recorded_result_json = serialize_json(&tool_call.recorded_result_json)?;
            let live_result_json = serialize_json(&tool_call.live_result_json)?;
            let diff_json = serialize_json(&tool_call.diff_json)?;
            let timing_json = serialize_json(&tool_call.timing)?;

            sqlx::query(
                r#"
                INSERT INTO recorded_tool_calls (
                  id,
                  recorded_session_id,
                  opencode_session_id,
                  message_id,
                  part_id,
                  sequence_index,
                  tool_kind,
                  mcp_server_name,
                  tool_name,
                  arguments_json,
                  recorded_result_json,
                  live_result_json,
                  diff_json,
                  timing_json,
                  status,
                  disabled
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
                ON CONFLICT(id) DO UPDATE SET
                  sequence_index = excluded.sequence_index,
                  tool_kind = excluded.tool_kind,
                  mcp_server_name = excluded.mcp_server_name,
                  tool_name = excluded.tool_name,
                  arguments_json = excluded.arguments_json,
                  recorded_result_json = excluded.recorded_result_json,
                  live_result_json = excluded.live_result_json,
                  diff_json = excluded.diff_json,
                  timing_json = excluded.timing_json,
                  status = excluded.status,
                  disabled = excluded.disabled
                "#,
            )
            .bind(&tool_call.id)
            .bind(&payload.session.id)
            .bind(&tool_call.opencode_session_id)
            .bind(&tool_call.message_id)
            .bind(&tool_call.part_id)
            .bind(tool_call.sequence_index)
            .bind(&tool_call.tool_kind)
            .bind(&tool_call.mcp_server_name)
            .bind(&tool_call.tool_name)
            .bind(arguments_json)
            .bind(recorded_result_json)
            .bind(live_result_json)
            .bind(diff_json)
            .bind(timing_json)
            .bind(&tool_call.status)
            .bind(tool_call.disabled.unwrap_or(false))
            .execute(&mut *transaction)
            .await
            .map_err(|error| error.to_string())?;
        }

        transaction
            .commit()
            .await
            .map_err(|error| error.to_string())?;

        Ok(payload.session)
    }

    pub async fn duplicate_session(
        &self,
        request: RecordedSessionDuplicateRequest,
    ) -> Result<RecordedSession, String> {
        let mut transaction = self
            .pool
            .begin()
            .await
            .map_err(|error| error.to_string())?;

        let source = sqlx::query_as::<_, RecordedSession>(
            r#"
            SELECT id, opencode_session_id, title, source, created_at, updated_at
            FROM recorded_sessions
            WHERE id = ?1
            "#,
        )
        .bind(&request.session_id)
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "Recorded session not found".to_string())?;

        let created_at = current_timestamp_ms()?;
        let title = match request.title {
            Some(title) => title,
            None => format!("{} (copy)", source.title),
        };

        let new_session = RecordedSession {
            id: Uuid::new_v4().to_string(),
            opencode_session_id: Uuid::new_v4().to_string(),
            title,
            source: source.source,
            created_at,
            updated_at: created_at,
        };

        sqlx::query(
            r#"
            INSERT INTO recorded_sessions (id, opencode_session_id, title, source, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            "#,
        )
        .bind(&new_session.id)
        .bind(&new_session.opencode_session_id)
        .bind(&new_session.title)
        .bind(&new_session.source)
        .bind(new_session.created_at)
        .bind(new_session.updated_at)
        .execute(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;

        sqlx::query(
            r#"
            INSERT INTO session_tags (session_id, tag_id)
            SELECT ?1, tag_id
            FROM session_tags
            WHERE session_id = ?2
            "#,
        )
        .bind(&new_session.id)
        .bind(&request.session_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;

        let message_rows = sqlx::query_as::<_, RecordedMessageRow>(
            r#"
            SELECT id, opencode_session_id, role, content, created_at
            FROM recorded_messages
            WHERE recorded_session_id = ?1
            ORDER BY created_at ASC
            "#,
        )
        .bind(&request.session_id)
        .fetch_all(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;

        let mut message_id_map = HashMap::new();
        for row in message_rows {
            let RecordedMessageRow {
                id,
                role,
                content,
                created_at,
                ..
            } = row;
            let new_message_id = Uuid::new_v4().to_string();
            message_id_map.insert(id, new_message_id.clone());

            sqlx::query(
                r#"
                INSERT INTO recorded_messages (id, recorded_session_id, opencode_session_id, role, content, created_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                "#,
            )
            .bind(&new_message_id)
            .bind(&new_session.id)
            .bind(&new_session.opencode_session_id)
            .bind(&role)
            .bind(&content)
            .bind(created_at)
            .execute(&mut *transaction)
            .await
            .map_err(|error| error.to_string())?;
        }

        let tool_call_rows = sqlx::query_as::<_, RecordedToolCallRow>(
            r#"
            SELECT
              id,
              opencode_session_id,
              message_id,
              part_id,
              sequence_index,
              tool_kind,
              mcp_server_name,
              tool_name,
              arguments_json,
              recorded_result_json,
              live_result_json,
              diff_json,
              timing_json,
              status,
              disabled
            FROM recorded_tool_calls
            WHERE recorded_session_id = ?1
            ORDER BY sequence_index ASC
            "#,
        )
        .bind(&request.session_id)
        .fetch_all(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;

        for row in tool_call_rows {
            let RecordedToolCallRow {
                id: _old_tool_call_id,
                message_id,
                part_id,
                sequence_index,
                tool_kind,
                mcp_server_name,
                tool_name,
                arguments_json,
                recorded_result_json,
                live_result_json,
                diff_json,
                timing_json,
                status,
                disabled,
                ..
            } = row;

            let new_message_id = message_id_map
                .get(&message_id)
                .cloned()
                .unwrap_or(message_id);

            let arguments_json_value: serde_json::Value = parse_json_required(arguments_json)?;
            let recorded_result_value: Option<McpToolResult> =
                parse_json_optional(recorded_result_json)?;
            let live_result_value: Option<McpToolResult> = parse_json_optional(live_result_json)?;
            let diff_value: Option<serde_json::Value> = parse_json_optional(diff_json)?;
            let timing_value: Option<serde_json::Value> = parse_json_optional(timing_json)?;

            let arguments_json = serde_json::to_string(&arguments_json_value)
                .map_err(|error| error.to_string())?;
            let recorded_result_json = serialize_json(&recorded_result_value)?;
            let live_result_json = serialize_json(&live_result_value)?;
            let diff_json = serialize_json(&diff_value)?;
            let timing_json = serialize_json(&timing_value)?;
            let new_tool_call_id = Uuid::new_v4().to_string();

            sqlx::query(
                r#"
                INSERT INTO recorded_tool_calls (
                  id,
                  recorded_session_id,
                  opencode_session_id,
                  message_id,
                  part_id,
                  sequence_index,
                  tool_kind,
                  mcp_server_name,
                  tool_name,
                  arguments_json,
                  recorded_result_json,
                  live_result_json,
                  diff_json,
                  timing_json,
                  status,
                  disabled
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
                "#,
            )
            .bind(&new_tool_call_id)
            .bind(&new_session.id)
            .bind(&new_session.opencode_session_id)
            .bind(&new_message_id)
            .bind(&part_id)
            .bind(sequence_index)
            .bind(&tool_kind)
            .bind(&mcp_server_name)
            .bind(&tool_name)
            .bind(arguments_json)
            .bind(recorded_result_json)
            .bind(live_result_json)
            .bind(diff_json)
            .bind(timing_json)
            .bind(&status)
            .bind(disabled != 0)
            .execute(&mut *transaction)
            .await
            .map_err(|error| error.to_string())?;
        }

        transaction
            .commit()
            .await
            .map_err(|error| error.to_string())?;

        Ok(new_session)
    }

    pub async fn delete_session(&self, session_id: String) -> Result<(), String> {
        let mut transaction = self
            .pool
            .begin()
            .await
            .map_err(|error| error.to_string())?;

        sqlx::query(
            r#"
            DELETE FROM session_tags
            WHERE session_id = ?1
            "#,
        )
        .bind(&session_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;

        sqlx::query(
            r#"
            DELETE FROM recorded_messages
            WHERE recorded_session_id = ?1
            "#,
        )
        .bind(&session_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;

        sqlx::query(
            r#"
            DELETE FROM recorded_tool_calls
            WHERE recorded_session_id = ?1
            "#,
        )
        .bind(&session_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;

        sqlx::query(
            r#"
            DELETE FROM replay_run_tool_calls
            WHERE replay_run_id IN (
              SELECT id
              FROM replay_runs
              WHERE recorded_session_id = ?1
            )
            "#,
        )
        .bind(&session_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;

        sqlx::query(
            r#"
            DELETE FROM replay_runs
            WHERE recorded_session_id = ?1
            "#,
        )
        .bind(&session_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;

        let result = sqlx::query(
            r#"
            DELETE FROM recorded_sessions
            WHERE id = ?1
            "#,
        )
        .bind(&session_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;

        if result.rows_affected() == 0 {
            return Err("Recorded session not found".to_string());
        }

        transaction
            .commit()
            .await
            .map_err(|error| error.to_string())?;

        Ok(())
    }

    pub async fn replace_session_tool_calls(
        &self,
        session_id: String,
        tool_calls: Vec<RecordedToolCall>,
    ) -> Result<(), String> {
        let mut transaction = self
            .pool
            .begin()
            .await
            .map_err(|error| error.to_string())?;

        let session = sqlx::query_as::<_, RecordedSession>(
            r#"
            SELECT id, opencode_session_id, title, source, created_at, updated_at
            FROM recorded_sessions
            WHERE id = ?1
            "#,
        )
        .bind(&session_id)
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "Recorded session not found".to_string())?;

        sqlx::query(
            r#"
            UPDATE recorded_sessions
            SET updated_at = ?1
            WHERE id = ?2
            "#,
        )
        .bind(current_timestamp_ms()?)
        .bind(&session_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;

        sqlx::query(
            r#"
            DELETE FROM recorded_tool_calls
            WHERE recorded_session_id = ?1
            "#,
        )
        .bind(&session_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;

        for (index, tool_call) in tool_calls.into_iter().enumerate() {
            let sequence_index = i64::try_from(index).map_err(|error| error.to_string())?;
            let arguments_json = serde_json::to_string(&tool_call.arguments_json)
                .map_err(|error| error.to_string())?;
            let recorded_result_json = serialize_json(&tool_call.recorded_result_json)?;
            let live_result_json = serialize_json(&tool_call.live_result_json)?;
            let diff_json = serialize_json(&tool_call.diff_json)?;
            let timing_json = serialize_json(&tool_call.timing)?;

            sqlx::query(
                r#"
                INSERT INTO recorded_tool_calls (
                  id,
                  recorded_session_id,
                  opencode_session_id,
                  message_id,
                  part_id,
                  sequence_index,
                  tool_kind,
                  mcp_server_name,
                  tool_name,
                  arguments_json,
                  recorded_result_json,
                  live_result_json,
                  diff_json,
                  timing_json,
                  status,
                  disabled
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
                "#,
            )
            .bind(&tool_call.id)
            .bind(&session_id)
            .bind(&session.opencode_session_id)
            .bind(&tool_call.message_id)
            .bind(&tool_call.part_id)
            .bind(sequence_index)
            .bind(&tool_call.tool_kind)
            .bind(&tool_call.mcp_server_name)
            .bind(&tool_call.tool_name)
            .bind(arguments_json)
            .bind(recorded_result_json)
            .bind(live_result_json)
            .bind(diff_json)
            .bind(timing_json)
            .bind(&tool_call.status)
            .bind(tool_call.disabled.unwrap_or(false))
            .execute(&mut *transaction)
            .await
            .map_err(|error| error.to_string())?;
        }

        transaction
            .commit()
            .await
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    pub async fn update_tool_call_request(
        &self,
        update: RecordedToolCallRequestUpdate,
    ) -> Result<(), String> {
        let RecordedToolCallRequestUpdate {
            session_id,
            tool_call_id,
            mcp_server_name,
            tool_name,
            arguments_json,
            status,
            disabled,
        } = update;

        let mut transaction = self
            .pool
            .begin()
            .await
            .map_err(|error| error.to_string())?;

        let existing = sqlx::query_as::<_, RecordedToolCallUpdateRow>(
            r#"
            SELECT tool_kind, status, disabled
            FROM recorded_tool_calls
            WHERE id = ?1 AND recorded_session_id = ?2
            "#,
        )
        .bind(&tool_call_id)
        .bind(&session_id)
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "Recorded tool call not found".to_string())?;

        if existing.tool_kind != "mcp" {
            return Err("Tool call is not an MCP request".to_string());
        }

        let arguments_json = serde_json::to_string(&arguments_json)
            .map_err(|error| error.to_string())?;
        let status = status.unwrap_or(existing.status);
        let disabled = disabled.unwrap_or(existing.disabled != 0);

        sqlx::query(
            r#"
            UPDATE recorded_tool_calls
            SET mcp_server_name = ?1,
                tool_name = ?2,
                arguments_json = ?3,
                status = ?4,
                disabled = ?5
            WHERE id = ?6 AND recorded_session_id = ?7
            "#,
        )
        .bind(&mcp_server_name)
        .bind(&tool_name)
        .bind(arguments_json)
        .bind(status)
        .bind(disabled)
        .bind(&tool_call_id)
        .bind(&session_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;

        sqlx::query(
            r#"
            UPDATE recorded_sessions
            SET updated_at = ?1
            WHERE id = ?2
            "#,
        )
        .bind(current_timestamp_ms()?)
        .bind(&session_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;

        transaction
            .commit()
            .await
            .map_err(|error| error.to_string())?;

        Ok(())
    }

    pub async fn save_replay_run(&self, run: ReplayRun) -> Result<(), String> {
        let mut transaction = self
            .pool
            .begin()
            .await
            .map_err(|error| error.to_string())?;

        sqlx::query(
            r#"
            INSERT INTO replay_runs (id, recorded_session_id, mode, created_at, completed_at, summary)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ON CONFLICT(id) DO UPDATE SET
              mode = excluded.mode,
              completed_at = excluded.completed_at,
              summary = excluded.summary
            "#,
        )
        .bind(&run.id)
        .bind(&run.recorded_session_id)
        .bind(&run.mode)
        .bind(run.created_at)
        .bind(run.completed_at)
        .bind(serialize_json(&run.summary)?)
        .execute(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;

        for tool_call in run.tool_calls {
            insert_replay_tool_call(&mut transaction, &run.id, &tool_call).await?;
        }

        transaction
            .commit()
            .await
            .map_err(|error| error.to_string())?;
        Ok(())
    }
}

fn serialize_json<T: serde::Serialize>(value: &Option<T>) -> Result<Option<String>, String> {
    match value {
        Some(inner) => Ok(Some(
            serde_json::to_string(inner).map_err(|error| error.to_string())?,
        )),
        None => Ok(None),
    }
}

fn parse_json_required<T: DeserializeOwned>(value: String) -> Result<T, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err("Expected JSON value, found empty string".to_string());
    }
    serde_json::from_str(trimmed).map_err(|error| error.to_string())
}

fn parse_json_optional<T: DeserializeOwned>(value: Option<String>) -> Result<Option<T>, String> {
    match value {
        Some(inner) => {
            let trimmed = inner.trim();
            if trimmed.is_empty() || trimmed == "null" {
                return Ok(None);
            }
            serde_json::from_str(trimmed)
                .map(Some)
                .map_err(|error| error.to_string())
        }
        None => Ok(None),
    }
}

fn current_timestamp_ms() -> Result<i64, String> {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?;
    i64::try_from(duration.as_millis()).map_err(|error| error.to_string())
}

async fn insert_replay_tool_call(
    transaction: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    run_id: &str,
    tool_call: &ReplayRunToolCall,
) -> Result<(), String> {
    sqlx::query(
        r#"
        INSERT INTO replay_run_tool_calls (
          id,
          replay_run_id,
          recorded_tool_call_id,
          status,
          started_at,
          completed_at,
          duration_ms,
          live_result_json,
          diff_json
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          completed_at = excluded.completed_at,
          duration_ms = excluded.duration_ms,
          live_result_json = excluded.live_result_json,
          diff_json = excluded.diff_json
        "#,
    )
    .bind(&tool_call.id)
    .bind(run_id)
    .bind(&tool_call.recorded_tool_call_id)
    .bind(&tool_call.status)
    .bind(tool_call.started_at)
    .bind(tool_call.completed_at)
    .bind(tool_call.duration_ms)
    .bind(serialize_json(&tool_call.live_result_json)?)
    .bind(serialize_json(&tool_call.diff_json)?)
    .execute(&mut **transaction)
    .await
    .map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn storage_list_sessions(
    state: State<'_, AppState>,
) -> Result<Vec<RecordedSession>, String> {
    state.storage.list_sessions().await
}

#[tauri::command]
pub async fn storage_list_sessions_page(
    state: State<'_, AppState>,
    params: SessionListParams,
) -> Result<PagedSessions, String> {
    state.storage.list_sessions_page(params).await
}

#[tauri::command]
pub async fn storage_list_suites(state: State<'_, AppState>) -> Result<Vec<Suite>, String> {
    state.storage.list_suites().await
}

#[tauri::command]
pub async fn storage_create_suite(
    state: State<'_, AppState>,
    name: String,
) -> Result<Suite, String> {
    state.storage.create_suite(name).await
}

#[tauri::command]
pub async fn storage_delete_suite(
    state: State<'_, AppState>,
    suite_id: String,
) -> Result<(), String> {
    state.storage.delete_suite(suite_id).await
}

#[tauri::command]
pub async fn storage_assign_suite(
    state: State<'_, AppState>,
    session_id: String,
    suite_id: String,
) -> Result<(), String> {
    state
        .storage
        .assign_suite(session_id, suite_id)
        .await
}

#[tauri::command]
pub async fn storage_unassign_suite(
    state: State<'_, AppState>,
    session_id: String,
    suite_id: String,
) -> Result<(), String> {
    state
        .storage
        .unassign_suite(session_id, suite_id)
        .await
}

#[tauri::command]
pub async fn storage_list_session_suites(
    state: State<'_, AppState>,
    session_ids: Vec<String>,
) -> Result<Vec<SessionSuite>, String> {
    state.storage.list_session_suites(session_ids).await
}

#[tauri::command]
pub async fn storage_get_session_payload(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<RecordedSessionPayload, String> {
    state.storage.get_session_payload(session_id).await
}

#[tauri::command]
pub async fn storage_save_session(
    state: State<'_, AppState>,
    payload: RecordedSessionPayload,
) -> Result<RecordedSession, String> {
    state.storage.save_session(payload).await
}

#[tauri::command]
pub async fn storage_duplicate_session(
    state: State<'_, AppState>,
    request: RecordedSessionDuplicateRequest,
) -> Result<RecordedSession, String> {
    state.storage.duplicate_session(request).await
}

#[tauri::command]
pub async fn storage_delete_session(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    state.storage.delete_session(session_id).await
}

#[tauri::command]
pub async fn storage_replace_tool_calls(
    state: State<'_, AppState>,
    session_id: String,
    tool_calls: Vec<RecordedToolCall>,
) -> Result<(), String> {
    state.storage.replace_session_tool_calls(session_id, tool_calls).await
}

#[tauri::command]
pub async fn storage_update_tool_call_request(
    state: State<'_, AppState>,
    update: RecordedToolCallRequestUpdate,
) -> Result<(), String> {
    state.storage.update_tool_call_request(update).await
}

#[tauri::command]
pub async fn storage_save_replay_run(
    state: State<'_, AppState>,
    run: ReplayRun,
) -> Result<(), String> {
    state.storage.save_replay_run(run).await
}
