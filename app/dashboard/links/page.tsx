import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/utils/auth'
import LinksClient from './links-client'

export default async function LinksPage() {
  try {
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
    const [linksResult, categoriesResult, notesResult] = await Promise.allSettled([
      supabase
        .from('study_links')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('notes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    ])

    const links = linksResult.status === 'fulfilled' ? (linksResult.value.data ?? []) : []
    const categories = categoriesResult.status === 'fulfilled' ? (categoriesResult.value.data ?? []) : []
    const notes = notesResult.status === 'fulfilled' ? (notesResult.value.data ?? []) : []

    if (linksResult.status === 'rejected') {
      console.error('Links fetch error:', linksResult.reason)
    }
    if (categoriesResult.status === 'rejected') {
      console.error('Categories fetch error:', categoriesResult.reason)
    }
    if (notesResult.status === 'rejected') {
      console.error('Notes fetch error:', notesResult.reason)
    }

    const userIsAdmin = isAdmin(user?.email)
    return (
      <LinksClient
        initialLinks={links}
        initialCategories={categories}
        initialNotes={notes}
        user={user ?? ({ id: 'anonymous', email: 'anonymous@local.dev' } as any)}
        isAdmin={userIsAdmin}
      />
    )
  } catch (err) {
    console.error('Links page error:', err)
    throw err instanceof Error ? err : new Error('링크 페이지를 불러오는 중 오류가 났습니다.')
  }
}
