import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ProductForm } from "@/components/product-form";
import { createProduct } from "@/lib/actions/products";
import { useAuth } from "@/lib/auth-context";
import { haptics } from "@/lib/haptics";
import { useOrgId } from "@/lib/hooks/use-org";
import type { ProductFormInput } from "@/lib/validation/products";

// Mirrors Inventra/components/products/AddProductModal.tsx — same fields
// (via the shared ProductForm), condensed to a single scrollable mobile
// screen instead of a modal. Manager+ role is enforced server-side
// (createProduct throws) as well as by RLS.
export default function NewProductScreen() {
  const { session } = useAuth();
  const orgId = useOrgId();

  async function handleSubmit(
    values: ProductFormInput,
    imageUrl: string | undefined,
  ) {
    const id = await createProduct({
      name: values.name,
      description: values.description,
      sku: values.sku,
      barcode: values.barcode,
      categoryId: values.categoryId,
      unit: values.unit,
      costPrice: Number(values.costPrice),
      sellPrice: Number(values.sellPrice),
      reorderLevel: Number(values.reorderLevel),
      supplierId: values.supplierId,
      warehouseId: values.warehouseId,
      openingQty: Number(values.openingQty),
      imageUrl,
    });
    haptics.success();
    router.replace(`/inventory/${id}`);
  }

  if (!session || !orgId) return null;

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          hitSlop={10}
        >
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">
            Cancel
          </Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">
          New Product
        </Text>
        <View className="w-14" />
      </View>

      <ProductForm
        orgId={orgId}
        defaultValues={{}}
        showOpeningQty
        submitLabel="Create product"
        onSubmit={handleSubmit}
      />
    </SafeAreaView>
  );
}
