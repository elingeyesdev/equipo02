import { useState, type ReactNode } from 'react'
import { IconCheck, IconCopy } from '@tabler/icons-react'
import { copyToClipboard } from '../onboarding/OnboardingUi'

type MdBlock = { type: 'text'; content: string } | { type: 'code'; content: string; lang?: string }

function splitMarkdownBlocks(text: string): MdBlock[] {
  const blocks: MdBlock[] = []
  let remaining = text

  while (remaining.length > 0) {
    const fence = remaining.indexOf('```')
    if (fence === -1) {
      blocks.push({ type: 'text', content: remaining })
      break
    }
    if (fence > 0) {
      blocks.push({ type: 'text', content: remaining.slice(0, fence) })
    }
    const afterOpen = remaining.slice(fence + 3)
    const langEnd = afterOpen.indexOf('\n')
    const lang = langEnd >= 0 ? afterOpen.slice(0, langEnd).trim() : ''
    const codeStart = langEnd >= 0 ? langEnd + 1 : 0
    const close = afterOpen.indexOf('```', codeStart)
    if (close === -1) {
      blocks.push({ type: 'text', content: remaining.slice(fence) })
      break
    }
    blocks.push({
      type: 'code',
      lang: lang || undefined,
      content: afterOpen.slice(codeStart, close).replace(/\n$/, ''),
    })
    remaining = afterOpen.slice(close + 3)
  }

  return blocks.filter((b) => b.type !== 'text' || b.content.trim().length > 0)
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g
  const nodes: ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  let i = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index))
    }
    const key = `${keyPrefix}-${i++}`
    if (match[2]) {
      nodes.push(<strong key={key}>{match[2]}</strong>)
    } else if (match[3]) {
      nodes.push(<em key={key}>{match[3]}</em>)
    } else if (match[4]) {
      nodes.push(
        <code key={key} className="dev-chat-md-inline-code">
          {match[4]}
        </code>,
      )
    } else if (match[5] && match[6]) {
      nodes.push(
        <a key={key} href={match[6]} target="_blank" rel="noreferrer noopener">
          {match[5]}
        </a>,
      )
    }
    last = match.index + match[0].length
  }

  if (last < text.length) {
    nodes.push(text.slice(last))
  }

  return nodes.length > 0 ? nodes : [text]
}

function MarkdownText({ content }: { content: string }) {
  const paragraphs = content.split(/\n{2,}/)

  return (
    <>
      {paragraphs.map((para, pi) => {
        const lines = para.split('\n').filter((l) => l.trim().length > 0)
        const isList = lines.length > 0 && lines.every((l) => /^[-*]\s+/.test(l.trim()))

        if (isList) {
          return (
            <ul key={pi} className="dev-chat-md-list">
              {lines.map((line, li) => (
                <li key={li}>{renderInline(line.replace(/^[-*]\s+/, ''), `p${pi}-l${li}`)}</li>
              ))}
            </ul>
          )
        }

        return (
          <p key={pi} className="dev-chat-md-p">
            {lines.map((line, li) => (
              <span key={li}>
                {li > 0 ? <br /> : null}
                {renderInline(line, `p${pi}-${li}`)}
              </span>
            ))}
          </p>
        )
      })}
    </>
  )
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false)

  function copiar() {
    copyToClipboard(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="dev-chat-code-block">
      <div className="dev-chat-code-head">
        <span className="dev-chat-code-lang">{lang || 'código'}</span>
        <button type="button" className="dev-chat-code-copy" onClick={copiar} title="Copiar">
          {copied ? <IconCheck size={14} stroke={1.75} aria-hidden /> : <IconCopy size={14} stroke={1.75} aria-hidden />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre className="dev-chat-code-pre">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export function ChatMarkdown({ content }: { content: string }) {
  const blocks = splitMarkdownBlocks(content)

  return (
    <div className="dev-chat-md">
      {blocks.map((block, i) =>
        block.type === 'code' ? (
          <CodeBlock key={i} code={block.content} lang={block.lang} />
        ) : (
          <MarkdownText key={i} content={block.content.trim()} />
        ),
      )}
    </div>
  )
}
