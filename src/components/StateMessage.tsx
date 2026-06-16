interface Props {
  message: string
  onRetry?: () => void
}

// Shared loading / empty / error placeholder.
export function StateMessage({ message, onRetry }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 border border-black/15 px-6 py-16 text-center dark:border-white/15">
      <p className="text-[15px] text-gray-500 dark:text-gray-400">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="border border-black/40 px-3 py-1 text-[15px] hover:bg-black hover:text-white dark:border-white/40 dark:hover:bg-white dark:hover:text-black"
        >
          Retry
        </button>
      )}
    </div>
  )
}
