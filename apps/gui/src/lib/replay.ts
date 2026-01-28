import { diff } from "jsondiffpatch"

import type { McpToolResult } from "@opencode/core"

export const diffToolResults = (
  recorded?: McpToolResult,
  live?: McpToolResult,
) => {
  if (!recorded && !live) return undefined
  return {
    structured: diff(recorded?.structuredContent ?? null, live?.structuredContent ?? null),
    content: diff(recorded?.content ?? null, live?.content ?? null),
    isError: recorded?.isError !== live?.isError ? [recorded?.isError, live?.isError] : null,
  }
}
