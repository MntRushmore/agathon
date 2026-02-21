import HelpCenter from '../../components/help/HelpCenter'
import articles from '../../content/help/articles.json'

export const metadata = {
  title: 'Help Center — Agathon',
}

export default function HelpPage() {
  return <HelpCenter initialArticles={articles} />
}
