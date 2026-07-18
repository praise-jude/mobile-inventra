import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';

export interface PaystackMessage {
  type: 'success' | 'cancel' | 'error';
  reference?: string;
  message?: string;
}

// Paystack Inline v2, run inside a WebView and driven via resumeTransaction
// so checkout completes through in-page onSuccess/onCancel callbacks — no
// external browser redirect or deep link needed for the common case.
// callback_url (still set server-side, see Inventra's initiateAddCardForContext)
// only matters as a fallback for issuers that force a full-page 3D Secure
// redirect away from the popup; onNavigationStateChange below catches that.
function checkoutHtml(accessCode: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="https://js.paystack.co/v2/inline.js"></script>
</head>
<body style="margin:0;background:#f8fafc;">
<script>
  function postToRN(payload) {
    window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }
  try {
    var popup = new PaystackPop();
    popup.resumeTransaction(${JSON.stringify(accessCode)}, {
      onSuccess: function (transaction) {
        postToRN({ type: 'success', reference: transaction && transaction.reference });
      },
      onCancel: function () {
        postToRN({ type: 'cancel' });
      },
      onError: function (error) {
        postToRN({ type: 'error', message: error && error.message });
      }
    });
  } catch (e) {
    postToRN({ type: 'error', message: String(e) });
  }
</script>
</body>
</html>`;
}

// Shared by the onboarding "add card & start trial" step and the (billing)
// subscription-required screen's "renew"/"update card" actions — both kick
// off a Paystack Inline checkout the exact same way, just for different
// reasons, so this owns the WebView/Modal plumbing once.
export function PaystackCheckoutModal({
  accessCode,
  title = 'Secure checkout',
  onClose,
  onMessage,
  onCallbackUrlHit,
}: {
  accessCode: string | null;
  title?: string;
  onClose: () => void;
  onMessage: (payload: PaystackMessage) => void;
  onCallbackUrlHit: () => void;
}) {
  function handleWebViewMessage(event: WebViewMessageEvent) {
    let payload: PaystackMessage;
    try {
      payload = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    onMessage(payload);
  }

  function handleNavigationStateChange(navState: WebViewNavigation) {
    // Fallback for card issuers whose 3D Secure flow forces a full-page
    // redirect out of the popup — Paystack lands here afterward with
    // ?reference=... on success.
    if (navState.url.includes('/onboarding/plan/callback')) {
      onCallbackUrlHit();
    }
  }

  return (
    <Modal visible={!!accessCode} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
          <Text className="text-[16px] font-bold text-text dark:text-text-dark">{title}</Text>
          <Pressable onPress={onClose}>
            <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Cancel</Text>
          </Pressable>
        </View>
        {accessCode && (
          <WebView
            source={{ html: checkoutHtml(accessCode) }}
            onMessage={handleWebViewMessage}
            onNavigationStateChange={handleNavigationStateChange}
            startInLoadingState
            renderLoading={() => (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" />
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
