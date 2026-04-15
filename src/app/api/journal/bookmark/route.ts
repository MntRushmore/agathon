import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * Bookmark metadata fetcher — scrapes Open Graph / meta tags from a URL.
 * Returns title, description, image, favicon for rich bookmark cards.
 */

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { url } = await req.json();
    if (!url?.trim()) return NextResponse.json({ error: 'url is required' }, { status: 400 });

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Bad protocol');
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    const res = await fetch(parsedUrl.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Agathon/1.0; +https://agathon.app)' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

    const html = await res.text();

    const getMeta = (property: string): string => {
      const match =
        html.match(new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i')) ||
        html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i')) ||
        html.match(new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'));
      return match?.[1] || '';
    };

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

    const title = getMeta('og:title') || getMeta('twitter:title') || titleMatch?.[1]?.trim() || parsedUrl.hostname;
    const description = getMeta('og:description') || getMeta('twitter:description') || getMeta('description') || '';
    const image = getMeta('og:image') || getMeta('twitter:image') || '';
    const favicon = `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=32`;

    return NextResponse.json({ title, description, image, favicon, url: parsedUrl.toString(), hostname: parsedUrl.hostname });
  } catch (err) {
    console.error('[bookmark] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch bookmark metadata' }, { status: 500 });
  }
}
