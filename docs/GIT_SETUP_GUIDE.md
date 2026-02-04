# Git 저장소 준비 가이드

GitHub에 저장소를 만들고 프로젝트를 푸시하는 방법을 설명합니다.

## 📋 사전 준비

1. **GitHub 계정 생성** (없다면)
   - [github.com](https://github.com) 접속
   - "Sign up" 클릭하여 계정 생성

2. **Git 설치 확인** (로컬 컴퓨터에)
   ```bash
   git --version
   ```
   - 설치되어 있지 않다면: [git-scm.com](https://git-scm.com/download/win)에서 다운로드

## 🚀 GitHub에 저장소 만들기

### 방법 1: GitHub 웹사이트에서 만들기 (추천)

1. **GitHub 로그인**
   - [github.com](https://github.com) 접속 후 로그인

2. **새 저장소 생성**
   - 우측 상단 **"+"** 아이콘 클릭 → **"New repository"** 선택
   - 또는 [github.com/new](https://github.com/new) 직접 접속

3. **저장소 정보 입력**
   - **Repository name**: `study-notes-summarizer` (또는 원하는 이름)
   - **Description**: "Study Notes Summarizer - 수업 공부 내용을 정리해주는 웹 애플리케이션" (선택사항)
   - **Public** 또는 **Private** 선택
     - Public: 누구나 볼 수 있음 (무료)
     - Private: 본인만 볼 수 있음 (무료)
   - ⚠️ **"Initialize this repository with a README"** 체크하지 않기 (이미 프로젝트가 있으므로)
   - **"Add .gitignore"** 선택 안 함
   - **"Choose a license"** 선택 안 함

4. **"Create repository"** 클릭

5. **저장소 URL 복사**
   - 생성된 페이지에서 HTTPS URL 복사
   - 예: `https://github.com/YOUR_USERNAME/study-notes-summarizer.git`

## 💻 로컬 프로젝트를 GitHub에 연결하기

### 1단계: Git 초기화 (아직 안 했다면)

프로젝트 폴더에서 PowerShell 또는 터미널 열기:

```bash
cd d:\Study-CURSOR
git init
```

### 2단계: .gitignore 확인

`.gitignore` 파일이 있는지 확인하고, 다음 항목들이 포함되어 있는지 확인:

```
node_modules
.next
.env.local
.env*.local
.vercel
dist
build
*.log
.DS_Store
```

### 3단계: 파일 추가 및 커밋

```bash
# 모든 파일 추가
git add .

# 첫 커밋
git commit -m "Initial commit: Study Notes Summarizer"
```

### 4단계: GitHub 저장소 연결

```bash
# GitHub에서 복사한 URL 사용
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# 브랜치 이름을 main으로 설정
git branch -M main

# GitHub에 푸시
git push -u origin main
```

**⚠️ 주의**: `YOUR_USERNAME`과 `YOUR_REPO_NAME`을 실제 값으로 변경하세요!

### 5단계: 인증 (필요한 경우)

GitHub에 푸시할 때 인증이 필요할 수 있습니다:

#### 방법 A: Personal Access Token 사용 (추천)

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. **"Generate new token"** 클릭
3. **Note**: "Vercel Deployment" 입력
4. **Expiration**: 원하는 기간 선택
5. **Scopes**: `repo` 체크
6. **"Generate token"** 클릭
7. 생성된 토큰 복사 (다시 볼 수 없으니 저장!)
8. 푸시할 때 비밀번호 대신 이 토큰 사용

#### 방법 B: GitHub CLI 사용

```bash
# GitHub CLI 설치 (선택사항)
# winget install GitHub.cli

# 로그인
gh auth login

# 그 다음 git push
git push -u origin main
```

## ✅ 확인

GitHub 저장소 페이지를 새로고침하면 파일들이 업로드된 것을 확인할 수 있습니다!

## 🔄 이후 변경사항 푸시하기

코드를 수정한 후:

```bash
git add .
git commit -m "설명 메시지"
git push
```

## 📝 다른 Git 호스팅 서비스

### GitLab
- [gitlab.com](https://gitlab.com) 접속
- "New project" → "Create blank project"
- 동일한 방식으로 연결

### Bitbucket
- [bitbucket.org](https://bitbucket.org) 접속
- "Create repository"
- 동일한 방식으로 연결

---

**다음 단계**: Git 저장소 준비가 완료되면 `VERCEL_DEPLOYMENT.md`의 2단계부터 진행하세요!
