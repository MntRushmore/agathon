import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, message, page } = body ?? {}

    // Compose an email to the support inbox
    const to = 'joel@agathon.app'
    const from = process.env.SUPPORT_FROM_EMAIL || 'support@agathon.app'
    const subject = `Agathon help request from ${email || 'unknown'}`
    const html = `
      <div>
        <p><strong>From:</strong> ${email || 'unknown'}</p>
        <p><strong>Page:</strong> ${page || 'n/a'}</p>
        <p><strong>Message:</strong></p>
        <div>${(message || '').replace(/\n/g, '<br/>')}</div>
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
        console.log('[Help request] sent to', to, { email, page })
      } catch (sendErr) {
        console.error('Failed to send help email via Resend', sendErr)
        console.log('[Help request]', { email, page, message })
      }
    } else {
      console.log('RESEND_API_KEY not configured; logging help request instead.', { email, page, message })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error in /api/help', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
