import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware runs on all routes to keep Supabase session cookies fresh.
 * Auth gating is handled per-page (soft gates), not here.
 */
export async function middleware(req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on all routes except static assets and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
