/**
 * LLM API 통합 모듈
 * 여러 LLM 제공자를 지원합니다: Groq, OpenAI, Gemini, Hugging Face
 * 요약은 마크다운으로 출력합니다.
 */

const MD_SYSTEM_PROMPT = `You are a helpful assistant that summarizes study notes in Korean.
반드시 **마크다운(Markdown)** 형식으로 작성하세요.
- 큰 섹션 제목은 \`## 1. 소제목\`, \`## 2. 소제목\` 처럼 번호 + 소제목 형태로, **눈에 잘 띄게 크게** 작성하세요.
- **각 번호 섹션(## 1., ## 2., ## 3. ...) 사이에는 반드시 수평선(Horizontal Rule) \`---\` 를 넣어 구분해주세요.** 섹션과 섹션 사이를 확실히 나누는 것이 중요합니다.
- 일반 소제목은 \`###\` 를 사용해 구조를 분명하게 나누세요.
- **굵은 글씨**, 리스트(- ), 인용(>) 등을 적절히 사용해
- 가독성 있게 핵심 개념·요점·주요 주제를 정리해주세요.

## 매우 중요한 지시사항
- **반드시 제공된 전체 내용을 처음부터 끝까지 모두 읽고 정리하세요.** 중간에 멈추거나 일부만 읽지 마세요.
- **원문의 마지막 문장·마지막 단락까지 반드시 요약에 포함하세요.** 원문 끝까지 다룬 뒤 요약을 마무리하세요. 출력을 중간에서 끊지 마세요.
- 원문의 모든 중요한 부분을 빠짐없이 포함하세요. 요약이 길어져도 괜찮으니, 끝까지 다 쓰세요.

## 가독성 규칙 (중요)
- 색깔이나 크기 통일: 마크다운 헤딩 레벨과 스타일을 일관되게 사용하세요 (같은 레벨의 제목은 같은 크기, 같은 스타일)
- 불필요한 반복/중복 제거: 같은 내용을 여러 번 반복하지 마세요
- 원문에 없는 사실을 만들지 말기: 원문에 명시되지 않은 내용은 추측하거나 추가하지 마세요

출력은 마크다운만 반환하고 다른 설명은 붙이지 마세요.`

const MD_USER_PROMPT_PREFIX = '다음 수업/자료 내용을 **처음부터 끝까지 전부** 읽고, **원문 마지막 부분까지** 빠짐없이 마크다운으로 요약해주세요. 중간에서 끊지 말고 끝까지 작성하세요.\n\n'

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
  let lastError: any = null
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
        let error: any
        try {
          error = await response.json()
        } catch {
          error = { error: await response.text() }
        }
        lastError = error
        // 404 오류면 다음 모델 시도
        if (error?.error?.code === 404) {
          continue
        }
        throw new Error(`Gemini API error: ${JSON.stringify(error)}`)
      }

      const data = await response.json()
      const summary = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      if (!summary) throw new Error('Failed to generate summary from Gemini')
      return summary
    } catch (error: any) {
      // 404가 아니면 즉시 에러 throw
      if (error.message && !error.message.includes('404')) {
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
