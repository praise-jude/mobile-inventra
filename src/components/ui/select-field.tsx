import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectFieldProps {
  label?: string;
  error?: string;
  value: string;
  placeholder?: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  searchable?: boolean;
}

// Same visual language as TextField, opening a searchable modal list instead
// of an inline dropdown — the country list alone is 190+ entries, so a
// native <select>-style inline menu isn't practical on mobile.
export function SelectField({ label, error, value, placeholder, options, onChange, searchable }: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const borderClass = error ? 'border-red dark:border-red-dark' : 'border-border dark:border-border-dark';

  return (
    <View>
      {label && <Text className="mb-1.5 text-[12.5px] font-semibold text-text-2 dark:text-text-2-dark">{label}</Text>}
      <Pressable
        onPress={() => setOpen(true)}
        className={`h-[42px] w-full flex-row items-center justify-between rounded-[9px] border bg-surface px-[13px] dark:bg-surface-dark ${borderClass}`}
      >
        <Text
          className={`text-[14px] ${selected ? 'text-text dark:text-text-dark' : 'text-faint dark:text-faint-dark'}`}
        >
          {selected?.label ?? placeholder ?? 'Select…'}
        </Text>
        <Text className="text-text-2 dark:text-text-2-dark">▾</Text>
      </Pressable>
      {error && <Text className="mt-1.5 text-[12px] font-medium text-red dark:text-red-dark">{error}</Text>}

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
          <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
            <Text className="text-[16px] font-bold text-text dark:text-text-dark">{label ?? 'Select'}</Text>
            <Pressable onPress={() => setOpen(false)}>
              <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Close</Text>
            </Pressable>
          </View>
          {searchable && (
            <View className="px-4 pt-3">
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search…"
                placeholderTextColor="#aab2c4"
                className="h-[42px] w-full rounded-[9px] border border-border bg-surface px-[13px] text-[14px] text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
              />
            </View>
          )}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.value}
            className="mt-2"
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onChange(item.value);
                  setQuery('');
                  setOpen(false);
                }}
                className={`px-4 py-3 ${item.value === value ? 'bg-accent-weak dark:bg-accent-weak-dark' : ''}`}
              >
                <Text className="text-[14px] text-text dark:text-text-dark">{item.label}</Text>
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}
