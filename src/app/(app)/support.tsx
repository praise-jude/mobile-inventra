import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { haptics } from '@/lib/haptics';

// Mirrors Inventra/components/support/SupportClient.tsx — same hardcoded
// contacts (not pulled from support_settings, same as web's page; only the
// floating widget is DB-configured).
const CONTACTS = [
  { id: 'email', icon: '✉️', label: 'Email', value: 'royalmandigitalconcept@gmail.com' },
  { id: 'whatsapp', icon: '💬', label: 'WhatsApp', value: '+234 803 630 5562' },
] as const;

export default function SupportScreen() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleCopy(id: string, value: string) {
    await Clipboard.setStringAsync(value);
    haptics.success();
    setCopiedId(id);
    setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 2000);
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
          return (
            <View key={contact.id} className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
              <View className="mb-3 h-10 w-10 items-center justify-center rounded-[10px] bg-accent-weak dark:bg-accent-weak-dark">
                <Text className="text-[18px]">{contact.icon}</Text>
              </View>
              <Text className="mb-1 text-[12.5px] font-bold text-text-2 dark:text-text-2-dark">{contact.label}</Text>
              <Text className="mb-3 font-mono text-[14px] font-semibold text-text dark:text-text-dark">{contact.value}</Text>
              <Pressable
                onPress={() => handleCopy(contact.id, contact.value)}
                className="h-9 flex-row items-center gap-1.5 self-start rounded-[9px] border border-border bg-surface px-3 dark:border-border-dark dark:bg-surface-dark"
              >
                <Text className="text-[12.5px] font-semibold text-text dark:text-text-dark">
                  {copied ? '✓ Copied' : `Copy ${contact.label.toLowerCase()}`}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
