import { useQuery } from "@tanstack/react-query"

import { getConfig } from "@opencode/opencode-client"

export const McpView = () => {
  const { data: config = {} } = useQuery({
    queryKey: ["mcp-config"],
    queryFn: getConfig,
  })

  const entries = Object.entries(config)

  return (
    <div className="panel-bg h-full rounded-3xl p-6">
      <div className="flex items-center justify-between">
        <p className="text-lg font-semibold">MCP servers</p>
        <span className="text-xs text-text3">{entries.length} servers</span>
      </div>
      <div className="mt-6 space-y-3">
        {entries.map(([name, server]) => (
          <div
            key={name}
            className="rounded-2xl border border-border1/10 bg-surface1/60 px-4 py-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{name}</p>
              <span className="rounded-full bg-surface3/80 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-text3">
                {server.type}
              </span>
            </div>
            <p className="text-xs text-text3">
              {server.type === "remote" ? server.url : server.command.join(" ")}
            </p>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border1/15 bg-surface1/40 px-4 py-6 text-sm text-text3">
            No MCP servers configured. Add them in OpenCode config.
          </div>
        )}
      </div>
    </div>
  )
}
