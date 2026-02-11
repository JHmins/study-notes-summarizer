/**
 * LLM API 통합 모듈
 * 여러 LLM 제공자를 지원합니다: Groq, OpenAI, Gemini, Hugging Face
 * 요약은 마크다운으로 출력합니다.
 */

const MD_SYSTEM_PROMPT = `You are a professional academic summarization assistant.

당신은 수업·강의·교재·학습 자료를 구조화하여 정리하는 전문 요약 어시스턴트입니다.
학습자가 나중에 핵심 개념을 빠르게 복습하고 전체 구조를 한눈에 파악할 수 있도록 정리하는 것이 목적입니다.

모든 출력은 반드시 한국어로 작성하며, 엄격한 Markdown 형식을 준수해야 합니다.

────────────────────────
[출력 우선 원칙]

1. 내용의 완전성(원문 끝까지 포함)이 형식보다 우선입니다.
2. 원문의 마지막 문장과 마지막 주제까지 반드시 포함하세요.
3. 요약이 길어져도 절대 중간에서 끊지 마세요.

────────────────────────
[작성 절차 - 내부 수행]

1. 원문 전체 완독
2. 마지막 문장·단락 확인
3. 주요 주제 및 구조 파악
4. 논리적으로 재구성
5. Markdown 구조 적용
6. 마지막 내용 반영 여부 검증
7. 형식 위반 여부 점검 후 출력

(위 절차는 출력에 표시하지 마세요.)

────────────────────────
[출력 형식 규칙 - 절대 준수]

1. 요약 최상단에 반드시 1~2문장의 전체 핵심 요약을 작성하세요.

2. 큰 섹션은 반드시 아래 형식을 따르세요:

# 1. 대제목
내용

---
## 2. 소제목
내용

3. 각 ## 섹션 사이에는 반드시 수평선 --- 를 삽입하세요.
4. ### 는 하위 개념 정리에만 사용하세요.
5. ### 아래에는 수평선을 사용하지 마세요.

[가독성 규칙]

- 핵심 개념·정의는 **굵게**
- 나열이 3개 이상이면 반드시 리스트(-) 사용
- 단계/절차는 번호 리스트(1. 2. 3.) 사용
- 정의·중요 문장은 인용문(>) 사용 가능
- 코드·명령어·함수명·키워드는 반드시 인라인 코드(\`example\`)로 표기

[코드 사용 규칙]

- 세 개의 백틱(\`\`\`) 코드 블록은 절대 사용 금지
- 인라인 코드(한 개 백틱)만 허용

────────────────────────
[내용 구성 원칙]

1. 도입부부터 마지막 문장까지 누락 없이 포함하세요.
2. 모든 핵심 개념, 정의, 사례, 결론을 포함하세요.
3. 원문에 없는 내용은 절대 추가하지 마세요.
4. 기본적으로 원문의 흐름을 유지하세요.
5. 유사 개념은 한 섹션으로 묶어 재구성 가능합니다.
6. 핵심 주제는 2~3문장 이상 설명하세요.
7. 보조 설명은 1문장 이내로 정리하세요.

[용어 규칙]

- 전문 용어는 원문 표기 그대로 유지
- 첫 등장 시 가능하면 굵게 처리
- 약어는 첫 등장 시 풀어쓰기 권장
- 설명은 한국어로 작성하되, 전문 용어·고유명사·수식·영문 표현·코드 조각은 원문 그대로 유지

[문체 규칙]

- 반드시 합니다체(격식체) 사용
- 반말·구어체·감탄형 표현 금지

────────────────────────
[학습 최적화 요소]

각 ## 큰 섹션 마지막에 다음을 추가하세요:

### Key Terminology
- 해당 섹션 핵심 용어 3~5개 정리

요약의 마지막에는 반드시 다음을 추가하세요:

---
## 복습 질문 (Self-Check Questions)

1. 전체 내용을 관통하는 핵심 질문
2. 개념 이해를 점검하는 질문
3. 응용 사고를 요구하는 질문

────────────────────────
[금지 사항]

- 세 개의 백틱(\`\`\`) 코드 블록 사용
- 원문에 없는 사실·추측·의견 추가
- 원문 끝까지 다루기 전에 중단
- 같은 내용 불필요하게 반복
- 메타 설명, 사과, 내부 사고 과정 출력

출력은 오직 Markdown 요약만 반환하세요.
`

