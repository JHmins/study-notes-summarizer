-- ============================================================================
-- 004_fix_user_id_type.sql
-- user_id 컬럼 타입 수정: UUID → TEXT (익명 사용자 지원)
-- 
-- 주의: 003_enable_anonymous_auth.sql을 실행했다면 이 마이그레이션은 불필요합니다.
-- 기존 프로젝트에서만 필요할 수 있습니다.
-- ============================================================================

-- 외래 키 제약 조건 제거 (있는 경우)
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_user_id_fkey;

-- user_id 컬럼 타입 변경: UUID → TEXT
ALTER TABLE notes ALTER COLUMN user_id TYPE TEXT USING user_id::text;

-- 인덱스 재생성
DROP INDEX IF EXISTS idx_notes_user_id;
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
