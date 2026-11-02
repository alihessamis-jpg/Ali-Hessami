// v1.6 (NEPHRON_CHAPTER_FORMAT.md section 10.2): "Import bundle (zip)" --
// imports every note a `manifest.json` lists in one pass instead of one
// chapter at a time. Reuses importChapterNote exactly as the existing
// per-chapter importer does (same book/chapter/part resolution, same
// upsert-by-import_key card rebuild, same figure upload) -- this is just
// the orchestration layer that walks a manifest and builds the report.
//
// Accepts one or more zip files because a real bundle in this app is often
// split across a notes+manifest zip and one or more figures-only zips
// (figures/<name>.jpg, no manifest) that were uploaded separately -- every
// selected zip's images are pooled together before any note is imported.
import JSZip from 'jszip'

type JSZipObject = InstanceType<typeof JSZip>['files'][string]
import { importChapterNote, type ChapterNoteImageInput } from './api/library'
import { collectAnchorIds } from './sourceLinks'
import { parseSections } from './libraryNote'
import { autolinkChapterQuestions } from './api/boardQuestions'

const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp)$/i
const LINK_RE = /\[\[#([\w-]+)/g

interface ManifestEntry {
  file: string
  book_id?: string | null
  chapter?: number
  chapter_part?: number | null
}

export interface BundleFileReport {
  file: string
  chapterNumber: number | null
  chapterPart: number | null
  sections: number
  cards: number
  anchors: number
  links: number
  unresolvedLinks: string[]
  missingFigures: string[]
  autolinked: number
  error: string | null
}

export interface BundleImportReport {
  files: BundleFileReport[]
  totalNotes: number
  totalCards: number
  totalAnchors: number
  totalLinks: number
  totalUnresolved: number
}

function basename(path: string): string {
  return path.split('/').pop() ?? path
}

async function collectImages(entries: JSZipObject[]): Promise<ChapterNoteImageInput[]> {
  const imageEntries = entries.filter((f) => IMAGE_EXT_RE.test(f.name))
  return Promise.all(
    imageEntries.map(async (entry) => {
      const blob = await entry.async('blob')
      const filename = basename(entry.name)
      return { filename, file: new File([blob], filename, { type: blob.type }) }
    })
  )
}

export interface BundleImportProgress {
  done: number
  total: number
  currentFile: string
  phase: 'loading' | 'importing'
}

export async function importNoteBundle(
  zipFiles: File[],
  onProgress?: (progress: BundleImportProgress) => void
): Promise<BundleImportReport> {
  onProgress?.({ done: 0, total: 0, currentFile: '', phase: 'loading' })
  const zips = await Promise.all(zipFiles.map((f) => JSZip.loadAsync(f)))
  const allEntries = zips.flatMap((z) => Object.values(z.files).filter((f) => !f.dir))

  const manifestEntry = allEntries.find((f) => basename(f.name).toLowerCase() === 'manifest.json')
  const mdEntries = allEntries.filter((f) => f.name.toLowerCase().endsWith('.md'))
  const images = await collectImages(allEntries)

  let manifestNotes: ManifestEntry[] | null = null
  if (manifestEntry) {
    try {
      const parsed = JSON.parse(await manifestEntry.async('text')) as { notes?: ManifestEntry[] }
      if (Array.isArray(parsed.notes)) manifestNotes = parsed.notes
    } catch {
      manifestNotes = null
    }
  }

  // With a manifest: import in its order, by basename (a manifest's `file`
  // is a bundle-root-relative path like "notes/x.md", the zip entry may sit
  // under a different top-level folder depending on how it was zipped).
  // Without one: every .md file found, in whatever order the zip(s) give.
  const targets: Array<{ file: string; entry: JSZipObject | undefined }> = manifestNotes
    ? manifestNotes.map((m) => ({ file: m.file, entry: mdEntries.find((e) => basename(e.name) === basename(m.file)) }))
    : mdEntries.map((e) => ({ file: e.name, entry: e }))

  const files: BundleFileReport[] = []
  let doneCount = 0
  for (const target of targets) {
    onProgress?.({ done: doneCount, total: targets.length, currentFile: basename(target.file), phase: 'importing' })
    if (!target.entry) {
      files.push({
        file: target.file,
        chapterNumber: null,
        chapterPart: null,
        sections: 0,
        cards: 0,
        anchors: 0,
        links: 0,
        unresolvedLinks: [],
        missingFigures: [],
        autolinked: 0,
        error: 'فایل در zip(های) انتخاب‌شده پیدا نشد',
      })
      doneCount++
      continue
    }
    try {
      const raw = await target.entry.async('text')
      const anchors = collectAnchorIds(raw)
      const linkIds = [...raw.matchAll(LINK_RE)].map((m) => m[1])
      const unresolvedLinks = [...new Set(linkIds.filter((id) => !anchors.has(id)))]
      const result = await importChapterNote(raw, images)
      // 10.3: re-run auto-linking for this chapter's still-unlinked
      // questions now that its note (and anchors) just changed.
      const autolinked = await autolinkChapterQuestions(result.chapter.id).catch(() => 0)
      files.push({
        file: target.file,
        chapterNumber: result.chapter.chapterNumber,
        chapterPart: result.part?.partNumber ?? null,
        sections: parseSections(result.part ? result.part.note : result.chapter.note).length,
        cards: result.suggestedCardCount,
        anchors: anchors.size,
        links: linkIds.length,
        unresolvedLinks,
        missingFigures: result.missingFigures,
        autolinked,
        error: null,
      })
      doneCount++
    } catch (err) {
      files.push({
        file: target.file,
        chapterNumber: null,
        chapterPart: null,
        sections: 0,
        cards: 0,
        anchors: 0,
        links: 0,
        unresolvedLinks: [],
        missingFigures: [],
        autolinked: 0,
        error: err instanceof Error ? err.message : 'ایمپورت ناموفق بود',
      })
      doneCount++
    }
  }
  onProgress?.({ done: doneCount, total: targets.length, currentFile: '', phase: 'importing' })

  return {
    files,
    totalNotes: files.length,
    totalCards: files.reduce((s, f) => s + f.cards, 0),
    totalAnchors: files.reduce((s, f) => s + f.anchors, 0),
    totalLinks: files.reduce((s, f) => s + f.links, 0),
    totalUnresolved: files.reduce((s, f) => s + f.unresolvedLinks.length, 0),
  }
}
