import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface SearchResult {
  noteId: string
  title: string
  created_at: string
  matches: Array<{
    text: string
    context: string
    lineNumber?: number
  }>
  matchCount: number
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const userId = user.id
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ results: [] })
    }

    const searchTerm = query.trim().toLowerCase()

    // 사용자의 모든 노트 가져오기
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('id, title, file_path, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (notesError || !notes) {
      return NextResponse.json({ error: '노트를 불러오는데 실패했습니다.' }, { status: 500 })
    }

    const results: SearchResult[] = []
    const adminClient = createAdminClient()

    // 각 노트의 파일 내용 검색
    for (const note of notes) {
      if (!note.file_path) continue

      try {
        const { data: fileData } = await adminClient.storage
          .from('study-notes')
          .download(note.file_path)

        if (!fileData) continue

        const fileContent = await fileData.text()
        const lines = fileContent.split('\n')
        const matches: Array<{ text: string; context: string; lineNumber?: number }> = []

        // 제목에서 검색
        if (note.title.toLowerCase().includes(searchTerm)) {
          matches.push({
            text: note.title,
            context: note.title,
          })
        }

        // 파일 내용에서 검색
        lines.forEach((line, index) => {
          const lowerLine = line.toLowerCase()
          if (lowerLine.includes(searchTerm)) {
            const matchIndex = lowerLine.indexOf(searchTerm)
            const start = Math.max(0, matchIndex - 50)
            const end = Math.min(line.length, matchIndex + searchTerm.length + 50)
            const context = line.slice(start, end).trim()

            matches.push({
              text: searchTerm,
              context: context,
              lineNumber: index + 1,
            })
          }
        })

        if (matches.length > 0) {
          results.push({
            noteId: note.id,
            title: note.title,
            created_at: note.created_at,
            matches: matches.slice(0, 5), // 최대 5개 매칭만 표시
            matchCount: matches.length,
          })
        }
      } catch (err) {
        // 파일을 읽을 수 없는 경우 무시하고 계속 진행
        console.error(`Failed to read file for note ${note.id}:`, err)
        continue
      }
    }

    // 매칭 개수 순으로 정렬
    results.sort((a, b) => b.matchCount - a.matchCount)

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ error: '검색 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
