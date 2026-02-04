# 환경 변수(.env.local) 보안 가이드

`.env.local`에는 API 키, 비밀 키 등 **절대 외부에 노출되면 안 되는 값**이 들어 있습니다. 아래를 지키면 보안을 높일 수 있습니다.

---

## 1. Git에 넣지 않기 (가장 중요)

- **`.env.local`은 이미 `.gitignore`에 포함**되어 있어, 기본적으로 커밋되지 않습니다.
- **절대** `git add .env.local` 하거나 `.gitignore`에서 제거하지 마세요.
- 실수로 커밋했다면: [GitHub 문서](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository) 참고해 히스토리에서 제거한 뒤, **해당 키는 즉시 폐기·재발급**하세요.

---

## 2. 공유·노출 금지

- `.env.local` 파일 자체를 이메일, 채팅, 클라우드 드라이브에 올리지 마세요.
- 키를 복사해 붙여넣을 때도 채팅/이슈/문서에 남기지 마세요.
- 팀원에게는 **키 값 대신** “Supabase 대시보드에서 Anon key / Service role key 확인해서 본인 `.env.local`에 넣으세요”처럼 **설정 방법만** 안내하세요.

---

## 3. 프로덕션(배포) 환경

- **배포 시에는 `.env.local` 파일을 저장소에 넣지 마세요.**
- **Vercel, Netlify 등**: 대시보드의 **Environment Variables**에만 입력합니다. 추가/수정은 대시보드에서 하고, 저장소에는 넣지 않습니다.
- **자체 서버(VPS)**: 서버에 올린 코드에는 `.env.local`이 없으므로, **서버에 SSH로 접속한 뒤** 그곳에서 `.env.local`을 만들고, 필요할 때마다 같은 방식으로 수정합니다. (SETUP.md의 "자체 서버(VPS)에 배포할 때" 참고.)
- 가능하면 **개발용 키**와 **프로덕션용 키**를 구분해 두고, 프로덕션에는 프로덕션 전용 키만 사용하세요.

---

## 4. 키 구분 및 권한

- **`NEXT_PUBLIC_`** 로 시작하는 변수는 **브라우저에 노출**됩니다. 공개해도 되는 값만 넣으세요. (예: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- **`SUPABASE_SERVICE_ROLE_KEY`**, **`ADMIN_EMAILS`**, **`GROQ_API_KEY`** 등은 **서버에서만** 사용하고, `NEXT_PUBLIC_`을 붙이지 마세요. (현재 프로젝트도 이렇게 사용 중입니다.)

---

## 5. 유출 시 대응

- 키가 노출됐다고 생각되면:
  1. **Supabase**: 대시보드 → Project Settings → API → 해당 키 **Regenerate**
  2. **Groq/OpenAI 등**: 해당 서비스에서 키 **재발급** 후 기존 키 비활성화
  3. `.env.local`(및 배포 환경 변수)을 **새 키로 갱신**
  4. 이미 Git에 올렸다면 저장소 히스토리에서 제거 절차 진행

---

## 6. 로컬 파일 권한 (선택)

- Windows: `.env.local`이 있는 폴더에 본인만 접근하도록 계정/권한 설정.
- Mac/Linux: 터미널에서 `chmod 600 .env.local` 로 본인만 읽기/쓰기 하도록 할 수 있습니다.

---

## 7. 요약

| 하지 말 것 | 할 것 |
|------------|--------|
| `.env.local`을 Git에 커밋 | `.gitignore` 유지, 커밋 전 `git status`로 확인 |
| 키를 채팅/문서에 붙여넣기 | 설정 방법만 공유, 키는 각자 대시보드에서 복사 |
| 배포 시 `.env.local`을 서버에 복사 | 호스팅 환경 변수에만 입력 |
| `SUPABASE_SERVICE_ROLE_KEY` 등에 `NEXT_PUBLIC_` 붙이기 | 서버 전용 키는 `NEXT_PUBLIC_` 없이 사용 |

`.env.local` 파일 자체를 “암호화”해 두는 것보다, **저장·공유·배포 방식**을 위처럼 지키는 것이 더 중요합니다.
