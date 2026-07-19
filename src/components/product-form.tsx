import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';

import { BarcodeScannerModal } from '@/components/barcode-scanner';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { uploadProductImage } from '@/lib/actions/products';
import { createCategory, createSupplier } from '@/lib/actions/inventory';
import { generateEan13 } from '@/lib/barcode';
import { useCategories, useSuppliers, useWarehouses } from '@/lib/hooks/use-products';
import { productFormSchema, type ProductFormInput } from '@/lib/validation/products';

// Shared by (app)/inventory/new.tsx (create) and (app)/inventory/[id]/edit.tsx
// (edit) — same field set either way, only the submit action and whether
// "opening quantity" applies differ, per Inventra/components/products/
// ProductFormFields.tsx.
export function ProductForm({
  orgId,
  defaultValues,
  showOpeningQty,
  submitLabel,
  onSubmit,
}: {
  orgId: string;
  defaultValues: Partial<ProductFormInput>;
  showOpeningQty: boolean;
  submitLabel: string;
  onSubmit: (values: ProductFormInput, imageUrl: string | undefined) => Promise<void>;
}) {
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoriesQuery = useCategories();
  const suppliersQuery = useSuppliers();
  const warehousesQuery = useWarehouses();

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<ProductFormInput>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: '',
      description: '',
      sku: '',
      barcode: '',
      unit: 'each',
      costPrice: '0',
      sellPrice: '0',
      reorderLevel: '0',
      openingQty: '0',
      ...defaultValues,
    },
  });

  const skuValue = watch('sku');

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Photo library access is needed to add a product photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  }

  async function handleFormSubmit(values: ProductFormInput) {
    setError(null);
    try {
      let imageUrl: string | undefined;
      if (photoUri) {
        setUploading(true);
        imageUrl = await uploadProductImage(photoUri, orgId);
        setUploading(false);
      }
      await onSubmit(values, imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setUploading(false);
    }
  }

  return (
    <>
      <ScrollView contentContainerClassName="gap-3.5 p-5" keyboardShouldPersistTaps="handled">
        <Pressable onPress={pickPhoto} className="items-center">
          {photoUri ? (
            <Image source={{ uri: photoUri }} className="h-24 w-24 rounded-2xl" />
          ) : (
            <View className="h-24 w-24 items-center justify-center rounded-2xl border border-dashed border-border bg-surface dark:border-border-dark dark:bg-surface-dark">
              <Text className="text-[24px]">📷</Text>
              <Text className="mt-1 text-[10.5px] font-semibold text-text-2 dark:text-text-2-dark">Add photo</Text>
            </View>
          )}
        </Pressable>

        <Controller
          control={control}
          name="name"
          render={({ field, fieldState }) => (
            <TextField label="Product name" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
          )}
        />
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <TextField label="Description (optional)" value={field.value} onChangeText={field.onChange} multiline />
          )}
        />

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Controller
              control={control}
              name="sku"
              render={({ field, fieldState }) => (
                <TextField
                  label="SKU"
                  autoCapitalize="characters"
                  value={field.value}
                  onChangeText={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
          </View>
          <View className="flex-1">
            <Controller
              control={control}
              name="unit"
              render={({ field }) => <TextField label="Unit" value={field.value} onChangeText={field.onChange} />}
            />
          </View>
        </View>

        <Controller
          control={control}
          name="barcode"
          render={({ field }) => (
            <View>
              <TextField label="Barcode (optional)" value={field.value} onChangeText={field.onChange} className="pr-28" />
              <View className="absolute right-2 top-[27px] flex-row gap-3">
                <Pressable onPress={() => setScannerOpen(true)} hitSlop={8}>
                  <Text className="text-[12px] font-semibold text-accent-text dark:text-accent-text-dark">Scan</Text>
                </Pressable>
                <Pressable onPress={() => field.onChange(generateEan13(skuValue))} hitSlop={8}>
                  <Text className="text-[12px] font-semibold text-accent-text dark:text-accent-text-dark">Generate</Text>
                </Pressable>
              </View>
            </View>
          )}
        />

        <Controller
          control={control}
          name="brand"
          render={({ field }) => <TextField label="Brand (optional)" value={field.value ?? ''} onChangeText={field.onChange} />}
        />

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Controller
              control={control}
              name="costPrice"
              render={({ field, fieldState }) => (
                <TextField
                  label="Cost price"
                  keyboardType="decimal-pad"
                  value={field.value}
                  onChangeText={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
          </View>
          <View className="flex-1">
            <Controller
              control={control}
              name="sellPrice"
              render={({ field, fieldState }) => (
                <TextField
                  label="Sell price"
                  keyboardType="decimal-pad"
                  value={field.value}
                  onChangeText={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
          </View>
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Controller
              control={control}
              name="reorderLevel"
              render={({ field, fieldState }) => (
                <TextField
                  label="Reorder level"
                  keyboardType="number-pad"
                  value={field.value}
                  onChangeText={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
          </View>
          {showOpeningQty && (
            <View className="flex-1">
              <Controller
                control={control}
                name="openingQty"
                render={({ field, fieldState }) => (
                  <TextField
                    label="Opening quantity"
                    keyboardType="number-pad"
                    value={field.value}
                    onChangeText={field.onChange}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </View>
          )}
        </View>

        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <PickerWithInlineAdd
              label="Category"
              value={field.value}
              options={(categoriesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
              onChange={field.onChange}
              onCreate={async (name) => {
                const cat = await createCategory(name);
                await categoriesQuery.refetch();
                setValue('categoryId', cat.id);
              }}
              addLabel="+ New category"
            />
          )}
        />

        <Controller
          control={control}
          name="supplierId"
          render={({ field }) => (
            <PickerWithInlineAdd
              label="Supplier"
              value={field.value}
              options={(suppliersQuery.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
              onChange={field.onChange}
              onCreate={async (name) => {
                const sup = await createSupplier(name);
                await suppliersQuery.refetch();
                setValue('supplierId', sup.id);
              }}
              addLabel="+ New supplier"
            />
          )}
        />

        {(warehousesQuery.data ?? []).length > 0 && (
          <Controller
            control={control}
            name="warehouseId"
            render={({ field }) => (
              <SelectField
                label="Warehouse"
                placeholder="Select warehouse…"
                value={field.value ?? ''}
                options={(warehousesQuery.data ?? []).map((w) => ({ value: w.id, label: w.name }))}
                onChange={field.onChange}
              />
            )}
          />
        )}

        {error && <Text className="text-[13px] font-medium text-red dark:text-red-dark">{error}</Text>}

        <Button loading={isSubmitting || uploading} onPress={handleSubmit(handleFormSubmit)} className="mt-2">
          {uploading ? 'Uploading photo…' : submitLabel}
        </Button>
      </ScrollView>

      <BarcodeScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(code) => {
          setValue('barcode', code);
          setScannerOpen(false);
        }}
      />
    </>
  );
}

function PickerWithInlineAdd({
  label,
  value,
  options,
  onChange,
  onCreate,
  addLabel,
}: {
  label: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  onCreate: (name: string) => Promise<void>;
  addLabel: string;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <View>
      <SelectField label={label} placeholder={`Select ${label.toLowerCase()}…`} searchable value={value ?? ''} options={options} onChange={onChange} />
      {adding ? (
        <View className="mt-2">
          <View className="flex-row items-center gap-2">
            <View className="flex-1">
              <TextField placeholder={`New ${label.toLowerCase()} name`} value={newName} onChangeText={setNewName} autoFocus />
            </View>
            {busy ? (
              <ActivityIndicator />
            ) : (
              <>
                <Pressable
                  onPress={async () => {
                    if (!newName.trim()) return;
                    setBusy(true);
                    setError(null);
                    try {
                      await onCreate(newName.trim());
                      setAdding(false);
                      setNewName('');
                    } catch (err) {
                      setError(err instanceof Error ? err.message : `Could not create this ${label.toLowerCase()}.`);
                    } finally {
                      setBusy(false);
                    }
                  }}
                  hitSlop={8}
                >
                  <Text className="text-[13px] font-semibold text-accent-text dark:text-accent-text-dark">Save</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setAdding(false);
                    setNewName('');
                    setError(null);
                  }}
                  hitSlop={8}
                >
                  <Text className="text-[13px] font-semibold text-text-2 dark:text-text-2-dark">Cancel</Text>
                </Pressable>
              </>
            )}
          </View>
          {error && <Text className="mt-1 text-[12px] font-medium text-red dark:text-red-dark">{error}</Text>}
        </View>
      ) : (
        <Pressable onPress={() => setAdding(true)} className="mt-1.5">
          <Text className="text-[12.5px] font-semibold text-accent-text dark:text-accent-text-dark">{addLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
