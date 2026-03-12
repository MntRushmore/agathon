'use client';

import articles from '../../../../content/help/articles.json'
import { notFound } from 'next/navigation'
import { useParams } from 'next/navigation'
import DOMPurify from 'dompurify'

export default function ArticlePage() {
  const { id } = useParams<{ id: string }>()
  const article = articles.find((a) => a.id === id)
  if (!article) return notFound()

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-4">{article.title}</h1>
      <div className="prose" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.content.replace(/\n/g, '<br/>')) }} />
    </div>
  )
}
