/**
 * Server-side rate limiter — Node.js runtime only (not Edge).
 * Import from API route handlers, NOT from middleware.ts.
 *
 * Only active when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set.
 * Fail-open: if Upstash is not configured, returns null (request passes through).
 *
 * Usage:
 *   const limited = await applyRateLimit(request);
 *   if (limited) return limited;
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

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

export async function applyRateLimit(req: NextRequest): Promise<NextResponse | null> {
  if (!ratelimit) return null;

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";

  const { success } = await ratelimit.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  return null;
}
