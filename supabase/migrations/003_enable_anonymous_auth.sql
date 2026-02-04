-- ============================================================================
-- 003_enable_anonymous_auth.sql
-- 익명 인증 활성화: 회원가입 없이 앱 사용 가능
-- ============================================================================

-- ============================================================================
-- user_id 컬럼 타입 변경: UUID → TEXT (익명 사용자 ID 지원)
-- ============================================================================
ALTER TABLE notes ALTER COLUMN user_id TYPE TEXT;

-- Update RLS policies to allow anonymous users
DROP POLICY IF EXISTS "Users can view their own notes" ON notes;
CREATE POLICY "Users can view their own notes"
  ON notes FOR SELECT
  USING (
    auth.uid()::text = user_id OR 
    user_id LIKE 'anonymous_%' OR
    auth.role() = 'anon'
  );

DROP POLICY IF EXISTS "Users can insert their own notes" ON notes;
CREATE POLICY "Users can insert their own notes"
  ON notes FOR INSERT
  WITH CHECK (
    auth.uid()::text = user_id OR 
    user_id LIKE 'anonymous_%' OR
    auth.role() = 'anon'
  );

DROP POLICY IF EXISTS "Users can update their own notes" ON notes;
CREATE POLICY "Users can update their own notes"
  ON notes FOR UPDATE
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

DROP POLICY IF EXISTS "Users can delete their own notes" ON notes;
CREATE POLICY "Users can delete their own notes"
  ON notes FOR DELETE
  USING (
    auth.uid()::text = user_id OR 
    user_id LIKE 'anonymous_%' OR
    auth.role() = 'anon'
  );

-- ============================================================================
-- Storage RLS 정책 업데이트: 익명 사용자 허용
-- ============================================================================
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
CREATE POLICY "Users can upload their own files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'study-notes' AND
    (
      auth.uid()::text = (storage.foldername(name))[1] OR 
      auth.role() = 'anon' OR
      (storage.foldername(name))[1] LIKE 'anonymous_%'
    )
  );

DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
CREATE POLICY "Users can view their own files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'study-notes' AND
    (
      auth.uid()::text = (storage.foldername(name))[1] OR 
      auth.role() = 'anon' OR
      (storage.foldername(name))[1] LIKE 'anonymous_%'
    )
  );

DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
CREATE POLICY "Users can delete their own files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'study-notes' AND
    (
      auth.uid()::text = (storage.foldername(name))[1] OR 
      auth.role() = 'anon' OR
      (storage.foldername(name))[1] LIKE 'anonymous_%'
    )
  );
