'use client'

import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] px-4">
      <div className="max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        <h1 className="mb-2 text-xl font-semibold text-[var(--foreground)]">
          문제가 발생했어요
        </h1>
        <p className="mb-4 text-sm text-[var(--foreground-muted)]">
          {error.message || '알 수 없는 오류입니다.'}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            다시 시도
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
          >
            대시보드로
          </Link>
        </div>
      </div>
    </div>
  )
}