const MD_USER_PROMPT_PREFIX = '다음 학습 자료를 **처음부터 마지막 단어까지 꼼꼼하게 읽고**, 전체 내용을 상세하게 분석하여 요약해 주세요. 특히 **원문의 결론 부분까지 완벽하게 포함**되어야 하며, 정의된 강조 규칙을 활용해 가독성이 극대화된 깔끔한 노트를 만들어 주세요.\n\n'

interface SummarizeOptions {
  text: string
  title?: string
}

interface SummarizeResult {
  summary: string
}

export async function summarizeText({ text }: SummarizeOptions): Promise<SummarizeResult> {
  const provider = process.env.LLM_PROVIDER || 'groq'

  switch (provider.toLowerCase()) {
    case 'groq':
      return { summary: await summarizeWithGroq(text) }
    case 'openai':
      return { summary: await summarizeWithOpenAI(text) }
    case 'gemini':
      return { summary: await summarizeWithGemini(text) }
    case 'huggingface':
      return { summary: await summarizeWithHuggingFace(text) }
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`)
  }
}

async function summarizeWithGroq(text: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY not configured')

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: MD_SYSTEM_PROMPT },
        { role: 'user', content: MD_USER_PROMPT_PREFIX + text },
      ],
      temperature: 0.7,
      max_tokens: 8192,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Groq API error: ${error}`)
  }

  const data = await response.json()
  const summary = data.choices[0]?.message?.content || ''
  if (!summary) throw new Error('Failed to generate summary from Groq')
  return summary
}

async function summarizeWithOpenAI(text: string): Promise<string> {
  const { default: OpenAI } = await import('openai')
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  const openai = new OpenAI({ apiKey })
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: MD_SYSTEM_PROMPT },
      { role: 'user', content: MD_USER_PROMPT_PREFIX + text },
    ],
    temperature: 0.7,
    max_tokens: 4096,
  })

  const summary = completion.choices[0]?.message?.content || ''
  if (!summary) throw new Error('Failed to generate summary from OpenAI')
  return summary
}

async function summarizeWithGemini(text: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  // 사용 가능한 모델 목록 (우선순위 순) - 최신 모델명 사용
  const availableModels = [
    'gemini-2.5-flash',      // 최신 빠른 모델
    'gemini-1.5-flash',      // 안정적인 빠른 모델
    'gemini-2.0-flash',      // 중간 버전
    'gemini-1.5-pro',        // 강력한 모델
  ]
  
  const model = process.env.GEMINI_MODEL || availableModels[0]
  const apiVersion = process.env.GEMINI_API_VERSION || 'v1beta'

  // 첫 번째 모델 시도
  let lastError: unknown = null
  for (const tryModel of [model, ...availableModels.filter(m => m !== model)]) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/${apiVersion}/models/${tryModel}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: MD_SYSTEM_PROMPT + '\n\n' + MD_USER_PROMPT_PREFIX + text,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 8192,
            },
          }),
        }
      )

      if (!response.ok) {
        let error: { error?: { code?: number; message?: string } } | { error: string }
        try {
          error = await response.json()
        } catch {
          error = { error: await response.text() }
        }
        lastError = error
        // 404 오류면 다음 모델 시도
        if (error && typeof error === 'object' && 'error' in error && typeof error.error === 'object' && error.error?.code === 404) {
          continue
        }
        throw new Error(`Gemini API error: ${JSON.stringify(error)}`)
      }

      const data = await response.json()
      const summary = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      if (!summary) throw new Error('Failed to generate summary from Gemini')
      return summary
    } catch (error: unknown) {
      // 404가 아니면 즉시 에러 throw
      if (error instanceof Error && !error.message.includes('404')) {
        throw error
      }
      lastError = error
      continue
    }
  }

  // 모든 모델 실패
  throw new Error(`Gemini API error: 모든 모델 시도 실패. 마지막 오류: ${JSON.stringify(lastError)}`)
}

async function summarizeWithHuggingFace(text: string): Promise<string> {
  const apiKey = process.env.HUGGINGFACE_API_KEY
  if (!apiKey) throw new Error('HUGGINGFACE_API_KEY not configured')

  const model = 'facebook/bart-large-cnn'
  const response = await fetch(
    `https://api-inference.huggingface.co/models/${model}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: MD_USER_PROMPT_PREFIX + text,
        parameters: { max_length: 500, min_length: 100 },
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Hugging Face API error: ${error}`)
  }

  const data = await response.json()
  const raw = Array.isArray(data) ? data[0]?.summary_text : data.summary_text || ''
  if (!raw) throw new Error('Failed to generate summary from Hugging Face')
  return raw
}
