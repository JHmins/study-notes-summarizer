# Study Notes Summarizer — 사이트 기능·구조·코드 정리

이 문서는 현재 사이트의 **기능**, **구조**, **코드가 어떻게 나뉘고 정리되어 있는지**를 설명합니다.

---

## 1. 사이트 개요

- **이름**: Study Notes Summarizer  
- **역할**: 수업/공부 내용을 텍스트·마크다운으로 업로드하면, LLM으로 자동 요약해 주고 검색·카테고리·프로젝트·링크로 정리할 수 있는 웹 앱입니다.
- **기술 스택**
  - **프론트**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
  - **백엔드**: Next.js API Routes (Route Handlers)
  - **DB·스토리지·인증**: Supabase (PostgreSQL, Storage, Auth)
  - **AI**: OpenAI API 또는 호환 LLM (Groq, Gemini, Hugging Face 등 — `LLM_PROVIDER`로 선택)

---

## 2. 제공 기능 요약

| 기능 | 설명 |
|------|------|
| **인증** | 로그인/회원가입 (Supabase Auth). 익명 로그인 지원. 이메일 가입 시 관리자 승인 후 이용 가능. |
| **파일 업로드** | `.txt`, `.md` 파일 드래그 앤 드롭 또는 선택 업로드 (최대 10MB). Storage 버킷 `study-notes`에 저장. |
| **자동 요약** | 업로드 후 API가 Storage에서 파일을 읽어 LLM으로 한국어 마크다운 요약 생성. 상태: `pending` → `processing` → `completed` / `failed`. |
| **요약 재생성** | 실패하거나 다시 만들고 싶을 때 `/api/summarize/retry`로 재시도. |
| **노트 목록·필터** | 대시보드에서 노트 목록, 날짜/카테고리/상태 필터, 정렬(최신/오래된순/제목). |
| **노트 상세** | 요약·원문 보기, 카테고리/프로젝트 지정, 삭제. |
| **검색** | 노트 제목·파일 내용 검색 (2글자 이상). API에서 Storage 파일 내용 읽어 매칭 후 결과 반환. |
| **카테고리** | 사이드바에서 카테고리 추가/수정/삭제. 노트에 카테고리 연결. |
| **프로젝트** | 프로젝트 생성 후 노트를 프로젝트에 묶어 관리. 프로젝트별 상세 페이지. |
| **스터디 링크** | 유용한 링크 저장. 노트와 연결 가능 (`note_id`). |
| **그래프 뷰** | 노트·카테고리·날짜·키워드를 시각화한 그래프 페이지. |
| **비교 뷰** | 두 노트를 골라 요약/원문을 나란히 비교. |
| **캘린더** | 사이드바에 오늘/이번 주 노트 수, 월별 캘린더로 날짜 필터. |
| **테마** | 라이트/다크 모드. `localStorage` + `prefers-color-scheme`. |
| **관리자** | `ADMIN_EMAILS`에 등록된 이메일만 가입 승인 페이지 접근. 익명·이메일 없는 프로필은 승인 목록에서 제외. |

---

## 3. 디렉터리 구조

