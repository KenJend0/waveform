import { redirect } from 'next/navigation';
import { getAuthUser } from '@/lib/supabase/server';
import { getMyProfileSettings } from '@/app/actions/profile';
import { getSuggestedUsers } from '@/app/actions/social';
import OnboardingFlow from '@/components/onboarding/OnboardingFlow';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Bienvenue — Waveform',
};

export default async function OnboardingPage() {
    const user = await getAuthUser();
    if (!user) redirect('/auth?mode=login');

    const profileResult = await getMyProfileSettings();
    if (!profileResult.ok || !profileResult.profile) redirect('/feed');

    const profile = profileResult.profile;

    // Redirect if already onboarded:
    // - username_changed = true → used the settings change right
    // - username != UUID fragment → completed step 1 (safe now: setOnboardingUsername no longer
    //   calls revalidatePath, so no re-render occurs mid-flow)
    const defaultUsername = user.id.substring(0, 8);
    const hasRealUsername = profile.username && profile.username !== defaultUsername;
    if (profile.username_changed === true || hasRealUsername) redirect('/feed');

    const suggestedUsers = await getSuggestedUsers(5);

    return (
        <OnboardingFlow
            suggestedUsers={suggestedUsers}
        />
    );
}
