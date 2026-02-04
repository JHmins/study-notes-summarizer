'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale/ko'
import Link from 'next/link'
import Sidebar from '@/components/sidebar'
import ThemeToggle from '@/components/theme-toggle'
import type { User } from '@supabase/supabase-js'
import type { StudyLink, Category, Note } from '@/types'

interface LinksClientProps {
  initialLinks: StudyLink[]
  initialCategories: Category[]
  initialNotes: Note[]
  user: User
  isAdmin?: boolean
}

export default function LinksClient({ initialLinks, initialCategories, initialNotes, user, isAdmin }: LinksClientProps) {
  const router = useRouter()
  const [links, setLinks] = useState<StudyLink[]>(initialLinks)
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedLinks, setExpandedLinks] = useState<Set<string>>(new Set())
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [formData, setFormData] = useState({
    title: '',
    url: '',
    description: '',
    category: '',
    note_id: '' as string,
  })

  const refreshLinks = async () => {
    const { data } = await supabase
      .from('study_links')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (data) setLinks(data)
  }

  const refreshCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (data) setCategories(data)
  }

  const refreshNotes = async () => {
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (data) setNotes(data)
  }

  useEffect(() => {
    setLinks(initialLinks)
    setCategories(initialCategories)
    setNotes(initialNotes)
  }, [initialLinks, initialCategories, initialNotes])

  useEffect(() => {
    const onFocus = () => {
      refreshLinks()
      refreshNotes()
      refreshCategories()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [user.id])

  useEffect(() => {
    const linksChannel = supabase
      .channel('links-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'study_links', filter: `user_id=eq.${user.id}` },
        () => refreshLinks()
      )
      .subscribe()

    const categoriesChannel = supabase
      .channel('categories-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories', filter: `user_id=eq.${user.id}` },
        () => refreshCategories()
      )
      .subscribe()

    const notesChannel = supabase
      .channel('notes-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${user.id}` },
        () => refreshNotes()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(linksChannel)
      supabase.removeChannel(categoriesChannel)
      supabase.removeChannel(notesChannel)
    }
  }, [user.id])

  // 카테고리별 노트 개수 계산
  const notesCountByCategory = notes.reduce<Record<string, number>>((acc, n) => {
    const id = n.category_id ?? '_none'
    acc[id] = (acc[id] ?? 0) + 1
    return acc
  }, {})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim() || !formData.url.trim()) {
      alert('제목과 URL을 입력해주세요.')
      return
    }

    try {
      if (editingId) {
        const { error } = await supabase
          .from('study_links')
          .update({
            title: formData.title.trim(),
            url: formData.url.trim(),
            description: formData.description.trim() || null,
            category: formData.category.trim() || null,
            note_id: formData.note_id.trim() || null,
          })
          .eq('id', editingId)
          .eq('user_id', user.id)

        if (error) throw error
        setEditingId(null)
      } else {
        const { error } = await supabase.from('study_links').insert({
          user_id: user.id,
          title: formData.title.trim(),
          url: formData.url.trim(),
          description: formData.description.trim() || null,
          category: formData.category.trim() || null,
          note_id: formData.note_id.trim() || null,
        })

        if (error) throw error
      }

      setFormData({ title: '', url: '', description: '', category: '', note_id: '' })
      setIsAdding(false)
      refreshLinks()
    } catch (error: any) {
      console.error('Link save error:', error)
      alert(error.message || '링크 저장에 실패했습니다.')
    }
  }

  const handleEdit = (link: StudyLink) => {
    setFormData({
      title: link.title,
      url: link.url,
      description: link.description || '',
      category: link.category || '',
      note_id: link.note_id || '',
    })
    setEditingId(link.id)
    setIsAdding(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 링크를 삭제할까요?')) return

    try {
      const { error } = await supabase.from('study_links').delete().eq('id', id).eq('user_id', user.id)
      if (error) throw error
      refreshLinks()
    } catch (error: any) {
      console.error('Link delete error:', error)
      alert(error.message || '링크 삭제에 실패했습니다.')
    }
  }

  const handleCancel = () => {
    setIsAdding(false)
    setEditingId(null)
    setFormData({ title: '', url: '', description: '', category: '', note_id: '' })
  }

  // 링크에서 사용된 카테고리와 실제 카테고리 테이블의 카테고리를 합침
  const linkCategories = [...new Set(links.map((l) => l.category).filter(Boolean))] as string[]
  const categoryNames = categories.map((c) => c.name)
  const allCategories = [...new Set([...categoryNames, ...linkCategories])]

  // 그룹별로 링크 분류
  const groupedLinks = links.reduce<Record<string, StudyLink[]>>((acc, link) => {
    const group = link.category || '기타'
    if (!acc[group]) acc[group] = []
    acc[group].push(link)
    return acc
  }, {})

  // 그룹 순서 정렬 (카테고리 순서 우선, 그 다음 기타)
  const sortedGroups = Object.keys(groupedLinks).sort((a, b) => {
    if (a === '기타') return 1
    if (b === '기타') return -1
    const aIndex = categories.findIndex((c) => c.name === a)
    const bIndex = categories.findIndex((c) => c.name === b)
    if (aIndex !== -1 && bIndex !== -1) {
      return categories[aIndex].sort_order - categories[bIndex].sort_order
    }
    if (aIndex !== -1) return -1
    if (bIndex !== -1) return 1
    return a.localeCompare(b)
  })

  const toggleLink = (linkId: string) => {
    setExpandedLinks((prev) => {
      const next = new Set(prev)
      if (next.has(linkId)) {
        next.delete(linkId)
      } else {
        next.add(linkId)
      }
      return next
    })
  }

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupName)) {
        next.delete(groupName)
      } else {
        next.add(groupName)
      }
      return next
    })
  }

  // 초기 상태: 모든 그룹 펼침
  useEffect(() => {
    if (sortedGroups.length > 0 && expandedGroups.size === 0) {
      setExpandedGroups(new Set(sortedGroups))
    }
  }, [sortedGroups.length])

  return (
    <div className="min-h-screen flex bg-[var(--background)]">
      <Sidebar
        notes={notes}
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
            <span className="text-sm font-medium text-[var(--foreground)]">수업 자료</span>
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

        <main className="flex-1 overflow-auto px-4 py-6 sm:px-6">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-[var(--foreground)]">수업 자료</h1>
            {!isAdding && (
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
              >
                링크 추가
              </button>
            )}
          </div>

          {isAdding && (
            <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">
                {editingId ? '링크 수정' : '새 링크 추가'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                    제목 *
                  </label>
                  <input
                    id="title"
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)] focus:border-[var(--border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)]"
                    placeholder="링크 제목을 입력하세요"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="url" className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                    URL *
                  </label>
                  <input
                    id="url"
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)] focus:border-[var(--border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)]"
                    placeholder="https://example.com"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                    설명
                  </label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)] focus:border-[var(--border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)]"
                    placeholder="링크에 대한 설명을 입력하세요"
                    rows={3}
                  />
                </div>
                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                    그룹
                  </label>
                  <input
                    id="category"
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)] focus:border-[var(--border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)]"
                    placeholder="그룹 이름을 입력하세요 (예: 강의자료, 참고사이트, 유튜브 등)"
                    list="categories"
                  />
                  {allCategories.length > 0 && (
                    <datalist id="categories">
                      {allCategories.map((cat) => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                  )}
                  <p className="mt-1 text-xs text-[var(--foreground-subtle)]">
                    같은 그룹 이름을 사용하면 링크들이 그룹으로 묶여서 표시됩니다.
                  </p>
                </div>
                <div>
                  <label htmlFor="note_id" className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                    연결할 노트
                  </label>
                  <select
                    id="note_id"
                    value={formData.note_id}
                    onChange={(e) => setFormData({ ...formData, note_id: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)] focus:border-[var(--border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)]"
                  >
                    <option value="">연결 안 함</option>
                    {notes.map((n) => (
                      <option key={n.id} value={n.id}>{n.title}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-[var(--foreground-subtle)]">
                    노트와 연결하면 해당 노트 상세에서 링크가 표시되고, 변동 시 실시간 반영됩니다.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
                  >
                    {editingId ? '수정' : '추가'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                  >
                    취소
                  </button>
                </div>
              </form>
            </div>
          )}

          {links.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-12 text-center text-[var(--foreground-muted)]">
              <p className="mb-2">아직 저장된 링크가 없습니다.</p>
              <p className="text-sm">위의 "링크 추가" 버튼을 눌러 첫 번째 링크를 추가해보세요.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedGroups.map((groupName) => {
                const groupLinks = groupedLinks[groupName]
                const isGroupExpanded = expandedGroups.has(groupName)
                return (
                  <div key={groupName} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                    {/* 그룹 헤더 */}
                    <button
                      type="button"
                      onClick={() => toggleGroup(groupName)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-[var(--surface-hover)] hover:bg-[var(--surface-hover)]/80 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <svg
                          className={`h-5 w-5 text-[var(--foreground-subtle)] transition-transform ${isGroupExpanded ? 'rotate-90' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <h2 className="text-lg font-semibold text-[var(--foreground)]">{groupName}</h2>
                        <span className="text-sm text-[var(--foreground-subtle)]">({groupLinks.length})</span>
                      </div>
                    </button>

                    {/* 그룹 내용 */}
                    {isGroupExpanded && (
                      <div className="divide-y divide-[var(--border)]">
                        {groupLinks.map((link) => {
                          const isExpanded = expandedLinks.has(link.id)
                          return (
                            <div key={link.id} className="group">
                              {/* 링크 제목 (항상 표시) */}
                              <button
                                type="button"
                                onClick={() => toggleLink(link.id)}
                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--surface-hover)] transition-colors"
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <svg
                                    className={`h-4 w-4 shrink-0 text-[var(--foreground-subtle)] transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                  <h3 className="text-base font-medium text-[var(--foreground)] truncate text-left">
                                    {link.title}
                                  </h3>
                                  {link.note_id && (
                                    <span className="shrink-0 rounded bg-[var(--surface-hover)] px-1.5 py-0.5 text-xs text-[var(--foreground-muted)]">
                                      {notes.find((n) => n.id === link.note_id)?.title ?? '노트'}
                                    </span>
                                  )}
                                  <span className="text-xs text-[var(--foreground-subtle)] shrink-0">
                                    {format(new Date(link.created_at), 'yyyy.M.d', { locale: ko })}
                                  </span>
                                </div>
                                <div className="flex shrink-0 gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => handleEdit(link)}
                                    className="rounded p-1.5 text-[var(--foreground-subtle)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                                    aria-label="수정"
                                  >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                      />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(link.id)}
                                    className="rounded p-1.5 text-[var(--foreground-subtle)] hover:bg-[var(--error-muted)] hover:text-[var(--error)]"
                                    aria-label="삭제"
                                  >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                      />
                                    </svg>
                                  </button>
                                </div>
                              </button>

                              {/* 링크 상세 내용 (클릭 시 표시) */}
                              {isExpanded && (
                                <div className="px-4 pb-4 pt-2 bg-[var(--surface)]">
                                  <div className="space-y-3">
                                    <div>
                                      <a
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-[var(--accent)] hover:underline break-all inline-flex items-center gap-1"
                                      >
                                        {link.url}
                                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                          />
                                        </svg>
                                      </a>
                                    </div>
                                    {link.description && (
                                      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed whitespace-pre-wrap">
                                        {link.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
