/**
 * Server-side rate limiter — Node.js runtime only (not Edge).
 * Import from API route handlers or server actions, NOT from middleware.ts.
 *
 * Only active when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set.
 * Fail-open: if Upstash is not configured, returns null (request passes through).
 *
 * Usage (API routes):
 *   const limited = await applyRateLimit(request);
 *   if (limited) return limited;
 *
 * Usage (server actions):
 *   const err = await checkActionRateLimit(user.id, 'comment');
 *   if (err) throw new Error(err);
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

function makeRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

const redis = makeRedis();

// API routes: 30 req / 60s per IP
const ratelimit = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, "60 s"), analytics: false, prefix: "waveform:rl" })
  : null;

// Server actions: per-user limits keyed by action type
type ActionKey = "like" | "follow" | "comment" | "diary_write" | "report" | "block" | "list_write" | "save";

const ACTION_LIMITS: Record<ActionKey, { requests: number; window: string }> = {
  like:        { requests: 60, window: "60 s" },
  follow:      { requests: 20, window: "60 s" },
  comment:     { requests: 10, window: "60 s" },
  diary_write: { requests: 20, window: "60 s" },
  report:      { requests: 10, window: "60 s" },
  block:       { requests: 10, window: "60 s" },
  list_write:  { requests: 30, window: "60 s" },
  save:        { requests: 60, window: "60 s" },
};

const actionLimiters = redis
  ? (Object.fromEntries(
      Object.entries(ACTION_LIMITS).map(([key, { requests, window }]) => [
        key,
        new Ratelimit({ redis: redis!, limiter: Ratelimit.slidingWindow(requests, window as any), analytics: false, prefix: `waveform:action:${key}` }),
      ])
    ) as Record<ActionKey, Ratelimit>)
  : null;

/**
 * Rate-limit a server action by authenticated user ID.
 * Returns an error message string if limited, or null if the request is allowed.
 */
export async function checkActionRateLimit(userId: string, action: ActionKey): Promise<string | null> {
  if (!actionLimiters) return null;
  const limiter = actionLimiters[action];
  const { success } = await limiter.limit(userId);
  if (!success) return "Trop de requêtes — réessaie dans une minute.";
  return null;
}

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
