import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Colors } from '@/constants/theme';

const DURATION = 600;

// Same brand mark used for the app icon (assets/images/icon.png) and Android
// adaptive-icon foreground — extracted from Inventra/public/inventra-logo.svg
// so the splash reads as the same product as the web app, not Expo's default.
const LOGO = require('@/assets/images/brand-logo.png');

export function AnimatedSplashOverlay() {
  const [animate, setAnimate] = useState(false);
  const [visible, setVisible] = useState(true);
  const scheme = useColorScheme();
  const bg = Colors[scheme === 'dark' ? 'dark' : 'light'].background;

  if (!visible) return null;

  const splashKeyframe = new Keyframe({
    0: {
      transform: [{ scale: 1 }],
      opacity: 1,
    },
    20: {
      opacity: 1,
    },
    70: {
      opacity: 0,
      easing: Easing.elastic(0.7),
    },
    100: {
      opacity: 0,
      transform: [{ scale: 1 }],
      easing: Easing.elastic(0.7),
    },
  });

  const image = <Image style={styles.image} source={LOGO} contentFit="contain" />;

  return animate ? (
    <Animated.View
      entering={splashKeyframe.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      })}
      style={[styles.splashOverlay, { backgroundColor: bg }]}>
      {image}
    </Animated.View>
  ) : (
    <View
      onLayout={() => {
        SplashScreen.hideAsync().finally(() => {
          setAnimate(true);
        });
      }}
      style={[styles.splashOverlay, { backgroundColor: bg }]}>
      {image}
    </View>
  );
}

const logoKeyframe = new Keyframe({
  0: {
    transform: [{ scale: 1.3 }],
    opacity: 0,
  },
  40: {
    transform: [{ scale: 1.3 }],
    opacity: 0,
    easing: Easing.elastic(0.7),
  },
  100: {
    opacity: 1,
    transform: [{ scale: 1 }],
    easing: Easing.elastic(0.7),
  },
});

const glowKeyframe = new Keyframe({
  0: {
    transform: [{ rotateZ: '0deg' }],
  },
  100: {
    transform: [{ rotateZ: '7200deg' }],
  },
});

// A larger, standalone version of the brand mark with the same
// glow/entrance choreography as the splash — reused as the hero moment on
// the onboarding carousel's final "Get Started" page.
export function AnimatedIcon() {
  return (
    <View style={styles.iconContainer}>
      <Animated.View entering={glowKeyframe.duration(60 * 1000 * 4)} style={styles.glow} />
      <Animated.View style={styles.imageContainer} entering={logoKeyframe.duration(DURATION)}>
        <Image style={styles.image} source={LOGO} contentFit="contain" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    width: 220,
    height: 220,
    borderRadius: 110,
    position: 'absolute',
    // Flat translucent circle rather than a radial-gradient falloff — RN's
    // `experimental_backgroundImage` (which supports radial-gradient()) is
    // native-only and doesn't render on web; a solid low-opacity fill reads
    // as a soft glow on every platform without extra assets or libraries.
    backgroundColor: 'rgba(37,99,235,0.18)',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 168,
    height: 168,
    zIndex: 100,
  },
  image: {
    width: 148,
    height: 146,
  },
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
});
