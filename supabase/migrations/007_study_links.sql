-- ============================================================================
-- 007_study_links.sql
-- 수업 자료 링크 기능: 유용한 링크 저장 및 관리
-- ============================================================================

-- ============================================================================
-- study_links 테이블: 사용자별 링크 저장
-- ============================================================================
CREATE TABLE IF NOT EXISTS study_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_links_user_id ON study_links(user_id);
CREATE INDEX IF NOT EXISTS idx_study_links_created_at ON study_links(created_at DESC);

ALTER TABLE study_links ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own links
CREATE POLICY "Users can view their own links"
  ON study_links FOR SELECT
  USING (
    auth.uid()::text = user_id OR
    user_id LIKE 'anonymous_%' OR
    auth.role() = 'anon'
  );

-- Policy: Users can insert their own links
CREATE POLICY "Users can insert their own links"
  ON study_links FOR INSERT
  WITH CHECK (
    auth.uid()::text = user_id OR
    user_id LIKE 'anonymous_%' OR
    auth.role() = 'anon'
  );

-- Policy: Users can update their own links
CREATE POLICY "Users can update their own links"
  ON study_links FOR UPDATE
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

-- Policy: Users can delete their own links
CREATE POLICY "Users can delete their own links"
  ON study_links FOR DELETE
  USING (
    auth.uid()::text = user_id OR
    user_id LIKE 'anonymous_%' OR
    auth.role() = 'anon'
  );

-- ============================================================================
-- 트리거: updated_at 자동 업데이트
-- ============================================================================
CREATE TRIGGER update_study_links_updated_at
  BEFORE UPDATE ON study_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
