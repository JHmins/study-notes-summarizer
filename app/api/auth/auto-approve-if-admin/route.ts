import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/utils/auth'

/**
 * 회원가입 직후 또는 로그인 시 호출. 현재 세션 사용자 이메일이 ADMIN_EMAILS에 있으면
 * 해당 사용자를 자동 승인합니다. (첫 관리자/관리자 계정이 스스로 가입·로그인할 때 사용)
 */

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email) {
      return NextResponse.json({ approved: false })
    }

    if (!isAdmin(user.email)) {
      return NextResponse.json({ approved: false })
    }

    const admin = createAdminClient()
    const now = new Date().toISOString()
    await admin
      .from('profiles')
      .upsert(
        {
          id: user.id,
          email: user.email,
          approved: true,
          approved_at: now,
          approved_by: user.id,
          updated_at: now,
        },
        { onConflict: 'id' }
      )

    return NextResponse.json({ approved: true })
  } catch (err) {
    console.error('Auto-approve error:', err)
    return NextResponse.json({ approved: false }, { status: 500 })
  }
}
