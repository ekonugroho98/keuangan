import React from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

export type AiMessageProps = {
  text: string
  variant: 'floating' | 'page'
}

const NUMERIC_CELL_RE = /^[Rp\s\d.,%+-]+$/
const UNSAFE_HREF_RE = /^\s*(javascript|data|vbscript):/i

/** Ekstrak teks polos dari ReactNode untuk deteksi kolom angka dan baris TOTAL. */
function extractPlainText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractPlainText).join('')
  if (React.isValidElement(node)) {
    return extractPlainText((node.props as { children?: React.ReactNode }).children)
  }
  return ''
}

function isNumericValue(node: React.ReactNode): boolean {
  const txt = extractPlainText(node).trim()
  return txt.length > 0 && NUMERIC_CELL_RE.test(txt) && /\d/.test(txt)
}

/** Plugin HAST ringan untuk menandai elemen blok terakhir agar paragraf terakhir tanpa margin bawah. */
function rehypeMarkLastElement() {
  return (tree: { children?: Array<{ type?: string; properties?: Record<string, unknown> }> }) => {
    if (!tree?.children) return
    const elements = tree.children.filter((c) => c.type === 'element')
    if (elements.length > 0) {
      const last = elements[elements.length - 1]!
      last.properties = { ...(last.properties ?? {}), 'data-last': 'true' }
    }
  }
}

/** Ekstrak baris header dan baris data dari children <table> react-markdown. */
function parseTableChildren(children: React.ReactNode): {
  headers: React.ReactNode[]
  rows: React.ReactNode[][]
} {
  const headers: React.ReactNode[] = []
  const rows: React.ReactNode[][] = []

  const extractCells = (trChildren: React.ReactNode): React.ReactNode[] => {
    const cells: React.ReactNode[] = []
    React.Children.forEach(trChildren, (cell) => {
      if (React.isValidElement(cell) && (cell.type === 'th' || cell.type === 'td')) {
        cells.push((cell.props as { children?: React.ReactNode }).children)
      }
    })
    return cells
  }

  React.Children.forEach(children, (section) => {
    if (!React.isValidElement(section)) return
    const secChildren = (section.props as { children?: React.ReactNode }).children
    if (section.type === 'thead') {
      React.Children.forEach(secChildren, (tr) => {
        if (React.isValidElement(tr) && tr.type === 'tr' && headers.length === 0) {
          headers.push(...extractCells((tr.props as { children?: React.ReactNode }).children))
        }
      })
    } else if (section.type === 'tbody') {
      React.Children.forEach(secChildren, (tr) => {
        if (React.isValidElement(tr) && tr.type === 'tr') {
          rows.push(extractCells((tr.props as { children?: React.ReactNode }).children))
        }
      })
    }
  })

  return { headers, rows }
}

