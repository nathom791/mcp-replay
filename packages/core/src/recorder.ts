import type {
  McpToolResult,
  OpenCodeMessageWithParts,
  OpenCodeToolPart,
  RecordedToolCall,
  ToolState,
} from "./types"

const TOOL_SEPARATORS = [".", "_", "/", ":"]

const parseToolIdentifier = (tool: string, mcpServers: string[]) => {
  const normalizedTool = tool.trim()
  for (const serverName of mcpServers) {
    for (const separator of TOOL_SEPARATORS) {
      const prefix = `${serverName}${separator}`
      if (normalizedTool.startsWith(prefix)) {
        return {
          toolKind: "mcp" as const,
          mcpServerName: serverName,
          toolName: normalizedTool.slice(prefix.length),
        }
      }
    }
  }
  return {
    toolKind: normalizedTool.includes("mcp") ? ("unknown" as const) : ("builtin" as const),
    toolName: normalizedTool,
  }
}

const normalizeToolResult = (state: ToolState): McpToolResult | undefined => {
  if (state.status === "running" || state.status === "pending") {
    return undefined
  }

  if (state.status === "error") {
    return {
      content: [{ type: "text", text: state.error }],
      isError: true,
    }
  }

  const output = state.output ?? ""
  const trimmed = output.trim()

  if (!trimmed) {
    return { content: [] }
  }

  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed === "object") {
      if ("content" in parsed || "structuredContent" in parsed || "isError" in parsed) {
        return parsed as McpToolResult
      }
      return {
        content: [{ type: "text", text: trimmed }],
        structuredContent: parsed,
      }
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: output }],
    }
  }

  return {
    content: [{ type: "text", text: output }],
  }
}

const statusFromToolState = (state: ToolState): RecordedToolCall["status"] => {
  switch (state.status) {
    case "pending":
      return "pending"
    case "running":
      return "running"
    case "completed":
      return "success"
    case "error":
      return "error"
    default:
      return "pending"
  }
}

const timingFromToolState = (state: ToolState) => {
  if (state.status === "running") {
    return { start: state.time.start }
  }
  if (state.status === "completed" || state.status === "error") {
    const durationMs = state.time.end - state.time.start
    return {
      start: state.time.start,
      end: state.time.end,
      durationMs,
    }
  }
  return undefined
}

export const extractRecordedToolCalls = ({
  sessionId,
  messages,
  mcpServers,
}: {
  sessionId: string
  messages: OpenCodeMessageWithParts[]
  mcpServers: string[]
}): RecordedToolCall[] => {
  let sequenceIndex = 0
  const toolParts = messages
    .flatMap((message) => message.parts)
    .filter((part): part is OpenCodeToolPart => part.type === "tool")

  return toolParts.map((part) => {
    const toolInfo = parseToolIdentifier(part.tool, mcpServers)
    const recordedResultJson = normalizeToolResult(part.state)
    const timing = timingFromToolState(part.state)

    return {
      id: part.callID,
      opencodeSessionId: sessionId,
      messageId: part.messageID,
      partId: part.id,
      sequenceIndex: sequenceIndex++,
      toolKind: toolInfo.toolKind,
      mcpServerName: toolInfo.mcpServerName,
      toolName: toolInfo.toolName,
      argumentsJson: part.state.input ?? {},
      recordedResultJson,
      timing,
      status: statusFromToolState(part.state),
    }
  })
}
