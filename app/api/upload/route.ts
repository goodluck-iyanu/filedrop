import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const upstream = new FormData();
    upstream.append('file', file as Blob, (file as File).name);

    // file.io — reliable free file host, auto-expires in 14 days
    const response = await fetch('https://file.io', {
      method: 'POST',
      body: upstream,
    });

    if (!response.ok) {
      throw new Error(`file.io responded with ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.link) {
      throw new Error(data.message || 'Upload failed — no link returned.');
    }

    return NextResponse.json({ url: data.link });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    console.error('[upload route]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}