import React, { useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { useNetworkStore } from '../store/networkStore';
import { useI18n } from '../i18n';
import LoginScreen from '../screens/LoginScreen';
import SearchScreen from '../screens/SearchScreen';
import ScannerScreen from '../screens/ScannerScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import { colors, typography, hitSlop } from '../theme';

const Stack = createNativeStackNavigator();

const styles = StyleSheet.create({
  splash: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.bg,
    paddingHorizontal: 32,
  },
  splashLogo: {
    width: 88, height: 88, borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  splashIcon:  { fontSize: 40 },
  splashTitle: { ...typography.h2, marginBottom: 8, textAlign: 'center' },
  splashSub:   { ...typography.small, color: colors.textMuted, textAlign: 'center', marginBottom: 24 },
  splashSpinner: { marginTop: 8 },
  logoutBtn:   { paddingHorizontal: 10, paddingVertical: 6 },
  logoutText:  { color: 'rgba(255,255,255,0.92)', fontSize: 15, fontWeight: '600' },
});

export default function AppNavigator() {
  const { t } = useI18n();
  const { user, isLoading, loadSession, logout } = useAuthStore();
  const startMonitoring = useNetworkStore((s) => s.startMonitoring);

  const headerRight = useCallback(
    () => (
      <TouchableOpacity
        onPress={logout}
        style={styles.logoutBtn}
        hitSlop={hitSlop}
        accessibilityLabel={t('nav_logoutA11y')}
        accessibilityRole="button"
      >
        <Text style={styles.logoutText}>{t('nav_logout')}</Text>
      </TouchableOpacity>
    ),
    [logout, t],
  );

  useEffect(() => {
    loadSession();
    const stop = startMonitoring();
    return stop;
  }, []);

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <View style={styles.splash}>
          <View style={styles.splashLogo}>
            <Text style={styles.splashIcon}>🔍</Text>
          </View>
          <Text style={styles.splashTitle}>{t('splash_title')}</Text>
          <Text style={styles.splashSub}>{t('splash_subtitle')}</Text>
          <ActivityIndicator size="large" color={colors.primary} style={styles.splashSpinner} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: colors.primary,
              elevation: 0,
              shadowOpacity: 0,
              borderBottomWidth: 0,
            },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '700', fontSize: 18, letterSpacing: -0.3 },
            headerShadowVisible: false,
            headerBackTitleVisible: false,
            animation: 'slide_from_right',
          }}
        >
          {!user ? (
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
          ) : (
            <>
              <Stack.Screen
                name="Search"
                component={SearchScreen}
                options={{
                  title: t('nav_search'),
                  headerRight,
                }}
              />
              <Stack.Screen
                name="Scanner"
                component={ScannerScreen}
                options={{
                  title: t('nav_scanner_title'),
                  presentation: 'fullScreenModal',
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="ProductDetail"
                component={ProductDetailScreen}
                options={{ title: t('nav_productDetail') }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
