-- ============================================================================
-- 011_notes_project_relation.sql
-- 노트-프로젝트 연결: 노트를 프로젝트에 할당
-- ============================================================================

-- ============================================================================
-- notes 테이블에 project_id 컬럼 추가
-- - 한 노트는 최대 하나의 프로젝트에 속함
-- - 프로젝트 삭제 시 노트의 project_id는 NULL로 설정됨 (노트는 유지)
-- ============================================================================
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notes_project_id ON public.notes(project_id);

COMMENT ON COLUMN public.notes.project_id IS '이 노트가 속한 프로젝트 (선택)';
