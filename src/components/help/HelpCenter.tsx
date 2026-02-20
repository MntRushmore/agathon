'use client'
import React, { useState } from 'react'
import HelpArticleCard from './HelpArticleCard'

type Article = {
  id: string
  title: string
  excerpt: string
  tags?: string[]
}

export default function HelpCenter({ initialArticles }: { initialArticles: Article[] }) {
  const [q, setQ] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const filtered = initialArticles.filter((a) => {
    const text = (a.title + ' ' + a.excerpt + ' ' + (a.tags || []).join(' ')).toLowerCase()
    return text.includes(q.toLowerCase())
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    try {
      const res = await fetch('/api/help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, message }),
      })
      if (res.ok) setStatus('sent')
      else setStatus('error')
    } catch (err) {
      setStatus('error')
    }
  }

  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Help Center</h1>
        <p className="text-muted-foreground">Search docs, read guides, or contact support.</p>
      </header>

      <div className="mb-6">
        <input
          aria-label="Search help"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search articles, e.g. 'billing', 'math editor'"
          className="w-full border rounded px-3 py-2"
        />
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {filtered.map((a) => (
          <HelpArticleCard key={a.id} id={a.id} title={a.title} excerpt={a.excerpt} tags={a.tags} />
        ))}
      </section>

      <aside className="border rounded p-4">
        <h2 className="text-xl font-semibold mb-2">Contact support</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <input
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <textarea
            placeholder="Describe the issue or question"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="border rounded px-3 py-2 h-28"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={status === 'sending' || !message}
              className="px-4 py-2 bg-primary text-white rounded disabled:opacity-60"
            >
              Send
            </button>
            {status === 'sending' && <span>Sending…</span>}
            {status === 'sent' && <span className="text-green-600">Sent — we'll reply soon.</span>}
            {status === 'error' && <span className="text-red-600">Error sending message.</span>}
          </div>
        </form>
      </aside>
    </div>
  )
}
