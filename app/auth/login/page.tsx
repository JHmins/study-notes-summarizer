'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getSupabaseErrorMessage } from '@/lib/utils/errors'
import ThemeToggle from '@/components/theme-toggle'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [anonLoading, setAnonLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const msg = searchParams.get('message')
    if (msg === 'pending') {
      setError('가입 승인이 완료될 때까지 대기해 주세요. 관리자 승인 후 로그인할 수 있습니다.')
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      if (data.user) {
        const res = await fetch('/api/auth/auto-approve-if-admin', { method: 'POST' })
        const body = await res.json().catch(() => ({}))
        if (body.approved) {
          router.push('/dashboard')
          router.refresh()
          setLoading(false)
          return
        }
        const { data: profile } = await supabase
          .from('profiles')
          .select('approved')
          .eq('id', data.user.id)
          .single()
        if (profile && profile.approved !== true) {
          await supabase.auth.signOut()
          setError('가입 승인 대기 중입니다. 관리자 승인 후 로그인할 수 있습니다.')
          setLoading(false)
          return
        }
      }
      router.push('/dashboard')
      router.refresh()
    } catch (err: unknown) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleAnonymous = async () => {
    setAnonLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInAnonymously()
      if (error) throw error
      router.push('/dashboard')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '익명 로그인에 실패했습니다.')
    } finally {
      setAnonLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="max-w-md w-full space-y-8 p-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
        <div>
          <h2 className="text-center text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            로그인
          </h2>
          <p className="mt-2 text-center text-sm text-[var(--foreground-muted)]">
            Study Notes Summarizer
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-lg border border-[var(--error)]/40 bg-[var(--error-muted)] px-4 py-3 text-sm text-[var(--error)]">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--foreground)] placeholder-[var(--foreground-subtle)] focus:border-[var(--border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)]"
              placeholder="이메일 주소"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--foreground)] placeholder-[var(--foreground-subtle)] focus:border-[var(--border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)]"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--background)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '처리 중...' : '로그인'}
          </button>
        </form>
        <p className="text-center text-sm text-[var(--foreground-muted)]">
          계정이 없으신가요?{' '}
          <Link href="/auth/signup" className="font-medium text-[var(--accent)] hover:underline">
            회원가입
          </Link>
        </p>
        <div className="relative">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-[var(--border)]" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-[var(--surface)] px-2 text-[var(--foreground-subtle)]">또는</span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleAnonymous}
          disabled={anonLoading}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
        >
          {anonLoading ? '처리 중...' : '익명으로 체험하기'}
        </button>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--foreground-muted)]">로딩 중...</p>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
