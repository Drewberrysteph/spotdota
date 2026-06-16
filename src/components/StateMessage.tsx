interface Props {
  message: string
  onRetry?: () => void
}

// Shared loading / empty / error placeholder.
export function StateMessage({ message, onRetry }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface px-6 py-16 text-center">
      <p className="text-[15px] text-muted">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="cursor-pointer rounded-lg border border-line-strong px-3.5 py-1.5 text-[14px] font-medium transition-colors hover:border-dota hover:bg-dota hover:text-white"
        >
          Retry
        </button>
      )}
    </div>
  )
}
