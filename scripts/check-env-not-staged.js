#!/usr/bin/env node
/**
 * .env.local 이 실수로 커밋 대상에 포함되지 않았는지 확인합니다.
 * 사용: npm run check:env (또는 CI/커밋 전에 실행)
 */
const { execSync } = require('child_process')

try {
  const staged = execSync('git diff --cached --name-only', { encoding: 'utf8' })
  if (staged.includes('.env.local') || staged.includes('.env')) {
    console.error('\n❌ .env.local 또는 .env 파일이 커밋 대상에 포함되어 있습니다.')
    console.error('   보안을 위해 이 파일은 절대 커밋하지 마세요.')
    console.error('   해제: git reset HEAD .env.local\n')
    process.exit(1)
  }
} catch (e) {
  // git이 없거나 저장소가 아니면 무시
}
process.exit(0)
