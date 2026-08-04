// Mobile equivalent of Inventra/lib/google-cloud/storage.ts's
// getGoogleCloudStatus — a mobile bundle can never hold the service-role
// key needed to check the bucket itself, so this goes through the
// bearer-token web route instead, same pattern as billing.ts/invoices.ts.
import { supabase } from '@/lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export interface GoogleCloudStatus {
  configured: boolean;
  connected: boolean;
}

export async function getGoogleCloudStatus(): Promise<GoogleCloudStatus> {
  if (!API_URL) return { configured: false, connected: false };
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { configured: false, connected: false };

  try {
    const response = await fetch(`${API_URL}/api/mobile/google-cloud/status`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!response.ok) return { configured: false, connected: false };
    return await response.json();
  } catch {
    return { configured: false, connected: false };
  }
}
