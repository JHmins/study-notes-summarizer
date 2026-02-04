import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/utils/auth'
import GraphViewClient from './graph-view-client'

/** 본문/제목에서 그래프용 단어 추출 (2글자 이상, 상위 limit개) */
function extractWords(text: string, limit = 12): string[] {
  if (!text || typeof text !== 'string') return []
  const stop = new Set(['그', '이', '저', '것', '수', '등', '및', '또', '는', '을', '를', '이', '가', '은', '는', '의', '에', '로', '으로', '와', '과', 'the', 'a', 'an', 'and', 'or', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on', 'at'])
  const tokens = text.replace(/[#*_`\[\]()]/g, ' ').split(/\s+/).filter((s) => s.length >= 2 && !/^\d+$/.test(s))
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of tokens) {
    const lower = t.toLowerCase().slice(0, 20)
    if (stop.has(lower) || seen.has(lower)) continue
    seen.add(lower)
    out.push(t.slice(0, 12))
    if (out.length >= limit) break
  }
  return out
}

export default async function GraphViewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  if (!user.is_anonymous) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('approved')
      .eq('id', user.id)
      .single()
    if (profile && profile.approved !== true) {
      await supabase.auth.signOut()
      redirect('/auth/login?message=pending')
    }
  }

  const userId = user.id
  const [notesResult, categoriesResult] = await Promise.allSettled([
    supabase.from('notes').select('id, title, created_at, category_id, status, file_path').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('categories').select('id, name, sort_order').eq('user_id', userId).order('sort_order').order('created_at'),
  ])

  const notes = (notesResult.status === 'fulfilled' ? (notesResult.value.data ?? []) : []) as { id: string; title: string; created_at: string; category_id: string | null; status: string; file_path?: string }[]
  const categories = categoriesResult.status === 'fulfilled' ? (categoriesResult.value.data ?? []) : []

  const dateKeys = [...new Set(notes.map((n) => n.created_at.slice(0, 10)))].sort()
  const noteWords: Record<string, string[]> = {}

  try {
    const admin = createAdminClient()
    const batch = notes.slice(0, 30)
    for (const note of batch) {
      const fromTitle = extractWords(note.title || '', 6)
      if (!note.file_path) {
        noteWords[note.id] = fromTitle
        continue
      }
      try {
        const { data: fileData } = await admin.storage.from('study-notes').download(note.file_path)
        const text = fileData ? await fileData.text() : ''
        const fromBody = extractWords(text, 10)
        noteWords[note.id] = [...new Set([...fromTitle, ...fromBody])].slice(0, 12)
      } catch {
        noteWords[note.id] = fromTitle
      }
    }
  } catch (_) {
    notes.forEach((n) => { noteWords[n.id] = extractWords(n.title || '', 8) })
  }

  const userIsAdmin = isAdmin(user?.email)
  return (
    <GraphViewClient
      notes={notes.map(({ file_path: _, ...r }) => r)}
      categories={categories}
      userEmail={user?.email ?? '익명'}
        isAdmin={userIsAdmin}
      dateKeys={dateKeys}
      noteWords={noteWords}
    />
  )
}
