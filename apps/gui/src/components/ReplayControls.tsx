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
    <div className="flex rounded-full border border-border1/10 bg-surface3/80 p-1 text-xs">
      {modes.map((option) => (
        <button
          key={option}
          onClick={() => onModeChange(option)}
          className={clsx(
            "ui-focus rounded-full px-3 py-1 capitalize transition duration-ui ease-ease-out",
            mode === option
              ? "bg-surface1 text-text1 shadow-pressed"
              : "text-text2 hover:bg-ink/5 hover:text-text1",
          )}
        >
          {option}
        </button>
      ))}
    </div>
    <button
      onClick={onRun}
      disabled={isRunning}
      className="flex items-center gap-2 rounded-full bg-cobalt px-4 py-2 text-xs font-semibold text-white transition duration-ui ease-ease-out hover:bg-cobalt-600 disabled:opacity-60"
    >
      {isRunning ? <Pause size={14} /> : <Play size={14} />}
      {isRunning ? "Running" : "Run replay"}
    </button>
    <button
      onClick={onStop}
      className="flex items-center gap-2 rounded-full border border-border1/10 bg-surface3/70 px-4 py-2 text-xs font-semibold text-text1 transition duration-ui ease-ease-out hover:bg-surface3"
    >
      <Square size={14} />
      Stop
    </button>
  </div>
)
