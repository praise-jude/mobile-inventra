import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { haptics } from '@/lib/haptics';

// Native camera-based scanner replacing web's html5-qrcode (browser-only).
// expo-camera's built-in barcode scanning covers the same symbologies the
// web app supports (EAN-13/8, UPC-A/E, Code128/39, QR) with no extra
// native module beyond expo-camera itself.
export function BarcodeScannerModal({ visible, onClose, onScan }: { visible: boolean; onClose: () => void; onScan: (code: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  function handleScanned(result: { data: string }) {
    if (scanned) return;
    setScanned(true);
    haptics.success();
    onScan(result.data);
  }

  function handleClose() {
    setScanned(false);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView className="flex-1 bg-black">
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text className="text-[16px] font-bold text-white">Scan barcode</Text>
          <Pressable onPress={handleClose} hitSlop={10}>
            <Text className="text-[14px] font-semibold text-white">Cancel</Text>
          </Pressable>
        </View>

        {!permission ? null : !permission.granted ? (
          <View className="flex-1 items-center justify-center gap-4 px-8">
            <Text className="text-center text-[14px] text-white">
              Camera access is needed to scan barcodes.
            </Text>
            <Button onPress={requestPermission}>Grant camera access</Button>
          </View>
        ) : (
          <View className="flex-1">
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'],
              }}
              onBarcodeScanned={scanned ? undefined : handleScanned}
            />
            <View className="absolute inset-x-0 bottom-0 items-center pb-10">
              <View className="h-[120px] w-[260px] rounded-2xl border-2 border-white/80" />
              <Text className="mt-4 text-[12.5px] text-white/80">Align the barcode within the frame</Text>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}
