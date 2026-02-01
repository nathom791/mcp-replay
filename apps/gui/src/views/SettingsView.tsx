import { ThemeToggle } from "../components/ThemeToggle"

export const SettingsView = () => (
  <div className="panel-bg h-full rounded-3xl p-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <p className="text-lg font-semibold text-text1">Settings</p>
      <ThemeToggle />
    </div>
    <div className="mt-4 space-y-3 text-sm text-text2">
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
