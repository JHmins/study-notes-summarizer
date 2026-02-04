/**
 * 에러 처리 유틸리티 함수
 */

/**
 * 에러 객체를 사용자 친화적인 메시지로 변환
 */
export function getErrorMessage(error: unknown, defaultMessage: string = '오류가 발생했습니다.'): string {
  if (error instanceof Error) {
    return error.message || defaultMessage
  }
  if (typeof error === 'string') {
    return error
  }
  return defaultMessage
}

/**
 * Supabase 에러를 사용자 친화적인 메시지로 변환
 */
export function getSupabaseErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    
    if (message.includes('already registered') || message.includes('already in use')) {
      return '이미 가입된 이메일입니다. 로그인해주세요.'
    }
    if (message.includes('password') || message.includes('비밀번호')) {
      return '비밀번호는 8자 이상이어야 합니다.'
    }
    if (message.includes('invalid login credentials')) {
      return '이메일 또는 비밀번호가 올바르지 않습니다.'
    }
    if (message.includes('email not confirmed')) {
      return '이메일 인증이 완료되지 않았습니다. 메일의 링크를 클릭한 뒤 다시 로그인해주세요.'
    }
    if (message.includes('rate limit') || message.includes('rate limit exceeded')) {
      return '이메일 발송 제한에 걸렸습니다. Supabase 대시보드에서 Authentication > Providers > Email 로 가서 "Confirm email"을 끄면 가입 시 이메일을 보내지 않아 해결됩니다. 또는 약 1시간 후 다시 시도해보세요.'
    }
    
    return error.message
  }
  
  return '오류가 발생했습니다.'
}
