export const SettingsView = () => (
  <div className="panel-bg h-full rounded-3xl border border-black/5 p-6 shadow-panel">
    <p className="text-lg font-semibold">Settings</p>
    <div className="mt-4 space-y-3 text-sm text-black/60">
      <p>
        Tool replay runs are treated as potentially destructive. Keep simulated mode as
        the default until you trust the MCP server.
      </p>
      <p>
        Future settings will include per-tool allowlists, replay concurrency, and
        storage locations.
      </p>
    </div>
  </div>
)
