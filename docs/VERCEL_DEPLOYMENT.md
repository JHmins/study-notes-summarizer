# Vercel 배포 가이드

이 문서는 Study Notes Summarizer 프로젝트를 Vercel에 배포하는 방법을 설명합니다.

## 📋 사전 준비사항

1. **Git 저장소 준비**
   - GitHub, GitLab, 또는 Bitbucket 계정 필요
   - 프로젝트가 Git 저장소에 푸시되어 있어야 함

2. **Vercel 계정**
   - [vercel.com](https://vercel.com)에서 무료 계정 생성

## 🚀 배포 단계

### 1단계: Git 저장소에 프로젝트 푸시

프로젝트가 아직 Git 저장소에 없다면:

```bash
# Git 초기화 (아직 안 했다면)
git init

# .gitignore 확인 (node_modules, .next, .env.local 등이 제외되어 있는지 확인)
cat .gitignore

# 모든 파일 추가
git add .

# 첫 커밋
git commit -m "Initial commit: Study Notes Summarizer"

# GitHub에 새 저장소 생성 후 연결
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

### 2단계: Vercel에 프로젝트 가져오기

1. [Vercel 대시보드](https://vercel.com/dashboard)에 로그인
2. **"Add New..."** → **"Project"** 클릭
3. Git 저장소 선택 (GitHub/GitLab/Bitbucket)
4. 프로젝트 선택
5. **"Import"** 클릭

### 3단계: 프로젝트 설정

Vercel이 자동으로 Next.js 프로젝트를 감지합니다. 다음 설정을 확인하세요:

#### Framework Preset
- **Framework Preset**: Next.js (자동 감지됨)

#### Build and Output Settings
- **Build Command**: `npm run build` (기본값)
- **Output Directory**: `.next` (기본값)
- **Install Command**: `npm install` (기본값)

#### Root Directory
- 프로젝트가 저장소 루트에 있다면 비워두기
- 하위 폴더에 있다면 폴더 경로 지정

### 4단계: 환경 변수 설정 ⚠️ 중요!

`.env.local` 파일의 모든 환경 변수를 Vercel에 설정해야 합니다.

#### Vercel에서 환경 변수 추가하는 방법:

1. 프로젝트 설정 페이지에서 **"Environment Variables"** 탭 클릭
2. 다음 환경 변수들을 하나씩 추가:

**⚠️ 보안 주의사항:**
- `SUPABASE_SERVICE_ROLE_KEY`는 절대 공개 저장소에 커밋하지 마세요!
- `.env.local` 파일은 `.gitignore`에 포함되어 있어야 합니다
- 환경 변수는 Vercel 대시보드에서만 설정하세요

#### 환경 변수 적용 범위:
- 각 환경 변수에 대해 **Production**, **Preview**, **Development** 중 선택
- 일반적으로 모든 환경에 적용: 세 가지 모두 체크

### 5단계: 배포 실행

1. **"Deploy"** 버튼 클릭
2. 빌드 로그 확인 (약 2-5분 소요)
3. 배포 완료 후 자동으로 URL 생성됨 (예: `your-project.vercel.app`)

### 6단계: Supabase 설정 확인

#### Supabase Redirect URLs 설정

Vercel 배포 후 Supabase 인증 설정에 리다이렉트 URL을 추가해야 합니다:

1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. 프로젝트 선택
3. **Authentication** → **URL Configuration** 이동
4. **Redirect URLs**에 다음 추가:
   ```
   https://your-project.vercel.app/auth/callback
   https://your-project.vercel.app/**
   ```

#### CORS 설정 (필요한 경우)

Supabase에서 Vercel 도메인을 허용하도록 설정:
- **Settings** → **API** → **CORS** 설정 확인

### 7단계: 배포 확인

1. **배포된 URL 접속** (예: `https://your-project.vercel.app`)
2. **로그인/회원가입 테스트**
3. **기능 테스트**:
   - 파일 업로드
   - 노트 생성 및 요약
   - 카테고리 관리
   - 프로젝트 관리

## 🔄 자동 배포 설정

Vercel은 기본적으로 Git 저장소에 푸시할 때마다 자동으로 재배포됩니다:

- **main/master 브랜치**: Production 배포
- **다른 브랜치**: Preview 배포

## 📝 커스텀 도메인 설정 (선택사항)

1. Vercel 프로젝트 설정 → **Domains** 탭
2. 원하는 도메인 입력
3. DNS 설정 안내에 따라 도메인 제공업체에서 설정

## 🐛 문제 해결

### 빌드 실패 시

1. **빌드 로그 확인**
   - Vercel 대시보드 → 프로젝트 → **Deployments** → 실패한 배포 클릭
   - 로그에서 에러 메시지 확인

2. **로컬에서 빌드 테스트**
   ```bash
   npm run build
   ```
   - 로컬에서 빌드가 성공해야 Vercel에서도 성공합니다

3. **환경 변수 확인**
   - 모든 필수 환경 변수가 설정되었는지 확인
   - 변수명 오타 확인

### 환경 변수 관련 문제

- `NEXT_PUBLIC_` 접두사가 있는 변수는 클라이언트에서 접근 가능
- 접두사가 없는 변수는 서버 사이드에서만 접근 가능
- 환경 변수 변경 후 **재배포** 필요

### Supabase 연결 문제

- Supabase URL과 키가 올바른지 확인
- Redirect URLs에 Vercel 도메인이 추가되었는지 확인
- Supabase 프로젝트가 활성화되어 있는지 확인

## 📚 추가 리소스

- [Vercel 공식 문서](https://vercel.com/docs)
- [Next.js 배포 가이드](https://nextjs.org/docs/deployment)
- [Supabase 인증 설정](https://supabase.com/docs/guides/auth)

## ✅ 배포 체크리스트

배포 전 확인사항:

- [ ] Git 저장소에 프로젝트 푸시 완료
- [ ] `.env.local` 파일이 `.gitignore`에 포함됨
- [ ] 모든 환경 변수를 Vercel에 설정함
- [ ] 로컬에서 `npm run build` 성공
- [ ] Supabase Redirect URLs 설정 완료
- [ ] Vercel 배포 성공 확인
- [ ] 배포된 사이트에서 로그인 테스트 완료
- [ ] 주요 기능 테스트 완료

---

**배포 완료 후**: Vercel은 자동으로 HTTPS 인증서를 제공하고, CDN을 통해 전 세계에 빠르게 서비스합니다! 🎉
