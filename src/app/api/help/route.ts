import { NextResponse } from 'next/server'
import { helpLogger } from '@/lib/logger'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const rateLimit = await checkRateLimit(user.id, 'chat')
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000)) } }
      )
    }

    const body = await req.json()
    const { email, message, page } = body ?? {}

    // Compose an email to the support inbox
    const to = 'joel@agathon.app'
    const from = process.env.SUPPORT_FROM_EMAIL || 'support@agathon.app'
    // Escape HTML to prevent injection via user-supplied fields
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const subject = `Agathon help request from ${email || 'unknown'}`
    const html = `
      <div>
        <p><strong>From:</strong> ${esc(String(email || 'unknown'))}</p>
        <p><strong>Page:</strong> ${esc(String(page || 'n/a'))}</p>
        <p><strong>Message:</strong></p>
        <div>${esc(String(message || '')).replace(/\n/g, '<br/>')}</div>
      </div>
    `

    // Only attempt to import/send if the API key is present. Dynamic import
    // avoids bundling the `resend` package into environments that don't
    // support it at build time.
    if (process.env.RESEND_API_KEY) {
      try {
        const { getResend } = await import('@/lib/resend')
        const resend = await getResend()
        await resend.emails.send({ from, to, subject, html })
      } catch (sendErr) {
        helpLogger.error({ err: sendErr }, 'Failed to send help email via Resend')
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    helpLogger.error({ err }, 'Error in /api/help')
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
