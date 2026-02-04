-- ============================================================================
-- 005_fix_storage_policies.sql
-- Storage 정책 수정: 익명 사용자 지원 개선
-- "Invalid key" 오류 해결
-- 
-- 주의: 003_enable_anonymous_auth.sql을 실행했다면 이 마이그레이션은 중복될 수 있습니다.
-- ============================================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- ============================================================================
-- 새로운 정책 생성: 익명 사용자 허용
-- ============================================================================
CREATE POLICY "Users can upload their own files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'study-notes' AND
    (
      auth.uid()::text = (storage.foldername(name))[1] OR 
      auth.role() = 'anon'
    )
  );

CREATE POLICY "Users can view their own files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'study-notes' AND
    (
      auth.uid()::text = (storage.foldername(name))[1] OR 
      auth.role() = 'anon'
    )
  );

CREATE POLICY "Users can delete their own files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'study-notes' AND
    (
      auth.uid()::text = (storage.foldername(name))[1] OR 
      auth.role() = 'anon'
    )
  );