```
Study-CURSOR/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # 루트 레이아웃 (폰트, 테마 스크립트, globals.css)
│   ├── page.tsx                  # / → 로그인 여부에 따라 /auth/login 또는 /dashboard
│   ├── globals.css               # 전역 스타일, CSS 변수(테마)
│   ├── error.tsx                 # 전역 에러 바운더리
│   ├── auth/                     # 인증 페이지
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── callback/route.ts     # OAuth 콜백
│   ├── admin/                    # 관리자 전용
│   │   └── approvals/
│   │       ├── page.tsx          # 가입 승인 페이지 (서버)
│   │       └── admin-approvals-client.tsx
│   ├── dashboard/                # 대시보드 및 하위 화면
│   │   ├── page.tsx              # 메인 대시보드 (노트 목록, 업로드, 필터)
│   │   ├── dashboard-client.tsx  # 대시보드 클라이언트 (상태, 검색, 사이드바 연동)
│   │   ├── error.tsx
│   │   ├── notes/[id]/           # 노트 상세
│   │   ├── projects/             # 프로젝트 목록·상세
│   │   ├── compare/              # 두 노트 비교
│   │   ├── graph/                # 그래프 뷰
│   │   └── links/                # 스터디 링크
│   └── api/                      # API Route Handlers
│       ├── auth/auto-approve-if-admin/route.ts
│       ├── admin/approve/route.ts
│       ├── admin/pending-users/route.ts
│       ├── notes/[id]/route.ts   # 노트 GET/PATCH/DELETE
│       ├── search/route.ts       # 검색
│       ├── summarize/route.ts    # 요약 생성
│       └── summarize/retry/route.ts
├── components/                   # 공통 UI 컴포넌트
│   ├── sidebar.tsx
│   ├── sidebar-categories.tsx
│   ├── calendar-notes.tsx
│   ├── file-upload.tsx
│   ├── simple-markdown.tsx
│   └── theme-toggle.tsx
├── lib/                          # 서버/클라이언트 공용 로직
│   ├── supabase/
│   │   ├── server.ts             # 서버용 Supabase 클라이언트 (쿠키)
│   │   ├── client.ts             # 브라우저용 Supabase 클라이언트
│   │   └── admin.ts              # Service Role 클라이언트 (API 전용)
│   ├── llm/
│   │   └── summarize.ts          # LLM 요약 (Groq/OpenAI/Gemini/HuggingFace)
│   └── utils/
│       ├── auth.ts               # isAdmin()
│       ├── constants.ts          # ADMIN_EMAILS, MAX_FILE_SIZE, ALLOWED_FILE_TYPES 등
│       ├── errors.ts
│       └── format.ts
├── types/
│   └── index.ts                  # Note, Category, Project, StudyLink, NOTE_STATUS_CONFIG 등
├── supabase/
│   └── migrations/               # DB 마이그레이션 (순서대로 적용)
├── public/                       # 정적 파일 (로고, 아이콘)
├── middleware.ts                 # 인증 체크, /dashboard·/admin 접근 시 로그인 리다이렉트
└── docs/                         # 설정·문제해결 가이드
```

---

## 4. 라우팅 구조

사이트의 **주소(URL)**와 그 주소로 들어갔을 때 **어떤 화면/기능이 나오는지**를 정리한 것입니다.

### 4.1 페이지(URL) — 사용자가 브라우저에서 접속하는 주소

| 경로 | 용도 |
|------|------|
| `/` | 로그인되어 있으면 `/dashboard`로 이동, 아니면 `/auth/login`으로 이동 |
| `/auth/login` | 로그인 페이지 |
| `/auth/signup` | 회원가입 페이지 |
| `/dashboard` | 메인 대시보드 (노트 목록, 업로드, 필터, 검색). `?date=`, `?category=` 로 날짜/카테고리 필터 가능 |
| `/dashboard/notes/[id]` | 노트 하나 상세 보기 |
| `/dashboard/projects` | 프로젝트 목록 |
| `/dashboard/projects/[id]` | 프로젝트 하나 상세 보기 |
| `/dashboard/compare` | 두 노트 비교 (쿼리로 두 노트 ID 지정) |
| `/dashboard/graph` | 그래프 뷰 |
| `/dashboard/links` | 스터디 링크 목록 |
| `/admin/approvals` | 관리자 전용 가입 승인 페이지 (이메일 있는 사용자만 목록에 표시) |

### 4.2 API 경로 — 화면이 아니라 서버와 데이터를 주고받을 때 쓰는 주소

검색, 요약 생성, 노트 수정·삭제 등은 **프론트에서 이 API 주소로 요청**을 보내서 처리합니다.

| 메서드 | 경로 | 용도 |
|--------|------|------|
| GET | `/api/search?q=...` | 노트 내용 검색 |
| POST | `/api/summarize` | 업로드된 파일 기준으로 요약 생성 |
| POST | `/api/summarize/retry` | 요약 재시도 |
| GET / PATCH / DELETE | `/api/notes/[id]` | 노트 조회 / 수정 / 삭제 |
| GET | `/api/admin/pending-users` | 승인 대기 사용자 목록 (이메일 있는 사람만) |
| POST | `/api/admin/approve` | 사용자 승인 처리 |
| GET | `/api/auth/auto-approve-if-admin` | 관리자 이메일이면 자동 승인 |

