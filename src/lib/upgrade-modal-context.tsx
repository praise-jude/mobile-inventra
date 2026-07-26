import { router } from 'expo-router';
import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

interface UpgradeModalContextValue {
  openUpgradeModal: () => void;
}

const UpgradeModalContext = createContext<UpgradeModalContextValue | undefined>(undefined);

// Mirrors Inventra/components/billing/EntitlementsProvider.tsx's modal —
// mounted once near the root (src/app/_layout.tsx) so any screen can
// trigger it via useUpgradeModal() without prop-drilling.
export function UpgradeModalProvider({ children }: PropsWithChildren) {
  const [open, setOpen] = useState(false);

  const value = useMemo<UpgradeModalContextValue>(() => ({ openUpgradeModal: () => setOpen(true) }), []);

  return (
    <UpgradeModalContext.Provider value={value}>
      {children}
      <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
        <Pressable onPress={() => setOpen(false)} className="flex-1 items-center justify-center bg-black/50 px-6">
          <Pressable onPress={(e) => e.stopPropagation()} className="w-full max-w-[380px] rounded-2xl bg-surface p-5 dark:bg-surface-dark">
            <View className="mb-3 self-start rounded-full bg-accent-weak px-3 py-1 dark:bg-accent-weak-dark">
              <Text className="text-[11px] font-bold text-accent-text dark:text-accent-text-dark">PREMIUM</Text>
            </View>
            <Text className="text-[17px] font-bold text-text dark:text-text-dark">Upgrade to Inventra Premium</Text>
            <Text className="mt-2 text-[13.5px] leading-snug text-text-2 dark:text-text-2-dark">
              Unlock unlimited inventory, receipt printing, inventory editing, reports, AI tools, team collaboration,
              analytics, and more by upgrading your subscription.
            </Text>
            <View className="mt-5 flex-row gap-2.5">
              <Pressable
                onPress={() => setOpen(false)}
                className="h-11 flex-1 items-center justify-center rounded-[9px] border border-border dark:border-border-dark"
              >
                <Text className="text-[13.5px] font-semibold text-text dark:text-text-dark">Maybe Later</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setOpen(false);
                  router.push('/billing');
                }}
                className="h-11 flex-1 items-center justify-center rounded-[9px] bg-accent dark:bg-accent-dark"
              >
                <Text className="text-[13.5px] font-semibold text-white">Upgrade Now</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </UpgradeModalContext.Provider>
  );
}

export function useUpgradeModal(): UpgradeModalContextValue {
  const ctx = useContext(UpgradeModalContext);
  if (!ctx) throw new Error('useUpgradeModal must be used within an UpgradeModalProvider');
  return ctx;
}
