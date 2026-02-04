import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProjectsClient from './projects-client'
import type { User } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/utils/auth'

export default async function ProjectsPage() {
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

    const [projectsResult, notesResult, categoriesResult] = await Promise.all([
      supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('notes')
        .select('id, title, created_at, category_id, status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
    ])

    const projects = projectsResult.data ?? []
    const notes = notesResult.data ?? []
    const categories = categoriesResult.data ?? []
    const userIsAdmin = isAdmin(user.email)

    return (
      <ProjectsClient
        initialProjects={projects}
        initialNotes={notes}
        initialCategories={categories}
        user={user as User}
        isAdmin={userIsAdmin}
      />
    )
  } catch (err) {
    console.error('Projects page error:', err)
    throw err instanceof Error ? err : new Error('프로젝트 페이지를 불러오는 중 오류가 났습니다.')
  }
}
