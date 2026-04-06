import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { useNetworkStore } from '../store/networkStore';
import LoginScreen from '../screens/LoginScreen';
import SearchScreen from '../screens/SearchScreen';
import ScannerScreen from '../screens/ScannerScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import { colors, typography } from '../theme';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { user, isLoading, loadSession, logout } = useAuthStore();
  const startMonitoring = useNetworkStore((s) => s.startMonitoring);

  useEffect(() => {
    loadSession();
    const stop = startMonitoring();
    return stop;
  }, []);

  if (isLoading) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashIcon}>🔍</Text>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle:     { backgroundColor: colors.primary },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '600', fontSize: 17 },
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
                  title: 'Product Search',
                  headerRight: () => (
                    <TouchableOpacity
                      onPress={logout}
                      style={styles.logoutBtn}
                      accessibilityLabel="Sign out"
                      accessibilityRole="button"
                    >
                      <Text style={styles.logoutText}>Sign out</Text>
                    </TouchableOpacity>
                  ),
                }}
              />
              <Stack.Screen
                name="Scanner"
                component={ScannerScreen}
                options={{
                  title: 'Scan Barcode',
                  presentation: 'fullScreenModal',
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="ProductDetail"
                component={ProductDetailScreen}
                options={{ title: 'Product Details' }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.bg,
  },
  splashIcon:  { fontSize: 52 },
  logoutBtn:   { paddingHorizontal: 8, paddingVertical: 4 },
  logoutText:  { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
});
