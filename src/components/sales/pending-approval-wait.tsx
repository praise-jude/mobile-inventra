import { useEffect, useState } from 'react';
import { Modal, ActivityIndicator, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { cancelApprovalRequest } from '@/lib/actions/approvals';
import { supabase } from '@/lib/supabase';

// Realtime-subscribes to this one approval_requests row so the cashier sees
// the outcome the instant a manager decides, without polling — mirrors
// Inventra/components/sales/PendingApprovalWait.tsx's web equivalent.
export function PendingApprovalWait({
  requestId,
  onApproved,
  onRejected,
  onCancelled,
}: {
  requestId: string;
  onApproved: (saleId: string | null) => void;
  onRejected: (reason: string | null) => void;
  onCancelled: () => void;
}) {
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel(`approval-request:${requestId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'approval_requests', filter: `id=eq.${requestId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const status = row.status as string;
          if (status === 'approved') onApproved((row.entity_id as string) ?? null);
          else if (status === 'rejected') onRejected(row.rejected_reason as string | null);
          else if (status === 'cancelled') onCancelled();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  async function handleCancel() {
    setCancelling(true);
    try {
      await cancelApprovalRequest(requestId);
      onCancelled();
    } finally {
      setCancelling(false);
    }
  }

  return (
    <Modal transparent animationType="fade" visible>
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View className="w-full max-w-[340px] rounded-2xl bg-bg p-6 dark:bg-bg-dark">
          <ActivityIndicator size="large" className="mb-3.5" />
          <Text className="mb-1.5 text-center text-[15px] font-bold text-text dark:text-text-dark">
            Waiting for manager approval
          </Text>
          <Text className="mb-4 text-center text-[13px] text-text-2 dark:text-text-2-dark">
            This discount is above the store&apos;s approval threshold — a manager or admin needs to approve it before the sale
            is recorded.
          </Text>
          <Button variant="secondary" loading={cancelling} onPress={handleCancel}>
            Cancel request
          </Button>
        </View>
      </View>
    </Modal>
  );
}
