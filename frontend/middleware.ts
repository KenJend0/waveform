import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Protect these top-level routes (and any nested paths)
const AUTH_MATCHER = [
  "/diary/:path*",
  "/settings/:path*",
  "/add/:path*",
  "/me/:path*",
  "/feed/:path*",
];

/**
 * Rate limiter — only active when UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN are set in the environment.
 * 30 requests / 60 s per IP on /api/* routes.
 * Fail-open: if Upstash is not configured, all requests pass through.
 */
const ratelimit =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({
        redis: new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        }),
        limiter: Ratelimit.slidingWindow(30, "60 s"),
        analytics: false,
        prefix: "waveform:rl",
      })
    : null;

/**
 * Edge-friendly, deterministic cookie check fallback for Supabase sessions.
 * Reliable server-side validation should use a middleware client, but
 * that package export may not be available in some versions. This
 * heuristic checks the presence of Supabase auth cookies to avoid SSR flashes.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Rate limiting for /api/* ──────────────────────────────────────────────
  if (pathname.startsWith("/api/") && ratelimit) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "anonymous";
    const { success } = await ratelimit.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
  }

  // ── Auth protection for guarded routes ───────────────────────────────────
  const isProtected = AUTH_MATCHER.some((m) => {
    const prefix = m.replace("/:path*", "");
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
  if (!isProtected) return NextResponse.next();

  // Check cookies for known Supabase session keys using NextRequest cookie API
  const allCookies = req.cookies.getAll ? req.cookies.getAll() : [];
  const cookieNames = allCookies.map((c) => c.name);

  const candidates = [
    "sb-access-token",
    "sb-refresh-token",
    "sb:token",
    "sb:session",
    "supabase-auth-token",
  ];

  const hasAuth = cookieNames.some(
    (n) =>
      candidates.includes(n) ||
      n.startsWith("sb:") ||
      n.startsWith("sb-") ||
      n.includes("supabase")
  );

  if (!hasAuth) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/diary/:path*",
    "/settings/:path*",
    "/add/:path*",
    "/me/:path*",
    "/feed/:path*",
  ],
};
