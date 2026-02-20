import articles from '../../../../content/help/articles.json'
import { notFound } from 'next/navigation'

type Params = { params: { id: string } }

export async function generateStaticParams() {
  return articles.map((a) => ({ id: a.id }))
}

export default function ArticlePage({ params }: Params) {
  const { id } = params
  const article = articles.find((a) => a.id === id)
  if (!article) return notFound()

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-4">{article.title}</h1>
      <div className="prose" dangerouslySetInnerHTML={{ __html: article.content.replace(/\n/g, '<br/>') }} />
    </div>
  )
}
