import { NextRequest, NextResponse } from 'next/server';
import { isProductEventName, logProductEvent } from '@/lib/productEvents';
import { getAuthUser } from '@/lib/supabase/server';
import { applyRateLimit } from '@/lib/serverRateLimit';

export async function POST(request: NextRequest) {
  const limited = await applyRateLimit(request);
  if (limited) return limited;

  try {
    const body = await request.json();
    const eventName = typeof body?.eventName === 'string' ? body.eventName : '';

    if (!isProductEventName(eventName)) {
      return NextResponse.json({ ok: false, error: 'invalid_event_name' }, { status: 400 });
    }

    const user = await getAuthUser();

    await logProductEvent({
      eventName,
      userId: user?.id ?? null,
      sessionId: typeof body?.sessionId === 'string' ? body.sessionId : null,
      surface: typeof body?.surface === 'string' ? body.surface : null,
      properties: typeof body?.properties === 'object' && body.properties !== null ? body.properties : {},
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api/events] POST error:', error);
    return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 });
  }
}