---

## 5. 인증·미들웨어

**미들웨어**는 사용자가 어떤 주소로 들어오기 **직전에 한 번** 실행되는 코드입니다. 여기서는 “로그인 여부”를 보고, 필요하면 로그인 페이지나 대시보드로 보내줍니다.

- **동작 요약** (`middleware.ts`)
  - 쿠키로 현재 사용자 정보를 읽어서 로그인 여부를 판단합니다.
  - **이미 로그인한 사람**이 `/auth/login`, `/auth/signup` 으로 가려 하면 → `/dashboard` 로 보냅니다.
  - **로그인 안 한 사람**이 `/`, `/dashboard/*`, `/admin/*` 으로 가려 하면 → `/auth/login` 으로 보냅니다.

- **가입 승인**
  - 이메일로 회원가입하면 DB의 `profiles` 테이블에 `approved = false` 로 저장됩니다 (가입 시 자동 삽입 트리거).
  - 대시보드에 들어갈 때 `profiles.approved` 를 확인하고, **아직 승인 전이면** 로그아웃 후 `/auth/login?message=pending` 으로 보냅니다.
  - **익명 로그인** 사용자는 이 승인 체크를 하지 않고 바로 이용할 수 있습니다.

- **관리자**
  - `lib/utils/constants.ts` 의 `ADMIN_EMAILS` (환경 변수 `ADMIN_EMAILS` 를 쉼표로 나눈 목록)에 있는 이메일만 관리자로 인정합니다.
  - `lib/utils/auth.ts` 의 `isAdmin(userEmail)` 로 판별하며, 관리자만 `/admin/approvals` 에 접근할 수 있습니다.

---

## 6. 데이터베이스 구조 (Supabase / PostgreSQL)

DB 구조는 `supabase/migrations/` 안의 SQL 파일을 **번호 순서(001 → 011)**대로 적용한 상태를 기준으로 합니다.

| 마이그레이션 | 내용 |
|-------------|------|
| `001_initial_schema.sql` | `notes` 테이블 (user_id, title, file_path, status, summary 등), RLS, 인덱스 |
| `002_create_storage_bucket.sql` | Storage 버킷 `study-notes` 생성 |
| `003_enable_anonymous_auth.sql` | 익명 인증 관련 설정 |
| `004_fix_user_id_type.sql` | user_id 타입 등 조정 |
| `005_fix_storage_policies.sql` | Storage RLS 정책 |
| `006_categories.sql` | `categories` 테이블, `notes.category_id` 추가 |
| `007_study_links.sql` | `study_links` 테이블 |
| `008_note_study_links_relation.sql` | 링크–노트 연결 |
| `009_profiles_approval.sql` | `profiles` (id, email, approved 등), 가입 시 자동 삽입 트리거 |
| `010_projects.sql` | `projects`, `project_files` 테이블 |
| `011_notes_project_relation.sql` | `notes.project_id` 추가 |

**테이블 역할 요약**

- **notes**: 업로드한 파일의 메타정보·요약·상태. `user_id`, `category_id`, `project_id` 로 사용자/카테고리/프로젝트와 연결.
- **categories**: 사용자별 카테고리. `user_id`, `sort_order` 로 정렬.
- **profiles**: 로그인 사용자와 1:1. `approved` 로 가입 승인 여부 관리.
- **projects / project_files**: 프로젝트 정보와, 그 프로젝트에 속한 파일(노트) 목록.
- **study_links**: 저장한 링크. 선택적으로 `note_id` 로 노트와 연결.

**보안**: 모든 테이블에 RLS(Row Level Security)가 켜져 있어 **본인 데이터만** 조회·수정 가능합니다. 익명 사용자(`user_id` 가 `anonymous_%` 형태이거나 `auth.role() = 'anon'`)도 정책에 포함된 테이블에서는 본인 데이터만 접근합니다.

---

## 7. 코드 구성 방식

### 7.1 서버 vs 클라이언트

