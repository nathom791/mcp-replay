import { useEffect } from "react"
import { listen } from "@tauri-apps/api/event"

import type { OpenCodeEvent } from "@opencode/core"
import { startEventStream, stopEventStream } from "@opencode/opencode-client"
import { useAppStore } from "../store/app-store"
import { useRecorderStore } from "../store/recorder-store"

export const useEventStream = () => {
  const serverConfig = useAppStore((state) => state.serverConfig)
  const mcpServers = useAppStore((state) => state.mcpServers)
  const applyEvent = useRecorderStore((state) => state.applyEvent)

  useEffect(() => {
    if (!serverConfig) {
      return
    }
    let mounted = true
    let cleanup: (() => void) | undefined

    const connect = async () => {
      try {
        await startEventStream()
        const unlisten = await listen<OpenCodeEvent>(
          "opencode:event",
          (event) => {
            if (!mounted) return
            applyEvent(event.payload, mcpServers)
          },
        )
        cleanup = () => {
          unlisten()
        }
      } catch (error) {
        // ignore connection errors for now
      }
    }

    connect()

    return () => {
      mounted = false
      cleanup?.()
      stopEventStream().catch(() => undefined)
    }
  }, [serverConfig, mcpServers, applyEvent])
}
