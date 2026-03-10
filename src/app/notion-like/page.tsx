import { NotionEditor } from "@/components/tiptap-templates/notion-like/notion-like-editor"

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const slug = (await params).slug || "notion"
  return <NotionEditor room={slug} />
}
