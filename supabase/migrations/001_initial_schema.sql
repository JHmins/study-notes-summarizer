-- ============================================================================
-- 001_initial_schema.sql
-- 기본 스키마 생성: notes 테이블, RLS 정책, 트리거 함수
-- ============================================================================

-- UUID 생성 함수 활성화 (PostgreSQL 확장)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- notes 테이블: 업로드된 파일의 메타데이터 및 요약 저장
-- ============================================================================
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL, -- TEXT 타입: UUID와 익명 사용자 ID 모두 지원
  title TEXT NOT NULL, -- 파일 제목
  file_path TEXT NOT NULL, -- Storage 버킷 내 파일 경로
  file_size INTEGER, -- 파일 크기 (바이트)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  summary TEXT, -- LLM으로 생성된 요약 내용
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 인덱스 생성: 쿼리 성능 최적화
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_status ON notes(status);

-- ============================================================================
-- Row Level Security (RLS) 활성화: 사용자별 데이터 격리
-- ============================================================================
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS 정책: 사용자는 자신의 노트만 조회/생성/수정/삭제 가능
-- 주의: 익명 인증을 사용하려면 003_enable_anonymous_auth.sql 실행 필요
-- ============================================================================
CREATE POLICY "Users can view their own notes"
  ON notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notes"
  ON notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes"
  ON notes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
  ON notes FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 트리거 함수: updated_at 자동 업데이트
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================================
-- 트리거: notes 테이블 업데이트 시 updated_at 자동 갱신
-- ============================================================================
CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
