# 데이터베이스 마이그레이션 가이드

이 폴더에는 Supabase 데이터베이스 스키마를 생성하고 업데이트하는 SQL 마이그레이션 파일들이 포함되어 있습니다.

## 📋 마이그레이션 파일 목록

### 필수 마이그레이션 (순서대로 실행)

1. **001_initial_schema.sql** - 기본 테이블 및 함수 생성
   - `notes` 테이블 생성
   - RLS (Row Level Security) 정책 설정
   - `update_updated_at_column()` 함수 및 트리거 생성

2. **002_create_storage_bucket.sql** - Storage 버킷 생성
   - `study-notes` 버킷 생성
   - Storage RLS 정책 설정 (인증된 사용자만)

### 선택적 마이그레이션

3. **003_enable_anonymous_auth.sql** - 익명 인증 활성화
   - 익명 사용자 지원을 위한 RLS 정책 업데이트
   - Storage 정책 업데이트

4. **004_fix_user_id_type.sql** - user_id 타입 수정
   - 기존 UUID 타입을 TEXT로 변경 (익명 사용자 지원)
   - 이미 `003_enable_anonymous_auth.sql`을 실행했다면 불필요

5. **005_fix_storage_policies.sql** - Storage 정책 수정
   - 익명 사용자 지원을 위한 Storage 정책 업데이트
   - `003_enable_anonymous_auth.sql`과 중복될 수 있음

6. **006_categories.sql** - 카테고리 기능
   - `categories` 테이블 생성
   - `notes` 테이블에 `category_id` 컬럼 추가

7. **007_study_links.sql** - 수업 자료 링크 기능
   - `study_links` 테이블 생성
   - RLS 정책 설정

8. **008_note_study_links_relation.sql** - 노트-링크 연결
   - `study_links` 테이블에 `note_id` 컬럼 추가
   - 노트와 링크 연결 기능

9. **009_profiles_approval.sql** - 관리자 승인 기능
   - `profiles` 테이블 생성
   - 회원가입 시 관리자 승인 대기 기능
   - 트리거 함수 생성

10. **010_projects.sql** - 프로젝트 기능
    - `projects` 및 `project_files` 테이블 생성
    - `project-files` Storage 버킷 생성

11. **011_notes_project_relation.sql** - 노트-프로젝트 연결
    - `notes` 테이블에 `project_id` 컬럼 추가

## 🚀 실행 방법

### Supabase 대시보드에서 실행 (권장)

1. [Supabase 대시보드](https://supabase.com/dashboard) 접속
2. 프로젝트 선택
3. 왼쪽 메뉴에서 **SQL Editor** 클릭
4. **New query** 버튼 클릭
5. 마이그레이션 파일 내용을 복사하여 붙여넣기
6. **RUN** 버튼 클릭 (또는 `Ctrl+Enter`)

### Supabase CLI 사용

```bash
# Supabase CLI 설치
npm install -g supabase

# 로그인
supabase login

# 프로젝트 링크
supabase link --project-ref your-project-ref

# 마이그레이션 실행
supabase db push
```

## ⚠️ 주의사항

1. **실행 순서**: 마이그레이션 파일은 번호 순서대로 실행해야 합니다.
2. **중복 실행**: `IF NOT EXISTS` 구문이 있어 중복 실행해도 안전합니다.
3. **데이터 백업**: 프로덕션 환경에서는 실행 전 데이터를 백업하세요.
4. **정책 충돌**: 일부 마이그레이션은 기존 정책을 삭제하고 재생성합니다.

## 🔍 문제 해결

### "relation already exists" 오류
- 정상적인 메시지입니다. `IF NOT EXISTS` 구문으로 인해 이미 존재하는 객체는 건너뜁니다.

### "policy already exists" 오류
- 기존 정책을 삭제하고 재생성하는 마이그레이션(예: `003`, `005`)의 경우, 먼저 기존 정책을 수동으로 삭제해야 할 수 있습니다.

### "function does not exist" 오류
- `uuid_generate_v4()` 함수가 없다면 `001_initial_schema.sql`의 첫 줄(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`)이 실행되었는지 확인하세요.

## 📚 관련 문서

- [SETUP.md](../SETUP.md) - 전체 설정 가이드
- [docs/README.md](../docs/README.md) - 상세 문서 목록
