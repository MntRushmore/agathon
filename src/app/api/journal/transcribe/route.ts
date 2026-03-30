import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * Audio transcription endpoint.
 * Uses Groq's Whisper API (free, fast) if GROQ_API_KEY is set.
 * Falls back to a helpful message if not configured.
 */

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const rateLimit = await checkRateLimit(user.id, 'voice');
    if (!rateLimit.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return NextResponse.json(
        { error: 'Transcription not configured. Add GROQ_API_KEY to .env.local to enable audio transcription.' },
        { status: 501 }
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get('audio');
    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json({ error: 'audio file is required' }, { status: 400 });
    }

    // Groq Whisper — supports mp3, mp4, mpeg, mpga, m4a, wav, webm
    const groqForm = new FormData();
    groqForm.append('file', audioFile, (audioFile as File).name || 'audio.webm');
    groqForm.append('model', 'whisper-large-v3-turbo');
    groqForm.append('response_format', 'json');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}` },
      body: groqForm,
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[transcribe] Groq error:', err);
      return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json({ transcript: data.text || '' });
  } catch (err) {
    console.error('[transcribe] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
