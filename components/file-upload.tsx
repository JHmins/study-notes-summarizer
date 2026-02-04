'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Category } from '@/types'
import { MAX_FILE_SIZE, ALLOWED_FILE_TYPES } from '@/lib/utils/constants'

interface FileUploadProps {
  onUploadComplete: () => void
  defaultCategoryId?: string | null
  categories?: { id: string; name: string }[]
}

export default function FileUpload({ onUploadComplete, defaultCategoryId = null, categories = [] }: FileUploadProps) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState<string | null>(defaultCategoryId ?? null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    setCategoryId(defaultCategoryId ?? null)
  }, [defaultCategoryId])

  const effectiveCategoryId = categoryId ?? defaultCategoryId ?? null

  const isAllowed = (name: string) => ALLOWED_FILE_TYPES.some((ext) => name.toLowerCase().endsWith(ext))

  const handleFile = async (file: File) => {
    if (!isAllowed(file.name)) {
      setError('텍스트 파일(.txt) 또는 마크다운 파일(.md)만 업로드할 수 있어요.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('파일 크기는 10MB 이하여야 해요.')
      return
    }

    setUploading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('로그인이 필요합니다. 로그인 페이지로 이동한 뒤 다시 시도해주세요.')
      }

      const userId = user.id
      const timestamp = Date.now()
      const suffix = Math.random().toString(36).slice(2, 8)
      const ext = file.name.toLowerCase().endsWith('.md') ? '.md' : '.txt'
      const safeKey = `${timestamp}_${suffix}${ext}`
      const filePath = `${userId}/${safeKey}`

      const contentType = ext === '.md' ? 'text/markdown' : 'text/plain'
      const { error: uploadError } = await supabase.storage
        .from('study-notes')
        .upload(filePath, file, { contentType, upsert: false })
      if (uploadError) throw uploadError

      const { error: insertError } = await supabase.from('notes').insert({
        title: file.name.replace(/\.(txt|md)$/i, ''),
        file_path: filePath,
        file_size: file.size,
        status: 'pending',
        user_id: userId,
        ...(effectiveCategoryId ? { category_id: effectiveCategoryId } : {}),
      })
      if (insertError) throw insertError

      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, fileName: file.name }),
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || '요약 생성에 실패했어요.')
      }

      onUploadComplete()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '업로드 중 오류가 발생했어요.')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      {categories.length > 0 && (
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2">
          <span className="text-sm text-[var(--foreground-muted)]">카테고리</span>
          <select
            value={effectiveCategoryId ?? ''}
            onChange={(e) => setCategoryId(e.target.value || null)}
            className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--foreground)] focus:border-[var(--border-focus)] focus:outline-none"
          >
            <option value="">미분류</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <span className="text-xs text-[var(--foreground-subtle)]">업로드 시 이 카테고리에 들어갑니다.</span>
        </div>
      )}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 transition-colors ${
          dragging
            ? 'border-[var(--accent)] bg-[var(--accent-muted)]/30'
            : 'border-[var(--border)] bg-[var(--surface-hover)]/50 hover:border-[var(--border-focus)] hover:bg-[var(--surface-hover)]/70'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md"
          onChange={handleFileInput}
          className="sr-only"
          disabled={uploading}
          aria-label="텍스트/마크다운 파일 선택"
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-3 text-[var(--foreground-muted)]">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
            <p className="text-sm font-medium">업로드하고 요약 만들기 중…</p>
          </div>
        ) : (
          <>
            <div className="rounded-full bg-[var(--surface)] p-3 shadow-card">
              <svg
                className="h-6 w-6 text-[var(--foreground-subtle)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[var(--foreground)]">
                .txt / .md 파일을 여기에 올리거나
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-1 text-sm font-medium text-[var(--accent)] hover:underline"
              >
                파일 선택
              </button>
            </div>
            <p className="text-xs text-[var(--foreground-subtle)]">최대 10MB · .txt, .md 지원</p>
          </>
        )}

        {error && (
          <div className="mt-2 w-full max-w-md rounded-lg border border-[var(--error)]/30 bg-[var(--error-muted)] px-4 py-3 text-sm text-[var(--error)] whitespace-pre-line">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
