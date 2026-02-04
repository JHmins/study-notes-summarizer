# Study Notes Summarizer

수업 공부 내용을 정리해주는 웹 애플리케이션입니다. 텍스트 파일을 업로드하면 LLM을 통해 자동으로 요약해주고, 보기 쉽게 정리된 내용을 확인할 수 있습니다.

## 주요 기능

- **파일 업로드**: `.txt`, `.md` 파일을 드래그 앤 드롭 또는 파일 선택으로 업로드
- **자동 요약**: OpenAI GPT를 사용한 한국어 요약 자동 생성
- **파일 내용 검색**: 업로드한 모든 파일의 내용을 빠르게 검색
- **카테고리 관리**: 노트를 카테고리별로 분류하여 관리
- **그래프 뷰**: 노트, 카테고리, 날짜, 키워드를 시각화한 그래프 뷰
- **실시간 업데이트**: 파일 업로드 및 요약 상태 실시간 반영
- **요약 재생성**: 실패하거나 다시 생성하고 싶은 경우 재생성 가능
- **보안**: 사용자별 데이터 격리 및 인증 보호

## 기술 스택

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database & Storage**: Supabase (PostgreSQL + Storage)
- **Authentication**: Supabase Auth (익명 인증 지원)
- **AI**: OpenAI API (또는 호환 LLM)

## 빠른 시작

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.local.example` 파일을 참고하여 `.env.local` 파일을 생성하고 다음 값들을 설정하세요:

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase 프로젝트 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase Anon Key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Service Role Key
- `OPENAI_API_KEY`: OpenAI API Key

### 3. Supabase 설정

프로젝트 루트의 `supabase/migrations/` 폴더에 있는 SQL 마이그레이션 파일을 Supabase 대시보드에서 실행하세요:

1. `001_initial_schema.sql` - 기본 테이블 생성
2. `002_create_storage_bucket.sql` - Storage 버킷 생성
3. `003_enable_anonymous_auth.sql` - 익명 인증 활성화 (선택)
4. `006_categories.sql` - 카테고리 기능 (선택)

### 4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

## 사용 방법

1. **로그인/회원가입**: 익명 인증 또는 이메일 인증 사용
2. **파일 업로드**: 대시보드에서 `.txt` 또는 `.md` 파일 업로드
3. **자동 요약**: 업로드한 파일이 자동으로 요약됩니다
4. **검색**: 상단 검색창에서 파일 내용 검색 (2글자 이상)
5. **카테고리 관리**: 사이드바에서 카테고리 추가/수정/삭제
6. **그래프 뷰**: 노트 간의 관계를 시각화하여 확인

## 상세 설정 가이드

자세한 설정 방법은 [SETUP.md](./SETUP.md)를 참고하세요.

## 문제 해결

자세한 문제 해결 가이드는 [docs/](./docs/) 폴더를 참고하세요:

- **Storage 오류**: [docs/Storage_오류_해결_가이드.md](./docs/Storage_오류_해결_가이드.md)
- **로그인 오류**: [docs/로그인_오류_해결_가이드.md](./docs/로그인_오류_해결_가이드.md)
- **카테고리 설정**: [docs/카테고리_설정_가이드.md](./docs/카테고리_설정_가이드.md)
- **환경 변수 보안**: [docs/ENV_SECURITY.md](./docs/ENV_SECURITY.md)

## 테스트

수동 테스트 체크리스트는 [docs/TEST_CHECKLIST.md](./docs/TEST_CHECKLIST.md)를 참고하세요.
