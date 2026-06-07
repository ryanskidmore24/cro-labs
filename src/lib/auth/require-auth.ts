import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, type SessionPayload } from './session';

type Handler = (req: NextRequest, session: SessionPayload) => Promise<NextResponse>;

export function withAuth(handler: Handler) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handler(req, session);
  };
}
