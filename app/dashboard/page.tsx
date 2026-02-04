import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/utils/auth'
import DashboardClient from './dashboard-client'

interface PageProps {
  searchParams: Promise<{ date?: string; category?: string }>
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const { date: dateParam, category: categoryParam } = await searchParams
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
    const [notesResult, categoriesResult] = await Promise.allSettled([
      supabase.from('notes').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('categories').select('*').eq('user_id', userId).order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
    ])

    const notes = notesResult.status === 'fulfilled' ? (notesResult.value.data ?? []) : []
    const categories = categoriesResult.status === 'fulfilled' ? (categoriesResult.value.data ?? []) : []

    const userIsAdmin = isAdmin(user.email)

    return (
      <DashboardClient
        initialNotes={notes}
        initialCategories={categories}
        user={user as User}
        isAdmin={userIsAdmin}
        initialDate={dateParam ?? undefined}
        initialCategoryId={categoryParam ?? undefined}
      />
    )
  } catch (err) {
    console.error('Dashboard page error:', err)
    throw err instanceof Error ? err : new Error('대시보드를 불러오는 중 오류가 났습니다.')
  }
}
