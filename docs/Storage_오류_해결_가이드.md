# Storage 오류 해결: "Invalid key" 오류

## 🔴 문제
파일 업로드 시 "Invalid key: anonymous_1769502935946/1769502935947" 오류가 발생합니다.

## 🔍 원인
1. **키 형식**: Storage 키에 한글·공백·특수문자가 들어가면 `Invalid key`가 납니다. 앱에서는 이제 **영숫자·언더스코어·점만** 쓰는 안전한 키(`userId/타임스탬프_랜덤.txt`)를 사용합니다.
2. **정책**: 익명 사용자 경로를 허용하는 Storage RLS가 없거나 맞지 않을 수 있습니다.

---

## ✅ 해결 방법

### 1. Storage 정책 업데이트 (필수)

Supabase 대시보드에서 다음 SQL을 실행하세요:

1. **Supabase 대시보드** > **SQL Editor** 클릭
2. **New query** 클릭
3. 다음 SQL 복사하여 붙여넣기:

```sql
-- 기존 정책 삭제
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- 새로운 정책 생성 (익명 사용자 허용)
CREATE POLICY "Users can upload their own files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'study-notes' AND
    (
      auth.uid()::text = (storage.foldername(name))[1] OR 
      auth.role() = 'anon' OR
      (storage.foldername(name))[1] LIKE 'anonymous_%'
    )
  );

CREATE POLICY "Users can view their own files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'study-notes' AND
    (
      auth.uid()::text = (storage.foldername(name))[1] OR 
      auth.role() = 'anon' OR
      (storage.foldername(name))[1] LIKE 'anonymous_%'
    )
  );

CREATE POLICY "Users can delete their own files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'study-notes' AND
    (
      auth.uid()::text = (storage.foldername(name))[1] OR 
      auth.role() = 'anon' OR
      (storage.foldername(name))[1] LIKE 'anonymous_%'
    )
  );
```

4. **RUN** 버튼 클릭

### 2. 코드 수정 확인

코드는 이미 수정되었습니다:

- ✅ **Storage 키**: `userId/타임스탬프_랜덤.txt` 형식만 사용 (한글·공백 없음 → Invalid key 방지)
- ✅ `components/file-upload.tsx` - 익명 사용자 + 안전한 키 사용
- ✅ `app/api/summarize/route.ts` - 익명 사용자 허용
- ✅ Storage RLS에서 익명 사용자 허용 (위 SQL 실행)

---

## 🧪 테스트

1. 브라우저 새로고침 (F5)
2. 파일 업로드 시도
3. 오류가 해결되었는지 확인

---

## 🆘 여전히 오류가 나면

### 방법 1: Storage 정책 완전히 제거 후 재생성

```sql
-- 모든 정책 삭제
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- 더 관대한 정책 생성 (개발용)
CREATE POLICY "Allow all for study-notes bucket"
  ON storage.objects FOR ALL
  USING (bucket_id = 'study-notes')
  WITH CHECK (bucket_id = 'study-notes');
```

**주의**: 이 방법은 개발 환경에서만 사용하세요. 프로덕션에서는 보안 정책을 설정해야 합니다.

### 방법 2: 익명 인증 확인

1. Supabase 대시보드 > **Authentication** > **Providers**
2. **Anonymous** 섹션에서 "Enable Anonymous provider" 체크 확인
3. Save 클릭

---

## 📚 참고

- **키 규칙**: Storage 객체 키는 `영숫자`, `_`, `-`, `.`, `/` 등만 쓰는 것이 안전합니다. 한글·공백·기타 특수문자는 `Invalid key`를 유발할 수 있어, 업로드 시 `userId/타임스탬프_랜덤.txt` 형식만 사용합니다. 실제 파일명은 `notes.title`에 저장해 화면에만 표시합니다.
- Storage 정책은 경로의 첫 번째 폴더를 사용자 ID로 봅니다.
- 익명 사용자도 UUID로 올리므로, 정책에서 `auth.uid()::text` 또는 `auth.role() = 'anon'` 등으로 허용해 두면 됩니다.
