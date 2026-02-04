/**
 * 인증 관련 유틸리티 함수
 */

import { ADMIN_EMAILS } from './constants'

/**
 * 사용자가 관리자인지 확인
 */
export function isAdmin(userEmail: string | null | undefined): boolean {
  if (!userEmail) return false
  return ADMIN_EMAILS.includes(userEmail.toLowerCase())
}
