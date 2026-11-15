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

export interface CsBranch {
  label: string
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
  clues: string[]
  workup?: string[]
  treat?: string[]
  ref?: string
}

export interface CsTable {
  title?: string
  cols: string[]
  rows: string[][]
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
  numbers?: Array<{ k: string; v: string }>
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

function refChip(ref?: string): string {
  return ref ? ` <a class="cs-src" data-jump="${esc(ref)}" role="link" tabindex="0" title="رفتن به متن">📖</a>` : ''
}

const TAG_ICON: Record<NonNullable<CsItem['tag']>, string> = { red: '🚩', key: '⭐', tip: '💡' }

function items(list: CsItem[]): string {
  return `<ul class="cs-list">${list
    .map((it) => {
      const tag = it.tag ? `<span class="cs-tag cs-tag-${it.tag}">${TAG_ICON[it.tag]}</span>` : ''
      return `<li class="${it.tag ? `cs-li-${it.tag}` : ''}">${tag}<span>${inlineHtml(it.t)}${refChip(it.ref)}</span></li>`
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
        `<li class="cs-step cs-t-${s.tone ?? tone}"><span class="cs-num">${(i + 1).toLocaleString('fa-IR')}</span><div class="cs-step-c"><div class="cs-step-t">${inlineHtml(
          s.title
        )}${refChip(s.ref)}</div>${s.body ? `<div class="cs-step-b">${inlineHtml(s.body)}</div>` : ''}${
          s.items?.length ? items(s.items) : ''
        }</div></li>`
    )
    .join('')}</ol>`
}

function flowNode(n: CsFlowNode): string {
  return `<div class="cs-node"><div class="cs-q">❓ ${inlineHtml(n.q)}${refChip(n.ref)}</div><div class="cs-brs">${n.branches
    .map(
      (b) =>
        `<div class="cs-br cs-t-${b.tone ?? 'gray'}"><div class="cs-br-l"><span class="cs-arrow">◀</span>${inlineHtml(b.label)}</div>${
          b.then ? `<div class="cs-end">⬅ ${inlineHtml(b.then)}</div>` : ''
        }${b.next ? flowNode(b.next) : ''}</div>`
    )
    .join('')}</div></div>`
}

function scenarios(list: CsScenario[]): string {
  const block = (label: string, arr?: string[]) =>
    arr?.length ? `<div class="cs-sc-k">${label}</div><ul class="cs-list">${arr.map((x) => `<li><span>${inlineHtml(x)}</span></li>`).join('')}</ul>` : ''
  return `<div class="cs-scs">${list
    .map(
      (s) =>
        `<div class="cs-sc cs-t-${s.tone ?? 'blue'}"><div class="cs-sc-n">${inlineHtml(s.name)}${refChip(s.ref)}</div>${block('🔎 سرنخ‌ها', s.clues)}${block(
          '🧪 بررسی',
          s.workup
        )}${block('💊 برخورد', s.treat)}</div>`
    )
    .join('')}</div>`
}

function table(t: CsTable): string {
  return `${t.title ? `<div class="cs-tt">${inlineHtml(t.title)}</div>` : ''}<div class="cs-tscroll"><table class="cs-table"><thead><tr>${t.cols
    .map((c) => `<th>${inlineHtml(c)}</th>`)
    .join('')}</tr></thead><tbody>${t.rows
    .map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th>${inlineHtml(c)}</th>` : `<td>${inlineHtml(c)}</td>`)).join('')}</tr>`)
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
    }</header>`
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
        `<div class="cs-nums">${s.numbers.map((n) => `<div class="cs-numc"><div class="cs-numk">${inlineHtml(n.k)}</div><div class="cs-numv">${inlineHtml(n.v)}</div></div>`).join('')}</div>`,
        false
      )
    )
  return `<section class="cs" dir="rtl" id="clinical-summary">${parts.join('')}</section>`
}
