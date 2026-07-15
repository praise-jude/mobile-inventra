import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

// Mirrors Inventra/components/ui/Button.tsx's three variants and sizing.
export interface ButtonProps extends Omit<PressableProps, 'children'> {
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-accent dark:bg-accent-dark',
  secondary: 'border border-border bg-surface dark:border-border-dark dark:bg-surface-dark',
  ghost: 'bg-transparent',
};

const textClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'text-white',
  secondary: 'text-text dark:text-text-dark',
  ghost: 'text-text-2 dark:text-text-2-dark',
};

const spinnerColor: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: '#ffffff',
  secondary: '#2563eb',
  ghost: '#55607a',
};

export function Button({ variant = 'primary', loading, disabled, children, className, ...props }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      disabled={isDisabled}
      className={`h-[44px] flex-row items-center justify-center gap-2 rounded-[9px] px-4 ${variantClasses[variant]} ${isDisabled ? 'opacity-60' : ''} ${className ?? ''}`}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor[variant]} />
      ) : typeof children === 'string' ? (
        <Text className={`text-[14px] font-semibold ${textClasses[variant]}`}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
