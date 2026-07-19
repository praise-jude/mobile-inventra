import { Alert, Platform } from 'react-native';

type AlertButton = { text: string; style?: 'cancel' | 'destructive' | 'default'; onPress?: () => void };

// react-native-web's Alert.alert (node_modules/react-native-web/src/exports/Alert)
// is a no-op stub — any Alert.alert(title, message, [Cancel, Confirm]) built on
// it silently does nothing on web (the dialog never renders, so onPress never
// fires). Falls back to window.confirm there, same call shape as Alert.alert
// so call sites don't need restructuring, just this import swapped in.
export function confirmAlert(title: string, message: string, buttons: AlertButton[]): void {
  if (Platform.OS === 'web') {
    const confirmBtn = buttons.find((b) => b.style !== 'cancel');
    if (window.confirm(`${title}\n\n${message}`)) {
      confirmBtn?.onPress?.();
    }
    return;
  }
  Alert.alert(title, message, buttons);
}

// Same web gap as above, for a plain info/error alert with no buttons.
export function notifyAlert(title: string, message: string): void {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}
