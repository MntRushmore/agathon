import { NextResponse } from 'next/server'
import { getResend } from '@/lib/resend'

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

    const resend = getResend()
    await resend.emails.send({ from, to, subject, html })

    console.log('[Help request] sent to', to, { email, page })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error in /api/help', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
