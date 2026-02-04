'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale/ko'
import Link from 'next/link'
import ThemeToggle from '@/components/theme-toggle'
import SimpleMarkdown from '@/components/simple-markdown'
import type { Note, Category, Project, StudyLink } from '@/types'

interface NoteDetailClientProps {
  note: Note
  fileContent: string
  userEmail: string
  categories: Category[]
  projects: Project[]
  initialStudyLinks: StudyLink[]
  isAdmin?: boolean
}

const statusConfig = {
  completed: { label: '완료', className: 'bg-[var(--success-muted)] text-[var(--success)]' },
  processing: { label: '처리 중', className: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' },
  failed: { label: '실패', className: 'bg-[var(--error-muted)] text-[var(--error)]' },
  pending: { label: '대기', className: 'bg-[var(--surface-hover)] text-[var(--foreground-muted)]' },
} as const

export default function NoteDetailClient({
  note,
  fileContent: initialFileContent,
  userEmail,
  categories = [],
  projects = [],
  initialStudyLinks = [],
  isAdmin,
}: NoteDetailClientProps) {
  const [isRetrying, setIsRetrying] = useState(false)
  const [currentNote, setCurrentNote] = useState(note)
  const [originContent, setOriginContent] = useState(initialFileContent)
  const [studyLinks, setStudyLinks] = useState<StudyLink[]>(initialStudyLinks)
  const [activeBlock, setActiveBlock] = useState<'summary' | 'origin'>('summary')
  const [savingCategory, setSavingCategory] = useState(false)
  const [savingProject, setSavingProject] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(note.title)
  const [savingTitle, setSavingTitle] = useState(false)
  const [editingContent, setEditingContent] = useState(false)
  const [contentValue, setContentValue] = useState(initialFileContent)
  const [savingContent, setSavingContent] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const onFocus = () => {
      router.refresh()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [router])

  // 연결된 study_links 실시간 반영
  useEffect(() => {
    const channel = supabase
      .channel(`study-links-note-${note.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'study_links',
          filter: `note_id=eq.${note.id}`,
        },
        () => {
          supabase
            .from('study_links')
            .select('id, title, url, description, created_at')
            .eq('note_id', note.id)
            .order('created_at', { ascending: false })
            .then(({ data }) => {
              if (data) setStudyLinks(data)
            })
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [note.id])

  const handleTitleSave = async () => {
    const v = titleValue.trim()
    if (!v) return
    setSavingTitle(true)
    const { error } = await supabase.from('notes').update({ title: v }).eq('id', note.id)
    if (!error) {
      setCurrentNote((n) => ({ ...n, title: v }))
      setEditingTitle(false)
      router.refresh()
    }
    setSavingTitle(false)
  }

  const handleContentSave = async () => {
    setSavingContent(true)
    const isMd = note.file_path.toLowerCase().endsWith('.md')
    const contentType = isMd ? 'text/markdown' : 'text/plain'
    const blob = new Blob([contentValue], { type: contentType })
    const { error } = await supabase.storage
      .from('study-notes')
      .upload(note.file_path, blob, { contentType, upsert: true })
    if (!error) {
      setOriginContent(contentValue)
      setEditingContent(false)
      router.refresh()
    }
    setSavingContent(false)
  }

  const handleDelete = async () => {
    if (!confirm('이 노트를 삭제할까요? 삭제 후에는 복구할 수 없습니다.')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/notes/${note.id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/dashboard')
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || '삭제에 실패했습니다.')
      }
    } catch {
      alert('삭제 중 오류가 발생했습니다.')
    } finally {
      setDeleting(false)
    }
  }

  const handleCategoryChange = async (categoryId: string | null) => {
    setSavingCategory(true)
    const { error } = await supabase
      .from('notes')
      .update({ category_id: categoryId || null })
      .eq('id', note.id)
    if (!error) {
      setCurrentNote((n) => ({ ...n, category_id: categoryId ?? null }))
      router.refresh()
    }
    setSavingCategory(false)
  }

  const handleProjectChange = async (projectId: string | null) => {
    setSavingProject(true)
    const { error } = await supabase
      .from('notes')
      .update({ project_id: projectId || null })
      .eq('id', note.id)
    if (!error) {
      setCurrentNote((n) => ({ ...n, project_id: projectId ?? null }))
      router.refresh()
    }
    setSavingProject(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const handleRetrySummary = async () => {
    setIsRetrying(true)
    try {
      const res = await fetch('/api/summarize/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId: note.id }),
      })
      if (res.ok) {
        const data = await res.json()
        setCurrentNote({ ...currentNote, summary: data.summary, status: 'completed' })
        router.refresh()
      } else {
        alert('요약 재생성에 실패했습니다.')
      }
    } catch {
      alert('오류가 발생했습니다.')
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--surface)]/80">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/dashboard"
            className="text-lg font-semibold text-[var(--foreground)] no-underline hover:opacity-80"
          >
            Study Notes
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <span className="max-sm:hidden text-sm text-[var(--foreground-subtle)]">{userEmail || '익명'}</span>
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
              className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <nav className="mb-6 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-[var(--foreground-muted)] no-underline hover:text-[var(--accent)]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            목록으로
          </Link>
          <Link
            href={`/dashboard?compare=${note.id}`}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
            비교하기
          </Link>
        </nav>

        {/* 문서 헤더 - 노션/옵시디언 스타일 */}
        <article className="mb-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              {editingTitle ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={titleValue}
                    onChange={(e) => setTitleValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') { setEditingTitle(false); setTitleValue(currentNote.title); } }}
                    className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xl font-bold text-[var(--foreground)] focus:border-[var(--border-focus)] focus:outline-none sm:text-2xl"
                    autoFocus
                  />
                  <button type="button" onClick={handleTitleSave} disabled={savingTitle} className="shrink-0 rounded bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
                    {savingTitle ? '저장 중…' : '저장'}
                  </button>
                  <button type="button" onClick={() => { setEditingTitle(false); setTitleValue(currentNote.title); }} className="shrink-0 rounded border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)]">
                    취소
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
                    {currentNote.title}
                  </h1>
                  <button
                    type="button"
                    onClick={() => setEditingTitle(true)}
                    className="rounded p-1.5 text-[var(--foreground-subtle)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                    aria-label="제목 수정"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
              )}
              <p className="mt-2 text-sm text-[var(--foreground-subtle)]">
                생성 {format(new Date(currentNote.created_at), 'yyyy.M.d HH:mm', { locale: ko })}
                {currentNote.updated_at !== currentNote.created_at &&
                  ` · 수정 ${format(new Date(currentNote.updated_at), 'yyyy.M.d HH:mm', { locale: ko })}`}
              </p>
              {categories.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm text-[var(--foreground-muted)]">카테고리</span>
                  <select
                    value={currentNote.category_id ?? ''}
                    onChange={(e) => handleCategoryChange(e.target.value || null)}
                    disabled={savingCategory}
                    className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--foreground)] focus:border-[var(--border-focus)] focus:outline-none disabled:opacity-50"
                  >
                    <option value="">미분류</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {savingCategory && <span className="text-xs text-[var(--foreground-subtle)]">저장 중…</span>}
                </div>
              )}
              {projects.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm text-[var(--foreground-muted)]">프로젝트</span>
                  <select
                    value={currentNote.project_id ?? ''}
                    onChange={(e) => handleProjectChange(e.target.value || null)}
                    disabled={savingProject}
                    className="max-w-[200px] rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--foreground)] focus:border-[var(--border-focus)] focus:outline-none disabled:opacity-50"
                  >
                    <option value="">없음</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  {currentNote.project_id && (
                    <Link
                      href={`/dashboard/projects/${currentNote.project_id}`}
                      className="text-xs text-[var(--accent)] hover:underline"
                    >
                      프로젝트 보기
                    </Link>
                  )}
                  {savingProject && <span className="text-xs text-[var(--foreground-subtle)]">저장 중…</span>}
                </div>
              )}
              {studyLinks.length > 0 && (
                <div className="mt-3">
                  <span className="text-sm text-[var(--foreground-muted)]">연결된 링크</span>
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {studyLinks.map((link) => (
                      <li key={link.id}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-hover)] px-2 py-1 text-sm text-[var(--accent)] hover:underline"
                        >
                          {link.title}
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusConfig[currentNote.status].className}`}
              >
                {statusConfig[currentNote.status].label}
              </span>
              {(currentNote.status === 'failed' || currentNote.status === 'completed') && (
                <button
                  type="button"
                  onClick={handleRetrySummary}
                  disabled={isRetrying}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
                >
                  {isRetrying ? '재생성 중...' : '요약 다시 만들기'}
                </button>
              )}
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--error)] hover:bg-[var(--error-muted)] disabled:opacity-50"
              >
                {deleting ? '삭제 중…' : '노트 삭제'}
              </button>
            </div>
          </div>

          {/* 요약 / 원본 탭 */}
          <div className="border-b border-[var(--border)]">
            <div className="flex gap-6">
              <button
                type="button"
                onClick={() => setActiveBlock('summary')}
                className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                  activeBlock === 'summary'
                    ? 'border-[var(--accent)] text-[var(--foreground)]'
                    : 'border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                }`}
              >
                요약
              </button>
              <button
                type="button"
                onClick={() => setActiveBlock('origin')}
                className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                  activeBlock === 'origin'
                    ? 'border-[var(--accent)] text-[var(--foreground)]'
                    : 'border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                }`}
              >
                원본
              </button>
            </div>
          </div>

          {/* 요약 블록 - 마크다운 렌더링 + .md 다운로드 */}
          {activeBlock === 'summary' && (
            <section className="mt-6">
              {currentNote.summary ? (
                <>
                  <div className="mb-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        const blob = new Blob([currentNote.summary!], { type: 'text/markdown;charset=utf-8' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `${currentNote.title || '요약'}.md`
                        a.click()
                        URL.revokeObjectURL(url)
                      }}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                    >
                      요약 .md 다운로드
                    </button>
                  </div>
                  <div className="summary-markdown rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--foreground)] [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:first:mt-0 [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-medium [&_ul]:list-disc [&_ul]:pl-6 [&_li]:my-1 [&_p]:my-2 [&_a]:text-[var(--accent)] [&_a]:underline [&_a]:break-all [&_strong]:font-semibold [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--border)] [&_blockquote]:pl-4 [&_blockquote]:text-[var(--foreground-muted)]">
                    <SimpleMarkdown>{currentNote.summary}</SimpleMarkdown>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--foreground-muted)]">
                  {currentNote.status === 'processing'
                    ? '요약 생성 중입니다. 잠시만 기다려 주세요.'
                    : currentNote.status === 'pending'
                    ? '요약이 곧 생성됩니다.'
                    : '요약을 불러올 수 없습니다. "요약 다시 만들기"를 시도해 보세요.'}
                </div>
              )}
            </section>
          )}

          {/* 원본 블록 - 읽기/편집 */}
          {activeBlock === 'origin' && (
            <section className="mt-6">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-hover)] px-4 py-2">
                  <span className="text-xs font-medium text-[var(--foreground-muted)]">원본 텍스트</span>
                  {!editingContent ? (
                    <button
                      type="button"
                      onClick={() => { setEditingContent(true); setContentValue(originContent); }}
                      className="text-xs font-medium text-[var(--accent)] hover:underline"
                    >
                      내용 수정
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleContentSave}
                        disabled={savingContent}
                        className="text-xs font-medium text-[var(--accent)] hover:underline disabled:opacity-50"
                      >
                        {savingContent ? '저장 중…' : '저장'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditingContent(false); setContentValue(originContent); }}
                        className="text-xs font-medium text-[var(--foreground-muted)] hover:underline"
                      >
                        취소
                      </button>
                    </div>
                  )}
                </div>
                {editingContent ? (
                  <textarea
                    value={contentValue}
                    onChange={(e) => setContentValue(e.target.value)}
                    className="origin-block w-full max-h-[60vh] resize-y overflow-auto border-0 p-4 text-[var(--foreground-muted)] focus:outline-none focus:ring-0"
                    rows={16}
                    spellCheck={false}
                  />
                ) : (
                  <div className="origin-block max-h-[60vh] overflow-auto p-4 text-[var(--foreground-muted)] whitespace-pre-wrap">
                    {originContent || '파일을 불러올 수 없습니다.'}
                  </div>
                )}
              </div>
              {editingContent && (
                <p className="mt-2 text-xs text-[var(--foreground-subtle)]">
                  내용을 바꾼 뒤 저장하면 원본 파일이 덮어써집니다. 필요하면 「요약 다시 만들기」로 요약을 다시 생성할 수 있습니다.
                </p>
              )}
            </section>
          )}
        </article>
      </main>
    </div>
  )
}
