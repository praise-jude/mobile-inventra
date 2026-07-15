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

export async function initiateAddCard(planKey: 'monthly' | 'yearly'): Promise<InitiateAddCardResult> {
  if (!API_URL) {
    throw new Error('Missing EXPO_PUBLIC_API_URL — copy .env.example to .env and fill in the value.');
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(`${API_URL}/api/mobile/billing/initiate-card`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ planKey }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error ?? 'Could not start card setup.');
  }
  return body as InitiateAddCardResult;
}
