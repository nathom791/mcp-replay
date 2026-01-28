use sqlx::{
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    SqlitePool,
};
use tauri::{AppHandle, Manager, State};

use crate::state::AppState;
use crate::types::{RecordedSession, RecordedSessionPayload, ReplayRun, ReplayRunToolCall};

#[derive(Clone)]
pub struct Storage {
    pool: SqlitePool,
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
pub async fn storage_save_session(
    state: State<'_, AppState>,
    payload: RecordedSessionPayload,
) -> Result<RecordedSession, String> {
    state.storage.save_session(payload).await
}

#[tauri::command]
pub async fn storage_save_replay_run(
    state: State<'_, AppState>,
    run: ReplayRun,
) -> Result<(), String> {
    state.storage.save_replay_run(run).await
}
