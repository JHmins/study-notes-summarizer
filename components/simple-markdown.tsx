'use client'

/** 마크다운을 간단히 렌더링 (추가 패키지 없음) */
export default function SimpleMarkdown({ children }: { children: string }) {
  const lines = children.split(/\n/)
  const out: React.ReactNode[] = []
  let key = 0
  let listItems: string[] = []
  const flushList = () => {
    if (listItems.length) {
      out.push(
        <ul key={key++} className="list-disc pl-6 my-2 [&_li]:my-1">
          {listItems.map((item, j) => (
            <li key={j}>{inlineMarkdown(item)}</li>
          ))}
        </ul>
      )
      listItems = []
    }
  }
  const inlineMarkdown = (s: string) => {
    const parts: React.ReactNode[] = []
    let rest = s
    while (rest.length) {
      const bold = rest.match(/^\*\*(.+?)\*\*/)
      const link = rest.match(/^\[([^\]]+)\]\(([^)]+)\)/)
      if (bold) {
        parts.push(<strong key={parts.length}>{bold[1]}</strong>)
        rest = rest.slice(bold[0].length)
      } else if (link) {
        parts.push(
          <a key={parts.length} href={link[2]} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] underline break-all">
            {link[1]}
          </a>
        )
        rest = rest.slice(link[0].length)
      } else {
        const next = rest.search(/\*\*|\[/)
        if (next === -1) {
          parts.push(rest)
          rest = ''
        } else if (next === 0) {
          parts.push(rest[0])
          rest = rest.slice(1)
        } else {
          parts.push(rest.slice(0, next))
          rest = rest.slice(next)
        }
      }
    }
    return <>{parts}</>
  }
  for (let j = 0; j < lines.length; j++) {
    const line = lines[j]
    if (/^##\s/.test(line)) {
      flushList()
      out.push(<h2 key={key++} className="mt-6 mb-3 text-lg font-semibold first:mt-0">{inlineMarkdown(line.replace(/^##\s*/, ''))}</h2>)
    } else if (/^###\s/.test(line)) {
      flushList()
      out.push(<h3 key={key++} className="mt-4 mb-2 text-base font-medium">{inlineMarkdown(line.replace(/^###\s*/, ''))}</h3>)
    } else if (/^-\s/.test(line)) {
      listItems.push(line.replace(/^-\s*/, ''))
    } else if (/^\d+\.\s/.test(line)) {
      flushList()
      const m = line.match(/^\d+\.\s(.+)/)
      if (m) out.push(<p key={key++} className="my-2 pl-6 list-decimal">{inlineMarkdown(m[1])}</p>)
    } else if (/^>\s/.test(line)) {
      flushList()
      out.push(<blockquote key={key++} className="border-l-4 border-[var(--border)] pl-4 my-2 text-[var(--foreground-muted)]">{inlineMarkdown(line.replace(/^>\s*/, ''))}</blockquote>)
    } else if (/^---+$/.test(line)) {
      flushList()
      out.push(<hr key={key++} className="my-4 border-0 border-t border-[var(--border)]" />)
    } else if (line.trim()) {
      flushList()
      out.push(<p key={key++} className="my-2">{inlineMarkdown(line)}</p>)
    } else {
      flushList()
    }
  }
  flushList()
  return <div className="summary-markdown">{out}</div>
}
