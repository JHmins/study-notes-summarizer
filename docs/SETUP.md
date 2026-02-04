# 설정 가이드

Study Notes Summarizer를 설정하고 실행하는 상세 가이드입니다.

## 목차

1. [프로젝트 설정](#1-프로젝트-설정)
2. [Supabase 설정](#2-supabase-설정)
3. [환경 변수 설정](#3-환경-변수-설정)
4. [OpenAI API 키 발급](#4-openai-api-키-발급)
5. [개발 서버 실행](#5-개발-서버-실행)
6. [카테고리 기능 설정](#6-카테고리-기능-설정)
7. [문제 해결](#7-문제-해결)

---

## 1. 프로젝트 설정

### 1.1 의존성 설치

```bash
npm install
```

---

## 2. Supabase 설정

### ⚠️ 데이터 영속성 (중요)

**올린 파일과 링크가 서버를 꺼도 유지되려면 반드시 Supabase Cloud(호스팅) 프로젝트를 사용하세요.**

- **Supabase Cloud**: [supabase.com 대시보드](https://supabase.com/dashboard)에서 프로젝트를 만들고, `.env.local`에 **Project URL**(`https://xxxx.supabase.co`)과 API 키를 넣으면, 데이터는 Supabase 서버에 저장됩니다. Next.js 서버나 컴퓨터를 꺼도 DB·Storage는 그대로 유지됩니다.
- **로컬 Supabase**(`supabase start`): 개발용으로만 쓰세요. Docker/로컬 DB를 중지하면 **노트·링크·업로드 파일이 모두 사라집니다.** 실제 사용·보관용 데이터에는 로컬 Supabase URL(`http://127.0.0.1:54321` 등)을 쓰지 마세요.
- **익명 로그인**: 익명으로 쓰면 브라우저·기기마다 다른 “계정”으로 인식됩니다. 쿠키를 지우거나 다른 기기에서 들어오면 예전 데이터가 안 보입니다(DB에는 있지만 다른 익명 ID로 보이지 않음). 오래 보관하려면 이메일로 가입하는 것을 권장합니다.

### 2.1 Supabase 프로젝트 생성

1. [Supabase](https://supabase.com)에 가입하고 새 프로젝트 생성 (Cloud 프로젝트 사용 권장)
2. 프로젝트 설정에서 다음 정보 확인:
   - Project URL (`https://xxxx.supabase.co`)
   - Anon (public) key
   - Service role key (Settings > API)

### 2.2 데이터베이스 마이그레이션 실행

Supabase 대시보드의 SQL Editor에서 다음 순서로 실행:

1. `supabase/migrations/001_initial_schema.sql` 실행
2. `supabase/migrations/002_create_storage_bucket.sql` 실행
3. `supabase/migrations/003_enable_anonymous_auth.sql` 실행 (익명 인증 사용 시)
4. `supabase/migrations/006_categories.sql` 실행 (카테고리 기능 사용 시)
5. `supabase/migrations/007_study_links.sql` 실행 (수업 자료 링크 기능 사용 시)
6. `supabase/migrations/008_note_study_links_relation.sql` 실행 (노트-링크 연결 사용 시)
7. `supabase/migrations/009_profiles_approval.sql` 실행 (회원가입 시 관리자 승인 사용 시)

**SQL 실행 방법**:
1. Supabase 대시보드에서 **SQL Editor** 메뉴 클릭
2. **New query** 버튼 클릭
3. SQL 파일 내용을 복사하여 붙여넣기
4. **RUN** 버튼 클릭 (또는 `Ctrl+Enter`)

**또는 Supabase CLI 사용**:

```bash
# Supabase CLI 설치 (선택사항)
npm install -g supabase

# 로그인
supabase login

# 프로젝트 링크
supabase link --project-ref your-project-ref

# 마이그레이션 실행
supabase db push
```

### 2.3 Storage 버킷 확인

Supabase 대시보드에서:
1. Storage 메뉴로 이동
2. `study-notes` 버킷이 생성되었는지 확인
3. 버킷이 private으로 설정되어 있는지 확인

---

## 3. 환경 변수 설정

`.env.local` 파일을 생성하고 다음 내용을 추가:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI API Key
OPENAI_API_KEY=sk-your-openai-api-key
```

**관리자 승인 (선택)**: 회원가입 후 관리자 승인을 사용하려면 `.env.local`에 다음을 추가하세요.
- `ADMIN_EMAILS=관리자이메일1@example.com,관리자이메일2@example.com` (쉼표 구분)
- 이 이메일로 로그인한 사용자만 `/admin/approvals`에서 가입 대기 목록을 보고 승인할 수 있습니다.
- **첫 관리자**: `.env.local`에 `ADMIN_EMAILS=본인이메일`을 넣은 뒤, **회원가입** 페이지에서 그 이메일로 가입하면 자동 승인되어 바로 로그인됩니다. (다른 사용자는 가입 후 관리자 승인 대기)
- 마이그레이션 `009_profiles_approval.sql` 실행 후 적용됩니다.

**중요**: `.env.local` 파일은 Git에 커밋하지 마세요. 이미 `.gitignore`에 포함되어 있습니다.  
보안 상세: [환경 변수 보안 가이드](./docs/ENV_SECURITY.md) 참고. 커밋 전 `npm run check:env` 로 실수로 스테이징되지 않았는지 확인할 수 있습니다.

---

## 4. OpenAI API 키 발급

1. [OpenAI Platform](https://platform.openai.com)에 가입
2. API Keys 메뉴에서 새 API 키 생성
3. 생성된 키를 `.env.local`의 `OPENAI_API_KEY`에 설정

**참고**: 다른 LLM API를 사용하려면 `app/api/summarize/route.ts`의 코드를 수정해야 합니다.

---

## 5. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

---

## 6. 카테고리 기능 설정

카테고리 기능을 사용하려면 `supabase/migrations/006_categories.sql` 파일을 실행하세요.

**설정 방법**:
1. Supabase 대시보드의 SQL Editor에서 `006_categories.sql` 파일 내용 실행
2. 성공 메시지 확인 후 앱 새로고침
3. 사이드바에서 카테고리 추가/수정/삭제 가능

**에러 해결**:
- `function uuid_generate_v4() does not exist`: 쿼리 맨 위에 `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` 추가
- `relation "notes" does not exist`: 먼저 `001_initial_schema.sql` 실행 필요

---

## 7. 수업 자료 링크 기능 설정

수업 자료 링크 기능을 사용하려면 `supabase/migrations/007_study_links.sql` 파일을 실행하세요.

**설정 방법**:
1. Supabase 대시보드의 SQL Editor에서 `007_study_links.sql` 파일 내용 실행
2. 성공 메시지 확인 후 앱 새로고침
3. 사이드바에서 "수업 자료 링크" 메뉴 클릭하여 링크 추가/수정/삭제 가능

**에러 해결**:
- `Could not find the table 'public.study_links'`: `007_study_links.sql` 파일을 실행하지 않았을 가능성이 높습니다. 위의 설정 방법을 따라 실행하세요.
- `function update_updated_at_column() does not exist`: 먼저 `001_initial_schema.sql` 실행 필요 (이 함수가 정의되어 있음)

---

## 8. 문제 해결

### 마이그레이션 오류

- Supabase 대시보드의 SQL Editor에서 직접 실행해보세요
- 에러 메시지를 확인하고 필요한 경우 수정하세요
- "relation already exists" 오류는 이미 생성된 것이므로 무시 가능

### 인증 오류

- Supabase 프로젝트의 Authentication 설정 확인
- 익명 인증 사용 시 `003_enable_anonymous_auth.sql` 실행 확인
- 이메일 인증이 활성화되어 있는지 확인
- 리다이렉트 URL 설정 확인

### 이메일 rate limit (Email rate limit exceeded)

회원가입 시 **"Email rate limit exceeded"** 가 나오면 Supabase Auth의 이메일 발송 제한(시간당 소량)에 걸린 것입니다.

**해결 방법 (권장)**  
가입 시 인증 메일을 쓰지 않으려면 **Confirm email** 을 끄면 됩니다.

1. [Supabase 대시보드](https://supabase.com/dashboard) → 프로젝트 선택
2. **Authentication** → **Providers** → **Email** 이동
3. **"Confirm email"** 옵션을 **끄기(Off)** 로 변경 후 **Save**
4. 이후 회원가입 시 이메일을 보내지 않아 rate limit에 걸리지 않습니다. (가입 후 바로 로그인 가능)

**다른 방법**

- 약 **1시간 후** 다시 시도 (제한이 풀리면 가입 가능)
- Supabase에서 **Custom SMTP** 를 설정하면 발송 제한을 늘리거나 직접 제어할 수 있음 (Settings > Auth > SMTP)

### 인증 메일이 안 오는 경우

**1) "Confirm email"을 꺼둔 경우 (가장 흔함)**  
- rate limit 때문에 **Confirm email**을 끄셨다면, Supabase는 **의도적으로** 가입 시 메일을 보내지 않습니다.  
- 이 경우 **인증 메일이 안 오는 것이 정상**입니다. 가입 후 바로 로그인하거나, 관리자 승인 후 로그인하면 됩니다.

**2) "Confirm email"을 켜두었는데 메일이 안 오는 경우**  
- **스팸함**을 먼저 확인해보세요. Supabase 기본 발송 메일은 스팸으로 분류되는 경우가 많습니다.  
- Supabase 무료 플랜은 기본 SMTP를 쓰며, 발송 제한이 있고 도달률이 낮을 수 있습니다.  
- **Custom SMTP**를 쓰면 안정적으로 보낼 수 있습니다.  
  - Supabase 대시보드 → **Project Settings** → **Auth** → **SMTP Settings**  
  - Resend, SendGrid, AWS SES 등으로 SMTP 호스트/포트/계정 설정 후 **Enable Custom SMTP**  
- 인증 메일이 꼭 필요 없다면, 위처럼 **Confirm email**을 끄고 가입 후 바로 로그인하는 방식을 쓰는 것을 권장합니다.

### 파일 업로드 실패

- Storage 버킷이 올바르게 생성되었는지 확인
- Storage 정책이 올바르게 설정되었는지 확인
- 파일 크기 제한 확인 (현재 10MB)
- [Storage 오류 해결 가이드](./docs/Storage_오류_해결_가이드.md) 참고

### 요약 생성 실패

- OpenAI API 키가 올바른지 확인
- API 키에 충분한 크레딧이 있는지 확인
- 네트워크 연결 확인
- Supabase 로그에서 오류 메시지 확인

### 브라우저에서 페이지가 안 열려요

- 개발 서버가 실행 중인지 확인 (`npm run dev`)
- 터미널에 오류 메시지가 있는지 확인
- 포트가 사용 중인지 확인 (기본: 3000)
- 브라우저 개발자 도구(F12)에서 콘솔 오류 확인

### 로그인 오류

- [로그인 오류 해결 가이드](./docs/로그인_오류_해결_가이드.md) 참고
- 익명 인증 사용 시 `003_enable_anonymous_auth.sql` 실행 확인

---

## 추가 설정

### 이메일 인증 비활성화 (개발용)

Supabase 대시보드에서:
1. Authentication > Providers > Email
2. "Confirm email" 옵션 비활성화

### 커스텀 도메인 설정

Supabase 대시보드에서:
1. Settings > API
2. 추가 리다이렉트 URL 설정

---

## 프로덕션 배포

### Vercel 배포 (권장)

1. [Vercel](https://vercel.com)에 프로젝트 연결
2. 환경 변수 설정:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`
   - (선택) `ADMIN_EMAILS`, `LLM_PROVIDER`, `GROQ_API_KEY` 등
3. 배포

**환경 변수 추가/수정**: Vercel 대시보드 → 프로젝트 → **Settings** → **Environment Variables**에서 추가·수정 후 저장. 필요 시 **Redeploy** 하면 적용됩니다. 저장소에 `.env.local`을 넣지 않아도 됩니다.

### 다른 플랫폼 (Netlify, Railway 등)

Next.js를 지원하는 플랫폼에서는 대시보드의 **Environment Variables** 메뉴에 변수를 넣으면 됩니다. 추가/수정은 대시보드에서만 하면 되고, 저장소에는 넣지 않습니다.

### 자체 서버(VPS)에 배포할 때 — 환경 변수 추가/수정 방법

저장소에는 `.env.local`을 넣지 않으므로, **서버 쪽에서만** 환경 변수를 만들고 수정합니다.

**1) 처음 한 번 설정**

- 서버에 SSH로 접속한 뒤, 프로젝트 폴더(예: `~/app`)로 이동합니다.
- `.env.local.example`을 참고해 **서버에 직접** `.env.local` 파일을 만듭니다.
  ```bash
  cd ~/app   # 실제 프로젝트 경로로
  nano .env.local
  ```
- 필요한 변수 이름과 값을 입력하고 저장합니다. (로컬 PC의 `.env.local`에서 복사해 붙여넣거나, 비밀 메모장 등에 적어 둔 값을 입력해도 됩니다.)
- 앱을 재시작합니다 (예: `pm2 restart all`, `systemctl restart myapp`).

**2) 나중에 변수를 추가하거나 수정할 때**

- 다시 SSH로 서버에 접속합니다.
- 같은 경로에서 `.env.local`을 편집합니다.
  ```bash
  nano .env.local
  ```
- 추가/수정 후 저장하고, 앱을 재시작합니다.

**정리**

- **저장소**: `.env.local`은 올리지 않고, **이름만** 참고용으로 `.env.local.example`만 커밋합니다.
- **서버**: 서버에 올린 코드에는 `.env.local`이 없으므로, **서버에서 직접** `.env.local`을 만들고, 필요할 때마다 SSH로 접속해 수정합니다.
- **Vercel/Netlify 등**: 파일 대신 **대시보드의 Environment Variables**에만 넣고, 추가/수정도 대시보드에서 합니다.

---

## 지원

문제가 발생하면 다음을 확인하세요:
- 브라우저 콘솔의 오류 메시지
- Supabase 대시보드의 로그
- Next.js 개발 서버의 터미널 출력
