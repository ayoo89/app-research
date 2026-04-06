import React from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import AppNavigator from './src/navigation/AppNavigator';
import { colors } from './src/theme';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <AppNavigator />
      <Toast
        position="bottom"
        bottomOffset={60}
        visibilityTime={3000}
      />
    </GestureHandlerRootView>
  );
}
