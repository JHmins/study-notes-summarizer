/**
 * 포맷팅 유틸리티 함수
 */

import { format as dateFnsFormat, parseISO, startOfDay } from 'date-fns'
import { ko } from 'date-fns/locale/ko'

/**
 * 날짜를 한국어 형식으로 포맷
 */
export function formatDate(date: Date | string, formatStr: string = 'yyyy.M.d HH:mm'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateFnsFormat(dateObj, formatStr, { locale: ko })
}

/**
 * ISO 날짜 문자열을 YYYY-MM-DD 형식으로 변환 (날짜 비교용)
 * startOfDay를 사용하여 시간 부분을 제거하고 같은 날짜인지 비교할 수 있도록 함
 */
export function toDateKey(iso: string): string {
  return dateFnsFormat(startOfDay(parseISO(iso)), 'yyyy-MM-dd')
}

/**
 * 파일 크기를 읽기 쉬운 형식으로 포맷
 */
export function formatFileSize(bytes: number | null): string {
  if (bytes == null) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
