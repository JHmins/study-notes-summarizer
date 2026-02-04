/**
 * 공통 상수 정의
 */

export const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export const ALLOWED_FILE_TYPES = ['.txt', '.md']

export const STORAGE_KEY_THEME = 'study-notes-theme'
