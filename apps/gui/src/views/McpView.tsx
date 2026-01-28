import { useQuery } from "@tanstack/react-query"

import { getConfig } from "@opencode/opencode-client"

export const McpView = () => {
  const { data: config = {} } = useQuery({
    queryKey: ["mcp-config"],
    queryFn: getConfig,
  })

  const entries = Object.entries(config)

  return (
    <div className="panel-bg h-full rounded-3xl border border-black/5 p-6 shadow-panel">
      <div className="flex items-center justify-between">
        <p className="text-lg font-semibold">MCP servers</p>
        <span className="text-xs text-black/50">{entries.length} servers</span>
      </div>
      <div className="mt-6 space-y-3">
        {entries.map(([name, server]) => (
          <div
            key={name}
            className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{name}</p>
              <span className="text-xs uppercase tracking-[0.2em] text-black/50">
                {server.type}
              </span>
            </div>
            <p className="text-xs text-black/50">
              {server.type === "remote" ? server.url : server.command.join(" ")}
            </p>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="rounded-2xl border border-dashed border-black/10 px-4 py-6 text-sm text-black/50">
            No MCP servers configured. Add them in OpenCode config.
          </div>
        )}
      </div>
    </div>
  )
}
