import { describe, expect, it } from 'vitest'
import { parseBulkImportCsv, parseBulkImportJson, validateBulkImportItems } from './libraryBulkImport'

describe('parseBulkImportJson', () => {
  it('parses a bare array', () => {
    const items = parseBulkImportJson(JSON.stringify([{ kind: 'basic', chapter_number: 3, front: 'Q', back: 'A' }]))
    expect(items).toHaveLength(1)
    expect(items[0].kind).toBe('basic')
    expect(items[0].chapterNumber).toBe(3)
  })

  it('parses a { cards: [...] } wrapper', () => {
    const items = parseBulkImportJson(JSON.stringify({ cards: [{ kind: 'cloze', chapter_number: 1, front: 'Q', back: 'A' }] }))
    expect(items).toHaveLength(1)
  })

  it('throws on invalid JSON', () => {
    expect(() => parseBulkImportJson('not json')).toThrow()
  })

  it('throws on an unknown kind', () => {
    expect(() => parseBulkImportJson(JSON.stringify([{ kind: 'nope', chapter_number: 1, front: 'Q' }]))).toThrow()
  })

  it('reads mcq choices and clinical_scenario steps', () => {
    const items = parseBulkImportJson(
      JSON.stringify([
        {
          kind: 'mcq',
          chapter_number: 2,
          front: 'Which?',
          choices: [{ label: 'A', text: 'one', correct: true }, { label: 'B', text: 'two', correct: false }],
        },
        {
          kind: 'clinical_scenario',
          chapter_number: 2,
          front: 'A 4yo presents with...',
          steps: [{ label: 'diagnosis', question: 'What is it?', answer: 'MCD' }],
        },
      ])
    )
    expect(items[0].choices).toHaveLength(2)
    expect(items[1].steps).toHaveLength(1)
  })
})

describe('parseBulkImportCsv', () => {
  it('parses a simple header + row', () => {
    const csv = 'kind,chapter_number,front,back\nbasic,5,"What causes RTA, type 1?",Distal tubule defect'
    const items = parseBulkImportCsv(csv)
    expect(items).toHaveLength(1)
    expect(items[0].front).toBe('What causes RTA, type 1?')
    expect(items[0].chapterNumber).toBe(5)
  })

  it('rejects mcq/scenario kinds', () => {
    const csv = 'kind,chapter_number,front\nmcq,1,Q'
    expect(() => parseBulkImportCsv(csv)).toThrow()
  })

  it('splits tags on semicolons and parses high_yield booleans', () => {
    const csv = 'kind,chapter_number,front,back,tags,high_yield\nbasic,1,Q,A,"foo;bar",true'
    const items = parseBulkImportCsv(csv)
    expect(items[0].tags).toEqual(['foo', 'bar'])
    expect(items[0].highYield).toBe(true)
  })
})

describe('validateBulkImportItems', () => {
  it('flags an mcq with no correct choice', () => {
    const items = parseBulkImportJson(
      JSON.stringify([
        { kind: 'mcq', chapter_number: 1, front: 'Q', choices: [{ label: 'A', text: 'x', correct: false }, { label: 'B', text: 'y', correct: false }] },
      ])
    )
    expect(validateBulkImportItems(items)).toHaveLength(1)
  })

  it('flags a clinical_scenario with no steps', () => {
    const items = parseBulkImportJson(JSON.stringify([{ kind: 'clinical_scenario', chapter_number: 1, front: 'Stem' }]))
    expect(validateBulkImportItems(items)).toHaveLength(1)
  })

  it('passes a well-formed basic card', () => {
    const items = parseBulkImportJson(JSON.stringify([{ kind: 'basic', chapter_number: 1, front: 'Q', back: 'A' }]))
    expect(validateBulkImportItems(items)).toHaveLength(0)
  })
})
