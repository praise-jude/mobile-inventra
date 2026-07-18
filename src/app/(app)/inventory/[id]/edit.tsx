import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProductForm } from '@/components/product-form';
import { Button } from '@/components/ui/button';
import { updateProduct } from '@/lib/actions/products';
import { haptics } from '@/lib/haptics';
import { useOrgId } from '@/lib/hooks/use-org';
import { useProduct } from '@/lib/hooks/use-products';
import type { ProductFormInput } from '@/lib/validation/products';

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const orgId = useOrgId();
  const productQuery = useProduct(id ?? null);
  const queryClient = useQueryClient();

  async function handleSubmit(values: ProductFormInput, imageUrl: string | undefined) {
    await updateProduct(id!, {
      name: values.name,
      description: values.description,
      sku: values.sku,
      barcode: values.barcode,
      categoryId: values.categoryId,
      unit: values.unit,
      brand: values.brand,
      costPrice: Number(values.costPrice),
      sellPrice: Number(values.sellPrice),
      reorderLevel: Number(values.reorderLevel),
      supplierId: values.supplierId,
      warehouseId: values.warehouseId,
      imageUrl: imageUrl ?? productQuery.data?.image_url ?? undefined,
    });
    haptics.success();
    queryClient.invalidateQueries({ queryKey: ['product', id] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
    router.back();
  }

  if (productQuery.isLoading || !orgId) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg dark:bg-bg-dark">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (productQuery.isError || !productQuery.data) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-bg px-6 dark:bg-bg-dark">
        <Text className="text-[14px] text-text-2 dark:text-text-2-dark">Could not load this product.</Text>
        <Button onPress={() => router.back()}>Go back</Button>
      </SafeAreaView>
    );
  }

  const p = productQuery.data;

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Cancel</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">Edit Product</Text>
        <View className="w-14" />
      </View>

      <ProductForm
        orgId={orgId}
        showOpeningQty={false}
        submitLabel="Save changes"
        onSubmit={handleSubmit}
        defaultValues={{
          name: p.name,
          description: p.description ?? '',
          sku: p.sku,
          barcode: p.barcode ?? '',
          categoryId: p.category_id ?? undefined,
          unit: p.unit,
          brand: p.brand ?? '',
          costPrice: String(p.cost_price),
          sellPrice: String(p.sell_price),
          reorderLevel: String(p.reorder_level),
          supplierId: p.supplier_id ?? undefined,
          warehouseId: p.warehouse_id ?? undefined,
        }}
      />
    </SafeAreaView>
  );
}
