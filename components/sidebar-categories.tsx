'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Category } from '@/types'

interface SidebarCategoriesProps {
  categories: Category[]
  selectedCategoryId: string | null
  onSelectCategory: (id: string | null) => void
  onCategoriesChange: () => void
  userId: string
  notesCountByCategory: Record<string, number>
  onMobileClose?: () => void
}

export default function SidebarCategories({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onCategoriesChange,
  userId,
  notesCountByCategory,
  onMobileClose,
}: SidebarCategoriesProps) {
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const supabase = createClient()

  const categoryErrorMessage = (err: { message?: string; code?: string } | null) => {
    if (!err) return null
    if (err.message?.includes('relation') || err.message?.includes('does not exist') || (err as { code?: string }).code === '42P01') {
      return '카테고리 테이블이 없습니다. Supabase 대시보드 → SQL Editor에서 「카테고리_설정_가이드.md」에 안내된 SQL을 실행해 주세요.'
    }
    return err.message || '오류가 발생했습니다.'
  }

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) return
    setAddError(null)
    setAdding(true)
    const { error } = await supabase.from('categories').insert({
      user_id: userId,
      name,
      sort_order: categories.length,
    })
    setAdding(false)
    if (error) {
      setAddError(categoryErrorMessage(error) ?? error.message)
      return
    }
    setNewName('')
    setAddOpen(false)
    onCategoriesChange()
  }

  const handleUpdate = async (id: string) => {
    const name = editName.trim()
    if (!name) return
    setEditError(null)
    const { error } = await supabase.from('categories').update({ name }).eq('id', id).eq('user_id', userId)
    if (error) {
      setEditError(categoryErrorMessage(error) ?? error.message)
      return
    }
    setEditingId(null)
    setEditName('')
    setEditError(null)
    onCategoriesChange()
  }

  const handleDelete = async (id: string) => {
    setDeleteConfirmId(null)
    const { error } = await supabase.from('categories').delete().eq('id', id).eq('user_id', userId)
    if (error) {
      alert(categoryErrorMessage(error) ?? error.message)
      return
    }
    setDeleteConfirmId(null)
    onSelectCategory(selectedCategoryId === id ? null : selectedCategoryId)
    onCategoriesChange()
  }

  const startEdit = (c: Category) => {
    setEditingId(c.id)
    setEditName(c.name)
  }

  return (
    <div className="px-3 py-2">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--foreground-subtle)]">
          카테고리
        </p>
        {!addOpen ? (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="rounded-xl p-1.5 text-[var(--foreground-subtle)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            aria-label="카테고리 추가"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        ) : null}
      </div>

      {addOpen && (
        <div className="mb-2 space-y-1">
          <div className="flex flex-wrap items-center gap-1">
            <input
              type="text"
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setAddError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAddOpen(false); setNewName(''); setAddError(null); } }}
              placeholder="과목 이름 (예: 수학, 영어)"
              className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm text-[var(--foreground)] placeholder-[var(--foreground-subtle)] focus:border-[var(--border-focus)] focus:outline-none"
              autoFocus
              disabled={adding}
            />
            <button type="button" onClick={handleAdd} disabled={adding} className="shrink-0 rounded-xl bg-[var(--accent)] px-2.5 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50">
              {adding ? '추가 중…' : '추가'}
            </button>
            <button type="button" onClick={() => { setAddOpen(false); setNewName(''); setAddError(null); }} disabled={adding} className="shrink-0 rounded-xl border border-[var(--border)] px-2.5 py-1.5 text-sm text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-50">
              취소
            </button>
          </div>
          {addError && (
            <p className="rounded border border-[var(--error)]/30 bg-[var(--error-muted)] px-2 py-1.5 text-xs text-[var(--error)]">
              {addError}
            </p>
          )}
        </div>
      )}

      <ul className="space-y-0.5">
        <li className="flex items-center gap-1 rounded-xl transition-colors hover:bg-[var(--surface-hover)]">
          <button
            type="button"
            onClick={() => { onSelectCategory(selectedCategoryId === '_none' ? null : '_none'); onMobileClose?.(); }}
            className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
              selectedCategoryId === '_none'
                ? 'bg-[var(--accent-muted)] font-medium text-[var(--accent)]'
                : 'text-[var(--foreground-muted)]'
            }`}
          >
            <span className="truncate">미분류</span>
            {(notesCountByCategory['_none'] ?? 0) > 0 && (
              <span className="shrink-0 rounded-full bg-[var(--surface-hover)] px-1.5 py-0.5 text-xs text-[var(--foreground-muted)]">
                {notesCountByCategory['_none']}
              </span>
            )}
          </button>
        </li>
        {categories.map((c) => (
          <li key={c.id} className="group flex items-center gap-1 rounded-xl transition-colors hover:bg-[var(--surface-hover)]">
            {editingId === c.id ? (
              <div className="w-full space-y-1 px-3 py-2">
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => { setEditName(e.target.value); setEditError(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleUpdate(c.id); if (e.key === 'Escape') { setEditingId(null); setEditName(''); setEditError(null); } }}
                    className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm focus:border-[var(--border-focus)] focus:outline-none"
                    autoFocus
                  />
                  <button type="button" onClick={() => handleUpdate(c.id)} className="shrink-0 text-xs text-[var(--accent)] hover:underline">확인</button>
                  <button type="button" onClick={() => { setEditingId(null); setEditName(''); setEditError(null); }} className="shrink-0 text-xs text-[var(--foreground-muted)] hover:underline">취소</button>
                </div>
                {editError && <p className="text-xs text-[var(--error)]">{editError}</p>}
              </div>
            ) : deleteConfirmId === c.id ? (
              <div className="flex w-full items-center gap-1 px-2 py-1">
                <span className="flex-1 text-xs text-[var(--foreground-muted)]">삭제할까요? (노트는 미분류로)</span>
                <button type="button" onClick={() => handleDelete(c.id)} className="shrink-0 text-xs font-medium text-[var(--error)] hover:underline">삭제</button>
                <button type="button" onClick={() => setDeleteConfirmId(null)} className="shrink-0 text-xs text-[var(--foreground-muted)] hover:underline">취소</button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => { onSelectCategory(selectedCategoryId === c.id ? null : c.id); onMobileClose?.(); }}
                  className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                    selectedCategoryId === c.id
                      ? 'bg-[var(--accent-muted)] font-medium text-[var(--accent)]'
                      : 'text-[var(--foreground)]'
                  }`}
                >
                  <span className="truncate">{c.name}</span>
                  {(notesCountByCategory[c.id] ?? 0) > 0 && (
                    <span className="shrink-0 rounded-full bg-[var(--surface-hover)] px-1.5 py-0.5 text-xs text-[var(--foreground-muted)]">
                      {notesCountByCategory[c.id]}
                    </span>
                  )}
                </button>
                <div className="flex shrink-0 opacity-0 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => startEdit(c)}
                    className="rounded-lg p-1.5 text-[var(--foreground-subtle)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                    aria-label="수정"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(c.id)}
                    className="rounded-lg p-1.5 text-[var(--foreground-subtle)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--error)]"
                    aria-label="삭제"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      {categories.length === 0 && !addOpen && (
        <p className="py-2 text-center text-xs text-[var(--foreground-subtle)]">
          + 버튼으로 과목을 추가하세요
        </p>
      )}
    </div>
  )
}
