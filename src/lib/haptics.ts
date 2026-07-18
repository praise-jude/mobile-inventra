import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Thin wrappers so call sites don't need to remember Haptics isn't
// available on web (expo-haptics no-ops there anyway, but Platform.OS
// check avoids the native-module warning it logs on every call).
export const haptics = {
  tap: () => {
    if (Platform.OS === 'web') return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  select: () => {
    if (Platform.OS === 'web') return;
    void Haptics.selectionAsync();
  },
  success: () => {
    if (Platform.OS === 'web') return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  warning: () => {
    if (Platform.OS === 'web') return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },
};
