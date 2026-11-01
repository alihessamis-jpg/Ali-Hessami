import { describe, expect, it } from 'vitest'
import { collectAnchorIds, splitSourceLinks, stripTrailingAnchorText } from './sourceLinks'

describe('splitSourceLinks', () => {
  it('returns a single text segment when there are no links', () => {
    expect(splitSourceLinks('plain text')).toEqual([{ kind: 'text', text: 'plain text' }])
  })

  it('splits a [[#id|text]] source link out as a highlighted-word segment', () => {
    const segments = splitSourceLinks('حدود [[#ch75-s6-6-p3|10]] mL/kg باشد')
    expect(segments).toEqual([
      { kind: 'text', text: 'حدود ' },
      { kind: 'link', text: '10', id: 'ch75-s6-6-p3', chip: false },
      { kind: 'text', text: ' mL/kg باشد' },
    ])
  })

  it('treats a bare [[#id]] as a chip with no custom text', () => {
    const segments = splitSourceLinks('see [[#ch75-s2-2]] for the model')
    expect(segments[1]).toEqual({ kind: 'link', text: 'منبع', id: 'ch75-s2-2', chip: true })
  })

  it('handles multiple links in one string', () => {
    const segments = splitSourceLinks('[[#a|x]] and [[#b|y]]')
    const links = segments.filter((s) => s.kind === 'link')
    expect(links.map((l) => l.id)).toEqual(['a', 'b'])
    expect(links.map((l) => l.text)).toEqual(['x', 'y'])
  })
})

describe('collectAnchorIds', () => {
  it('collects heading, mcq, figure and paragraph-anchor ids from raw note text', () => {
    const note = [
      '## بخش ۱: مقدمه {#ch75-s1}',
      '### ۱-۱. Abstract {#ch75-s1-1}',
      'یک پاراگراف با لنگر در انتها. {#ch75-s1-1-p1}',
      '- یک آیتم فهرست با لنگر {#ch75-s1-1-li1}',
      '### سؤال ۱ {#ch75-q1 .mcq}',
      '![caption](figures/ch75-fig1.jpg){#ch75-fig1-img .figure}',
    ].join('\n')
    const ids = collectAnchorIds(note)
    expect(ids.has('ch75-s1')).toBe(true)
    expect(ids.has('ch75-s1-1')).toBe(true)
    expect(ids.has('ch75-s1-1-p1')).toBe(true)
    expect(ids.has('ch75-s1-1-li1')).toBe(true)
    expect(ids.has('ch75-q1')).toBe(true)
    expect(ids.has('ch75-fig1-img')).toBe(true)
  })
})

describe('stripTrailingAnchorText', () => {
  it('strips a trailing {#id} and returns the id', () => {
    const result = stripTrailingAnchorText('متن پاراگراف اینجا تمام می‌شود. {#ch75-s6-6-p3}')
    expect(result.id).toBe('ch75-s6-6-p3')
    expect(result.text).toBe('متن پاراگراف اینجا تمام می‌شود.')
  })

  it('leaves text without a trailing anchor unchanged', () => {
    const result = stripTrailingAnchorText('متن بدون لنگر')
    expect(result.id).toBeNull()
    expect(result.text).toBe('متن بدون لنگر')
  })

  it('does not strip an {#id} that is not at the very end', () => {
    const result = stripTrailingAnchorText('{#not-trailing} باقی متن اینجا ادامه دارد')
    expect(result.id).toBeNull()
  })
})
