import { Tabs } from 'expo-router';

// DIAGNOSTIC SWAP: NativeTabs (expo-router/unstable-native-tabs) replaced
// with the stable Tabs component. Suspected cause of "app crashes
// immediately on open": this app's environment matches a known RN 0.86
// bridgeless-mode boot race (expo/expo#47687) almost exactly — same RN
// version, New Architecture enabled, and the same structural trigger
// (each tab hosts its own nested <Stack>, see inventory/_layout.tsx etc.).
// The reporter's fix was removing the nested-Stack-under-tabs structure;
// swapping to the stable, battle-tested Tabs component first is a much
// smaller, fully reversible way to test whether NativeTabs itself (an
// explicitly "unstable" API) is implicated before considering the far
// more invasive navigation-flattening refactor. Icons are plain text
// labels for now — @expo/vector-icons isn't installed yet, and this swap
// is meant to isolate the crash cause, not polish the tab bar.
export default function AppTabs() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="sales" options={{ title: 'Sales' }} />
      <Tabs.Screen name="inventory" options={{ title: 'Inventory' }} />
      <Tabs.Screen name="billing" options={{ title: 'Billing' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      <Tabs.Screen name="reports" options={{ href: null }} />
      <Tabs.Screen name="team" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
    </Tabs>
  );
}
