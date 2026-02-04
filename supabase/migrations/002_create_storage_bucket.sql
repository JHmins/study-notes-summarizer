-- ============================================================================
-- 002_create_storage_bucket.sql
-- Storage 버킷 생성 및 RLS 정책 설정
-- ============================================================================

-- ============================================================================
-- Storage 버킷 생성: 업로드된 파일 저장소
-- private=false: 인증된 사용자만 접근 가능
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('study-notes', 'study-notes', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Storage RLS 정책: 사용자는 자신의 폴더에만 파일 업로드/조회/삭제 가능
-- 파일 경로 형식: {user_id}/{filename}
-- 주의: 익명 인증을 사용하려면 003_enable_anonymous_auth.sql 실행 필요
-- ============================================================================
CREATE POLICY "Users can upload their own files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'study-notes' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'study-notes' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'study-notes' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
