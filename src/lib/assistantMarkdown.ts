// Minimal markdown -> HTML for assistant answers (ported from the
// assistant prototype). Input is HTML-escaped first, so the only markup in
// the output is what this function emits. [S3] / [S2, S7] become
// <button class="cite" data-s="S3">3</button> chips.

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

function inline(s: string, known: (id: string) => boolean): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[(S\d+(?:\s*[,،]\s*S\d+)*)\]/g, (_m, g: string) =>
      g
        .split(/[,،]/)
        .map((x) => x.trim())
        .map((id) =>
          known(id)
            ? `<button type="button" class="cite" data-s="${id}" aria-label="منبع ${id.slice(1)}">${id.slice(1)}</button>`
            : `<span class="cite pending">${id.slice(1)}</span>`,
        )
        .join(''),
    )
}

export function renderAnswer(src: string, known: (id: string) => boolean = () => true): string {
  const L = esc(src).split('\n')
  let h = ''
  let list: 'ul' | 'ol' | null = null
  let i = 0
  const close = () => {
    if (list) {
      h += `</${list}>`
      list = null
    }
  }
  while (i < L.length) {
    const l = L[i]
    if (/^```/.test(l)) {
      close()
      const b: string[] = []
      i++
      while (i < L.length && !/^```/.test(L[i])) b.push(L[i++])
      i++
      h += `<pre>${b.join('\n')}</pre>`
      continue
    }
    if (/^\s*\|.*\|\s*$/.test(l)) {
      close()
      let rows: string[] = []
      while (i < L.length && /^\s*\|.*\|\s*$/.test(L[i])) rows.push(L[i++])
      rows = rows.filter((r) => !/^\s*\|[\s:|-]+\|\s*$/.test(r))
      h +=
        '<div class="as-table"><table>' +
        rows
          .map(
            (r, ri) =>
              '<tr>' +
              r
                .trim()
                .slice(1, -1)
                .split('|')
                .map((c) => (ri ? `<td>${inline(c.trim(), known)}</td>` : `<th>${inline(c.trim(), known)}</th>`))
                .join('') +
              '</tr>',
          )
          .join('') +
        '</table></div>'
      continue
    }
    let m: RegExpMatchArray | null
    if ((m = l.match(/^#{1,4}\s+(.*)/))) {
      close()
      h += `<h3>${inline(m[1], known)}</h3>`
    } else if ((m = l.match(/^\s*[-•*]\s+(.*)/))) {
      if (list !== 'ul') {
        close()
        h += '<ul>'
        list = 'ul'
      }
      h += `<li>${inline(m[1], known)}</li>`
    } else if ((m = l.match(/^\s*[\d۰-۹]+[.)]\s+(.*)/))) {
      if (list !== 'ol') {
        close()
        h += '<ol>'
        list = 'ol'
      }
      h += `<li>${inline(m[1], known)}</li>`
    } else if (/^&gt;\s?/.test(l)) {
      close()
      h += `<blockquote>${inline(l.replace(/^&gt;\s?/, ''), known)}</blockquote>`
    } else if (l.trim() === '') {
      close()
    } else {
      close()
      h += `<p>${inline(l, known)}</p>`
    }
    i++
  }
  close()
  return h
}

/** Source passage text for display: drop {#anchors}, figure lines and markdown emphasis. */
export function cleanPassage(t: string): string {
  return t
    .replace(/\{#[\w-]+[^}]*\}/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/^>\s*\[![a-z]+\]\s*$/gim, '')
    .replace(/^>\s?/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