function AiTable({ children, variant }: { children?: React.ReactNode; variant: 'floating' | 'page' }) {
  const { headers, rows } = parseTableChildren(children)
  const colCount = headers.length || (rows[0]?.length ?? 0)
  const maxTableCols = variant === 'page' ? 3 : 2

  if (colCount === 0) return null

  // Tabel > batas kolom diubah menjadi daftar kartu vertikal agar tidak perlu scroll horizontal di HP/widget
  if (colCount > maxTableCols) {
    return (
      <div
        data-testid="ai-table-cards"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          marginTop: 6,
          marginBottom: 6,
        }}
      >
        {rows.map((row, rowIdx) => {
          const firstCell = row[0]
          const firstText = extractPlainText(firstCell).trim()
          const isTotal = /^total\b/i.test(firstText)
          return (
            <div
              key={rowIdx}
              data-testid="ai-table-card"
              style={{
                background: isTotal ? 'var(--color-primary-soft)' : 'var(--bg-surface-low)',
                border: isTotal ? '1px solid var(--color-primary)' : '1px solid var(--color-border-soft)',
                borderRadius: 10,
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: variant === 'page' ? 13 : 12,
                  color: 'var(--color-text)',
                }}
              >
                {firstCell}
              </div>
              {row.slice(1).map((cell, idx) => {
                const colIdx = idx + 1
                const headerLabel = headers[colIdx]
                return (
                  <div
                    key={colIdx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: 8,
                      fontSize: variant === 'page' ? 12 : 11.5,
                      lineHeight: 1.4,
                    }}
                  >
                    <span style={{ color: 'var(--color-muted)' }}>{headerLabel} :</span>
                    <span
                      style={{
                        color: 'var(--color-text)',
                        fontWeight: isTotal ? 700 : 500,
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {cell}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    )
  }

  // Deteksi kolom angka/rupiah untuk perataan kanan pada kolom selain kolom pertama
  const numericCols = Array.from({ length: colCount }, (_, colIdx) => {
    if (colIdx === 0) return false
    return rows.length > 0 && rows.every((r) => !extractPlainText(r[colIdx]).trim() || isNumericValue(r[colIdx]))
  })

  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        marginTop: 6,
        marginBottom: 6,
      }}
    >
      {headers.length > 0 && (
        <thead>
          <tr>
            {headers.map((header, colIdx) => (
              <th
                key={colIdx}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '.04em',
                  color: 'var(--color-muted)',
                  textAlign: numericCols[colIdx] ? 'right' : 'left',
                  padding: '6px 8px',
                  borderBottom: '1px solid var(--color-border-soft)',
                }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map((row, rowIdx) => (
          <tr key={rowIdx}>
            {row.map((cell, colIdx) => {
              const alignRight = colIdx > 0 && (numericCols[colIdx] || isNumericValue(cell))
              return (
                <td
                  key={colIdx}
                  style={{
                    fontSize: variant === 'page' ? 13 : 12,
                    padding: '6px 8px',
                    borderBottom: '1px solid var(--color-border-soft)',
                    textAlign: alignRight ? 'right' : 'left',
                    fontVariantNumeric: alignRight ? 'tabular-nums' : undefined,
                    verticalAlign: 'top',
                  }}
                >
                  {cell}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function AiMessage({ text, variant }: AiMessageProps) {
  const fontSize = variant === 'page' ? 14 : 13
  const headingSize = variant === 'page' ? 12 : 11

  const renderHeading = ({ children }: { children?: React.ReactNode }) => (
    <div
      role="heading"
      aria-level={3}
      style={{
        fontSize: headingSize,
        fontWeight: 700,
        letterSpacing: '.04em',
        textTransform: 'uppercase',
        color: 'var(--color-primary)',
        marginTop: 10,
        marginBottom: 4,
      }}
    >
      {children}
    </div>
  )

  const components: Components = {
    h1: renderHeading,
    h2: renderHeading,
    h3: renderHeading,
    p: ({ children, ...rest }) => {
      const isLast = (rest as Record<string, unknown>)['data-last'] === 'true'
      return (
        <p
          style={{
            fontSize,
            lineHeight: 1.6,
            marginTop: 0,
            marginBottom: isLast ? 0 : 6,
          }}
        >
          {children}
        </p>
      )
    },
    ul: ({ children }) => (
      <ul
        style={{
          paddingLeft: 18,
          marginTop: 0,
          marginBottom: 6,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol
        style={{
          paddingLeft: 18,
          marginTop: 0,
          marginBottom: 6,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li
        style={{
          fontSize,
          lineHeight: 1.6,
        }}
      >
        {children}
      </li>
    ),
    strong: ({ children }) => (
      <strong style={{ fontWeight: 700, color: 'var(--color-text)' }}>{children}</strong>
    ),
    code: ({ children }) => (
      <code
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          background: 'var(--bg-surface-low)',
          borderRadius: 4,
          padding: '1px 4px',
          fontSize: 12,
        }}
      >
        {children}
      </code>
    ),
    pre: ({ children }) => (
      <pre
        style={{
          background: 'var(--bg-surface-low)',
          overflowX: 'auto',
          fontSize: 12,
          padding: '8px 10px',
          borderRadius: 8,
          marginTop: 4,
          marginBottom: 6,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        }}
      >
        {children}
      </pre>
    ),
    a: ({ href, children }) => {
      if (!href || UNSAFE_HREF_RE.test(href)) {
        return <span>{children}</span>
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}
        >
          {children}
        </a>
      )
    },
    hr: () => null,
    img: () => null,
    blockquote: ({ children }) => (
      <blockquote
        style={{
          borderLeft: '3px solid var(--color-border-strong)',
          color: 'var(--color-muted)',
          paddingLeft: 10,
          margin: '4px 0 6px 0',
        }}
      >
        {children}
      </blockquote>
    ),
    table: ({ children }) => <AiTable variant={variant}>{children}</AiTable>,
  }

  return (
    <div style={{ fontSize, lineHeight: 1.6, wordBreak: 'break-word' }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeMarkLastElement]}
        components={components}
        urlTransform={(url) => (UNSAFE_HREF_RE.test(url) ? '' : url)}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}

export default AiMessage
