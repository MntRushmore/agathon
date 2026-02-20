import Link from 'next/link'

type Props = {
  id: string
  title: string
  excerpt: string
  tags?: string[]
}

export default function HelpArticleCard({ id, title, excerpt, tags = [] }: Props) {
  return (
    <article className="rounded border p-4 hover:shadow-lg transition-shadow">
      <h3 className="text-lg font-semibold mb-1">
        <Link href={`/help/article/${id}`}>{title}</Link>
      </h3>
      <p className="text-sm text-muted-foreground mb-2">{excerpt}</p>
      <div className="flex gap-2 text-xs">
        {tags.map((t) => (
          <span key={t} className="px-2 py-1 bg-gray-100 rounded">{t}</span>
        ))}
      </div>
    </article>
  )
}
