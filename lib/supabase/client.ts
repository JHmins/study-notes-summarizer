import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

let browserClient: ReturnType<typeof createBrowserClient> | null = null

/** SSR 시 사용하는 더미 - 메서드 호출 시 빈 결과 반환하여 hydration 오류 방지 */
function createServerPlaceholder() {
  const empty = { data: null, error: null }
  const thenable = { then: (fn: (v: typeof empty) => void) => { fn(empty); return thenable }, catch: () => thenable }
  return new Proxy({} as ReturnType<typeof createBrowserClient>, {
    get(_, prop) {
      if (prop === 'from') {
        return () =>
          new Proxy(
            {},
            {
              get: () => () => thenable,
            }
          )
      }
      if (prop === 'auth') {
        return { getUser: () => Promise.resolve({ data: { user: null }, error: null }) }
      }
      return () => thenable
    },
  })
}

export function createClient() {
  if (typeof window === 'undefined') {
    return createServerPlaceholder()
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Check your .env.local file.'
    )
  }
  if (!browserClient) {
    if (SUPABASE_URL.includes('localhost') || SUPABASE_URL.includes('127.0.0.1')) {
      console.warn(
        '[Study Notes] ⚠️ 로컬 Supabase URL을 사용 중입니다. 서버를 중지하면 노트·링크 데이터가 사라질 수 있습니다.'
      )
    }
    browserClient = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  }
  return browserClient
}
