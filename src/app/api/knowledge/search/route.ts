import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { query, limit = 5 } = await req.json() as { query: string; limit?: number };

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Search title with ILIKE
    const { data: titleMatches, error: titleErr } = await supabase
      .from('knowledge_base')
      .select('id, source, source_id, title, content, metadata, synced_at')
      .eq('user_id', user.id)
      .ilike('title', `%${query}%`)
      .limit(limit);

    if (titleErr) {
      return NextResponse.json({ error: titleErr.message }, { status: 500 });
    }

    // Search content for additional matches
    const titleIds = new Set((titleMatches || []).map(d => d.id));
    const { data: contentMatches } = await supabase
      .from('knowledge_base')
      .select('id, source, source_id, title, content, metadata, synced_at')
      .eq('user_id', user.id)
      .ilike('content', `%${query}%`)
      .limit(limit);

    // Merge and deduplicate
    const allResults = [...(titleMatches || [])];
    for (const item of contentMatches || []) {
      if (!titleIds.has(item.id)) allResults.push(item);
    }

    return NextResponse.json({
      results: allResults.slice(0, limit).map(truncateContent),
    });
  } catch (error) {
    console.error('Knowledge search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

function truncateContent(item: { content: string; [key: string]: unknown }) {
  return {
    ...item,
    content: item.content.slice(0, 500) + (item.content.length > 500 ? '...' : ''),
  };
}
