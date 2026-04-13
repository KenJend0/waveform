import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import type { EmailOtpType } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/feed';

  const supabase = await createSupabaseServer();

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      const redirectTo = type === 'recovery' ? '/auth/reset' : type === 'signup' ? '/onboarding' : next;
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/auth/reset`);
      }
      const username = data.user?.user_metadata?.username as string | undefined;
      const needsOnboarding = !username || /^[0-9a-f-]{36}$/.test(username);
      const redirectTo = needsOnboarding ? '/onboarding' : next;
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth?error=confirmation_failed`);
}
