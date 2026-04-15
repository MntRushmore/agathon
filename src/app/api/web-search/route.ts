import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * Web search tool for the Socratic panel — ported from AFFiNE's WebSearchTool.
 * Uses DuckDuckGo Instant Answer API (no key required) + scrapes top results.
 */

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const rateLimit = await checkRateLimit(user.id, 'chat');
    if (!rateLimit.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

    const { query } = await req.json();
    if (!query?.trim()) return NextResponse.json({ error: 'query is required' }, { status: 400 });

    // Use DuckDuckGo Instant Answer API — no key needed, returns JSON
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`;
    const ddgRes = await fetch(ddgUrl, { headers: { 'Accept': 'application/json' } });
    const ddgData = await ddgRes.json();

    const results: WebSearchResult[] = [];

    // Instant answer (if present)
    if (ddgData.AbstractText) {
      results.push({
        title: ddgData.Heading || query,
        url: ddgData.AbstractURL || '',
        snippet: ddgData.AbstractText,
      });
    }

    // Related topics
    for (const topic of (ddgData.RelatedTopics || []).slice(0, 5)) {
      if (topic.Text && topic.FirstURL) {
        results.push({
          title: topic.Text.split(' - ')[0] || topic.Text.slice(0, 60),
          url: topic.FirstURL,
          snippet: topic.Text,
        });
      }
    }

    // If no DDG results, fall back to a note
    if (results.length === 0) {
      results.push({
        title: 'No instant results found',
        url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        snippet: `Search DuckDuckGo for "${query}" to find more information.`,
      });
    }

    return NextResponse.json({ results: results.slice(0, 6) });
  } catch (err) {
    console.error('[web-search] Error:', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
