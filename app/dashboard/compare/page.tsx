import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/utils/auth'
import CompareClient from './compare-client'

interface PageProps {
  searchParams: {
    id1?: string
    id2?: string
  }
}

export default async function ComparePage({ searchParams }: PageProps) {
  const supabase = await createClient()
  let {
    data: { user },
  } = await supabase.auth.getUser()

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

  const { id1, id2 } = searchParams

  if (!id1 || !id2) {
    redirect('/dashboard')
  }

  // 두 노트 모두 가져오기
  const [note1Result, note2Result] = await Promise.allSettled([
    adminClient.from('notes').select('*').eq('id', id1).single(),
    adminClient.from('notes').select('*').eq('id', id2).single(),
  ])

  const note1 = note1Result.status === 'fulfilled' ? note1Result.value.data : null
  const note2 = note2Result.status === 'fulfilled' ? note2Result.value.data : null

  // 노트가 없거나 권한이 없으면 리다이렉트
  if (!note1 || !note2) {
    redirect('/dashboard')
  }

  // 권한 확인
  if (
    (note1.user_id !== userId && !note1.user_id.startsWith('anonymous_')) ||
    (note2.user_id !== userId && !note2.user_id.startsWith('anonymous_'))
  ) {
    redirect('/dashboard')
  }

  // 파일 내용 가져오기
  let fileContent1 = ''
  let fileContent2 = ''
  try {
    const [file1Data, file2Data] = await Promise.allSettled([
      adminClient.storage.from('study-notes').download(note1.file_path),
      adminClient.storage.from('study-notes').download(note2.file_path),
    ])
    if (file1Data.status === 'fulfilled' && file1Data.value.data) {
      fileContent1 = await file1Data.value.data.text()
    }
    if (file2Data.status === 'fulfilled' && file2Data.value.data) {
      fileContent2 = await file2Data.value.data.text()
    }
  } catch (err) {
    console.error('Failed to download files:', err)
  }

  const [categoriesResult, notesResult] = await Promise.allSettled([
    supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order')
      .order('created_at'),
    supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ])

  const categories = categoriesResult.status === 'fulfilled' ? (categoriesResult.value.data ?? []) : []
  const notes = notesResult.status === 'fulfilled' ? (notesResult.value.data ?? []) : []

  const userIsAdmin = isAdmin(user?.email)
  return (
    <CompareClient
      note1={note1}
      note2={note2}
      fileContent1={fileContent1}
      fileContent2={fileContent2}
      userEmail={user?.email ?? ''}
      userId={userId}
        isAdmin={userIsAdmin}
      initialCategories={categories}
      initialNotes={notes}
    />
  )
}
