export type ServerConfig = {
  baseUrl: string
  username?: string
  password?: string
  directory?: string
}

export type OpenCodeSession = {
  id: string
  title: string
  time: {
    created: number
    updated: number
  }
  [key: string]: unknown
}

export type OpenCodeMessageInfo = {
  id: string
  sessionID: string
  role: "user" | "assistant"
  time: {
    created: number
    completed?: number
  }
  [key: string]: unknown
}

export type OpenCodeTextPart = {
  id: string
  sessionID: string
  messageID: string
  type: "text"
  text: string
  [key: string]: unknown
}

export type OpenCodeReasoningPart = {
  id: string
  sessionID: string
  messageID: string
  type: "reasoning"
  text: string
  [key: string]: unknown
}

export type OpenCodeFilePart = {
  id: string
  sessionID: string
  messageID: string
  type: "file"
  url: string
  mime: string
  filename?: string
  [key: string]: unknown
}

export type ToolStatePending = {
  status: "pending"
  input: Record<string, unknown>
  raw: string
}

export type ToolStateRunning = {
  status: "running"
  input: Record<string, unknown>
  title?: string
  metadata?: Record<string, unknown>
  time: {
    start: number
  }
}

export type ToolStateCompleted = {
  status: "completed"
  input: Record<string, unknown>
  output: string
  title: string
  metadata: Record<string, unknown>
  time: {
    start: number
    end: number
    compacted?: number
  }
  attachments?: OpenCodeFilePart[]
}

export type ToolStateError = {
  status: "error"
  input: Record<string, unknown>
  error: string
  metadata?: Record<string, unknown>
  time: {
    start: number
    end: number
  }
}

export type ToolState =
  | ToolStatePending
  | ToolStateRunning
  | ToolStateCompleted
  | ToolStateError

export type OpenCodeToolPart = {
  id: string
  sessionID: string
  messageID: string
  type: "tool"
  callID: string
  tool: string
  state: ToolState
  metadata?: Record<string, unknown>
}

export type OpenCodePart =
  | OpenCodeTextPart
  | OpenCodeReasoningPart
  | OpenCodeFilePart
  | OpenCodeToolPart
  | {
      id: string
      sessionID: string
      messageID: string
      type: string
      [key: string]: unknown
    }

export type OpenCodeMessageWithParts = {
  info: OpenCodeMessageInfo
  parts: OpenCodePart[]
}

export type OpenCodeEventPayload = {
  type: string
  [key: string]: unknown
}

export type OpenCodeEvent = {
  directory: string
  payload: OpenCodeEventPayload
}

export type McpLocalConfig = {
  type: "local"
  command: string[]
  environment?: Record<string, string>
  enabled?: boolean
  timeout?: number
}

export type McpRemoteConfig = {
  type: "remote"
  url: string
  headers?: Record<string, string>
  oauth?: Record<string, unknown> | false
  enabled?: boolean
  timeout?: number
}

export type McpServerConfig = McpLocalConfig | McpRemoteConfig

export type McpConfigMap = Record<string, McpServerConfig>

export type McpContentBlock = {
  type: "text" | "image" | "audio" | "resource" | "resource_link"
  text?: string
  data?: string
  mimeType?: string
  resource?: Record<string, unknown>
  uri?: string
  name?: string
  description?: string
  annotations?: Record<string, unknown>
}

export type McpToolResult = {
  content: McpContentBlock[]
  structuredContent?: unknown
  isError?: boolean
}

export type McpToolDefinition = {
  name: string
  title?: string
  description?: string
  inputSchema?: unknown
  outputSchema?: unknown
  annotations?: Record<string, unknown>
}

export type ToolTiming = {
  start?: number
  end?: number
  durationMs?: number
}

export type RecordedToolCall = {
  id: string
  opencodeSessionId: string
  messageId: string
  partId?: string
  sequenceIndex: number
  toolKind: "mcp" | "builtin" | "unknown"
  mcpServerName?: string
  toolName: string
  argumentsJson: Record<string, unknown>
  recordedResultJson?: McpToolResult
  liveResultJson?: McpToolResult
  diffJson?: unknown
  timing?: ToolTiming
  status: "pending" | "running" | "success" | "error" | "canceled"
  disabled?: boolean
}

export type RecordedMessage = {
  id: string
  opencodeSessionId: string
  role: "user" | "assistant"
  content: string
  createdAt: number
}

export type RecordedSession = {
  id: string
  opencodeSessionId: string
  title: string
  source: "live" | "import"
  createdAt: number
  updatedAt: number
}

export type Suite = {
  id: string
  name: string
  createdAt: number
}

export type SessionSuite = {
  sessionId: string
  suiteId: string
}

export type ReplayRunToolCall = {
  id: string
  recordedToolCallId: string
  status: "pending" | "running" | "success" | "error" | "skipped"
  startedAt?: number
  completedAt?: number
  durationMs?: number
  liveResultJson?: McpToolResult
  diffJson?: unknown
}

export type ReplayRun = {
  id: string
  recordedSessionId: string
  mode: "simulated" | "live" | "verify"
  createdAt: number
  completedAt?: number
  summary?: Record<string, unknown>
  toolCalls: ReplayRunToolCall[]
}
