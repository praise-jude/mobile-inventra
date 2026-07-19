// Mobile equivalent of Inventra/lib/actions/mfa.ts. The core TOTP
// enroll/challenge/verify/unenroll/listFactors calls are plain
// supabase.auth.mfa.* methods — same client-side Supabase Auth SDK on
// mobile as on web, no service-role key needed, so those are called
// directly here. Only generating recovery codes (RLS only allows a user to
// SELECT their own mfa_recovery_codes, not INSERT) and disabling MFA
// (needs the Admin API to delete a factor when the caller only proved a
// recovery code, not a real AAL2 session) go through the bearer-token
// mobile routes — same split as Team's invite/resend/remove vs.
// role-change/suspend/approve/reject.
import { supabase } from '@/lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

async function postToMobileMfaRoute(path: string, body?: unknown): Promise<unknown> {
  if (!API_URL) {
    throw new Error('Missing EXPO_PUBLIC_API_URL — copy .env.example to .env and fill in the value.');
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(`${API_URL}/api/mobile/mfa/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body ?? {}),
  });

  const responseBody = await response.json();
  if (!response.ok) {
    throw new Error(responseBody.error ?? 'Something went wrong.');
  }
  return responseBody;
}

export interface EnrollResult {
  factorId: string;
  secret: string;
  otpauthUrl: string;
}

// Supabase's own data.totp.qr_code is an SVG data URI, which React
// Native's <Image> can't render (raster formats only) — so this
// constructs the standard otpauth:// URI from the secret instead, fed
// into a client-rendered QR (react-native-qrcode-svg), same secret either
// way since that's what actually backs verification.
export async function startEnroll(email: string): Promise<EnrollResult> {
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
  if (error) throw error;
  const secret = data.totp.secret;
  const otpauthUrl = `otpauth://totp/Inventra:${encodeURIComponent(email)}?secret=${secret}&issuer=Inventra`;
  return { factorId: data.id, secret, otpauthUrl };
}

export async function cancelEnroll(factorId: string): Promise<void> {
  await supabase.auth.mfa.unenroll({ factorId }).catch(() => {});
}

export async function confirmEnroll(factorId: string, code: string): Promise<void> {
  const challenge = await supabase.auth.mfa.challenge({ factorId });
  if (challenge.error) throw challenge.error;
  const verify = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code });
  if (verify.error) throw verify.error;
}

export async function generateAndStoreRecoveryCodes(): Promise<string[]> {
  const result = (await postToMobileMfaRoute('generate-recovery-codes')) as { codes: string[] };
  return result.codes;
}

export async function verifyRecoveryCode(code: string): Promise<boolean> {
  const result = (await postToMobileMfaRoute('verify-recovery-code', { code })) as { valid: boolean };
  return result.valid;
}

export async function disableMfaWithPassword(input: { password: string; code: string }): Promise<void> {
  await postToMobileMfaRoute('disable', input);
}

export async function getMfaStatus(): Promise<{ enabled: boolean; factorId: string | null }> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  const totpFactor = data.totp?.[0] ?? null;
  return { enabled: !!totpFactor, factorId: totpFactor?.id ?? null };
}

export async function getRecoveryCodeCount(): Promise<number> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return 0;
  const { count, error } = await supabase
    .from('mfa_recovery_codes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', session.user.id)
    .eq('used', false);
  if (error) return 0;
  return count ?? 0;
}
