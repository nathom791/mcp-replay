import clsx from "clsx"
import { Play, Pause, Square } from "lucide-react"

import type { ReplayRun } from "@opencode/core"

const modes: ReplayRun["mode"][] = ["simulated", "live", "verify"]

export const ReplayControls = ({
  mode,
  onModeChange,
  onRun,
  onStop,
  isRunning,
}: {
  mode: ReplayRun["mode"]
  onModeChange: (mode: ReplayRun["mode"]) => void
  onRun: () => void
  onStop: () => void
  isRunning: boolean
}) => (
  <div className="flex flex-wrap items-center gap-3">
    <div className="flex rounded-full border border-black/10 bg-white/80 p-1 text-xs">
      {modes.map((option) => (
        <button
          key={option}
          onClick={() => onModeChange(option)}
          className={clsx(
            "rounded-full px-3 py-1 capitalize",
            mode === option
              ? "bg-ink text-white"
              : "text-black/60 hover:text-black",
          )}
        >
          {option}
        </button>
      ))}
    </div>
    <button
      onClick={onRun}
      disabled={isRunning}
      className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
    >
      {isRunning ? <Pause size={14} /> : <Play size={14} />}
      {isRunning ? "Running" : "Run replay"}
    </button>
    <button
      onClick={onStop}
      className="flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-xs font-semibold text-black/70"
    >
      <Square size={14} />
      Stop
    </button>
  </div>
)
