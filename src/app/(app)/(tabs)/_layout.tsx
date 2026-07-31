import AppTabs from '@/components/app-tabs';

// The 5 bottom-bar destinations only (Dashboard, Sales, Inventory,
// Billing, Settings). Everything else that used to live alongside these
// as `hidden` NativeTabs.Trigger entries (Cash Register, Invoices, Team,
// Customers, Expenses, Support, Audit Log, Reports, Notifications, Ask
// AI) moved up to be a sibling of this whole (tabs) group instead — see
// ../_layout.tsx's comment for why: Expo's own docs confirm a `hidden`
// NativeTabs.Trigger "cannot be navigated to in any way", which is
// exactly the "tap does nothing" bug this restructure fixes.
export default function TabsLayout() {
  return <AppTabs />;
}
