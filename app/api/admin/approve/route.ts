import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/utils/auth'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!isAdmin(user?.email)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const body = await request.json()
    const userId = body?.userId
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId가 필요합니다.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from('profiles')
      .update({
        approved: true,
        approved_at: new Date().toISOString(),
        approved_by: user?.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Admin approve error:', err)
    return NextResponse.json({ error: '오류가 발생했습니다.' }, { status: 500 })
  }
}
