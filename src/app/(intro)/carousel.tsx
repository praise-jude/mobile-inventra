import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedIcon } from '@/components/animated-icon';
import { OnboardingPage } from '@/components/onboarding-page';
import { BranchesPanel, InsightsPanel, InventoryPanel, PosPanel } from '@/components/onboarding-panels';
import { Button } from '@/components/ui/button';
import { useIntroSeen } from '@/lib/first-launch';
import { haptics } from '@/lib/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PAGES = [
  {
    key: 'inventory',
    title: 'Manage Your Inventory',
    bullets: ['Track products effortlessly', 'Monitor stock in real time'],
    panel: <InventoryPanel />,
  },
  {
    key: 'pos',
    title: 'Smart Sales & POS',
    bullets: ['Fast checkout', 'Barcode scanning', 'Digital receipts'],
    panel: <PosPanel />,
  },
  {
    key: 'insights',
    title: 'Business Insights',
    bullets: ['Sales analytics', 'Profit tracking', 'Inventory reports'],
    panel: <InsightsPanel />,
  },
  {
    key: 'branches',
    title: 'Multi-Branch Management',
    bullets: ['Manage multiple stores', 'Staff permissions', 'Team collaboration'],
    panel: <BranchesPanel />,
  },
];

const PAGE_COUNT = PAGES.length + 1; // + the final "Get Started" page

export default function OnboardingCarousel() {
  const router = useRouter();
  const { markSeen } = useIntroSeen();
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useSharedValue(0);
  const [index, setIndex] = useState(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  function goTo(i: number) {
    scrollRef.current?.scrollTo({ x: i * SCREEN_WIDTH, animated: true });
    setIndex(i);
  }

  function handleMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH));
  }

  function handleSkip() {
    haptics.tap();
    goTo(PAGE_COUNT - 1);
  }

  function enterAuth(path: '/(auth)/login' | '/(auth)/signup') {
    haptics.select();
    markSeen();
    router.replace(path);
  }

  const isLast = index === PAGE_COUNT - 1;

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="h-11 flex-row justify-end px-5">
        {!isLast && (
          <Pressable onPress={handleSkip} hitSlop={10} className="px-3 py-2">
            <Text className="text-[14px] font-semibold text-text-2 dark:text-text-2-dark">Skip</Text>
          </Pressable>
        )}
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleMomentumEnd}
      >
        {PAGES.map((p) => (
          <OnboardingPage key={p.key} title={p.title} bullets={p.bullets} panel={p.panel} />
        ))}
        <FinalPage
          onCreateAccount={() => enterAuth('/(auth)/signup')}
          onSignIn={() => enterAuth('/(auth)/login')}
        />
      </Animated.ScrollView>

      <View className="flex-row items-center justify-center gap-2 py-4">
        {Array.from({ length: PAGE_COUNT }).map((_, i) => (
          <Dot key={i} index={i} scrollX={scrollX} />
        ))}
      </View>

      {!isLast && (
        <View className="flex-row gap-3 px-6 pb-4">
          {index > 0 && (
            <Button
              variant="secondary"
              className="flex-1"
              onPress={() => {
                haptics.tap();
                goTo(index - 1);
              }}
            >
              Previous
            </Button>
          )}
          <Button
            className="flex-1"
            onPress={() => {
              haptics.tap();
              goTo(index + 1);
            }}
          >
            Next
          </Button>
        </View>
      )}
    </SafeAreaView>
  );
}

function Dot({ index, scrollX }: { index: number; scrollX: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const input = [(index - 1) * SCREEN_WIDTH, index * SCREEN_WIDTH, (index + 1) * SCREEN_WIDTH];
    return {
      width: interpolate(scrollX.value, input, [8, 22, 8], Extrapolation.CLAMP),
      opacity: interpolate(scrollX.value, input, [0.35, 1, 0.35], Extrapolation.CLAMP),
    };
  });

  return <Animated.View style={style} className="h-2 rounded-full bg-accent dark:bg-accent-dark" />;
}

function FinalPage({ onCreateAccount, onSignIn }: { onCreateAccount: () => void; onSignIn: () => void }) {
  return (
    <View style={{ width: SCREEN_WIDTH }} className="flex-1 items-center justify-center px-6">
      <AnimatedIcon />
      <Text className="mt-6 text-center text-[26px] font-bold tracking-tight text-text dark:text-text-dark">
        Welcome to Royal Inventra
      </Text>
      <Text className="mt-2 max-w-[300px] text-center text-[14px] text-text-2 dark:text-text-2-dark">
        Inventory, sales, and insights for your business — everywhere you go.
      </Text>

      <View className="mt-10 w-full gap-3">
        <Button onPress={onCreateAccount}>Create Account</Button>
        <Button variant="secondary" onPress={onSignIn}>
          Sign In
        </Button>
      </View>
    </View>
  );
}
