// Mobile equivalent of Inventra/lib/actions/billing.ts's initiateAddCard.
// That's a Next.js Server Action (only callable from inside Next.js) and it
// needs the Paystack secret key, which a mobile bundle can never safely
// hold — so this calls the dedicated bearer-token-authenticated route
// (Inventra/app/api/mobile/billing/initiate-card) instead, which wraps the
// exact same lib/billing-service.ts logic the web path uses.
import { supabase } from '@/lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export interface InitiateAddCardResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

// Shared by every action below — mirrors the fetch shape initiateAddCard
// already used, just generalized so change-plan/cancel/reactivate/
// remove-card don't each repeat the same bearer-token boilerplate.
async function postToMobileBillingRoute(path: string, body?: unknown): Promise<unknown> {
  if (!API_URL) {
    throw new Error('Missing EXPO_PUBLIC_API_URL — copy .env.example to .env and fill in the value.');
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(`${API_URL}/api/mobile/billing/${path}`, {
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

export async function initiateAddCard(planKey: 'monthly' | 'yearly'): Promise<InitiateAddCardResult> {
  return (await postToMobileBillingRoute('initiate-card', { planKey })) as InitiateAddCardResult;
}

export async function changePlan(planKey: 'monthly' | 'yearly'): Promise<void> {
  await postToMobileBillingRoute('change-plan', { planKey });
}

export async function cancelSubscription(): Promise<void> {
  await postToMobileBillingRoute('cancel');
}

export async function reactivateSubscription(): Promise<void> {
  await postToMobileBillingRoute('reactivate');
}

export async function removePaymentMethod(): Promise<void> {
  await postToMobileBillingRoute('remove-card');
}
