import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/utils/auth'
import AdminApprovalsClient from './admin-approvals-client'

export default async function AdminApprovalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  if (!isAdmin(user.email)) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-semibold text-[var(--foreground)]">가입 승인</h1>
          <a
            href="/dashboard"
            className="text-sm text-[var(--accent)] hover:underline"
          >
            대시보드로
          </a>
        </div>
      </header>
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        <AdminApprovalsClient />
      </main>
    </div>
  )
}
