// Daily email digest of overdue follow-ups and due/overdue reminders.
//
// Runs on a schedule (see the pg_cron job set up alongside this function) --
// not triggered by the app itself, since the whole point is to reach the
// clinician even when the app isn't open. Auth is a shared secret header
// (DIGEST_SECRET) rather than a Supabase JWT, since this is called by a
// cron job, not a signed-in browser session; deploy with JWT verification
// disabled and rely on this check instead.
//
// Env vars (Supabase secrets), set via the dashboard:
//   RESEND_API_KEY   - from resend.com
//   DIGEST_SECRET    - any random string you choose; must match the cron job
//   DIGEST_TO_EMAIL  - where to send the digest (e.g. alihessamis@gmail.com)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const DIGEST_SECRET = Deno.env.get('DIGEST_SECRET')!
const DIGEST_TO_EMAIL = Deno.env.get('DIGEST_TO_EMAIL')!

// Mirrors FOLLOW_UP_WINDOW_DAYS in src/lib/procedureChecks.ts -- keep these
// two in sync if that changes.
const FOLLOW_UP_WINDOW_DAYS: Record<string, number> = {
  culture: 2,
  pathology: 2,
}

function daysSince(dateStr: string): number {
  const ms = new Date().setUTCHours(0, 0, 0, 0) - new Date(`${dateStr}T00:00:00Z`).getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

Deno.serve(async (req) => {
  if (req.headers.get('x-digest-secret') !== DIGEST_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const { data: patients, error: patientsError } = await supabase.from('patients').select('id, name')
  if (patientsError) return new Response(patientsError.message, { status: 500 })
  const patientNameById = new Map((patients ?? []).map((p) => [p.id as string, p.name as string]))

  const { data: followUps, error: followUpsError } = await supabase
    .from('follow_up_items')
    .select('*')
    .eq('resolved', false)
  if (followUpsError) return new Response(followUpsError.message, { status: 500 })

  const overdueFollowUps = (followUps ?? []).filter((item) => {
    const windowDays = FOLLOW_UP_WINDOW_DAYS[item.category as string]
    return windowDays != null && daysSince(item.ordered_date as string) >= windowDays
  })

  const today = new Date().toISOString().slice(0, 10)
  const { data: reminders, error: remindersError } = await supabase
    .from('patient_reminders')
    .select('*')
    .eq('done', false)
    .lte('event_date', today)
  if (remindersError) return new Response(remindersError.message, { status: 500 })

  const reminderRows = reminders ?? []

  if (overdueFollowUps.length === 0 && reminderRows.length === 0) {
    return new Response(JSON.stringify({ sent: false, reason: 'nothing due' }), { status: 200 })
  }

  const sections: string[] = []
  if (overdueFollowUps.length > 0) {
    const items = overdueFollowUps
      .map((item) => {
        const name = patientNameById.get(item.patient_id as string) ?? 'Unknown patient'
        const days = daysSince(item.ordered_date as string)
        return `<li><strong>${escapeHtml(name)}</strong> — ${escapeHtml(item.category as string)}: ${escapeHtml(
          item.description as string
        )} (sent ${days}d ago)</li>`
      })
      .join('')
    sections.push(`<h3>Follow-ups needing attention</h3><ul>${items}</ul>`)
  }
  if (reminderRows.length > 0) {
    const items = reminderRows
      .map((r) => {
        const name = patientNameById.get(r.patient_id as string) ?? 'Unknown patient'
        const overdue = (r.event_date as string) < today
        return `<li><strong>${escapeHtml(name)}</strong> — ${escapeHtml(r.title as string)} (${
          overdue ? 'overdue since' : 'due'
        } ${r.event_date})</li>`
      })
      .join('')
    sections.push(`<h3>Reminders due or overdue</h3><ul>${items}</ul>`)
  }

  const html = `<div>${sections.join('')}</div>`

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Nephron <onboarding@resend.dev>',
      to: [DIGEST_TO_EMAIL],
      subject: `Nephron: ${overdueFollowUps.length + reminderRows.length} item(s) need attention`,
      html,
    }),
  })

  if (!emailRes.ok) {
    const text = await emailRes.text()
    return new Response(`Resend error: ${text}`, { status: 500 })
  }

  return new Response(
    JSON.stringify({ sent: true, followUps: overdueFollowUps.length, reminders: reminderRows.length }),
    { status: 200 }
  )
})
