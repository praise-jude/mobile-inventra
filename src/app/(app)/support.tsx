import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { notifyAlert } from '@/lib/confirm';
import { haptics } from '@/lib/haptics';

// Mirrors Inventra/components/support/SupportClient.tsx's contact values,
// but actually launches the device's mail/WhatsApp app on tap (mailto: /
// wa.me links) rather than only copying — web's "copy to clipboard" pattern
// doesn't match what a mobile user expects tapping a contact method to do.
const CONTACTS = [
  {
    id: 'email',
    icon: '✉️',
    label: 'Email',
    value: 'royalmandigitalconcept@gmail.com',
    actionLabel: 'Send email',
    buildUrl: (value: string) => `mailto:${value}`,
    unavailableMessage: 'No email app is set up on this device. You can copy the address instead.',
  },
  {
    id: 'whatsapp',
    icon: '💬',
    label: 'WhatsApp',
    value: '+234 803 630 5562',
    actionLabel: 'Open WhatsApp',
    // wa.me needs plain digits, no '+'/spaces — strips whatever formatting
    // the display value uses rather than requiring it to already match.
    buildUrl: (value: string) => `https://wa.me/${value.replace(/\D/g, '')}`,
    unavailableMessage: 'WhatsApp is not installed on this device. You can copy the number instead.',
  },
] as const;

export default function SupportScreen() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  async function handleCopy(id: string, value: string) {
    await Clipboard.setStringAsync(value);
    haptics.success();
    setCopiedId(id);
    setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 2000);
  }

  async function handleOpen(contact: (typeof CONTACTS)[number]) {
    setOpeningId(contact.id);
    try {
      const url = contact.buildUrl(contact.value);
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        haptics.warning();
        notifyAlert(`Could not open ${contact.label}`, contact.unavailableMessage);
        return;
      }
      haptics.tap();
      await Linking.openURL(url);
    } catch {
      haptics.warning();
      notifyAlert('Error', `Could not open ${contact.label.toLowerCase()}. Please try again.`);
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Back</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">Contact support</Text>
        <View className="w-12" />
      </View>

      <View className="gap-3.5 p-5">
        <Text className="text-[13px] text-text-2 dark:text-text-2-dark">Reach us directly — we usually reply within a few hours.</Text>
        {CONTACTS.map((contact) => {
          const copied = copiedId === contact.id;
          const opening = openingId === contact.id;
          return (
            <View key={contact.id} className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
              <View className="mb-3 h-10 w-10 items-center justify-center rounded-[10px] bg-accent-weak dark:bg-accent-weak-dark">
                <Text className="text-[18px]">{contact.icon}</Text>
              </View>
              <Text className="mb-1 text-[12.5px] font-bold text-text-2 dark:text-text-2-dark">{contact.label}</Text>
              <Text className="mb-3 font-mono text-[14px] font-semibold text-text dark:text-text-dark">{contact.value}</Text>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => handleOpen(contact)}
                  disabled={opening}
                  className="h-9 flex-1 items-center justify-center rounded-[9px] bg-accent px-3 dark:bg-accent-dark disabled:opacity-60"
                >
                  <Text className="text-[12.5px] font-semibold text-white">{opening ? 'Opening…' : contact.actionLabel}</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleCopy(contact.id, contact.value)}
                  className="h-9 items-center justify-center rounded-[9px] border border-border bg-surface px-3 dark:border-border-dark dark:bg-surface-dark"
                >
                  <Text className="text-[12.5px] font-semibold text-text dark:text-text-dark">{copied ? '✓ Copied' : 'Copy'}</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
