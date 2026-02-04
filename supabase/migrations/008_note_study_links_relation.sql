-- ============================================================================
-- 008_note_study_links_relation.sql
-- 노트-링크 연결: 노트에 관련 링크 연결 기능
-- ============================================================================

-- ============================================================================
-- study_links 테이블에 note_id 컬럼 추가
-- - 한 노트에 여러 링크 연결 가능
-- - 노트 삭제 시 링크는 유지하고 note_id만 NULL로 설정
-- ============================================================================
ALTER TABLE study_links
  ADD COLUMN IF NOT EXISTS note_id UUID REFERENCES notes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_study_links_note_id ON study_links(note_id);

COMMENT ON COLUMN study_links.note_id IS '연결된 노트 ID. 노트 삭제 시 NULL로 설정됨.';
