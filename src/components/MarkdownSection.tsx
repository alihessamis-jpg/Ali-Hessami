import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { protectNumberRanges } from '../lib/bidiText'

interface Props {
  text: string
}

// Renders a topic section's markdown — GFM tables, headings, lists, bold —
// with blockquotes (used for a chapter's "جمع‌بندی" summary callouts)
// styled as a distinct highlighted box, all inside an RTL container.
export function MarkdownSection({ text }: Props) {
  return (
    <div className="academy-markdown" dir="rtl">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{protectNumberRanges(text)}</ReactMarkdown>
    </div>
  )
}
