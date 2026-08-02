import { Component, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// App-wide safety net for render-time crashes outside of a screen's own
// query-error handling (see error-state.tsx's comment referencing this) —
// a TypeError/null-deref during render currently has nothing catching it
// and would show a blank/red screen instead of a recovery UI. Wrapped
// once around the whole app in _layout.tsx.
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('[Royal Inventra] Unhandled render error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <View className="flex-1 items-center justify-center gap-4 bg-bg px-8 py-14 dark:bg-bg-dark">
          <View className="h-[52px] w-[52px] items-center justify-center rounded-xl bg-red-weak dark:bg-red-weak-dark">
            <Text className="text-[26px]">⚠️</Text>
          </View>
          <View>
            <Text className="text-center text-[18px] font-bold text-text dark:text-text-dark">Something went wrong</Text>
            <Text className="mt-1.5 max-w-[320px] text-center text-[13px] text-text-2 dark:text-text-2-dark">
              The app hit an unexpected error. Try again — if it keeps happening, restart the app.
            </Text>
          </View>
          <Button onPress={this.handleReset}>Try again</Button>
        </View>
      );
    }
    return this.props.children;
  }
}
