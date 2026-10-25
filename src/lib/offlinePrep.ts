// "Download everything for offline": walks the whole app once, in a hidden
// frame, so every page's data is saved on this device by offlineFetch.ts and
// every image / PDF it links to is saved by the service worker.
//
// It drives the real pages instead of re-implementing their queries, so the
// saved copies are exactly what each page asks for when it's opened offline.
import { listPatients } from './api/patients'
import { listAcademyTopics } from './api/academy'
import { listAllLibraryChapters } from './api/library'
import { listResearchProjects } from './api/research'

const STATIC_ROUTES = [
  '/',
  '/today',
  '/patients',
  '/case-log',
  '/academic-activity',
  '/reference',
  '/calculators',
  '/checklists',
  '/academy',
  '/academy/topics',
  '/academy/review',
  '/academy/practice',
  '/academy/mistakes',
  '/academy/stats',
  '/academy/exam-plan',
  '/high-yield',
  '/board-readiness',
  '/research',
  '/thesis-form',
  '/cv',
  '/settings',
]

const STUDY_HUB_TABS = [
  'notes',
  'flashcards',
  'reasoning',
  'labChallenges',
  'imagingChallenges',
  'boardQuestions',
  'consults',
  'gaps',
  'cases',
  'reading',
]

// A path no route matches -- visiting it between pages unmounts the previous
// page so the next one always mounts fresh and loads its own data.
const BLANK_ROUTE = '/__offline-prep-blank'

const LAST_SYNC_KEY = 'nephron.offline.lastSync'

export interface OfflinePrepProgress {
  done: number
  total: number
  current: string
  files: number
}

export interface OfflinePrepResult {
  pages: number
  files: number
  failedFiles: number
  finishedAt: number
}

export function getLastOfflineSync(): OfflinePrepResult | null {
  try {
    const raw = localStorage.getItem(LAST_SYNC_KEY)
    return raw ? (JSON.parse(raw) as OfflinePrepResult) : null
  } catch {
    return null
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function loadFrame(src: string): Promise<HTMLIFrameElement> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.tabIndex = -1
    Object.assign(frame.style, {
      position: 'fixed',
      left: '-10000px',
      top: '0',
      width: '1024px',
      height: '768px',
      border: '0',
      opacity: '0',
      pointerEvents: 'none',
    })
    const timer = setTimeout(() => reject(new Error('The app did not load in the background frame.')), 60000)
    frame.onload = () => {
      clearTimeout(timer)
      resolve(frame)
    }
    frame.src = src
    document.body.appendChild(frame)
  })
}

function navigateFrame(frame: HTMLIFrameElement, path: string) {
  const win = frame.contentWindow
  if (!win) return
  win.history.pushState({}, '', path)
  win.dispatchEvent(new PopStateEvent('popstate', { state: {} }))
}

// Waits until the frame's Supabase traffic has been quiet for a moment.
async function waitForIdle(frame: HTMLIFrameElement, signal: AbortSignal, maxMs = 30000) {
  const start = Date.now()
  await wait(300)
  while (Date.now() - start < maxMs) {
    if (signal.aborted) return
    const net = frame.contentWindow?.__nephronNet
    const quietFor = net ? Date.now() - net.lastActivity : Date.now() - start
    if ((!net || net.inflight === 0) && quietFor > 900) return
    await wait(200)
  }
}

function stripToken(href: string): string {
  try {
    const u = new URL(href)
    u.searchParams.delete('token')
    return u.href
  } catch {
    return href
  }
}

// Every stored file the page links to or shows (imaging, PDFs, figures):
// fetching it once lets the service worker keep a copy for offline viewing.
function collectFileUrls(frame: HTMLIFrameElement): string[] {
  const doc = frame.contentDocument
  if (!doc) return []
  const urls: string[] = []
  doc.querySelectorAll<HTMLAnchorElement>('a[href*="/storage/v1/object/"]').forEach((a) => urls.push(a.href))
  doc.querySelectorAll<HTMLImageElement>('img[src*="/storage/v1/object/"]').forEach((img) => urls.push(img.src))
  doc
    .querySelectorAll<HTMLSourceElement>('source[src*="/storage/v1/object/"], audio[src*="/storage/v1/object/"], video[src*="/storage/v1/object/"]')
    .forEach((el) => urls.push(el.src))
  return urls
}

export async function prepareOffline(
  onProgress: (p: OfflinePrepProgress) => void,
  signal: AbortSignal
): Promise<OfflinePrepResult> {
  if (!navigator.onLine) throw new Error('Connect to the internet first — this downloads your data for later offline use.')

  // Ask the browser not to evict the offline copy when space runs low.
  try {
    await navigator.storage?.persist?.()
  } catch {
    // ignore
  }

  const [patients, topics, chapters, projects] = await Promise.all([
    listPatients(),
    listAcademyTopics().catch(() => []),
    listAllLibraryChapters().catch(() => []),
    listResearchProjects().catch(() => []),
  ])

  const targets: { path: string; label: string }[] = [
    ...STATIC_ROUTES.map((path) => ({ path, label: path === '/' ? 'Dashboard' : path.slice(1) })),
    ...STUDY_HUB_TABS.map((tab) => ({ path: `/study?tab=${tab}`, label: `Study hub · ${tab}` })),
    ...patients.map((p) => ({ path: `/patients/${p.id}?offlinePrep=1`, label: `Patient · ${p.name}` })),
    ...topics.map((t) => ({ path: `/academy/${t.id}`, label: `Academy · ${t.name}` })),
    ...chapters.map((c) => ({ path: `/academy/reader/${c.id}`, label: `Library · ${c.title}` })),
    ...projects.map((r) => ({ path: `/research/${r.id}`, label: `Research · ${r.name}` })),
  ]

  const seenFiles = new Set<string>()
  let files = 0
  let failedFiles = 0
  let done = 0
  onProgress({ done, total: targets.length, current: 'Starting…', files })

  const frame = await loadFrame(BLANK_ROUTE)
  try {
    await waitForIdle(frame, signal)
    for (const target of targets) {
      if (signal.aborted) break
      onProgress({ done, total: targets.length, current: target.label, files })
      navigateFrame(frame, BLANK_ROUTE)
      await wait(50)
      navigateFrame(frame, target.path)
      await waitForIdle(frame, signal)

      const pending = collectFileUrls(frame).filter((url) => {
        const key = stripToken(url)
        if (seenFiles.has(key)) return false
        seenFiles.add(key)
        return true
      })
      for (const url of pending) {
        if (signal.aborted) break
        try {
          const res = await fetch(url, { mode: 'cors', credentials: 'omit' })
          if (res.ok) {
            await res.arrayBuffer()
            files++
          } else {
            failedFiles++
          }
        } catch {
          failedFiles++
        }
        onProgress({ done, total: targets.length, current: target.label, files })
      }
      done++
    }
  } finally {
    frame.remove()
  }

  const result: OfflinePrepResult = { pages: done, files, failedFiles, finishedAt: Date.now() }
  if (!signal.aborted) {
    try {
      localStorage.setItem(LAST_SYNC_KEY, JSON.stringify(result))
    } catch {
      // ignore
    }
  }
  onProgress({ done, total: targets.length, current: signal.aborted ? 'Stopped' : 'Done', files })
  return result
}
