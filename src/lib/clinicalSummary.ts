// Clinical summary ("جمع‌بندی بالینی") shown in a box at the end of a chapter.
// Stored as JSON in library_chapters.clinical_summary and rendered to an HTML
// string (no React) so the exact same markup can be previewed outside the
// app. Every string field accepts a tiny inline syntax:
//   **bold**             -> <b>
//   [[#anchor|text]]     -> a link that jumps to that paragraph of the chapter
// and gets the same Latin-run bidi isolation as the chapter text.
import { tokenizeBidi } from './bidiText'

export type CsTone = 'red' | 'amber' | 'green' | 'blue' | 'purple' | 'teal' | 'pink' | 'gray'

export interface CsItem {
  t: string
  /** red = red flag, key = must-know, tip = practical tip */
  tag?: 'red' | 'key' | 'tip'
  /** anchor id in the chapter text, e.g. "ch8-p1-s9" */
  ref?: string
}

export interface CsStep {
  title: string
  body?: string
  items?: CsItem[]
  tone?: CsTone
  ref?: string
}

/** A plain string, or an item with its own source anchor. */
export type CsText = string | CsItem

export interface CsBranch {
  label: string
  ref?: string
  tone?: CsTone
  /** terminal conclusion/action for this branch */
  then?: string
  next?: CsFlowNode
}

export interface CsFlowNode {
  q: string
  ref?: string
  branches: CsBranch[]
}

export interface CsFlow {
  title: string
  tone?: CsTone
  root: CsFlowNode
}

export interface CsScenario {
  name: string
  tone?: CsTone
  clues: CsText[]
  workup?: CsText[]
  treat?: CsText[]
  ref?: string
}

export interface CsTable {
  title?: string
  cols: string[]
  rows: string[][]
  /** source anchor per row (same order as rows) */
  rowRefs?: Array<string | null>
}

