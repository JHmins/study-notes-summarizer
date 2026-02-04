-- ============================================================================
-- 010_projects.sql
-- 프로젝트 기능: 프로젝트별 파일 관리 및 정리
-- ============================================================================

-- ============================================================================
-- projects 테이블: 사용자별 프로젝트 관리
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects(created_at DESC);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own projects"
  ON public.projects FOR ALL
  USING (
    auth.uid()::text = user_id OR
    user_id LIKE 'anonymous_%' OR
    auth.role() = 'anon'
  )
  WITH CHECK (
    auth.uid()::text = user_id OR
    user_id LIKE 'anonymous_%' OR
    auth.role() = 'anon'
  );

-- 2. project_files 테이블 (프로젝트에 속한 파일 메타)
CREATE TABLE IF NOT EXISTS public.project_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  title TEXT NOT NULL,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON public.project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_user_id ON public.project_files(user_id);

ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own project files"
  ON public.project_files FOR ALL
  USING (
    auth.uid()::text = user_id OR
    user_id LIKE 'anonymous_%' OR
    auth.role() = 'anon'
  )
  WITH CHECK (
    auth.uid()::text = user_id OR
    user_id LIKE 'anonymous_%' OR
    auth.role() = 'anon'
  );

-- ============================================================================
-- 트리거: projects 테이블의 updated_at 자동 업데이트
-- ============================================================================
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Storage 버킷 생성: 프로젝트 파일 저장소
-- 파일 경로 형식: {user_id}/{project_id}/{filename}
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-files', 'project-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload project files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-files' AND
    (
      auth.uid()::text = (storage.foldername(name))[1] OR
      (storage.foldername(name))[1] LIKE 'anonymous_%' OR
      auth.role() = 'anon'
    )
  );

CREATE POLICY "Users can view project files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'project-files' AND
    (
      auth.uid()::text = (storage.foldername(name))[1] OR
      (storage.foldername(name))[1] LIKE 'anonymous_%' OR
      auth.role() = 'anon'
    )
  );

CREATE POLICY "Users can delete project files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'project-files' AND
    (
      auth.uid()::text = (storage.foldername(name))[1] OR
      (storage.foldername(name))[1] LIKE 'anonymous_%' OR
      auth.role() = 'anon'
    )
  );
