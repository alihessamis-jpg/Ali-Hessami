import { useEffect, useState } from 'react'

interface Offender {
  tag: string
  cls: string
  text: string
  left: number
  right: number
  width: number
}

interface Scan {
  scrollWidth: number
  innerWidth: number
  scale: number | null
  offenders: Offender[]
}

const OUTLINE = '3px solid #ff0040'

function scan(): { result: Scan; elements: HTMLElement[] } {
  const vw = window.innerWidth
  const offenders: Offender[] = []
  const elements: HTMLElement[] = []
  document.querySelectorAll<HTMLElement>('body *').forEach((el) => {
    if (el.closest('#overflow-debug-panel')) return
    const r = el.getBoundingClientRect()
    if (r.right > vw + 1 || r.left < -1) {
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: typeof el.className === 'string' ? el.className.slice(0, 60) : '',
        text: (el.textContent ?? '').trim().slice(0, 40),
        left: Math.round(r.left),
        right: Math.round(r.right),
        width: Math.round(r.width),
      })
      elements.push(el)
    }
  })
  offenders.sort((a, b) => b.right - a.right)
  return {
    result: {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: vw,
      scale: window.visualViewport ? window.visualViewport.scale : null,
      offenders,
    },
    elements,
  }
}

export function OverflowDebugPanel() {
  const [data, setData] = useState<Scan | null>(null)
  const enabled = new URLSearchParams(window.location.search).get('debug') === 'overflow'

  useEffect(() => {
    if (!enabled) return
    const outlined: HTMLElement[] = []

    function run() {
      for (const el of outlined) el.style.outline = ''
      outlined.length = 0
      const { result, elements } = scan()
      for (const el of elements) {
        el.style.outline = OUTLINE
        el.style.outlineOffset = '-2px'
        outlined.push(el)
      }
      setData(result)
    }

    run()
    const interval = setInterval(run, 1000)
    window.addEventListener('resize', run)
    window.addEventListener('orientationchange', run)
    return () => {
      clearInterval(interval)
      window.removeEventListener('resize', run)
      window.removeEventListener('orientationchange', run)
      for (const el of outlined) el.style.outline = ''
    }
  }, [enabled])

  if (!enabled || !data) return null

  return (
    <div
      id="overflow-debug-panel"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2147483647,
        background: '#b30018',
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: 11,
        lineHeight: 1.5,
        padding: '8px 10px',
        maxHeight: '45vh',
        overflowY: 'auto',
        direction: 'ltr',
        textAlign: 'left',
        boxShadow: '0 2px 10px rgba(0,0,0,.5)',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>
        OVERFLOW DEBUG — scrollWidth={data.scrollWidth} innerWidth={data.innerWidth} visualViewport.scale=
        {data.scale ?? 'n/a'} {data.scrollWidth > data.innerWidth ? '⚠ PAGE WIDER THAN VIEWPORT' : '✓ OK'}
      </div>
      {data.offenders.length === 0 ? (
        <div>No offending elements found.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', opacity: 0.8 }}>
              <th>tag</th>
              <th>class</th>
              <th>text</th>
              <th>left</th>
              <th>right</th>
              <th>width</th>
            </tr>
          </thead>
          <tbody>
            {data.offenders.map((o, i) => (
              <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,.25)' }}>
                <td>{o.tag}</td>
                <td>{o.cls}</td>
                <td>{o.text}</td>
                <td>{o.left}</td>
                <td>{o.right}</td>
                <td>{o.width}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
