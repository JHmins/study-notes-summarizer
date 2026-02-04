'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format, startOfDay, parseISO, isSameDay } from 'date-fns'
import { ko } from 'date-fns/locale/ko'
import Link from 'next/link'
import FileUpload from '@/components/file-upload'
import Sidebar from '@/components/sidebar'
import ThemeToggle from '@/components/theme-toggle'
import type { User } from '@supabase/supabase-js'
import type { SearchResult } from '@/app/api/search/route'
import type { Note, Category } from '@/types'
import { NOTE_STATUS_CONFIG } from '@/types'

interface DashboardClientProps {
  initialNotes: Note[]
  initialCategories: Category[]
  user: User
  isAdmin?: boolean
  /** URL ?date=yyyy-MM-dd 로 진입 시 오늘/날짜 필터 적용 */
  initialDate?: string
  /** URL ?category=id 로 진입 시 카테고리 필터 적용 */
  initialCategoryId?: string
}

type SortKey = 'newest' | 'oldest' | 'title'

export default function DashboardClient({ initialNotes, initialCategories, user, isAdmin, initialDate, initialCategoryId }: DashboardClientProps) {
  const router = useRouter()
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(initialCategoryId ?? null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
    if (!initialDate) return null
    const d = parseISO(initialDate)
    return isNaN(d.getTime()) ? null : startOfDay(d)
  })
  const [calendarMonth, setCalendarMonth] = useState(() => {
    if (initialDate) {
      const d = parseISO(initialDate)
      if (!isNaN(d.getTime())) return d
    }
    return new Date()
  })
  const [sortBy, setSortBy] = useState<SortKey>('newest')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [categoryUpdatingId, setCategoryUpdatingId] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [useFileSearch, setUseFileSearch] = useState(false)
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set())
  const supabase = createClient()
  const supabaseRef = useRef(supabase)
  supabaseRef.current = supabase

  // 서버에서 받은 최신 데이터와 동기화 (다른 페이지에서 삭제 후 돌아왔을 때 등)
  useEffect(() => {
    setNotes(initialNotes)
    setCategories(initialCategories)
  }, [initialNotes, initialCategories])

  // URL 검색 파라미터 변경 시 날짜/카테고리 필터 동기화 (전체 노트 클릭 등)
  useEffect(() => {
    setSelectedCategoryId(initialCategoryId ?? null)
    if (initialDate) {
      const d = parseISO(initialDate)
      setSelectedDate(isNaN(d.getTime()) ? null : startOfDay(d))
      setCalendarMonth(isNaN(d.getTime()) ? new Date() : d)
    } else {
      setSelectedDate(null)
      setCalendarMonth(new Date())
    }
  }, [initialDate, initialCategoryId])

  // URL 파라미터에서 compare 노트 ID 가져오기
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const compareId = params.get('compare')
      if (compareId && notes.some((n) => n.id === compareId)) {
        setSelectedNotes(new Set([compareId]))
        // URL에서 파라미터 제거
        const newUrl = new URL(window.location.href)
        newUrl.searchParams.delete('compare')
        window.history.replaceState({}, '', newUrl.toString())
      }
    }
  }, [notes])

  // 파일 내용 검색
  const searchInFiles = useCallback(async (query: string) => {
    if (!query.trim() || query.trim().length < 2) {
      setSearchResults([])
      setUseFileSearch(false)
      return
    }

    setIsSearching(true)
    setUseFileSearch(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
      if (res.ok) {
        const data = await res.json()
        setSearchResults(data.results || [])
      } else {
        setSearchResults([])
      }
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  // 검색어 변경 시 디바운스
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchInFiles(searchQuery)
      } else {
        setSearchResults([])
        setUseFileSearch(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery, searchInFiles])

  const handleSignOut = async () => {
    await supabaseRef.current.auth.signOut()
    window.location.href = '/auth/login'
  }

  const refreshNotes = useCallback(async () => {
    const { data } = await supabaseRef.current.from('notes').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    if (data) setNotes(data)
  }, [user.id])

  const refreshCategories = useCallback(async () => {
    const { data } = await supabaseRef.current.from('categories').select('*').eq('user_id', user.id).order('sort_order').order('created_at')
    if (data) setCategories(data)
  }, [user.id])

  // 탭/창 포커스 시 목록 다시 불러오기 (삭제·업로드가 다른 탭에서 되었을 때)
  useEffect(() => {
    const onFocus = () => {
      refreshNotes()
      refreshCategories()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshNotes, refreshCategories])

  const filteredNotes = useMemo(() => {
    let list = notes.filter((note) => {
      const matchesSearch =
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (note.summary && note.summary.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesStatus = filterStatus === 'all' || note.status === filterStatus
      const matchesDate =
        !selectedDate || isSameDay(startOfDay(parseISO(note.created_at)), selectedDate)
      const matchesCategory =
        selectedCategoryId === null
          ? true
          : selectedCategoryId === '_none'
            ? (note.category_id ?? null) === null
            : (note.category_id ?? null) === selectedCategoryId
      return matchesSearch && matchesStatus && matchesDate && matchesCategory
    })

    const cmp = (a: Note, b: Note) => {
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      return (a.title || '').localeCompare(b.title || '', 'ko')
    }
    list = [...list].sort(cmp)
    return list
  }, [notes, searchQuery, filterStatus, selectedDate, selectedCategoryId, sortBy])

  useEffect(() => {
    const ch = supabaseRef.current.channel('notes-changes')
    ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${user.id}` },
      () => refreshNotes()
    )
    ch.subscribe()
    return () => { supabaseRef.current.removeChannel(ch) }
  }, [user.id, refreshNotes])

  return (
    <div className="min-h-screen flex bg-[var(--background)]">
      <Sidebar
        notes={notes}
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={setSelectedCategoryId}
        onCategoriesChange={refreshCategories}
        userId={user.id}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        calendarMonth={calendarMonth}
        onCalendarMonthChange={setCalendarMonth}
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
        onFullNotesClick={() => {
          setSelectedDate(null)
          setSelectedCategoryId(null)
          setCalendarMonth(new Date())
          setFilterStatus('all')
          router.replace('/dashboard')
        }}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col lg:min-w-[400px]">
        {/* 상단 바: 메뉴 버튼 + 타이틀 + 로그아웃 */}
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
            <div className="flex items-center gap-2">
              {selectedCategoryId ? (
                <span className="text-sm font-medium text-[var(--foreground)]">
                  {selectedCategoryId === '_none'
                    ? '미분류'
                    : categories.find((c) => c.id === selectedCategoryId)?.name ?? '카테고리'}{' '}
                  노트
                </span>
              ) : selectedDate ? (
                <span className="text-sm font-medium text-[var(--foreground)]">
                  {format(selectedDate, 'M월 d일 노트', { locale: ko })}
                </span>
              ) : (
                <span className="text-sm font-medium text-[var(--foreground-muted)]">노트</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <span className="hidden text-sm text-[var(--foreground-subtle)] sm:inline">
              {user.email || '익명'}
            </span>
            {isAdmin && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-muted)] px-2 py-1 text-xs font-medium text-[var(--accent)]">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                관리자
              </span>
            )}
            {isAdmin && (
              <Link
                href="/admin/approvals"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--accent)] hover:underline"
              >
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

        <main className="flex-1 overflow-auto px-4 py-6 sm:px-6">
          {/* 검색 + 정렬 */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)]">
                {isSearching ? (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
              </span>
              <input
                type="text"
                placeholder="파일 내용 검색 (2글자 이상)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2.5 pl-9 pr-4 text-[var(--foreground)] placeholder-[var(--foreground-subtle)] focus:border-[var(--border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)]"
              />
              {useFileSearch && searchQuery.trim().length >= 2 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <span className="text-xs text-[var(--accent)] font-medium">파일 검색 중</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="sort" className="text-sm text-[var(--foreground-subtle)]">
                정렬
              </label>
              <select
                id="sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--border-focus)] focus:outline-none"
              >
                <option value="newest">최신순</option>
                <option value="oldest">오래된순</option>
                <option value="title">제목순</option>
              </select>
            </div>
          </div>

          {/* 선택된 필터 해제 */}
          {(selectedDate || selectedCategoryId) && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              {selectedDate && (
                <span className="text-sm text-[var(--foreground-muted)]">
                  {format(selectedDate, 'yyyy년 M월 d일', { locale: ko })} 보기 중
                </span>
              )}
              {selectedCategoryId && (
                <span className="text-sm text-[var(--foreground-muted)]">
                  {selectedCategoryId === '_none'
                    ? '미분류'
                    : categories.find((c) => c.id === selectedCategoryId)?.name}{' '}
                  보기 중
                </span>
              )}
              <button
                type="button"
                onClick={() => { setSelectedDate(null); setSelectedCategoryId(null); }}
                className="text-sm font-medium text-[var(--accent)] hover:underline"
              >
                필터 해제
              </button>
            </div>
          )}

          {/* 파일 검색 결과 */}
          {useFileSearch && searchQuery.trim().length >= 2 && (
            <div className="mb-6">
              {isSearching ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
                  <p className="mt-3 text-sm text-[var(--foreground-muted)]">파일 내용을 검색하는 중...</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--foreground-muted)]">
                  <p className="text-sm">검색어 &quot;{searchQuery}&quot;와 일치하는 내용을 찾을 수 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">
                      검색 결과 ({searchResults.length}개)
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('')
                        setSearchResults([])
                        setUseFileSearch(false)
                      }}
                      className="text-xs text-[var(--foreground-subtle)] hover:text-[var(--foreground)]"
                    >
                      검색 초기화
                    </button>
                  </div>
                  {searchResults.map((result) => {
                    const note = notes.find((n) => n.id === result.noteId)
                    const isSelected = note ? selectedNotes.has(note.id) : false
                    return (
                      <div
                        key={result.noteId}
                        className={`group flex items-start gap-2 rounded-xl border ${
                          isSelected ? 'border-[var(--accent)] bg-[var(--accent-muted)]/20' : 'border-[var(--border)] bg-[var(--surface)]'
                        } p-4 shadow-card transition-shadow hover:border-[var(--border-focus)] hover:shadow-card-hover`}
                      >
                        {note && (
                          <label
                            className={`mt-1 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 transition-[border-color,background-color,box-shadow] duration-200 focus-within:ring-2 focus-within:ring-[var(--accent)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--surface)] ${
                              isSelected
                                ? 'border-[var(--accent)] bg-[var(--accent)]'
                                : 'border-[var(--border)] bg-transparent hover:border-[var(--foreground-subtle)]'
                            }`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const newSelected = new Set(selectedNotes)
                                if (e.target.checked) {
                                  if (newSelected.size >= 2) {
                                    alert('최대 2개의 노트만 선택할 수 있습니다.')
                                    return
                                  }
                                  newSelected.add(note.id)
                                } else {
                                  newSelected.delete(note.id)
                                }
                                setSelectedNotes(newSelected)
                              }}
                              className="sr-only"
                              aria-label="비교용으로 선택"
                            />
                            {isSelected && (
                              <svg className="h-3 w-3 text-white pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                <path d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </label>
                        )}
                        <Link
                          href={`/dashboard/notes/${result.noteId}`}
                          className="min-w-0 flex-1"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <h4 className="text-base font-semibold text-[var(--foreground)] mb-1">
                                {result.title}
                              </h4>
                              <p className="text-xs text-[var(--foreground-subtle)] mb-3">
                                {format(new Date(result.created_at), 'yyyy.M.d HH:mm', { locale: ko })} · {result.matchCount}개 매칭
                              </p>
                              <div className="space-y-2">
                                {result.matches.slice(0, 3).map((match, idx) => (
                                  <div
                                    key={idx}
                                    className="rounded-md bg-[var(--surface-hover)] p-2 text-sm text-[var(--foreground-muted)]"
                                  >
                                    {match.lineNumber && (
                                      <span className="text-xs text-[var(--foreground-subtle)] mr-2">
                                        {match.lineNumber}줄:
                                      </span>
                                    )}
                                    <span
                                      dangerouslySetInnerHTML={{
                                        __html: match.context.replace(
                                          new RegExp(`(${searchQuery})`, 'gi'),
                                          '<mark class="bg-[var(--accent)]/30 text-[var(--accent)] font-medium">$1</mark>'
                                        ),
                                      }}
                                    />
                                  </div>
                                ))}
                                {result.matchCount > 3 && (
                                  <p className="text-xs text-[var(--foreground-subtle)]">
                                    + {result.matchCount - 3}개 더...
                                  </p>
                                )}
                              </div>
                            </div>
                            {note && (
                              <span
                                className={`shrink-0 self-start rounded-full px-2.5 py-1 text-xs font-medium ${NOTE_STATUS_CONFIG[note.status].className}`}
                              >
                                {NOTE_STATUS_CONFIG[note.status].label}
                              </span>
                            )}
                          </div>
                        </Link>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <section id="upload" className="scroll-mt-4 mb-6">
            <FileUpload
              onUploadComplete={() => {
                refreshNotes()
                refreshCategories()
                // 요약 처리 반영을 위해 잠시 후 한 번 더 갱신
                setTimeout(() => { refreshNotes() }, 2000)
                setTimeout(() => { refreshNotes() }, 5000)
              }}
              defaultCategoryId={selectedCategoryId}
              categories={categories}
            />
          </section>

          {/* 노트 목록 */}
          {!useFileSearch && (
            <div>
              {filteredNotes.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-12 text-center text-[var(--foreground-muted)]">
                  {notes.length === 0
                    ? '업로드한 노트가 없습니다. 위에서 .txt 파일을 올려보세요.'
                    : selectedDate
                    ? '이 날짜에 업로드한 노트가 없습니다.'
                    : selectedCategoryId
                    ? selectedCategoryId === '_none'
                      ? '미분류 노트가 없습니다.'
                      : '이 카테고리에 노트가 없습니다.'
                    : '검색·필터 조건에 맞는 노트가 없습니다.'}
                </div>
              ) : (
              <>
                {selectedNotes.size === 2 && (
                  <div className="mb-4 flex items-center justify-between rounded-xl border border-[var(--accent)] bg-[var(--accent-muted)]/30 px-4 py-3">
                    <span className="text-sm font-medium text-[var(--accent)]">
                      {selectedNotes.size}개의 노트가 선택되었습니다
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const ids = Array.from(selectedNotes)
                          if (ids.length === 2) {
                            window.location.href = `/dashboard/compare?id1=${ids[0]}&id2=${ids[1]}`
                          }
                        }}
                        className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
                      >
                        비교하기
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedNotes(new Set())}
                        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                      >
                        선택 취소
                      </button>
                    </div>
                  </div>
                )}
                <ul className="space-y-2">
                  {filteredNotes.map((note) => {
                    const isSelected = selectedNotes.has(note.id)
                    return (
                      <li key={note.id}>
                        <div className={`group flex items-start gap-2 rounded-xl border ${
                          isSelected ? 'border-[var(--accent)] bg-[var(--accent-muted)]/20' : 'border-[var(--border)] bg-[var(--surface)]'
                        } p-4 shadow-card transition-shadow hover:border-[var(--border-focus)] hover:shadow-card-hover sm:p-5`}>
                          <label
                            className={`mt-1 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 transition-[border-color,background-color,box-shadow] duration-200 focus-within:ring-2 focus-within:ring-[var(--accent)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--surface)] ${
                              isSelected
                                ? 'border-[var(--accent)] bg-[var(--accent)]'
                                : 'border-[var(--border)] bg-transparent hover:border-[var(--foreground-subtle)]'
                            }`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const newSelected = new Set(selectedNotes)
                                if (e.target.checked) {
                                  if (newSelected.size >= 2) {
                                    alert('최대 2개의 노트만 선택할 수 있습니다.')
                                    return
                                  }
                                  newSelected.add(note.id)
                                } else {
                                  newSelected.delete(note.id)
                                }
                                setSelectedNotes(newSelected)
                              }}
                              className="sr-only"
                              aria-label="비교용으로 선택"
                            />
                            {isSelected && (
                              <svg className="h-3 w-3 text-white pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                <path d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </label>
                          <Link
                            href={`/dashboard/notes/${note.id}`}
                            className="min-w-0 flex-1"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0 flex-1">
                                <h3 className="truncate text-base font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)] sm:text-lg">
                                  {note.title}
                                </h3>
                                <p className="mt-0.5 text-sm text-[var(--foreground-subtle)]">
                                  {format(new Date(note.created_at), 'yyyy.M.d HH:mm', { locale: ko })}
                                </p>
                                {note.summary && (
                                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--foreground-muted)]">
                                    {note.summary.replace(/^#+\s*/gm, '').replace(/\n+/g, ' ').trim().slice(0, 200)}
                                    {note.summary.length > 200 ? '…' : ''}
                                  </p>
                                )}
                              </div>
                              <span
                                className={`shrink-0 self-start rounded-full px-2.5 py-1 text-xs font-medium ${NOTE_STATUS_CONFIG[note.status].className}`}
                              >
                                {NOTE_STATUS_CONFIG[note.status].label}
                              </span>
                            </div>
                          </Link>
                          <div
                            className="shrink-0 flex items-center gap-1"
                            onClick={(e) => e.preventDefault()}
                          >
                            <select
                              value={note.category_id ?? ''}
                              onChange={async (e) => {
                                const next = e.target.value === '' ? null : e.target.value
                                if ((note.category_id ?? null) === next) return
                                setCategoryUpdatingId(note.id)
                                const res = await fetch(`/api/notes/${note.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ category_id: next }),
                                })
                                setCategoryUpdatingId(null)
                                if (res.ok) {
                                  refreshNotes()
                                } else {
                                  const data = await res.json().catch(() => ({}))
                                  alert(data.error || '카테고리 변경에 실패했습니다.')
                                }
                              }}
                              disabled={categoryUpdatingId === note.id}
                              className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--foreground)] focus:border-[var(--border-focus)] focus:outline-none disabled:opacity-60"
                              aria-label="카테고리 선택"
                            >
                              <option value="">미분류</option>
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.preventDefault()
                              if (!confirm('이 노트를 삭제할까요?')) return
                              const res = await fetch(`/api/notes/${note.id}`, { method: 'DELETE' })
                              if (res.ok) refreshNotes()
                              else {
                                const data = await res.json().catch(() => ({}))
                                alert(data.error || '삭제에 실패했습니다.')
                              }
                            }}
                            className="shrink-0 rounded p-2 text-[var(--foreground-subtle)] hover:bg-[var(--error-muted)] hover:text-[var(--error)]"
                            aria-label="노트 삭제"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
