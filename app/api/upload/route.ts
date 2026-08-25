import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
// 0x0.st can be slow for large files – give it plenty of time
export const maxDuration = 60;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Expected multipart/form-data' },
        { status: 400 },
      );
    }

    // Read the incoming FormData from the browser
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Re-post to 0x0.st from the server (no CORS restriction here)
    const upstream = new FormData();
    upstream.append('file', file as Blob, (file as File).name);

    const response = await fetch('https://0x0.st', {
      method: 'POST',
      body: upstream,
    });

    if (!response.ok) {
      throw new Error(`0x0.st responded with ${response.status}`);
    }

    const downloadUrl = (await response.text()).trim();

    if (!downloadUrl || !downloadUrl.startsWith('http')) {
      throw new Error('Invalid download link received from upstream.');
    }

    return NextResponse.json({ url: downloadUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    console.error('[upload route]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}