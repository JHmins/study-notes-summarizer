/**
 * 공통 타입 정의
 */

export type NoteStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Note {
  id: string
  title: string
  status: NoteStatus
  summary: string | null
  created_at: string
  updated_at?: string
  file_path?: string
  category_id?: string | null
  project_id?: string | null
}

export interface Category {
  id: string
  user_id: string
  name: string
  sort_order: number
  created_at: string
}

export interface Project {
  id: string
  user_id: string
  name: string
  description?: string | null
  created_at: string
  updated_at: string
}

export interface ProjectFile {
  id: string
  project_id: string
  user_id: string
  file_path: string
  title: string
  file_size: number | null
  created_at: string
}

export interface StudyLink {
  id: string
  title: string
  url: string
  description?: string | null
  category?: string | null
  note_id?: string | null
  created_at: string
  updated_at: string
}

export interface NoteForCalendar {
  id: string
  title: string
  created_at: string
}

/**
 * 노트 상태별 설정
 */
export const NOTE_STATUS_CONFIG = {
  completed: { 
    label: '완료', 
    className: 'bg-[var(--success-muted)] text-[var(--success)]' 
  },
  processing: { 
    label: '처리 중', 
    className: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' 
  },
  failed: { 
    label: '실패', 
    className: 'bg-[var(--error-muted)] text-[var(--error)]' 
  },
  pending: { 
    label: '대기', 
    className: 'bg-[var(--surface-hover)] text-[var(--foreground-muted)]' 
  },
} as const
