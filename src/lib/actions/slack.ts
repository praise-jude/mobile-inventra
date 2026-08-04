// Direct-Supabase equivalent of Inventra/lib/slack-service.ts — the Slack
// webhook URL is readable via normal RLS (integrations_select is org-wide,
// same trust level as other org-shared config this app already reads
// directly on mobile), so posting to it needs no server hop, unlike
// GCS/billing which need a secret key mobile can never hold. Connecting/
// disconnecting Slack stays web-only (Settings -> Integrations,
// SlackConnectModal) — an admin setup task done once, not something this
// app needs its own UI for; mobile only consumes the connection.
import { supabase } from '@/lib/supabase';

async function postToSlack(orgId: string, text: string): Promise<void> {
  try {
    const { data: integration } = await supabase
      .from('integrations')
      .select('status, config')
      .eq('org_id', orgId)
      .eq('provider', 'slack')
      .maybeSingle();
    if (integration?.status !== 'connected') return;
    const webhookUrl = (integration.config as { webhook_url?: string } | null)?.webhook_url;
    if (!webhookUrl) return;

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.error('[Royal Inventra] postToSlack failed:', res.status);
    }
  } catch (err) {
    console.error('[Royal Inventra] postToSlack threw:', err);
  }
}

const STATUS_EMOJI: Record<string, string> = { out_of_stock: '🔴', low_stock: '🟡' };
const STATUS_LABEL: Record<string, string> = { out_of_stock: 'is out of stock', low_stock: 'is low on stock' };

// Called after any stock_movements insert succeeds (recordSale, adjustments
// — see call sites) with the product ids that just moved. Mirrors
// Inventra/lib/slack-service.ts's checkAndSendStockAlerts exactly,
// including the last_alerted_status dedup so a sale on web followed by an
// adjustment on mobile (or vice versa) doesn't double-alert.
export async function checkAndSendStockAlerts(orgId: string, productIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(productIds)];
  if (uniqueIds.length === 0) return;

  const { data: settings } = await supabase
    .from('notification_settings')
    .select('low_stock, out_of_stock')
    .eq('org_id', orgId)
    .maybeSingle();
  if (!settings?.low_stock && !settings?.out_of_stock) return;

  const { data: products } = await supabase
    .from('products')
    .select('id, name, status, qty_on_hand, reorder_level, last_alerted_status')
    .in('id', uniqueIds)
    .is('archived_at', null);

  const lines: string[] = [];
  for (const p of products ?? []) {
    const alertableStatus = p.status === 'out_of_stock' || p.status === 'low_stock';
    const enabledForStatus = (p.status === 'out_of_stock' && settings.out_of_stock) || (p.status === 'low_stock' && settings.low_stock);

    if (alertableStatus && enabledForStatus && p.last_alerted_status !== p.status) {
      lines.push(
        p.status === 'out_of_stock'
          ? `${STATUS_EMOJI.out_of_stock} *${p.name}* ${STATUS_LABEL.out_of_stock} (0 units on hand)`
          : `${STATUS_EMOJI.low_stock} *${p.name}* ${STATUS_LABEL.low_stock} (${p.qty_on_hand} left, reorder at ${p.reorder_level})`,
      );
      void supabase.from('products').update({ last_alerted_status: p.status }).eq('id', p.id);
    } else if (!alertableStatus && p.last_alerted_status) {
      void supabase.from('products').update({ last_alerted_status: null }).eq('id', p.id);
    }
  }

  if (lines.length > 0) {
    await postToSlack(orgId, lines.length === 1 ? lines[0] : `Stock alerts:\n${lines.join('\n')}`);
  }
}

export interface SlackStatus {
  connected: boolean;
}

// Backs a small read-only status row on Settings — mirrors the shape of
// Inventra/lib/google-cloud/storage.ts's getGoogleCloudStatus, but Slack
// needs no bearer-token route since, unlike GCS, nothing here requires the
// service-role key.
export async function getSlackStatus(orgId: string): Promise<SlackStatus> {
  const { data } = await supabase.from('integrations').select('status').eq('org_id', orgId).eq('provider', 'slack').maybeSingle();
  return { connected: data?.status === 'connected' };
}
