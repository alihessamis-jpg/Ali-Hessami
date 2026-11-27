import { describe, expect, it } from 'vitest'
import { plainCardText } from './cardText'
import { isolateLatinRuns } from './bidiText'

describe('plainCardText', () => {
  it('drops a generic source link with its separator', () => {
    expect(plainCardText('📖 فصل 25 — Acute PSGN · [[#ch25-s6-p4|📖 منبع در متن]]')).toBe('📖 فصل 25 — Acute PSGN')
  })
  it('keeps a meaningful link label, removes bare chips, names chapters, unbolds', () => {
    expect(plainCardText('**C3** پایین [[#ch25-s6|۸ هفته]] [[#ch25-s7]] و [[ch26]]')).toBe('C3 پایین ۸ هفته و فصل 26')
  })
})

describe('isolateLatinRuns guillemets', () => {
  it('keeps « » outside the LTR isolate', () => {
    expect(isolateLatinRuns('C3 — «starry sky»')).toBe('⁦C3⁩ — «⁦starry sky⁩»')
  })
})
