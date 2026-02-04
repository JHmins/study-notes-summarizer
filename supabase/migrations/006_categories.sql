-- ============================================================================
-- 006_categories.sql
-- 카테고리 기능: 노트를 과목/카테고리별로 분류
-- ============================================================================

-- ============================================================================
-- categories 테이블: 사용자별 카테고리 관리
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own categories"
  ON categories FOR SELECT
  USING (
    auth.uid()::text = user_id OR
    user_id LIKE 'anonymous_%' OR
    auth.role() = 'anon'
  );

CREATE POLICY "Users can insert their own categories"
  ON categories FOR INSERT
  WITH CHECK (
    auth.uid()::text = user_id OR
    user_id LIKE 'anonymous_%' OR
    auth.role() = 'anon'
  );

CREATE POLICY "Users can update their own categories"
  ON categories FOR UPDATE
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

CREATE POLICY "Users can delete their own categories"
  ON categories FOR DELETE
  USING (
    auth.uid()::text = user_id OR
    user_id LIKE 'anonymous_%' OR
    auth.role() = 'anon'
  );

-- ============================================================================
-- notes 테이블에 category_id 컬럼 추가
-- 카테고리 삭제 시 노트의 category_id는 NULL로 설정됨 (노트는 유지)
-- ============================================================================
ALTER TABLE notes ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notes_category_id ON notes(category_id);
