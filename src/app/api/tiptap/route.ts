import { NextRequest, NextResponse } from 'next/server';

// POST /api/tiptap - Returns collaboration config for the client
// This keeps sensitive tokens server-side and only exposes what the client needs
export async function POST(req: NextRequest) {
  try {
    const { documentId } = await req.json();

    if (!documentId) {
      return NextResponse.json({ error: 'documentId required' }, { status: 400 });
    }

    const collabAppId = process.env.NEXT_PUBLIC_TIPTAP_COLLAB_APP_ID;
    const collabToken = process.env.TIPTAP_COLLAB_TOKEN;
    const docPrefix = process.env.NEXT_PUBLIC_TIPTAP_COLLAB_DOC_PREFIX || 'agathon-journal-';

    if (!collabAppId || collabAppId === 'your-tiptap-collab-app-id') {
      return NextResponse.json({ error: 'TipTap Collaboration not configured' }, { status: 503 });
    }

    if (!collabToken || collabToken === 'your-tiptap-collab-token') {
      return NextResponse.json({ error: 'TipTap Collaboration token not configured' }, { status: 503 });
    }

    return NextResponse.json({
      token: collabToken,
      appId: collabAppId,
      documentName: `${docPrefix}${documentId}`,
    });
  } catch (error) {
    console.error('TipTap token error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
