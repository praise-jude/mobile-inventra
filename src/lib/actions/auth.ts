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
import * as Linking from 'expo-linking';

import { recordLogin, recordLogout } from '@/lib/actions/audit';
import { currencyForCountry, timezoneFor } from '@/lib/geo/countries';
import { deregisterPushToken } from '@/lib/actions/notifications';
import { supabase } from '@/lib/supabase';
import { CURRENT_TERMS_VERSION } from '@/lib/terms';
import type { Organization } from '@/types/database';
import type { CompleteOnboardingInput, JoinBranchInput, SignupInput } from '@/lib/validation/auth';

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
      // Confirmation email must return to the app, not the web app's
      // default Site URL — Linking.createURL resolves to
      // royalinventra://callback in a standalone/dev-client build and to
      // the correct exp://<lan-ip>/--/callback form under Expo Go, so this
      // works in both development and production without branching.
      emailRedirectTo: Linking.createURL('callback'),
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
        referral_code: input.referralCode?.trim() || undefined,
        terms_accepted: true,
        terms_version: CURRENT_TERMS_VERSION,
        terms_accepted_ip: null,
      },
    },
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, hasSession: !!data.session };
}

// The self-service replacement for the old Team invite flow — much lighter
// than registerAccount() above (no business/country fields, since those
// come from the branch's existing org) because this joins an EXISTING
// org/branch rather than creating one. The actual org_id/branch_id
// resolution happens server-side in the on_auth_user_created trigger (see
// 20260803200000_branch_code_signup.sql), which looks the code up itself
// rather than trusting anything the client claims — this action only
// forwards what the user typed, never an org/branch id. Mirrors
// Inventra/lib/actions/auth.ts's joinBranchAsManager.
export async function joinBranchAsManager(input: JoinBranchInput): Promise<RegisterAccountResult> {
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const branchCode = input.branchCode.trim().toUpperCase();

  const [firstName, ...rest] = fullName.split(/\s+/);
  const lastName = rest.join(' ') || undefined;

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      emailRedirectTo: Linking.createURL('callback'),
      data: {
        first_name: firstName,
        last_name: lastName,
        branch_code: branchCode,
        terms_accepted: true,
        terms_version: CURRENT_TERMS_VERSION,
        terms_accepted_ip: null,
      },
    },
  });

  // "Invalid or expired branch code." raised by the trigger surfaces here as
  // a generic auth error — checked for directly so the message stays useful.
  if (error) {
    const message = error.message?.includes('branch code') ? 'Invalid or expired branch code.' : error.message;
    return { ok: false, error: message };
  }
  return { ok: true, hasSession: !!data.session };
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  void recordLogin();
}

export async function signOut(): Promise<void> {
  // Both must run before auth.signOut() tears down the session — recordLogout
  // needs a valid session to attribute the entry, and deleting the
  // push_tokens row needs a valid auth.uid() for RLS.
  await recordLogout();
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
