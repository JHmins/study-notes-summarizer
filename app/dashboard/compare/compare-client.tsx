'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale/ko'
import Link from 'next/link'
import Sidebar from '@/components/sidebar'
import ThemeToggle from '@/components/theme-toggle'
import SimpleMarkdown from '@/components/simple-markdown'
import type { Note, Category } from '@/types'
import { NOTE_STATUS_CONFIG } from '@/types'

interface CompareClientProps {
  note1: Note
  note2: Note
  fileContent1: string
  fileContent2: string
  userEmail: string
  userId: string
  isAdmin?: boolean
  initialCategories: Category[]
  initialNotes: Note[]
}

export default function CompareClient({
  note1,
  note2,
  fileContent1,
  fileContent2,
  userEmail,
  userId,
  isAdmin,
  initialCategories = [],
  initialNotes = [],
}: CompareClientProps) {
  const router = useRouter()
  const [activeBlock1, setActiveBlock1] = useState<'summary' | 'origin'>('summary')
  const [activeBlock2, setActiveBlock2] = useState<'summary' | 'origin'>('summary')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const supabase = createClient()

  const refreshCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (data) setCategories(data)
  }

  const refreshNotes = async () => {
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (data) setNotes(data)
  }

  useEffect(() => {
    setCategories(initialCategories)
    setNotes(initialNotes)
  }, [initialCategories, initialNotes])

  useEffect(() => {
    const onFocus = () => {
      refreshCategories()
      refreshNotes()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [userId])

  useEffect(() => {
    const categoriesChannel = supabase
      .channel('compare-categories')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories', filter: `user_id=eq.${userId}` },
        () => refreshCategories()
      )
      .subscribe()
    const notesChannel = supabase
      .channel('compare-notes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${userId}` },
        () => refreshNotes()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(categoriesChannel)
      supabase.removeChannel(notesChannel)
    }
  }, [userId])

  // 카테고리 이름 찾기
  const getCategoryName = (categoryId: string | null | undefined) => {
    if (!categoryId) return null
    return categories.find((c) => c.id === categoryId)?.name || null
  }

  return (
    <div className="h-screen flex bg-[var(--background)] overflow-hidden relative">
      <Sidebar
        notes={notes}
        categories={categories}
        selectedCategoryId={null}
        onSelectCategory={(id) => router.push(id ? `/dashboard?category=${id}` : '/dashboard')}
        onCategoriesChange={refreshCategories}
        userId={userId}
        selectedDate={null}
        onSelectDate={(date) => router.push(date ? `/dashboard?date=${format(date, 'yyyy-MM-dd')}` : '/dashboard')}
        calendarMonth={new Date()}
        onCalendarMonthChange={() => {}}
        filterStatus="all"
        onFilterStatusChange={() => {}}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col lg:min-w-[400px] min-h-0 relative">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-[var(--surface)]/80 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((o) => !o)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] lg:hidden"
              aria-label="메뉴 열기"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-sm font-medium text-[var(--foreground)]">듀얼 뷰</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-colors"
            >
              대시보드로
            </Link>
            <ThemeToggle />
            <span className="hidden text-sm text-[var(--foreground-subtle)] sm:inline">{userEmail || '익명'}</span>
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
          </div>
        </header>

        <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* 듀얼 뷰 컨테이너 - 각 패널 독립 스크롤 */}
          <div className="flex-1 min-h-0 flex overflow-hidden">
            {/* 왼쪽 노트 */}
            <div className="flex-1 min-h-0 min-w-0 flex flex-col border-r border-[var(--border)] overflow-hidden">
              <div className="flex-shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-[var(--foreground)] truncate">{note1.title}</h2>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${NOTE_STATUS_CONFIG[note1.status].className}`}>
                      {NOTE_STATUS_CONFIG[note1.status].label}
                    </span>
                  </div>
                  <Link
                    href={`/dashboard/notes/${note1.id}`}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-colors"
                  >
                    전체 보기
                  </Link>
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--foreground-subtle)]">
                  <span>{format(new Date(note1.created_at), 'yyyy.M.d HH:mm', { locale: ko })}</span>
                  {getCategoryName(note1.category_id) && (
                    <span className="rounded-full bg-[var(--surface-hover)] px-2 py-0.5">{getCategoryName(note1.category_id)}</span>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0 border-b border-[var(--border)] bg-[var(--surface-hover)] px-4 py-2">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveBlock1('summary')}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      activeBlock1 === 'summary'
                        ? 'bg-[var(--surface)] text-[var(--foreground)] shadow-sm'
                        : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    요약
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveBlock1('origin')}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      activeBlock1 === 'origin'
                        ? 'bg-[var(--surface)] text-[var(--foreground)] shadow-sm'
                        : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    원문
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
                <div className="p-4 sm:p-6">
                  {activeBlock1 === 'summary' ? (
                    note1.summary ? (
                      <SimpleMarkdown>{note1.summary}</SimpleMarkdown>
                    ) : (
                      <div className="text-center text-[var(--foreground-muted)] py-12">
                        <p>아직 요약이 생성되지 않았습니다.</p>
                      </div>
                    )
                  ) : (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)] font-mono">
                      {fileContent1 || '파일 내용을 불러올 수 없습니다.'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 오른쪽 노트 */}
            <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
              <div className="flex-shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-[var(--foreground)] truncate">{note2.title}</h2>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${NOTE_STATUS_CONFIG[note2.status].className}`}>
                      {NOTE_STATUS_CONFIG[note2.status].label}
                    </span>
                  </div>
                  <Link
                    href={`/dashboard/notes/${note2.id}`}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-colors"
                  >
                    전체 보기
                  </Link>
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--foreground-subtle)]">
                  <span>{format(new Date(note2.created_at), 'yyyy.M.d HH:mm', { locale: ko })}</span>
                  {getCategoryName(note2.category_id) && (
                    <span className="rounded-full bg-[var(--surface-hover)] px-2 py-0.5">{getCategoryName(note2.category_id)}</span>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0 border-b border-[var(--border)] bg-[var(--surface-hover)] px-4 py-2">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveBlock2('summary')}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      activeBlock2 === 'summary'
                        ? 'bg-[var(--surface)] text-[var(--foreground)] shadow-sm'
                        : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    요약
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveBlock2('origin')}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      activeBlock2 === 'origin'
                        ? 'bg-[var(--surface)] text-[var(--foreground)] shadow-sm'
                        : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    원문
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
                <div className="p-4 sm:p-6">
                  {activeBlock2 === 'summary' ? (
                    note2.summary ? (
                      <SimpleMarkdown>{note2.summary}</SimpleMarkdown>
                    ) : (
                      <div className="text-center text-[var(--foreground-muted)] py-12">
                        <p>아직 요약이 생성되지 않았습니다.</p>
                      </div>
                    )
                  ) : (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)] font-mono">
                      {fileContent2 || '파일 내용을 불러올 수 없습니다.'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
