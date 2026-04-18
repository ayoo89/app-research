// ── Fake timers ────────────────────────────────────────────────────
// Belt-and-suspenders: prevents any remaining RAF/setTimeout animation
// callbacks from running between module load and first test.
jest.useFakeTimers();
global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = () => {};

// ── Reanimated mock ────────────────────────────────────────────────
// Minimal zero-timer mock — avoids the real Reanimated worklet engine which leaks
// memory at ~28 MB/s during tests (entering= animations run real timers indefinitely).
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');

  const noOp = () => ({});
  const passthrough = (v: any) => v;
  const animDef = { duration: () => animDef, delay: () => animDef, easing: () => animDef };

  const Animated = {
    View:       ({ entering: _e, exiting: _ex, layout: _l, ...p }: any) => React.createElement(View, p),
    Text:       ({ entering: _e, exiting: _ex, ...p }: any) => React.createElement(View, p),
    ScrollView: ({ entering: _e, exiting: _ex, ...p }: any) => React.createElement(View, p),
    FlatList:   ({ entering: _e, exiting: _ex, ...p }: any) => React.createElement(View, p),
    Image:      ({ entering: _e, exiting: _ex, ...p }: any) => React.createElement(View, p),
  };

  return {
    __esModule: true,
    default: Animated,
    Animated,
    useAnimatedStyle: noOp,
    useSharedValue: (v: any) => ({ value: v }),
    useDerivedValue: (fn: any) => ({ value: fn() }),
    useAnimatedScrollHandler: noOp,
    useAnimatedRef: () => ({ current: null }),
    useAnimatedGestureHandler: noOp,
    withTiming: passthrough,
    withSpring: passthrough,
    withRepeat: passthrough,
    withSequence: (...args: any[]) => args[0],
    withDelay: (_: any, v: any) => v,
    cancelAnimation: jest.fn(),
    runOnJS: (fn: any) => fn,
    runOnUI: (fn: any) => fn,
    interpolate: (_v: any, _i: any, o: any) => o[0],
    Extrapolation: { CLAMP: 'CLAMP', EXTEND: 'EXTEND', IDENTITY: 'IDENTITY' },
    FadeIn: animDef, FadeOut: animDef,
    FadeInDown: animDef, FadeInUp: animDef,
    FadeOutDown: animDef, FadeOutUp: animDef,
    SlideInLeft: animDef, SlideOutLeft: animDef,
    SlideInRight: animDef, SlideOutRight: animDef,
    ZoomIn: animDef, ZoomOut: animDef,
    Layout: animDef,
  };
});

// ── AsyncStorage mock ──────────────────────────────────────────────
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// ── NetInfo mock ───────────────────────────────────────────────────
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
  useNetInfo: jest.fn(() => ({ isConnected: true })),
}));

// ── Safe area context mock ─────────────────────────────────────────
jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }: any) => children,
    SafeAreaView: ({ children }: any) => children,
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
    initialWindowMetrics: { insets: inset, frame: { x: 0, y: 0, width: 390, height: 844 } },
  };
});

// ── Toast mock ─────────────────────────────────────────────────────
jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: () => null,
  show: jest.fn(),
  hide: jest.fn(),
}));

// ── Heavy RN component mocks ───────────────────────────────────────
// ActivityIndicator, RefreshControl, and FlatList all register native
// animation nodes and event listeners that are never cleaned up in the
// test environment, causing ~30 MB/s heap growth. Replace with static
// View stubs so no animation or native state is created.
jest.mock(
  'react-native/Libraries/Components/ActivityIndicator/ActivityIndicator',
  () => {
    const React = require('react');
    const { View } = require('react-native');
    // Uses `export default` — must return { __esModule, default }
    return { __esModule: true, default: ({ testID }: any) => React.createElement(View, { testID }) };
  },
);

jest.mock(
  'react-native/Libraries/Components/RefreshControl/RefreshControl',
  () => {
    const React = require('react');
    const { View } = require('react-native');
    // Uses `module.exports = RefreshControl` — return component directly
    return ({ testID }: any) => React.createElement(View, { testID });
  },
);

jest.mock('react-native/Libraries/Lists/FlatList', () => {
  const React = require('react');
  const { View } = require('react-native');
  // Uses `module.exports = FlatList` — return component directly.
  // Renders all items statically so findByTestId/findByText still work.
  const FlatList = ({
    data = [],
    renderItem,
    keyExtractor,
    ListHeaderComponent,
    ListEmptyComponent,
    ListFooterComponent,
  }: any) => {
    const asElement = (C: any) => {
      if (!C) return null;
      return typeof C === 'function' ? React.createElement(C) : C;
    };
    const items =
      data.length > 0
        ? data.map((item: any, index: number) =>
            React.createElement(
              View,
              { key: keyExtractor ? keyExtractor(item, index) : String(index) },
              renderItem({ item, index }),
            ),
          )
        : asElement(ListEmptyComponent);
    return React.createElement(
      View,
      null,
      asElement(ListHeaderComponent),
      items,
      asElement(ListFooterComponent),
    );
  };
  return FlatList;
});

// ── Timer and GC cleanup ───────────────────────────────────────────
beforeEach(() => {
  // Reset fake timers for each test so leftover RAF chains from the
  // previous test don't carry over.
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  if (typeof (global as any).gc === 'function') (global as any).gc();
});

// ── expo-document-picker mock ─────────────────────────────────────
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(() => Promise.resolve({ canceled: true, assets: [] })),
}));

// ── expo-sharing mock ──────────────────────────────────────────────
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));

// ── Expo modules mocks ─────────────────────────────────────────────
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'Success', Warning: 'Warning', Error: 'Error' },
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0', name: 'ProductSearch' } },
}));

jest.mock('expo-image', () => ({
  Image: 'Image',
}));

jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  Camera: {
    requestCameraPermissionsAsync: jest.fn(() =>
      Promise.resolve({ status: 'granted' }),
    ),
  },
  useCameraPermissions: jest.fn(() => [{ granted: true }, jest.fn()]),
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(() =>
    Promise.resolve({ canceled: false, assets: [{ uri: 'mock://image.jpg' }] }),
  ),
  MediaTypeOptions: { Images: 'Images' },
  UIImagePickerPresentationStyle: { FullScreen: 'FullScreen' },
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(() =>
    Promise.resolve({ base64: 'bW9jaw==', uri: 'mock://manipulated.jpg' }),
  ),
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
}));
