import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { summarizeText } from '@/lib/llm/summarize'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { filePath, fileName } = await request.json()

    if (!filePath || !fileName) {
      return NextResponse.json({ error: 'Missing filePath or fileName' }, { status: 400 })
    }

    // 사용자가 없으면 파일 경로에서 추출
    const fileUserId = filePath.split('/')[0]
    const userId = user?.id || fileUserId

    // Verify file belongs to user (익명 사용자 포함)
    // 파일 경로의 첫 번째 폴더가 사용자 ID와 일치하거나 익명 사용자인지 확인
    if (fileUserId !== userId && !fileUserId.startsWith('anonymous_') && !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Update status to processing
    const adminClient = createAdminClient()
    const { data: note } = await adminClient
      .from('notes')
      .select('id')
      .eq('file_path', filePath)
      .eq('user_id', userId)
      .single()

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    await adminClient
      .from('notes')
      .update({ status: 'processing' })
      .eq('id', note.id)

    // Download file from storage
    const { data: fileData, error: downloadError } = await adminClient.storage
      .from('study-notes')
      .download(filePath)

    if (downloadError || !fileData) {
      await adminClient
        .from('notes')
        .update({ status: 'failed' })
        .eq('id', note.id)
      return NextResponse.json(
        { error: 'Failed to download file' },
        { status: 500 }
      )
    }

    const text = await fileData.text()
    const title = (fileName || '').replace(/\.(txt|md)$/i, '').trim()

    // Call LLM API for summarization (Markdown + optional related web resources)
    const { summary } = await summarizeText({ text, title })

    // Update note with summary
    await adminClient
      .from('notes')
      .update({
        summary,
        status: 'completed',
      })
      .eq('id', note.id)

    return NextResponse.json({ success: true, summary })
  } catch (error: any) {
    console.error('Summarization error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
