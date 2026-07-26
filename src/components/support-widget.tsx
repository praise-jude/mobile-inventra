import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { haptics } from '@/lib/haptics';
import { useSupportSettings } from '@/lib/hooks/use-support-settings';

// Mirrors Inventra/components/support/SupportWidget.tsx — a floating
// WhatsApp chat bubble driven by the same admin-configured
// support_settings row (business hours/average response/enabled flags).
export function SupportWidget() {
  const query = useSupportSettings();
  const [open, setOpen] = useState(false);
  const settings = query.data;

  if (!settings || !settings.widget_enabled || !settings.whatsapp_enabled) return null;

  function openWhatsApp() {
    haptics.tap();
    setOpen(false);
    const url = `https://wa.me/${settings!.whatsapp_number}?text=${encodeURIComponent(settings!.whatsapp_message)}`;
    void Linking.openURL(url);
  }

  return (
    <View className="absolute bottom-6 right-5" pointerEvents="box-none">
      {open && (
        <View className="mb-3 w-[260px] rounded-2xl border border-border bg-surface p-4 shadow-lg dark:border-border-dark dark:bg-surface-dark">
          <Text className="text-[14px] font-bold text-text dark:text-text-dark">Need help?</Text>
          {settings.business_hours ? (
            <View className="mt-2.5 rounded-[10px] bg-surface-2 p-2.5 dark:bg-surface-2-dark">
              <Text className="text-[11.5px] font-semibold text-text dark:text-text-dark">Business hours</Text>
              <Text className="mt-0.5 text-[11.5px] text-text-2 dark:text-text-2-dark">{settings.business_hours}</Text>
              {settings.average_response ? (
                <Text className="mt-1 text-[11.5px] text-text-2 dark:text-text-2-dark">Average response: {settings.average_response}</Text>
              ) : null}
            </View>
          ) : null}
          <Pressable
            onPress={openWhatsApp}
            className="mt-3 h-9 items-center justify-center rounded-[9px] border border-border bg-surface dark:border-border-dark dark:bg-surface-dark"
          >
            <Text className="text-[12.5px] font-semibold text-text dark:text-text-dark">Chat on WhatsApp</Text>
          </Pressable>
        </View>
      )}
      <Pressable
        onPress={() => {
          haptics.tap();
          setOpen((v) => !v);
        }}
        className="h-14 w-14 items-center justify-center rounded-full shadow-lg"
        style={{ backgroundColor: '#25D366' }}
      >
        <Text className="text-[26px]">💬</Text>
      </Pressable>
    </View>
  );
}
