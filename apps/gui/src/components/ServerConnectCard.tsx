import { useEffect, useState } from "react"
import { CheckCircle2, Link2Off, PlugZap } from "lucide-react"

import { checkServerHealth } from "@opencode/opencode-client"
import type { ServerConfig } from "@opencode/core"
import { useSetServerConfig } from "../hooks/useOpencode"
import { useAppStore } from "../store/app-store"

export const ServerConnectCard = () => {
  const serverConfig = useAppStore((state) => state.serverConfig)
  const connectionStatus = useAppStore((state) => state.connectionStatus)
  const setConnectionStatus = useAppStore((state) => state.setConnectionStatus)
  const setServerConfig = useAppStore((state) => state.setServerConfig)
  const { mutateAsync } = useSetServerConfig()

  const [formState, setFormState] = useState<ServerConfig>(
    serverConfig ?? {
      baseUrl: "http://127.0.0.1:4096",
      username: "opencode",
      password: "",
      directory: "",
    },
  )

  useEffect(() => {
    if (!serverConfig) return
    setFormState(serverConfig)
  }, [serverConfig])

  const handleChange = (field: keyof ServerConfig, value: string) => {
    setFormState((current) => ({ ...current, [field]: value }))
  }

  const connect = async () => {
    setConnectionStatus("connecting")
    const trimmedConfig = {
      ...formState,
      username: formState.username?.trim() || undefined,
      password: formState.password?.trim() || undefined,
      directory: formState.directory?.trim() || undefined,
    }
    try {
      const updated = await mutateAsync(trimmedConfig)
      await checkServerHealth()
      setServerConfig(updated)
      setConnectionStatus("connected")
    } catch (error) {
      setConnectionStatus("disconnected")
    }
  }

  const statusCopy =
    connectionStatus === "connected"
      ? "Connected"
      : connectionStatus === "connecting"
        ? "Connecting"
        : "Disconnected"

  const StatusIcon =
    connectionStatus === "connected"
      ? CheckCircle2
      : connectionStatus === "connecting"
        ? PlugZap
        : Link2Off

  return (
    <div className="panel-bg rounded-3xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-text3">
            OpenCode server
          </p>
          <p className="text-lg font-semibold text-text1">{statusCopy}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-text3">
          <StatusIcon size={16} />
          {serverConfig?.baseUrl ?? formState.baseUrl}
        </div>
      </div>
      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-text3">Base URL</span>
          <input
            value={formState.baseUrl}
            onChange={(event) => handleChange("baseUrl", event.target.value)}
            className="rounded-2xl border border-border1/10 bg-surface3/80 px-3 py-2 text-text1 placeholder:text-text3"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-text3">Workspace dir</span>
          <input
            value={formState.directory ?? ""}
            onChange={(event) => handleChange("directory", event.target.value)}
            className="rounded-2xl border border-border1/10 bg-surface3/80 px-3 py-2 text-text1 placeholder:text-text3"
            placeholder="Optional"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-text3">Username</span>
          <input
            value={formState.username ?? ""}
            onChange={(event) => handleChange("username", event.target.value)}
            className="rounded-2xl border border-border1/10 bg-surface3/80 px-3 py-2 text-text1 placeholder:text-text3"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-text3">Password</span>
          <input
            value={formState.password ?? ""}
            onChange={(event) => handleChange("password", event.target.value)}
            type="password"
            className="rounded-2xl border border-border1/10 bg-surface3/80 px-3 py-2 text-text1 placeholder:text-text3"
          />
        </label>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          onClick={connect}
          className="rounded-full bg-cobalt px-5 py-2 text-sm font-semibold text-white transition duration-ui ease-ease-out hover:bg-cobalt-600"
        >
          Connect
        </button>
      </div>
    </div>
  )
}
