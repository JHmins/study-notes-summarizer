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

    const { noteId } = await request.json()

    if (!noteId) {
      return NextResponse.json({ error: 'Missing noteId' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Get note
    const { data: note, error: noteError } = await adminClient
      .from('notes')
      .select('id, file_path, user_id, title')
      .eq('id', noteId)
      .single()

    if (noteError || !note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    // 사용자가 없으면 임시 ID 사용
    const userId = user?.id || note.user_id

    // Verify ownership (익명 사용자도 허용)
    if (note.user_id !== userId && !note.user_id.startsWith('anonymous_')) {
      // 익명 사용자도 허용
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    }

    // Update status to processing
    await adminClient
      .from('notes')
      .update({ status: 'processing' })
      .eq('id', noteId)

    // Download file from storage
    const { data: fileData, error: downloadError } = await adminClient.storage
      .from('study-notes')
      .download(note.file_path)

    if (downloadError || !fileData) {
      await adminClient
        .from('notes')
        .update({ status: 'failed' })
        .eq('id', noteId)
      return NextResponse.json(
        { error: 'Failed to download file' },
        { status: 500 }
      )
    }

    const text = await fileData.text()
    const title = (note.title || '').trim() || (note.file_path?.split('/').pop() || '').replace(/\.(txt|md)$/i, '')

    // Call LLM API for summarization (Markdown + optional related web resources)
    const { summary } = await summarizeText({ text, title })

    // Update note with summary
    await adminClient
      .from('notes')
      .update({
        summary,
        status: 'completed',
      })
      .eq('id', noteId)

    return NextResponse.json({ success: true, summary })
  } catch (error: any) {
    console.error('Summarization error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
