// Direct-Supabase equivalents of Inventra/lib/actions/auth.ts's Server
// Actions. Server Actions only run inside Next.js, so mobile reuses the
// exact same backend (auth.signUp() metadata contract, handle_new_user()
// trigger, RLS-scoped table writes) without a server hop of its own.
//
// Known, deliberate deviations from the web behavior (confirmed with the
// project owner):
//  - No signup IP rate-limiting: that check runs server-side with the
//    Supabase service-role key, which mobile can never hold.
//  - terms_accepted_ip is always left null for mobile-originated acceptances
//    instead of a spoofable client-reported value.
import { currencyForCountry, timezoneFor } from '@/lib/geo/countries';
import { deregisterPushToken } from '@/lib/actions/notifications';
import { supabase } from '@/lib/supabase';
import { CURRENT_TERMS_VERSION } from '@/lib/terms';
import type { Organization } from '@/types/database';
import type { CompleteOnboardingInput, SignupInput } from '@/lib/validation/auth';

export type RegisterAccountResult = { ok: true; hasSession: boolean } | { ok: false; error: string };

export async function registerAccount(input: SignupInput): Promise<RegisterAccountResult> {
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const businessName = input.businessName.trim();
  const businessEmail = input.businessEmail?.trim() || undefined;
  const country = input.country.trim();
  const state = input.state?.trim() || undefined;

  const [firstName, ...rest] = fullName.split(/\s+/);
  const lastName = rest.join(' ') || undefined;
  const currency = currencyForCountry(country) ?? 'USD';
  const timezone = timezoneFor(country, state);

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        business_name: businessName,
        business_email: businessEmail,
        country,
        state,
        currency,
        timezone,
        role: input.role,
        terms_accepted: true,
        terms_version: CURRENT_TERMS_VERSION,
        terms_accepted_ip: null,
      },
    },
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, hasSession: !!data.session };
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  // Must run before auth.signOut() tears down the session — deleting the
  // push_tokens row needs a valid auth.uid() for RLS.
  await deregisterPushToken();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Fills in gaps left by pre-migration accounts (mirrors
// Inventra's completeOnboarding — Google OAuth is not yet wired up on
// mobile, see AGENTS.md working-method note for that follow-up). Business
// fields are only writable by owner/admin, matching the is_org_admin() RLS
// already enforced on `organizations`.
export async function completeOnboarding(input: CompleteOnboardingInput): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (profileError || !profile) throw new Error('No profile');

  const isAdmin = profile.role === 'owner' || profile.role === 'admin';
  const wantsOrgUpdate = Boolean(input.businessName || input.businessEmail || input.country || input.state);

  if (wantsOrgUpdate) {
    if (!isAdmin) throw new Error('Only an owner or admin can complete the business profile.');

    const patch: Partial<Pick<Organization, 'name' | 'business_email' | 'country' | 'state' | 'currency' | 'timezone'>> =
      {};
    if (input.businessName?.trim()) patch.name = input.businessName.trim();
    if (input.businessEmail?.trim()) patch.business_email = input.businessEmail.trim();
    if (input.country) {
      patch.country = input.country;
      patch.currency = currencyForCountry(input.country) ?? 'USD';
      patch.timezone = timezoneFor(input.country, input.state?.trim() || undefined);
    }
    if (input.state?.trim()) patch.state = input.state.trim();

    const { error } = await supabase.from('organizations').update(patch).eq('id', profile.org_id);
    if (error) throw error;
  }

  if (input.termsAccepted && !profile.terms_accepted) {
    const { error } = await supabase
      .from('profiles')
      .update({
        terms_accepted: true,
        terms_version: CURRENT_TERMS_VERSION,
        terms_accepted_at: new Date().toISOString(),
        terms_accepted_ip: null,
      })
      .eq('id', user.id);
    if (error) throw error;
  }
}