- **서버 쪽**  
  `app/**/page.tsx` 에서 `@/lib/supabase/server` 의 `createClient()` 로 사용자 확인 후, 노트·카테고리 등을 DB에서 조회해 **초기 데이터를 props 로** 자식 컴포넌트에 넘깁니다.  
  예: `app/dashboard/page.tsx` — 로그인·승인 체크 후 notes/categories 조회하고, `DashboardClient` 에 `initialNotes`, `initialCategories` 등 전달.

- **클라이언트 쪽**  
  `'use client'` 가 붙은 파일(예: `*-client.tsx`)에서 **검색, 필터, 업로드, 사이드바, 실시간 구독** 등 사용자와 상호작용하는 부분을 처리합니다. `@/lib/supabase/client` 를 사용합니다.  
  정리하면, **페이지는 서버에서 데이터를 준비하고**, **실제 UI·상태·입력 처리는 클라이언트 컴포넌트**에서 합니다.

### 7.2 Supabase 클라이언트 역할

- **server** (`lib/supabase/server.ts`): 서버 컴포넌트·API Route 에서 사용. 쿠키 기반 세션으로 `getUser()` 하고, RLS 가 적용된 CRUD 수행.
- **client** (`lib/supabase/client.ts`): 브라우저에서만 사용. 한 번만 만들어 두고 재사용(싱글톤).
- **admin** (`lib/supabase/admin.ts`): API Route 에서만 사용. Service Role 로 Storage 파일 다운로드, notes 상태 업데이트 등 RLS 를 넘어서는 작업에 사용.

### 7.3 공통 코드 위치

- **타입**: `types/index.ts` — `Note`, `Category`, `Project`, `StudyLink`, `NoteStatus`, `NOTE_STATUS_CONFIG` 등.
- **상수·설정**: `lib/utils/constants.ts` — `ADMIN_EMAILS`, `MAX_FILE_SIZE`, `ALLOWED_FILE_TYPES` 등.
- **인증**: `lib/utils/auth.ts` — `isAdmin()`.
- **포맷·에러**: `lib/utils/format.ts`, `lib/utils/errors.ts`.

### 7.4 스타일

- Tailwind + `app/globals.css` 에서 CSS 변수로 테마 색 정의 (`--background`, `--foreground`, `--accent`, `--surface` 등).
- 다크 모드: `layout.tsx` 의 인라인 스크립트에서 `localStorage` 와 `prefers-color-scheme` 을 보고, `document.documentElement` 에 `dark` 클래스를 넣었다 뺐다 하며 적용.

### 7.5 파일 업로드 → 요약 플로우

1. **클라이언트** (`components/file-upload.tsx`): 사용자가 파일 선택 → Supabase Storage `study-notes` 에 `{userId}/{timestamp}_{random}.txt|.md` 형태로 업로드 → `notes` 테이블에 `status: 'pending'` 으로 한 행 삽입.
2. **클라이언트**(또는 대시보드): `POST /api/summarize` 에 `{ filePath, fileName }` 전달.
3. **API** (`app/api/summarize/route.ts`): 본인 노트인지 확인 → status 를 `processing` 으로 변경 → Admin 클라이언트로 Storage 에서 파일 다운로드 → `lib/llm/summarize.ts` 로 요약 생성 → `notes.summary` 업데이트, status 를 `completed` 또는 `failed` 로 저장.
4. **화면 반영**: 클라이언트에서 Supabase Realtime 으로 `notes` 변경을 구독하거나, 목록을 다시 불러와서 상태를 갱신합니다.

---

## 8. 요약

- **기능**: 파일 업로드 → 자동 요약, 검색, 카테고리·프로젝트·링크·그래프·비교, 이메일 가입·관리자 승인, 익명 로그인.
- **구조**: App Router 기준으로 `app/`(페이지·API), `components/`, `lib/`(supabase, llm, utils), `types/`, `supabase/migrations/` 로 역할이 나뉘어 있음.
- **코드 정리**: 서버에서 데이터·인증을 처리한 뒤 클라이언트에 초기값 전달. 상수·타입·인증은 `lib/utils`, `types` 에 모아 두고, Supabase 는 server / client / admin 세 가지 용도로 나누어 사용.