export interface ClinicalSummary {
  v: 1
  title?: string
  bottomLine: string
  /** typical presentations: "بیمار با … آمده" */
  entry?: string[]
  history?: CsItem[]
  exam?: CsItem[]
  redFlags?: CsItem[]
  flows?: CsFlow[]
  diagnosisSteps?: CsStep[]
  scenarios?: CsScenario[]
  compare?: CsTable
  treatment?: CsStep[]
  followUp?: CsItem[]
  pitfalls?: CsItem[]
  numbers?: Array<{ k: string; v: string; ref?: string }>
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function bidi(s: string): string {
  return tokenizeBidi(s)
    .map((t) => (t.isolate ? `<bdi dir="ltr">${esc(t.text)}</bdi>` : esc(t.text)))
    .join('')
}

const INLINE_RE = /\*\*(.+?)\*\*|\[\[#([\w-]+)\|([^\]]+)\]\]/g

export function inlineHtml(s: string): string {
  let out = ''
  let last = 0
  for (const m of s.matchAll(INLINE_RE)) {
    const idx = m.index ?? 0
    out += bidi(s.slice(last, idx))
    if (m[1] !== undefined) out += `<b>${inlineHtml(m[1])}</b>`
    else out += `<a class="cs-ref" data-jump="${esc(m[2])}" role="link" tabindex="0">${bidi(m[3])}</a>`
    last = idx + m[0].length
  }
  return out + bidi(s.slice(last))
}

// Every element with a source gets data-jump: tapping anywhere on it opens
// that paragraph of the chapter (an inner [[#…]] link still wins).
function jumpAttr(ref?: string | null): string {
  return ref ? ` data-jump="${esc(ref)}" role="link" tabindex="0"` : ''
}

function refChip(ref?: string): string {
  return ref ? ` <a class="cs-src" data-jump="${esc(ref)}" role="link" tabindex="0" title="رفتن به متن">📖</a>` : ''
}

const TAG_ICON: Record<NonNullable<CsItem['tag']>, string> = { red: '🚩', key: '⭐', tip: '💡' }

function items(list: CsItem[]): string {
  return `<ul class="cs-list">${list
    .map((it) => {
      const tag = it.tag ? `<span class="cs-tag cs-tag-${it.tag}">${TAG_ICON[it.tag]}</span>` : ''
      const cls = [it.tag ? `cs-li-${it.tag}` : '', it.ref ? 'cs-jump' : ''].filter(Boolean).join(' ')
      return `<li class="${cls}"${jumpAttr(it.ref)}>${tag}<span>${inlineHtml(it.t)}${refChip(it.ref)}</span></li>`
    })
    .join('')}</ul>`
}

function section(cls: CsTone, icon: string, title: string, body: string, open = true): string {
  return `<details class="cs-sec cs-t-${cls}"${open ? ' open' : ''}><summary><span class="cs-ico">${icon}</span><span>${inlineHtml(
    title
  )}</span></summary><div class="cs-body">${body}</div></details>`
}

function steps(list: CsStep[], tone: CsTone): string {
  return `<ol class="cs-steps">${list
    .map(
      (s, i) =>
        `<li class="cs-step cs-t-${s.tone ?? tone}"><span class="cs-num">${(i + 1).toLocaleString('fa-IR')}</span><div class="cs-step-c"><div class="cs-step-t${s.ref ? ' cs-jump' : ''}"${jumpAttr(s.ref)}>${inlineHtml(
          s.title
        )}${refChip(s.ref)}</div>${s.body ? `<div class="cs-step-b${s.ref ? ' cs-jump' : ''}"${jumpAttr(s.ref)}>${inlineHtml(s.body)}</div>` : ''}${
          s.items?.length ? items(s.items.map((it) => ({ ...it, ref: it.ref ?? s.ref }))) : ''
        }</div></li>`
    )
    .join('')}</ol>`
}

function flowNode(n: CsFlowNode, inheritedRef?: string): string {
  const nodeRef = n.ref ?? inheritedRef
  return `<div class="cs-node"><div class="cs-q${nodeRef ? ' cs-jump' : ''}"${jumpAttr(nodeRef)}>❓ ${inlineHtml(n.q)}${refChip(nodeRef)}</div><div class="cs-brs">${n.branches
    .map(
      (b) =>
        ((ref) => `<div class="cs-br cs-t-${b.tone ?? 'gray'}"><div class="cs-br-l"><span class="cs-arrow">◀</span>${inlineHtml(b.label)}</div>${
          b.then ? `<div class="cs-end${ref ? ' cs-jump' : ''}"${jumpAttr(ref)}>⬅ ${inlineHtml(b.then)}${refChip(ref)}</div>` : ''
        }${b.next ? flowNode(b.next, ref) : ''}</div>`)(b.ref ?? nodeRef)
    )
    .join('')}</div></div>`
}

function scenarios(list: CsScenario[]): string {
  const block = (label: string, arr: CsText[] | undefined, fallback?: string) =>
    arr?.length ? `<div class="cs-sc-k">${label}</div>${items(arr.map((x) => (typeof x === 'string' ? { t: x, ref: fallback } : { ...x, ref: x.ref ?? fallback })))}` : ''
  return `<div class="cs-scs">${list
    .map(
      (s) =>
        `<div class="cs-sc cs-t-${s.tone ?? 'blue'}"><div class="cs-sc-n${s.ref ? ' cs-jump' : ''}"${jumpAttr(s.ref)}>${inlineHtml(s.name)}${refChip(s.ref)}</div>${block(
          '🔎 سرنخ‌ها',
          s.clues,
          s.ref
        )}${block('🧪 بررسی', s.workup, s.ref)}${block('💊 برخورد', s.treat, s.ref)}</div>`
    )
    .join('')}</div>`
}

function table(t: CsTable): string {
  return `${t.title ? `<div class="cs-tt">${inlineHtml(t.title)}</div>` : ''}<div class="cs-tscroll"><table class="cs-table"><thead><tr>${t.cols
    .map((c) => `<th>${inlineHtml(c)}</th>`)
    .join('')}</tr></thead><tbody>${t.rows
    .map((r, ri) => {
      const ref = t.rowRefs?.[ri] ?? null
      return `<tr class="${ref ? 'cs-jump' : ''}"${jumpAttr(ref)}>${r
        .map((c, i) => (i === 0 ? `<th>${inlineHtml(c)}${refChip(ref ?? undefined)}</th>` : `<td>${inlineHtml(c)}</td>`))
        .join('')}</tr>`
    })
    .join('')}</tbody></table></div>`
}

export function renderClinicalSummaryHtml(s: ClinicalSummary): string {
  const parts: string[] = []
  parts.push(
    `<header class="cs-head"><div class="cs-badge">🩺 جمع‌بندی بالینی</div>${s.title ? `<div class="cs-title">${inlineHtml(s.title)}</div>` : ''}<p class="cs-bottom">${inlineHtml(
      s.bottomLine
    )}</p>${
      s.entry?.length
        ? `<div class="cs-entry"><span class="cs-entry-l">بیمار با این شکایت می‌آید:</span>${s.entry
            .map((e) => `<span class="cs-chip">${inlineHtml(e)}</span>`)
            .join('')}</div>`
        : ''
    }<div class="cs-hint">👆 روی هر مطلب بزن تا متن اصلی‌اش در کتاب باز شود</div></header>`
  )
  if (s.history?.length) parts.push(section('blue', '🗣️', 'شرح حال — چه بپرسم؟', items(s.history)))
  if (s.exam?.length) parts.push(section('teal', '🩻', 'معاینه — دنبال چه بگردم؟', items(s.exam)))
  if (s.redFlags?.length) parts.push(section('red', '🚩', 'علائم خطر — فوری اقدام کن', items(s.redFlags)))
  if (s.flows?.length)
    parts.push(
      section(
        'purple',
        '🧭',
        'الگوریتم تشخیص',
        s.flows.map((f) => `<div class="cs-flow cs-t-${f.tone ?? 'purple'}"><div class="cs-flow-t">${inlineHtml(f.title)}</div>${flowNode(f.root)}</div>`).join('')
      )
    )
  if (s.diagnosisSteps?.length) parts.push(section('blue', '🔬', 'قدم‌به‌قدم تا تشخیص', steps(s.diagnosisSteps, 'blue')))
  if (s.scenarios?.length) parts.push(section('amber', '🎭', 'سناریوها', scenarios(s.scenarios)))
  if (s.compare) parts.push(section('pink', '⚖️', 'مقایسهٔ تشخیص‌های افتراقی', table(s.compare)))
  if (s.treatment?.length) parts.push(section('green', '💊', 'قدم‌به‌قدم درمان و پیگیری', steps(s.treatment, 'green')))
  if (s.followUp?.length) parts.push(section('teal', '📅', 'پیگیری', items(s.followUp)))
  if (s.pitfalls?.length) parts.push(section('red', '⚠️', 'تله‌های بالینی', items(s.pitfalls), false))
  if (s.numbers?.length)
    parts.push(
      section(
        'gray',
        '🔢',
        'اعداد کلیدی',
        `<div class="cs-nums">${s.numbers
          .map(
            (n) =>
              `<div class="cs-numc${n.ref ? ' cs-jump' : ''}"${jumpAttr(n.ref)}><div class="cs-numk">${inlineHtml(n.k)}${refChip(n.ref)}</div><div class="cs-numv">${inlineHtml(n.v)}</div></div>`
          )
          .join('')}</div>`,
        false
      )
    )
  return `<section class="cs" dir="rtl" id="clinical-summary">${parts.join('')}</section>`
}
