'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  /** 수업 자료 링크 총 개수 */
  initialLinksCount?: number
  /** 프로젝트 총 개수 */
  initialProjectsCount?: number
  user: User
  isAdmin?: boolean
  /** URL ?date=yyyy-MM-dd 로 진입 시 오늘/날짜 필터 적용 */
  initialDate?: string
  /** URL ?category=id 로 진입 시 카테고리 필터 적용 */
  initialCategoryId?: string
}

type SortKey = 'newest' | 'oldest' | 'title'

export default function DashboardClient({ initialNotes, initialCategories, initialLinksCount = 0, initialProjectsCount = 0, user, isAdmin, initialDate, initialCategoryId }: DashboardClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
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
  const [perPage, setPerPage] = useState<number | 'all'>(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [favoriteUpdatingId, setFavoriteUpdatingId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [categoryUpdatingId, setCategoryUpdatingId] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [useFileSearch, setUseFileSearch] = useState(false)
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set())
  const STUDY_SESSION_KEY = 'studySessionStart'
  const [visitSeconds, setVisitSeconds] = useState(0)
  const [linksCount, setLinksCount] = useState(initialLinksCount)
  const [projectsCount, setProjectsCount] = useState(initialProjectsCount)
  const sessionStartRef = useRef<number>(0)
  const supabase = createClient()
  const supabaseRef = useRef(supabase)
  supabaseRef.current = supabase

  // 공부 시간 타이머 (클라이언트에서만 sessionStorage 읽기 — 서버/클라이언트 초기 렌더 일치로 hydration 에러 방지)
  useEffect(() => {
    const getSessionStart = () => {
      const stored = sessionStorage.getItem(STUDY_SESSION_KEY)
      if (stored) return parseInt(stored, 10)
      const now = Date.now()
      sessionStorage.setItem(STUDY_SESSION_KEY, String(now))
      return now
    }
    sessionStartRef.current = getSessionStart()
    const tick = () => setVisitSeconds(Math.max(0, Math.floor((Date.now() - sessionStartRef.current) / 1000)))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [])

  // 서버에서 받은 최신 데이터와 동기화 (다른 페이지에서 삭제 후 돌아왔을 때 등)
  useEffect(() => {
    setNotes(initialNotes)
    setCategories(initialCategories)
    setLinksCount(initialLinksCount)
    setProjectsCount(initialProjectsCount)
  }, [initialNotes, initialCategories, initialLinksCount, initialProjectsCount])

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

  // 다른 페이지에서 "전체 노트" 클릭 시(?reset=1) 첫 페이지로 이동
  useEffect(() => {
    if (searchParams.get('reset') === '1') {
      setCurrentPage(1)
      router.replace('/dashboard', { scroll: false })
    }
  }, [searchParams, router])

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
    const { data: notesData } = await supabaseRef.current.from('notes').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    if (!notesData?.length) {
      setNotes(notesData ?? [])
      return
    }
    const noteIds = notesData.map((n) => n.id)
    const { data: nc } = await supabaseRef.current.from('note_categories').select('note_id, category_id').in('note_id', noteIds)
    const merged = notesData.map((n) => ({
      ...n,
      category_ids: (nc ?? []).filter((x) => x.note_id === n.id).map((x) => x.category_id),
    }))
    setNotes(merged)
  }, [user.id])

  const refreshCategories = useCallback(async () => {
    const { data } = await supabaseRef.current
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (data) setCategories(data)
  }, [user.id])

  const refreshCounts = useCallback(async () => {
    const [linksRes, projectsRes] = await Promise.all([
      supabaseRef.current.from('study_links').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabaseRef.current.from('projects').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    ])
    if (linksRes.count != null) setLinksCount(linksRes.count)
    if (projectsRes.count != null) setProjectsCount(projectsRes.count)
  }, [user.id])

  // 마운트 시 목록 새로 불러오기 (뒤로 가기 등으로 돌아왔을 때 최신 업로드·삭제 반영)
  useEffect(() => {
    refreshNotes()
    refreshCategories()
    refreshCounts()
  }, [refreshNotes, refreshCategories, refreshCounts])

  // bfcache(뒤로가기 캐시) 복원 시 목록 다시 불러오기
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        refreshNotes()
        refreshCategories()
        refreshCounts()
      }
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [refreshNotes, refreshCategories, refreshCounts])

  // 탭/창 포커스 시 목록 다시 불러오기 (삭제·업로드가 다른 탭에서 되었을 때)
  useEffect(() => {
    const onFocus = () => {
      refreshNotes()
      refreshCategories()
      refreshCounts()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshNotes, refreshCategories, refreshCounts])

  const filteredNotes = useMemo(() => {
    let list = notes.filter((note) => {
      const matchesSearch =
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (note.summary && note.summary.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesStatus = filterStatus === 'all' || note.status === filterStatus
      const matchesDate =
        !selectedDate || isSameDay(startOfDay(parseISO(note.created_at)), selectedDate)
      const noteCategoryIds = note.category_ids ?? (note.category_id ? [note.category_id] : [])
      const matchesCategory =
        selectedCategoryId === null
          ? true
          : selectedCategoryId === '_favorites'
            ? !!note.is_favorite
            : selectedCategoryId === '_none'
              ? noteCategoryIds.length === 0
              : noteCategoryIds.includes(selectedCategoryId)
      const matchesFavorite = !showFavoritesOnly || !!note.is_favorite
      return matchesSearch && matchesStatus && matchesDate && matchesCategory && matchesFavorite
    })

    const cmp = (a: Note, b: Note) => {
      const favA = a.is_favorite ? 1 : 0
      const favB = b.is_favorite ? 1 : 0
      if (favB !== favA) return favB - favA
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      return (a.title || '').localeCompare(b.title || '', 'ko')
    }
    list = [...list].sort(cmp)
    return list
  }, [notes, searchQuery, filterStatus, selectedDate, selectedCategoryId, sortBy, showFavoritesOnly])

  const perPageOptions = [1, 3, 5, 7, 10, 'all'] as const
  const totalPages = perPage === 'all' ? 1 : Math.max(1, Math.ceil(filteredNotes.length / perPage))
  const paginatedNotes = useMemo(() => {
    if (perPage === 'all') return filteredNotes
    const start = (currentPage - 1) * perPage
    return filteredNotes.slice(start, start + perPage)
  }, [filteredNotes, perPage, currentPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [perPage, searchQuery, filterStatus, selectedDate, selectedCategoryId, sortBy, showFavoritesOnly])

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(Math.max(1, totalPages))
  }, [currentPage, totalPages])

  useEffect(() => {
    const ch = supabaseRef.current.channel('notes-changes')
    ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${user.id}` },
      () => refreshNotes()
    )
    ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'note_categories' },
      () => refreshNotes()
    )
    ch.subscribe()
    return () => { supabaseRef.current.removeChannel(ch) }
  }, [user.id, refreshNotes])

  useEffect(() => {
    const categoriesChannel = supabaseRef.current
      .channel('categories-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories', filter: `user_id=eq.${user.id}` },
        () => refreshCategories()
      )
      .subscribe()
    return () => { supabaseRef.current.removeChannel(categoriesChannel) }
  }, [user.id, refreshCategories])

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
          setCurrentPage(1)
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
                  {selectedCategoryId === '_favorites'
                    ? '즐겨찾기'
                    : selectedCategoryId === '_none'
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
          {/* 나의 학습 통계 (맨 앞 배치) */}
          <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="나의 학습 통계">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm transition-shadow hover:shadow-md">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--foreground-subtle)]">총 노트</p>
              <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{notes.length}<span className="text-base font-normal text-[var(--foreground-muted)]">개</span></p>
              <p className="mt-0.5 text-xs text-[var(--foreground-subtle)]">정리한 파일</p>
            </div>
            <Link href="/dashboard/links" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm transition-shadow hover:shadow-md hover:border-[var(--accent)]/40">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--foreground-subtle)]">수업 자료</p>
              <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{linksCount}<span className="text-base font-normal text-[var(--foreground-muted)]">개</span></p>
              <p className="mt-0.5 text-xs text-[var(--foreground-subtle)]">저장한 링크</p>
            </Link>
            <Link href="/dashboard/projects" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm transition-shadow hover:shadow-md hover:border-[var(--accent)]/40">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--foreground-subtle)]">프로젝트</p>
              <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{projectsCount}<span className="text-base font-normal text-[var(--foreground-muted)]">개</span></p>
              <p className="mt-0.5 text-xs text-[var(--foreground-subtle)]">진행 중</p>
            </Link>
            <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent-muted)]/20 p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--accent)]">공부 시간</p>
              <p className="mt-1 text-2xl font-bold text-[var(--accent)]">
                {visitSeconds >= 3600
                  ? `${Math.floor(visitSeconds / 3600)}시간 ${Math.floor((visitSeconds % 3600) / 60)}분`
                  : visitSeconds >= 60
                    ? `${Math.floor(visitSeconds / 60)}분 ${visitSeconds % 60}초`
                    : `${visitSeconds}초`}
              </p>
              <p className="mt-0.5 text-xs text-[var(--foreground-subtle)]">오늘 공부/방문한 시간</p>
            </div>
          </section>

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
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label htmlFor="perPage" className="text-sm text-[var(--foreground-subtle)]">
                  보기
                </label>
                <select
                  id="perPage"
                  value={perPage}
                  onChange={(e) => setPerPage(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--border-focus)] focus:outline-none"
                >
                  {perPageOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === 'all' ? '전체' : `${opt}개`}
                    </option>
                  ))}
                </select>
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
              <button
                type="button"
                onClick={() => setShowFavoritesOnly((v) => !v)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  showFavoritesOnly
                    ? 'border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)]'
                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]'
                }`}
                aria-pressed={showFavoritesOnly}
                aria-label="즐겨찾기만 보기"
              >
                <svg className="h-4 w-4" fill={showFavoritesOnly ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                즐겨찾기만
              </button>
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
                  {selectedCategoryId === '_favorites'
                    ? '즐겨찾기'
                    : selectedCategoryId === '_none'
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
                                className={`shrink-0 self-start rounded-full px-1.5 py-0.5 text-[10px] font-medium sm:px-2.5 sm:py-1 sm:text-xs ${NOTE_STATUS_CONFIG[note.status].className}`}
                                title={NOTE_STATUS_CONFIG[note.status].label}
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
              defaultCategoryId={selectedCategoryId === '_favorites' ? null : selectedCategoryId}
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
                    ? selectedCategoryId === '_favorites'
                      ? '즐겨찾기 노트가 없습니다.'
                      : selectedCategoryId === '_none'
                        ? '미분류 노트가 없습니다.'
                        : '이 카테고리에 노트가 없습니다.'
                    : '검색·필터 조건에 맞는 노트가 없습니다.'}
                </div>
              ) : (
              <>
                {selectedNotes.size === 2 && (
                  <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[var(--accent)] bg-[var(--accent-muted)]/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                    <span className="shrink-0 text-sm font-medium text-[var(--accent)]">
                      {selectedNotes.size}개의 노트가 선택되었습니다
                    </span>
                    <div className="flex shrink-0 items-center justify-end gap-2 sm:justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          const ids = Array.from(selectedNotes)
                          if (ids.length === 2) {
                            window.location.href = `/dashboard/compare?id1=${ids[0]}&id2=${ids[1]}`
                          }
                        }}
                        className="whitespace-nowrap rounded-lg bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                      >
                        비교하기
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedNotes(new Set())}
                        className="whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                      >
                        선택 취소
                      </button>
                    </div>
                  </div>
                )}
                <ul className="space-y-2">
                  {paginatedNotes.map((note) => {
                    const isSelected = selectedNotes.has(note.id)
                    return (
                      <li key={note.id}>
                        <div className={`group flex flex-col gap-3 rounded-xl border ${
                          isSelected ? 'border-[var(--accent)] bg-[var(--accent-muted)]/20' : 'border-[var(--border)] bg-[var(--surface)]'
                        } p-4 shadow-card transition-shadow hover:border-[var(--border-focus)] hover:shadow-card-hover sm:flex-row sm:items-center sm:gap-3 sm:p-5`}>
                          {/* 모바일: 위쪽에 제목·날짜·요약, 아래쪽에 액션 → 가독성 확보. 체크박스는 제목과 같은 줄 */}
                          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:min-w-0 sm:flex-1">
                            {/* 제목 줄: 체크박스 + 제목 + 상태 칩 + 즐겨찾기 (한 줄 정렬) */}
                            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                              <label
                                className={`flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 transition-[border-color,background-color,box-shadow] duration-200 focus-within:ring-2 focus-within:ring-[var(--accent)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--surface)] ${
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
                                <h3 className="break-words text-base font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)] sm:truncate sm:text-lg">
                                  {note.title}
                                </h3>
                              </Link>
                              <span
                                className={`w-fit shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium sm:px-2.5 sm:py-1 sm:text-xs ${NOTE_STATUS_CONFIG[note.status].className}`}
                                title={NOTE_STATUS_CONFIG[note.status].label}
                              >
                                {NOTE_STATUS_CONFIG[note.status].label}
                              </span>
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  const next = !note.is_favorite
                                  setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, is_favorite: next } : n)))
                                  setFavoriteUpdatingId(note.id)
                                  const res = await fetch(`/api/notes/${note.id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ is_favorite: next }),
                                  })
                                  setFavoriteUpdatingId(null)
                                  if (!res.ok) {
                                    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, is_favorite: note.is_favorite } : n)))
                                    const data = await res.json().catch(() => ({}))
                                    alert(data.error || '즐겨찾기 변경에 실패했습니다.')
                                  }
                                }}
                                disabled={favoriteUpdatingId === note.id}
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-60 ${
                                  note.is_favorite
                                    ? 'text-amber-500 hover:bg-amber-500/10'
                                    : 'text-[var(--foreground-subtle)] hover:bg-[var(--surface-hover)] hover:text-amber-500/80'
                                }`}
                                aria-label={note.is_favorite ? '즐겨찾기 해제' : '즐겨찾기'}
                                title={note.is_favorite ? '즐겨찾기 해제' : '즐겨찾기'}
                              >
                                <svg className="h-4 w-4" fill={note.is_favorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                </svg>
                              </button>
                            </div>
                            {/* 날짜·요약 (클릭 시 노트 상세로 이동) */}
                            <Link
                              href={`/dashboard/notes/${note.id}`}
                              className="block min-w-0"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-[var(--foreground-subtle)]">
                                  {format(new Date(note.created_at), 'yyyy.M.d HH:mm', { locale: ko })}
                                </p>
                                {note.summary && (
                                  <p className="mt-2 line-clamp-2 break-words text-sm leading-relaxed text-[var(--foreground-muted)]">
                                    {note.summary.replace(/^#+\s*/gm, '').replace(/\n+/g, ' ').trim().slice(0, 200)}
                                    {note.summary.length > 200 ? '…' : ''}
                                  </p>
                                )}
                              </div>
                            </Link>
                          </div>
                          <div
                            className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3 sm:shrink-0 sm:border-0 sm:pt-0"
                            onClick={(e) => e.preventDefault()}
                          >
                            <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5 sm:max-w-[220px]">
                              {(note.category_ids ?? (note.category_id ? [note.category_id] : [])).map((cid) => {
                                const cat = categories.find((c) => c.id === cid)
                                return (
                                  <span
                                    key={cid}
                                    className="inline-flex items-center gap-0.5 rounded-md bg-[var(--accent-muted)] px-1.5 py-0.5 text-xs text-[var(--accent)]"
                                    title={cat?.name ?? cid}
                                  >
                                    <span className="truncate max-w-[80px]">{cat?.name ?? cid}</span>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const current = note.category_ids ?? (note.category_id ? [note.category_id] : [])
                                        const next = current.filter((id) => id !== cid)
                                        setCategoryUpdatingId(note.id)
                                        setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, category_ids: next } : n)))
                                        const res = await fetch(`/api/notes/${note.id}`, {
                                          method: 'PATCH',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ category_ids: next }),
                                        })
                                        setCategoryUpdatingId(null)
                                        if (!res.ok) {
                                          setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, category_ids: current } : n)))
                                          const data = await res.json().catch(() => ({}))
                                          alert(data.error || '카테고리 제거에 실패했습니다.')
                                        } else {
                                          refreshNotes()
                                        }
                                      }}
                                      disabled={categoryUpdatingId === note.id}
                                      className="rounded p-0.5 hover:bg-[var(--accent)]/20 disabled:opacity-50"
                                      aria-label={`${cat?.name ?? cid} 제거`}
                                    >
                                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </span>
                                )
                              })}
                              {categories.length > 0 && (
                                <select
                                  value=""
                                  onChange={async (e) => {
                                    const addId = e.target.value
                                    if (!addId) return
                                    e.target.value = ''
                                    const current = note.category_ids ?? (note.category_id ? [note.category_id] : [])
                                    if (current.includes(addId)) return
                                    const next = [...current, addId]
                                    setCategoryUpdatingId(note.id)
                                    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, category_ids: next } : n)))
                                    const res = await fetch(`/api/notes/${note.id}`, {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ category_ids: next }),
                                    })
                                    setCategoryUpdatingId(null)
                                    if (!res.ok) {
                                      setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, category_ids: current } : n)))
                                      const data = await res.json().catch(() => ({}))
                                      alert(data.error || '카테고리 추가에 실패했습니다.')
                                    } else {
                                      refreshNotes()
                                    }
                                  }}
                                  disabled={categoryUpdatingId === note.id}
                                  className="max-w-[100px] min-w-0 truncate rounded border border-dashed border-[var(--border)] bg-transparent px-1.5 py-0.5 text-xs text-[var(--foreground-muted)] focus:border-[var(--border-focus)] focus:outline-none disabled:opacity-60"
                                  aria-label="카테고리 추가"
                                >
                                  <option value="">+ 추가</option>
                                  {categories.filter((c) => !(note.category_ids ?? (note.category_id ? [note.category_id] : [])).includes(c.id)).map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                  ))}
                                </select>
                              )}
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
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--foreground-subtle)] hover:bg-[var(--error-muted)] hover:text-[var(--error)]"
                              aria-label="노트 삭제"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>

                {/* 페이지네이션 */}
                {totalPages > 1 && (
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--border)] pt-6">
                    <p className="text-sm text-[var(--foreground-subtle)]">
                      {perPage === 'all'
                        ? `전체 ${filteredNotes.length}개`
                        : `${filteredNotes.length}개 중 ${(currentPage - 1) * (perPage as number) + 1}-${Math.min(currentPage * (perPage as number), filteredNotes.length)}번`}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[var(--surface)]"
                        aria-label="이전 페이지"
                      >
                        이전
                      </button>
                      <div className="flex items-center gap-0.5">
                        {(() => {
                          const maxShowAll = 9
                          if (totalPages <= maxShowAll) {
                            return Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                              <button
                                key={page}
                                type="button"
                                onClick={() => setCurrentPage(page)}
                                className={`min-w-[2.25rem] rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors ${
                                  currentPage === page
                                    ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]'
                                }`}
                                aria-label={`${page}페이지`}
                              >
                                {page}
                              </button>
                            ))
                          }
                          const left = Math.max(1, currentPage - 2)
                          const right = Math.min(totalPages, currentPage + 2)
                          const items: (number | 'ellipsis')[] = []
                          if (left > 1) {
                            items.push(1)
                            if (left > 2) items.push('ellipsis')
                          }
                          for (let i = left; i <= right; i++) items.push(i)
                          if (right < totalPages) {
                            if (right < totalPages - 1) items.push('ellipsis')
                            items.push(totalPages)
                          }
                          return items.map((page, idx) =>
                            page === 'ellipsis' ? (
                              <span key={`e-${idx}`} className="px-1.5 py-1.5 text-[var(--foreground-subtle)]">…</span>
                            ) : (
                              <button
                                key={page}
                                type="button"
                                onClick={() => setCurrentPage(page)}
                                className={`min-w-[2.25rem] rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors ${
                                  currentPage === page
                                    ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]'
                                }`}
                                aria-label={`${page}페이지`}
                              >
                                {page}
                              </button>
                            )
                          )
                        })()}
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[var(--surface)]"
                        aria-label="다음 페이지"
                      >
                        다음
                      </button>
                    </div>
                  </div>
                )}
              </>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
