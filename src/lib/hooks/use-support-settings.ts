import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { SupportSettings } from '@/types/database';

const FALLBACK: SupportSettings = {
  id: '',
  whatsapp_number: '',
  whatsapp_message: '',
  business_hours: '',
  support_email: '',
  average_response: '',
  whatsapp_enabled: false,
  widget_enabled: false,
};

// Mirrors Inventra/lib/queries/support-settings.ts's getSupportSettings —
// fail closed (no widget) on any error rather than surfacing one, since
// this is decoration on every screen, not a feature a user is trying to use.
export function useSupportSettings() {
  return useQuery({
    queryKey: ['support-settings'],
    queryFn: async (): Promise<SupportSettings> => {
      const { data, error } = await supabase.from('support_settings').select('*').maybeSingle();
      if (error || !data) return FALLBACK;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
