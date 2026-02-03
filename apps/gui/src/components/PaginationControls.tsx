import clsx from "clsx"
import { ChevronLeft, ChevronRight } from "lucide-react"

const clampPageIndex = (pageIndex: number, pageCount: number) => {
  if (pageCount <= 0) return 0
  if (pageIndex < 0) return 0
  if (pageIndex >= pageCount) return pageCount - 1
  return pageIndex
}

export const PaginationControls = ({
  pageIndex,
  pageSize,
  total,
  onPageIndexChange,
  className,
}: {
  pageIndex: number
  pageSize: number
  total: number
  onPageIndexChange: (pageIndex: number) => void
  className?: string
}) => {
  const pageCount = total === 0 ? 0 : Math.ceil(total / pageSize)
  const safePageIndex = clampPageIndex(pageIndex, pageCount)
  const canPrev = safePageIndex > 0
  const canNext = safePageIndex + 1 < pageCount
  const from = total === 0 ? 0 : safePageIndex * pageSize + 1
  const to = total === 0 ? 0 : Math.min(total, (safePageIndex + 1) * pageSize)

  return (
    <div className={clsx("flex items-center justify-between gap-3", className)}>
      <span className="text-xs text-text3">
        {total === 0 ? "0" : `${from}-${to} of ${total}`}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageIndexChange(safePageIndex - 1)}
          disabled={!canPrev}
          className="ui-focus flex items-center gap-1 rounded-full border border-border1/10 bg-surface1/40 px-3 py-1 text-xs font-semibold text-text2 transition duration-ui ease-ease-out hover:bg-surface1/70 hover:text-text1 disabled:opacity-40"
        >
          <ChevronLeft size={14} />
          Prev
        </button>
        <span className="min-w-[84px] text-center text-xs text-text3">
          {pageCount === 0 ? "Page 0 of 0" : `Page ${safePageIndex + 1} of ${pageCount}`}
        </span>
        <button
          type="button"
          onClick={() => onPageIndexChange(safePageIndex + 1)}
          disabled={!canNext}
          className="ui-focus flex items-center gap-1 rounded-full border border-border1/10 bg-surface1/40 px-3 py-1 text-xs font-semibold text-text2 transition duration-ui ease-ease-out hover:bg-surface1/70 hover:text-text1 disabled:opacity-40"
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
