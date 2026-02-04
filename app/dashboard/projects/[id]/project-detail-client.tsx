'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale/ko'
import Link from 'next/link'
import Sidebar from '@/components/sidebar'
import ThemeToggle from '@/components/theme-toggle'
import type { User } from '@supabase/supabase-js'
import type { Project, ProjectFile, Category, Note } from '@/types'
import { formatFileSize, formatDate } from '@/lib/utils/format'

interface LinkedNote {
  id: string
  title: string
  created_at: string
  status: string
}

interface SidebarNote {
  id: string
  title: string
  created_at: string
  category_id?: string | null
  status: string
  project_id?: string | null
}

interface ProjectDetailClientProps {
  project: Project
  initialFiles: ProjectFile[]
  initialLinkedNotes: LinkedNote[]
  initialNotes: SidebarNote[]
  initialCategories: Category[]
  user: User
  isAdmin?: boolean
}

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export default function ProjectDetailClient({
  project,
  initialFiles,
  initialLinkedNotes,
  initialNotes,
  initialCategories,
  user,
  isAdmin,
}: ProjectDetailClientProps) {
  const router = useRouter()
  const [currentProject, setCurrentProject] = useState(project)
  const [files, setFiles] = useState<ProjectFile[]>(initialFiles)
  const [linkedNotes, setLinkedNotes] = useState<LinkedNote[]>(initialLinkedNotes)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [linkNoteId, setLinkNoteId] = useState('')
  const [linking, setLinking] = useState(false)
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(project.name)
  const [savingName, setSavingName] = useState(false)
  const [editingDesc, setEditingDesc] = useState(false)
  const [descValue, setDescValue] = useState(project.description ?? '')
  const [savingDesc, setSavingDesc] = useState(false)
  const [notes, setNotes] = useState<SidebarNote[]>(initialNotes)
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    setNotes(initialNotes)
    setCategories(initialCategories)
  }, [initialNotes, initialCategories])

  const refreshNotes = useCallback(async () => {
    const { data } = await supabase
      .from('notes')
      .select('id, title, created_at, category_id, status, project_id')
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
    const onFocus = () => {
      refreshNotes()
      refreshCategories()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshNotes, refreshCategories])

  const handleSaveName = async () => {
    const name = nameValue.trim()
    if (!name) return
    setSavingName(true)
    try {
      const { error: err } = await supabase
        .from('projects')
        .update({ name })
        .eq('id', project.id)
        .eq('user_id', user.id)
      if (err) throw err
      setCurrentProject((p) => ({ ...p, name }))
      setEditingName(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : '이름 저장에 실패했습니다.')
    } finally {
      setSavingName(false)
    }
  }

  const handleSaveDescription = async () => {
    setSavingDesc(true)
    try {
      const description = descValue.trim() || null
      const { error: err } = await supabase
        .from('projects')
        .update({ description })
        .eq('id', project.id)
        .eq('user_id', user.id)
      if (err) throw err
      setCurrentProject((p) => ({ ...p, description }))
      setEditingDesc(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : '설명 저장에 실패했습니다.')
    } finally {
      setSavingDesc(false)
    }
  }

  const refreshLinkedNotes = async () => {
    const { data } = await supabase
      .from('notes')
      .select('id, title, created_at, status')
      .eq('user_id', user.id)
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
    if (data) setLinkedNotes(data)
  }

  const notesAvailableToLink = notes.filter((n) => n.project_id !== project.id)

  const handleLinkNote = async () => {
    const noteId = linkNoteId.trim()
    if (!noteId) return
    setLinking(true)
    try {
      const { error: err } = await supabase
        .from('notes')
        .update({ project_id: project.id })
        .eq('id', noteId)
        .eq('user_id', user.id)
      if (err) throw err
      setLinkNoteId('')
      await refreshLinkedNotes()
    } catch (e) {
      alert(e instanceof Error ? e.message : '노트 연결에 실패했습니다.')
    } finally {
      setLinking(false)
    }
  }

  const handleUnlinkNote = async (noteId: string) => {
    setUnlinkingId(noteId)
    try {
      const { error: err } = await supabase
        .from('notes')
        .update({ project_id: null })
        .eq('id', noteId)
        .eq('user_id', user.id)
      if (err) throw err
      await refreshLinkedNotes()
    } catch (e) {
      alert(e instanceof Error ? e.message : '연결 해제에 실패했습니다.')
    } finally {
      setUnlinkingId(null)
    }
  }

  const refreshFiles = async () => {
    const { data } = await supabase
      .from('project_files')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
    if (data) setFiles(data)
  }

  const handleFile = async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      setError(`파일 크기는 ${MAX_FILE_SIZE / 1024 / 1024}MB 이하여야 합니다.`)
      return
    }

    setUploading(true)
    setError(null)

    try {
      const userId = user.id
      const timestamp = Date.now()
      const suffix = Math.random().toString(36).slice(2, 8)
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const filePath = `${userId}/${project.id}/${timestamp}_${suffix}_${safeName}`

      const { error: uploadErr } = await supabase.storage
        .from('project-files')
        .upload(filePath, file, { upsert: false })
      if (uploadErr) throw uploadErr

      const { error: insertErr } = await supabase.from('project_files').insert({
        project_id: project.id,
        user_id: userId,
        file_path: filePath,
        title: file.name,
        file_size: file.size,
      })
      if (insertErr) throw insertErr

      await refreshFiles()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const handleDownload = async (file: ProjectFile) => {
    try {
      const { data, error: dlErr } = await supabase.storage
        .from('project-files')
        .createSignedUrl(file.file_path, 3600)
      if (dlErr) throw dlErr
      if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    } catch (err) {
      alert(err instanceof Error ? err.message : '다운로드에 실패했습니다.')
    }
  }

  const handleDeleteFile = async (file: ProjectFile) => {
    if (!confirm(`"${file.title}"을(를) 삭제할까요?`)) return
    setDeletingId(file.id)
    try {
      await supabase.storage.from('project-files').remove([file.file_path])
      const { error: delErr } = await supabase
        .from('project_files')
        .delete()
        .eq('id', file.id)
        .eq('user_id', user.id)
      if (delErr) throw delErr
      await refreshFiles()
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
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
            <Link
              href="/dashboard/projects"
              className="text-sm font-medium text-[var(--foreground-muted)] hover:text-[var(--accent)] no-underline"
            >
              프로젝트
            </Link>
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
          </div>
        </header>

        <main className="flex-1 overflow-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <nav className="mb-8">
              <Link
                href="/dashboard/projects"
                className="inline-flex items-center gap-1.5 text-sm text-[var(--foreground-subtle)] no-underline transition-colors hover:text-[var(--accent)]"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                프로젝트 목록
              </Link>
            </nav>

            <div className="mb-10 min-w-0 overflow-hidden rounded-2xl bg-[var(--surface)] p-6 shadow-sm ring-1 ring-[var(--border)] sm:p-8">
              <div className="flex min-w-0 flex-wrap items-start gap-3">
                {editingName ? (
                  <>
                    <input
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName()
                        if (e.key === 'Escape') {
                          setNameValue(currentProject.name)
                          setEditingName(false)
                        }
                      }}
                      className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-lg font-semibold text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                      autoFocus
                      aria-label="프로젝트 이름"
                    />
                    <button
                      type="button"
                      onClick={handleSaveName}
                      disabled={savingName || !nameValue.trim()}
                      className="rounded-xl bg-[var(--foreground)] px-4 py-2.5 text-sm font-medium text-[var(--background)] hover:opacity-90 disabled:opacity-50"
                    >
                      {savingName ? '저장 중…' : '저장'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setNameValue(currentProject.name); setEditingName(false); }}
                      disabled={savingName}
                      className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)]"
                    >
                      취소
                    </button>
                  </>
                ) : (
                  <>
                    <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                      {currentProject.name}
                    </h1>
                    <button
                      type="button"
                      onClick={() => setEditingName(true)}
                      className="rounded-lg p-2 text-[var(--foreground-subtle)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                      aria-label="이름 수정"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
              <div className="mt-4 min-w-0">
                {editingDesc ? (
                  <div className="min-w-0 space-y-3">
                    <textarea
                      value={descValue}
                      onChange={(e) => setDescValue(e.target.value)}
                      className="min-w-0 max-w-full w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 resize-none break-words"
                      placeholder="프로젝트 설명 (선택)"
                      rows={3}
                      aria-label="프로젝트 설명"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSaveDescription}
                        disabled={savingDesc}
                        className="rounded-xl bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] hover:opacity-90 disabled:opacity-50"
                      >
                        {savingDesc ? '저장 중…' : '저장'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDescValue(currentProject.description ?? ''); setEditingDesc(false); }}
                        disabled={savingDesc}
                        className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)]"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-w-0 flex-1 flex-wrap items-start gap-2">
                    {currentProject.description ? (
                      <p className="min-w-0 flex-1 break-words text-sm leading-relaxed text-[var(--foreground-muted)]">
                        {currentProject.description}
                      </p>
                    ) : (
                      <p className="text-sm text-[var(--foreground-subtle)]">설명 없음</p>
                    )}
                    <button
                      type="button"
                      onClick={() => { setDescValue(currentProject.description ?? ''); setEditingDesc(true); }}
                      className="rounded-lg p-1.5 text-[var(--foreground-subtle)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                      aria-label="설명 수정"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
              <p className="mt-4 text-xs text-[var(--foreground-subtle)]">
                생성 {format(new Date(currentProject.created_at), 'yyyy.M.d', { locale: ko })}
              </p>
            </div>

            <section className="mb-10">
              <p className="mb-4 text-xs font-medium uppercase tracking-wider text-[var(--foreground-subtle)]">
                연결된 노트 · {linkedNotes.length}개
              </p>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <select
                  value={linkNoteId}
                  onChange={(e) => setLinkNoteId(e.target.value)}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                >
                  <option value="">노트 선택</option>
                  {notesAvailableToLink.map((n) => (
                    <option key={n.id} value={n.id}>{n.title || '제목 없음'}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleLinkNote}
                  disabled={!linkNoteId || linking}
                  className="rounded-xl bg-[var(--foreground)] px-4 py-2.5 text-sm font-medium text-[var(--background)] hover:opacity-90 disabled:opacity-50"
                >
                  {linking ? '연결 중…' : '노트 연결'}
                </button>
              </div>
              {linkedNotes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]/50 py-10 text-center text-sm text-[var(--foreground-muted)]">
                  연결된 노트가 없습니다. 위에서 노트를 선택해 연결하세요.
                </div>
              ) : (
                <ul className="space-y-2">
                  {linkedNotes.map((note) => (
                    <li
                      key={note.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--surface)] px-4 py-3 ring-1 ring-[var(--border)] transition-colors hover:ring-[var(--border-focus)]"
                    >
                      <Link
                        href={`/dashboard/notes/${note.id}`}
                        className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--accent)] no-underline hover:underline"
                      >
                        {note.title || '제목 없음'}
                      </Link>
                      <span className="text-xs text-[var(--foreground-subtle)]">
                        {format(new Date(note.created_at), 'yyyy.M.d', { locale: ko })}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUnlinkNote(note.id)}
                        disabled={unlinkingId === note.id}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
                      >
                        {unlinkingId === note.id ? '해제 중…' : '연결 해제'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="mb-10">
              <p className="mb-4 text-xs font-medium uppercase tracking-wider text-[var(--foreground-subtle)]">
                파일 올리기
              </p>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={(e) => e.preventDefault()}
                className={`rounded-2xl border-2 border-dashed px-6 py-12 transition-all ${
                  uploading
                    ? 'border-[var(--accent)] bg-[var(--accent-muted)]/20'
                    : 'border-[var(--border)] bg-[var(--surface)]/50 hover:border-[var(--border-focus)] hover:bg-[var(--surface-hover)]/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileInput}
                  className="sr-only"
                  disabled={uploading}
                  aria-label="파일 선택"
                />
                {uploading ? (
                  <div className="flex flex-col items-center gap-4 text-[var(--foreground-muted)]">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
                    <p className="text-sm font-medium">업로드 중…</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-hover)] text-[var(--foreground-subtle)]">
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      파일을 여기에 놓거나
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-sm font-medium text-[var(--accent)] hover:underline"
                    >
                      파일 선택
                    </button>
                    <p className="text-xs text-[var(--foreground-subtle)]">최대 50MB</p>
                  </div>
                )}
                {error && (
                  <div className="mt-4 rounded-xl bg-[var(--error-muted)] px-4 py-3 text-sm text-[var(--error)]">
                    {error}
                  </div>
                )}
              </div>
            </section>

            <section>
              <p className="mb-4 text-xs font-medium uppercase tracking-wider text-[var(--foreground-subtle)]">
                프로젝트 파일 · {files.length}개
              </p>
              {files.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]/50 py-12 text-center">
                  <p className="text-sm text-[var(--foreground-muted)]">아직 올린 파일이 없습니다.</p>
                  <p className="mt-1 text-xs text-[var(--foreground-subtle)]">
                    위 영역에 파일을 끌어다 놓거나 파일 선택으로 추가하세요.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {files.map((file) => (
                    <li
                      key={file.id}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[var(--surface)] px-4 py-3.5 ring-1 ring-[var(--border)] transition-colors hover:ring-[var(--border-focus)]"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-hover)] text-[var(--foreground-subtle)]">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[var(--foreground)]">{file.title}</p>
                          <p className="text-xs text-[var(--foreground-subtle)]">
                            {formatFileSize(file.file_size)} · {formatDate(file.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => handleDownload(file)}
                          className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                        >
                          다운로드
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteFile(file)}
                          disabled={deletingId === file.id}
                          className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--foreground-muted)] transition-colors hover:bg-[var(--error-muted)] hover:text-[var(--error)] disabled:opacity-50"
                        >
                          {deletingId === file.id ? '삭제 중…' : '삭제'}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
