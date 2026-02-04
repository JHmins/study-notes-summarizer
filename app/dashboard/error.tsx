'use client'

import Link from 'next/link'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const isEnvError =
    error.message?.includes('SUPABASE') ||
    error.message?.includes('NEXT_PUBLIC') ||
    error.message?.includes('env')

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] px-4">
      <div className="max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        <h1 className="mb-2 text-xl font-semibold text-[var(--foreground)]">
          대시보드를 불러오지 못했어요
        </h1>
        <p className="mb-4 text-sm text-[var(--foreground-muted)]">
          {error.message || '잠시 후 다시 시도해 주세요.'}
        </p>
        {isEnvError && (
          <p className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] p-3 text-left text-xs text-[var(--foreground-muted)]">
            .env.local에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY가 설정돼 있는지 확인해 주세요.
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            다시 시도
          </button>
          <Link
            href="/"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
          >
            처음으로
          </Link>
        </div>
      </div>
    </div>
  )
}
