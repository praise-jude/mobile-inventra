import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, Text, View } from 'react-native';

// Web build of the tab shell (expo-router/ui's JS-based Tabs, since
// NativeTabs — see app-tabs.tsx — is iOS/Android only) — same 5 sections,
// same brand tokens, just a floating pill bar instead of a native tab bar.
//
// That bar is `position: absolute`, so unlike a native tab bar it doesn't
// automatically reserve its own space — every screen's content would
// otherwise render underneath it, with the bar visually overlapping (and
// intercepting taps on) anything scrolled to the bottom, e.g. a form's
// submit button. TAB_BAR_HEIGHT (measured: ~52px) is reserved via
// paddingBottom on TabSlot below, once, instead of every screen needing its
// own bottom padding to clear it.
export const TAB_BAR_HEIGHT = 56;

const TABS = [
  { name: 'index', href: '/', label: 'Dashboard', icon: '▦' },
  { name: 'sales', href: '/sales', label: 'Sales', icon: '🧾' },
  { name: 'inventory', href: '/inventory', label: 'Inventory', icon: '📦' },
  { name: 'billing', href: '/billing', label: 'Billing', icon: '💳' },
  { name: 'settings', href: '/settings', label: 'Settings', icon: '⚙️' },
] as const;

// `Tabs` (expo-router/ui) only knows how to route to segments registered as
// a TabTrigger inside TabList — a `router.push('/reports')` to any other
// top-level (app)/ route is silently swallowed (stays on the current tab)
// because the underlying ExpoTabRouter has no entry for it. These two are
// reachable via in-app navigation (Dashboard's Reports card, Settings'
// Team row) but shouldn't show as bottom-bar buttons, so they're registered
// with a zero-size trigger instead of a visible one — same intent as
// NativeTabs.Trigger's first-class `hidden` prop in app-tabs.tsx, which
// expo-router/ui has no equivalent for.
const HIDDEN_TABS = [
  { name: 'reports', href: '/reports' },
  { name: 'team', href: '/team' },
  { name: 'notifications', href: '/notifications' },
] as const;

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%', paddingBottom: TAB_BAR_HEIGHT }} />
      <TabList asChild>
        <View className="absolute bottom-0 w-full flex-row justify-center border-t border-border bg-surface px-2 py-2 dark:border-border-dark dark:bg-surface-dark">
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton icon={tab.icon} label={tab.label} />
            </TabTrigger>
          ))}
          {HIDDEN_TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} style={{ display: 'none' }} />
          ))}
        </View>
      </TabList>
    </Tabs>
  );
}

function TabButton({
  icon,
  label,
  isFocused,
  ...props
}: TabTriggerSlotProps & { icon: string; label: string }) {
  return (
    <Pressable {...props} className="flex-1 items-center gap-0.5 rounded-[9px] py-1.5">
      <Text className="text-[16px]">{icon}</Text>
      <Text
        className={`text-[11px] font-semibold ${isFocused ? 'text-accent-text dark:text-accent-text-dark' : 'text-text-2 dark:text-text-2-dark'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
