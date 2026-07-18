// Port of Inventra/lib/movement-meta.ts — same icons/copy, `bgClass` swapped
// from a CSS custom-property to a NativeWind token pair matching this app's
// `dark:`-suffixed color convention (tailwind.config.js).
export interface MovementMeta {
  icon: string;
  bgClass: string;
  label: string;
  verb: string;
}

export const MOVEMENT_META: Record<string, MovementMeta> = {
  received: { icon: '📥', bgClass: 'bg-green-weak dark:bg-green-weak-dark', label: 'Received', verb: 'received stock of' },
  sale: { icon: '🛒', bgClass: 'bg-accent-weak dark:bg-accent-weak-dark', label: 'Sale', verb: 'sold' },
  adjustment: { icon: '✏️', bgClass: 'bg-amber-weak dark:bg-amber-weak-dark', label: 'Adjustment', verb: 'adjusted' },
  transfer: { icon: '🔁', bgClass: 'bg-sky-weak dark:bg-sky-weak-dark', label: 'Transfer', verb: 'transferred' },
  return: { icon: '↩️', bgClass: 'bg-red-weak dark:bg-red-weak-dark', label: 'Return', verb: 'processed a return of' },
  expired: { icon: '🗑️', bgClass: 'bg-red-weak dark:bg-red-weak-dark', label: 'Expired', verb: 'expired' },
};
