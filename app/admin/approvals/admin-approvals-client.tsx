'use client'

import { useState, useEffect } from 'react'

interface PendingUser {
  id: string
  email: string | null
  created_at: string
}

export default function AdminApprovalsClient() {
  const [users, setUsers] = useState<PendingUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const fetchPending = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/pending-users')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || '목록을 불러올 수 없습니다.')
      }
      const data = await res.json()
      setUsers(data.users ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPending()
  }, [])

  const handleApprove = async (userId: string) => {
    setApprovingId(userId)
    try {
      const res = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || '승인에 실패했습니다.')
      }
      setUsers((prev) => prev.filter((u) => u.id !== userId))
    } catch (e) {
      alert(e instanceof Error ? e.message : '승인 중 오류가 발생했습니다.')
    } finally {
      setApprovingId(null)
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--foreground-muted)]">
        목록을 불러오는 중…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[var(--error)]/40 bg-[var(--error-muted)] px-4 py-3 text-sm text-[var(--error)]">
        {error}
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--foreground-muted)]">
        승인 대기 중인 가입 신청이 없습니다.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--foreground-muted)]">
        아래 사용자를 승인하면 로그인할 수 있습니다.
      </p>
      <ul className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)] overflow-hidden">
        {users.map((u) => (
          <li
            key={u.id}
            className="flex items-center justify-between gap-4 px-4 py-3"
          >
            <div>
              <span className="font-medium text-[var(--foreground)]">
                {u.email || '(이메일 없음)'}
              </span>
              <span className="ml-2 text-xs text-[var(--foreground-subtle)]">
                {new Date(u.created_at).toLocaleString('ko-KR')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleApprove(u.id)}
              disabled={approvingId === u.id}
              className="shrink-0 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {approvingId === u.id ? '처리 중…' : '승인'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
