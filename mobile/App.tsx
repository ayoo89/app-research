import React from 'react';
import { StatusBar, View } from 'react-native';
import Toast from 'react-native-toast-message';
import AppNavigator from './src/navigation/AppNavigator';
import { I18nProvider } from './src/i18n';
import { colors } from './src/theme';

export default function App() {
  return (
    <I18nProvider>
      <View style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
        <AppNavigator />
        <Toast
          position="bottom"
          bottomOffset={52}
          visibilityTime={2800}
          topOffset={48}
        />
      </View>
    </I18nProvider>
  );
}
