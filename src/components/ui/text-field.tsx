import { forwardRef, useState } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

// Mirrors Inventra/components/ui/Field.tsx's sizing, radius and color
// tokens (h-42px, rounded-9px, border/accent/red states) so mobile inputs
// read as the same design system.
export interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, onFocus, onBlur, className, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const borderClass = error
    ? 'border-red dark:border-red-dark'
    : focused
      ? 'border-accent dark:border-accent-dark'
      : 'border-border dark:border-border-dark';

  return (
    <View>
      {label && <Text className="mb-1.5 text-[12.5px] font-semibold text-text-2 dark:text-text-2-dark">{label}</Text>}
      <TextInput
        ref={ref}
        placeholderTextColor="#aab2c4"
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        className={`h-[42px] w-full rounded-[9px] border bg-surface px-[13px] text-[14px] text-text dark:bg-surface-dark dark:text-text-dark ${borderClass} ${className ?? ''}`}
        {...props}
      />
      {error && <Text className="mt-1.5 text-[12px] font-medium text-red dark:text-red-dark">{error}</Text>}
    </View>
  );
});
