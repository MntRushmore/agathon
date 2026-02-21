'use client'

import React from 'react'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle() {
  const [theme, setTheme] = React.useState<'light' | 'dark' | 'system'>(() => {
    try {
      return (localStorage.getItem('agathon_theme') as any) || 'system'
    } catch {
      return 'system'
    }
  })

  React.useEffect(() => {
    const apply = () => {
      const pref = localStorage.getItem('agathon_theme') || 'system'
      const el = document.documentElement
      if (pref === 'dark') el.classList.add('dark')
      else if (pref === 'light') el.classList.remove('dark')
      else {
        const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)')
        if (mq && mq.matches) el.classList.add('dark')
        else el.classList.remove('dark')
      }
      setTheme(pref as any)
    }
    apply()
    const onStorage = () => apply()
    window.addEventListener('storage', onStorage)
    window.addEventListener('agathon-pref-change', onStorage)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('agathon-pref-change', onStorage)
    }
  }, [])

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('agathon_theme', next)
    // Notify other listeners
    try {
      window.dispatchEvent(new Event('agathon-pref-change'))
    } catch {}
    setTheme(next)
  }

  return (
    <button
      aria-label="Toggle theme"
      onClick={toggle}
      data-theme-toggle
      className="fixed bottom-6 right-6 z-[9999] p-2 rounded-md bg-card border border-border shadow-md hover:scale-105 transform transition-transform"
    >
      {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  )
}
