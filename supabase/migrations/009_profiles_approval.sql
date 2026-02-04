-- ============================================================================
-- 009_profiles_approval.sql
-- 관리자 승인 기능: 회원가입 후 관리자 승인 필요
-- ============================================================================

-- ============================================================================
-- profiles 테이블: 사용자 프로필 및 승인 상태 저장
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  approved BOOLEAN NOT NULL DEFAULT false,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_approved ON public.profiles(approved);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS 정책: 사용자는 자신의 프로필만 조회 가능
-- ============================================================================
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- ============================================================================
-- 트리거 함수: 새 사용자 가입 시 자동으로 profiles에 삽입 (승인 대기 상태)
-- SECURITY DEFINER: 함수 실행 시 서비스 롤 권한 사용
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, approved)
  VALUES (NEW.id, NEW.email, false)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 5. auth.users INSERT 시 트리거
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 6. 기존 사용자 백필 (이미 있던 사용자는 승인된 것으로 처리)
INSERT INTO public.profiles (id, email, approved, approved_at)
SELECT id, email, true, NOW()
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
  approved = COALESCE(public.profiles.approved, true),
  approved_at = COALESCE(public.profiles.approved_at, NOW());

-- ============================================================================
-- 참고: 관리자 승인은 앱 레벨에서 처리
-- - ADMIN_EMAILS 환경 변수에 있는 이메일로 로그인한 사용자만 승인 가능
-- - /api/admin/approve 엔드포인트를 통해 승인 처리
-- ============================================================================
COMMENT ON TABLE public.profiles IS '사용자 프로필 및 관리자 승인 상태. approved=true일 때만 로그인 후 서비스 이용 가능.';
