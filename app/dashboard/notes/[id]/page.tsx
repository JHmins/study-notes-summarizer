import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/utils/auth'
import NoteDetailClient from './note-detail-client'

interface PageProps {
  params: {
    id: string
  }
}

export default async function NoteDetailPage({ params }: PageProps) {
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

  const adminClient = createAdminClient()
  const userId = user.id

  const { data: note, error } = await adminClient
    .from('notes')
    .select('*')
    .eq('id', params.id)
    .single()

  // 익명 사용자도 자신의 노트에 접근 가능하도록 확인
  if (error || !note) {
    redirect('/dashboard')
  }

  // 익명 사용자도 자신의 노트에 접근 가능
  if (note.user_id !== userId && !note.user_id.startsWith('anonymous_')) {
    // 다른 사용자의 노트는 접근 불가
    redirect('/dashboard')
  }

  let fileContent = ''
  try {
    const { data: fileData } = await adminClient.storage
      .from('study-notes')
      .download(note.file_path)
    if (fileData) fileContent = await fileData.text()
  } catch (err) {
    console.error('Failed to download file:', err)
  }

  const [categoriesResult, linksResult, projectsResult] = await Promise.all([
    supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order')
      .order('created_at'),
    supabase
      .from('study_links')
      .select('*')
      .eq('note_id', params.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('projects')
      .select('id, name')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ])

  const categories = categoriesResult.data ?? []
  const studyLinks = linksResult.data ?? []
  const projects = projectsResult.data ?? []
  const userIsAdmin = isAdmin(user?.email)

  return (
    <NoteDetailClient
      note={note}
      fileContent={fileContent}
      userEmail={user?.email ?? ''}
      categories={categories}
      projects={projects}
      initialStudyLinks={studyLinks}
        isAdmin={userIsAdmin}
    />
  )
}
