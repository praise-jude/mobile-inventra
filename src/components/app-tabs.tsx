import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// The 5 bottom-bar destinations only — rendered from
// (app)/(tabs)/_layout.tsx. Every other (app) screen (Cash Register,
// Invoices, Team, Customers, Expenses, Support, Audit Log, Reports,
// Notifications, Ask AI) used to be registered here too as a `hidden`
// NativeTabs.Trigger, reachable only via router.push — but Expo's docs
// confirm `hidden` on a Trigger means the route "cannot be navigated to
// in any way," which made every one of those tap-dead. They're now plain
// Stack screens (see ../app/(app)/_layout.tsx) instead of NativeTabs
// children, so they don't need registration here at all. Icons use SF
// Symbols/Material Symbols by name (`sf`/`md`) rather than bundled
// images, so there's no new icon-asset pipeline to maintain.
export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundSelected}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Dashboard</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }} md="dashboard" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="sales">
        <NativeTabs.Trigger.Label>Sales</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'cart', selected: 'cart.fill' }} md="shopping_cart" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="inventory">
        <NativeTabs.Trigger.Label>Inventory</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'shippingbox', selected: 'shippingbox.fill' }} md="inventory_2" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="billing">
        <NativeTabs.Trigger.Label>Billing</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'creditcard', selected: 'creditcard.fill' }} md="credit_card" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
