import clsx from "clsx"
import { Search, X } from "lucide-react"

export const SearchInput = ({
  value,
  onValueChange,
  placeholder = "Search",
  className,
}: {
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
}) => (
  <div
    className={clsx(
      "flex items-center gap-2 rounded-full border border-border1/10 bg-surface3/80 px-3 py-2",
      className,
    )}
  >
    <Search size={14} className="text-text3" />
    <input
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      placeholder={placeholder}
      className="min-w-0 flex-1 bg-transparent text-xs text-text1 placeholder:text-text3 focus:outline-none"
    />
    {value.trim().length > 0 && (
      <button
        type="button"
        onClick={() => onValueChange("")}
        aria-label="Clear search"
        className="ui-focus rounded-full p-1 text-text3 transition duration-ui ease-ease-out hover:bg-ink/5 hover:text-text1"
      >
        <X size={14} />
      </button>
    )}
  </div>
)
