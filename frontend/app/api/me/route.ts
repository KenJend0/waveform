import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { applyRateLimit } from "@/lib/serverRateLimit";

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request);
  if (limited) return limited;
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email ?? null,
    },
  });
}
