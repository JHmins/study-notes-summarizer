'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format, startOfDay, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale/ko'
import { toDateKey } from '@/lib/utils/format'
import type { Category, NoteForCalendar } from '@/types'
import CalendarNotes from './calendar-notes'
import SidebarCategories from './sidebar-categories'

export interface SidebarNote extends NoteForCalendar {
  status: string
  category_id?: string | null
}

interface SidebarProps {
  notes: SidebarNote[]
  categories: Category[]
  selectedCategoryId: string | null
  onSelectCategory: (id: string | null) => void
  onCategoriesChange: () => void
  userId: string
  selectedDate: Date | null
  onSelectDate: (date: Date | null) => void
  calendarMonth: Date
  onCalendarMonthChange: (date: Date) => void
  filterStatus: string
  onFilterStatusChange: (status: string) => void
  /** 대시보드에서만 전달: 전체 노트 클릭 시 필터 해제 후 이동 */
  onFullNotesClick?: () => void
  mobileOpen?: boolean
  onMobileClose?: () => void
}


export default function Sidebar({
  notes,
  categories,
  selectedCategoryId,
  onSelectCategory,
  onCategoriesChange,
  userId,
  selectedDate,
  onSelectDate,
  calendarMonth,
  onCalendarMonthChange,
  filterStatus,
  onFilterStatusChange,
  onFullNotesClick,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const today = startOfDay(new Date())
  const todayKey = format(today, 'yyyy-MM-dd')
  const weekStart = startOfWeek(today, { locale: ko })
  const weekEnd = endOfWeek(today, { locale: ko })

  const todayCount = notes.filter((n) => toDateKey(n.created_at) === todayKey).length
  const weekCount = notes.filter((n) =>
    isWithinInterval(parseISO(n.created_at), { start: weekStart, end: weekEnd })
  ).length

  const notesCountByCategory = notes.reduce<Record<string, number>>((acc, n) => {
    const id = n.category_id ?? '_none'
    acc[id] = (acc[id] ?? 0) + 1
    return acc
  }, {})

  const recentNotes = notes.slice(0, 6)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDark(document.documentElement.classList.contains('dark'))
    }
    checkDarkMode()
    const observer = new MutationObserver(checkDarkMode)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const content = (
    <>
      <div className="flex h-14 shrink-0 items-center justify-between px-5 lg:justify-start">
        <Link href="/dashboard" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-[var(--foreground)] no-underline">
          <img 
            src={isDark ? "/logo-dark.png" : "/logo.png"} 
            alt="" 
            width={28} 
            height={28} 
            className="h-7 w-7 shrink-0 rounded-lg object-contain" 
          />
          Study Notes
        </Link>
        {onMobileClose && (
          <button
            type="button"
            onClick={onMobileClose}
            className="rounded-xl p-2 text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] lg:hidden"
            aria-label="메뉴 닫기"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <nav className="px-3 py-2">
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => { onMobileClose?.(); document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth' }); }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent-muted)]/50"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-muted)] text-[var(--accent)]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 4v16m8-8H4" />
              </svg>
            </span>
            새 노트 추가
          </button>
          {onFullNotesClick ? (
            <button
              type="button"
              onClick={() => { onFullNotesClick(); onMobileClose?.(); }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-hover)] text-[var(--foreground-subtle)]">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </span>
              전체 노트
            </button>
          ) : (
            <Link
              href="/dashboard"
              onClick={onMobileClose}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-hover)] text-[var(--foreground-subtle)]">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </span>
              전체 노트
            </Link>
          )}
          <button
            type="button"
            onClick={() => { onSelectDate(today); onSelectCategory(null); onFilterStatusChange('all'); onMobileClose?.(); }}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-hover)] text-[var(--foreground-subtle)]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </span>
            <span className="flex-1">오늘</span>
            {todayCount > 0 && (
              <span className="rounded-full bg-[var(--accent-muted)] px-2.5 py-0.5 text-xs font-medium text-[var(--accent)]">
                {todayCount}
              </span>
            )}
          </button>
          <Link
            href="/dashboard/graph"
            onClick={onMobileClose}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-hover)] text-[var(--foreground-subtle)]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </span>
            그래프 뷰
          </Link>
          <Link
            href="/dashboard/links"
            onClick={onMobileClose}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-hover)] text-[var(--foreground-subtle)]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </span>
            수업 자료
          </Link>
          <Link
            href="/dashboard/projects"
            onClick={onMobileClose}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-hover)] text-[var(--foreground-subtle)]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </span>
            프로젝트
          </Link>
        </div>
      </nav>

      <SidebarCategories
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={onSelectCategory}
        onCategoriesChange={onCategoriesChange}
        userId={userId}
        notesCountByCategory={notesCountByCategory}
        onMobileClose={onMobileClose}
      />

      <div className="px-4 py-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--foreground-subtle)]">
          통계
        </p>
        <div className="flex gap-4 text-sm text-[var(--foreground-muted)]">
          <span>총 {notes.length}개</span>
          <span>이번 주 {weekCount}개</span>
        </div>
      </div>

      <div className="flex-shrink-0 px-3 pb-4">
        <CalendarNotes
          notes={notes}
          selectedDate={selectedDate}
          onSelectDate={(d) => { onSelectDate(d); onMobileClose?.(); }}
          currentMonth={calendarMonth}
          onMonthChange={onCalendarMonthChange}
        />
      </div>

      <div className="mt-auto px-4 py-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--foreground-subtle)]">
          최근 노트
        </p>
        <ul className="space-y-0.5">
          {recentNotes.length === 0 ? (
            <li className="rounded-lg px-3 py-2 text-sm text-[var(--foreground-muted)]">아직 노트가 없어요.</li>
          ) : (
            recentNotes.map((note) => (
              <li key={note.id}>
                <Link
                  href={`/dashboard/notes/${note.id}`}
                  onClick={onMobileClose}
                  className="block truncate rounded-lg px-3 py-2 text-sm text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                >
                  {note.title || '제목 없음'}
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>
    </>
  )

  const baseClass =
    'fixed inset-y-0 left-0 z-20 flex w-72 h-screen flex-col min-h-0 overflow-y-auto bg-[var(--surface)] lg:sticky lg:top-0 lg:z-0 lg:h-screen lg:min-h-screen lg:self-start lg:shadow-[0_4px_24px_-4px_rgba(28,25,23,0.08)] dark:lg:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.35)]'

  if (onMobileClose) {
    return (
      <>
        <div
          className={`${baseClass} transform transition-transform duration-200 ease-out lg:transform-none ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          {content}
        </div>
        {mobileOpen && (
          <button
            type="button"
            aria-label="메뉴 배경 닫기"
            className="fixed inset-0 z-10 bg-black/40 lg:hidden"
            onClick={onMobileClose}
          />
        )}
      </>
    )
  }

  return <aside className={`${baseClass} hidden lg:flex`}>{content}</aside>
}
