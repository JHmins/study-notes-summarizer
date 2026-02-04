'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale/ko'
import Link from 'next/link'
import Sidebar from '@/components/sidebar'
import ThemeToggle from '@/components/theme-toggle'
import type { User } from '@supabase/supabase-js'
import type { Project, Category, Note } from '@/types'

interface SidebarNote {
  id: string
  title: string
  created_at: string
  category_id?: string | null
  status: string
}

interface ProjectsClientProps {
  initialProjects: Project[]
  initialNotes: SidebarNote[]
  initialCategories: Category[]
  user: User
  isAdmin?: boolean
}

export default function ProjectsClient({
  initialProjects,
  initialNotes,
  initialCategories,
  user,
  isAdmin,
}: ProjectsClientProps) {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [notes, setNotes] = useState<SidebarNote[]>(initialNotes)
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectDesc, setProjectDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  const refreshProjects = useCallback(async () => {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (data) setProjects(data)
  }, [user.id])

  const refreshNotes = useCallback(async () => {
    const { data } = await supabase
      .from('notes')
      .select('id, title, created_at, category_id, status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (data) setNotes(data as SidebarNote[])
  }, [user.id])

  const refreshCategories = useCallback(async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (data) setCategories(data)
  }, [user.id])

  useEffect(() => {
    setProjects(initialProjects)
    setNotes(initialNotes)
    setCategories(initialCategories)
  }, [initialProjects, initialNotes, initialCategories])

  useEffect(() => {
    const onFocus = () => {
      refreshProjects()
      refreshNotes()
      refreshCategories()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshProjects, refreshNotes, refreshCategories])

  useEffect(() => {
    const channel = supabase
      .channel(`projects-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects', filter: `user_id=eq.${user.id}` },
        () => { refreshProjects() }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user.id, refreshProjects])

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = projectName.trim()
    if (!name) return
    setSaving(true)
    setError(null)
    try {
      const { error: err } = await supabase.from('projects').insert({
        user_id: user.id,
        name,
        description: projectDesc.trim() || null,
      })
      if (err) throw err
      setProjectName('')
      setProjectDesc('')
      setIsAdding(false)
      await refreshProjects()
      router.refresh()
    } catch (err: unknown) {
      const message =
        err != null && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : err instanceof Error
            ? err.message
            : '프로젝트 생성에 실패했습니다.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteProject = async (id: string) => {
    if (!confirm('이 프로젝트와 안의 모든 파일을 삭제할까요?')) return
    try {
      const { error: err } = await supabase.from('projects').delete().eq('id', id).eq('user_id', user.id)
      if (err) throw err
      await refreshProjects()
      router.refresh()
    } catch (err: unknown) {
      const message =
        err != null && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : err instanceof Error
            ? err.message
            : '삭제에 실패했습니다.'
      alert(message)
    }
  }

  return (
    <div className="min-h-screen flex bg-[var(--background)]">
      <Sidebar
        notes={notes as any}
        categories={categories}
        selectedCategoryId={null}
        onSelectCategory={(id) => router.push(id ? `/dashboard?category=${id}` : '/dashboard')}
        onCategoriesChange={refreshCategories}
        userId={user.id}
        selectedDate={null}
        onSelectDate={(date) => router.push(date ? `/dashboard?date=${format(date, 'yyyy-MM-dd')}` : '/dashboard')}
        calendarMonth={new Date()}
        onCalendarMonthChange={() => {}}
        filterStatus="all"
        onFilterStatusChange={() => {}}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col lg:min-w-[400px]">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((o) => !o)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] lg:hidden"
              aria-label="메뉴 열기"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-sm font-medium text-[var(--foreground)]">프로젝트</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <span className="hidden text-sm text-[var(--foreground-subtle)] sm:inline">{user.email || '익명'}</span>
            {isAdmin && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-muted)] px-2 py-1 text-xs font-medium text-[var(--accent)]">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                관리자
              </span>
            )}
            {isAdmin && (
              <Link href="/admin/approvals" className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--accent)] hover:underline">
                가입 승인
              </Link>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            >
              로그아웃
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 flex flex-col gap-1">
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
                프로젝트
              </h1>
              <p className="text-sm text-[var(--foreground-subtle)]">
                파일을 올리거나 노트와 함께 정리할 수 있는 프로젝트를 만드세요.
              </p>
            </div>

            {!isAdding && (
              <div className="mb-8">
                <button
                  type="button"
                  onClick={() => setIsAdding(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  새 프로젝트
                </button>
              </div>
            )}

            {isAdding && (
              <div className="mb-10 rounded-2xl bg-[var(--surface)] p-6 shadow-sm ring-1 ring-[var(--border)] sm:p-8">
                <p className="mb-5 text-xs font-medium uppercase tracking-wider text-[var(--foreground-subtle)]">
                  새 프로젝트
                </p>
                <form onSubmit={handleCreateProject} className="space-y-5">
                  {error && (
                    <div className="rounded-xl bg-[var(--error-muted)] px-4 py-3 text-sm text-[var(--error)]">
                      {error}
                    </div>
                  )}
                  <div>
                    <label htmlFor="project-name" className="mb-1.5 block text-xs font-medium text-[var(--foreground-muted)]">
                      프로젝트 이름
                    </label>
                    <input
                      id="project-name"
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                      placeholder="예: 졸업 과제"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="project-desc" className="mb-1.5 block text-xs font-medium text-[var(--foreground-muted)]">
                      설명 (선택)
                    </label>
                    <textarea
                      id="project-desc"
                      value={projectDesc}
                      onChange={(e) => setProjectDesc(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 resize-none"
                      placeholder="프로젝트에 대한 간단한 설명"
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-xl bg-[var(--foreground)] px-5 py-2.5 text-sm font-medium text-[var(--background)] transition-all hover:opacity-90 disabled:opacity-50"
                    >
                      {saving ? '만드는 중…' : '만들기'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsAdding(false); setProjectName(''); setProjectDesc(''); setError(null); }}
                      className="rounded-xl border border-[var(--border)] bg-transparent px-5 py-2.5 text-sm font-medium text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface-hover)]"
                    >
                      취소
                    </button>
                  </div>
                </form>
              </div>
            )}

            {projects.length === 0 && !isAdding ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]/50 py-16 px-6 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-hover)] text-[var(--foreground-subtle)]">
                  <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-[var(--foreground-muted)]">아직 프로젝트가 없습니다</p>
                <p className="mt-1 max-w-xs text-xs text-[var(--foreground-subtle)]">
                  새 프로젝트를 만들고 파일을 올리거나 노트와 연결해 보세요.
                </p>
              </div>
            ) : projects.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="group relative overflow-hidden rounded-2xl bg-[var(--surface)] shadow-sm ring-1 ring-[var(--border)] transition-all hover:shadow-md hover:ring-[var(--border-focus)]"
                  >
                    <Link
                      href={`/dashboard/projects/${project.id}`}
                      className="block p-5 sm:p-6"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-muted)] text-[var(--accent)]">
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold tracking-tight text-[var(--foreground)] truncate">
                            {project.name}
                          </h3>
                          {project.description ? (
                            <p className="mt-1 text-sm text-[var(--foreground-muted)] line-clamp-2">
                              {project.description}
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-[var(--foreground-subtle)]">
                              {format(new Date(project.created_at), 'yyyy년 M월 d일', { locale: ko })}
                            </p>
                          )}
                          {project.description && (
                            <p className="mt-2 text-xs text-[var(--foreground-subtle)]">
                              {format(new Date(project.created_at), 'yyyy.M.d', { locale: ko })}
                            </p>
                          )}
                        </div>
                        <svg className="h-5 w-5 shrink-0 text-[var(--foreground-subtle)] opacity-0 transition-opacity group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                    <div className="flex border-t border-[var(--border)]">
                      <Link
                        href={`/dashboard/projects/${project.id}`}
                        className="flex flex-1 items-center justify-center gap-1.5 py-3 text-sm font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent-muted)]/30"
                      >
                        열기
                      </Link>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); handleDeleteProject(project.id); }}
                        className="flex flex-1 items-center justify-center gap-1.5 py-3 text-sm font-medium text-[var(--foreground-muted)] transition-colors hover:bg-[var(--error-muted)] hover:text-[var(--error)]"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  )
}
