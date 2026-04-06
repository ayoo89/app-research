import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
  TouchableOpacity, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import Button from '../components/Button';
import { colors, spacing, radius, typography, shadow } from '../theme';

export default function LoginScreen() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const shakeAnim   = useRef(new Animated.Value(0)).current;
  const login = useAuthStore((s) => s.login);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Please fill in both fields');
      shake();
      return;
    }
    if (!trimmedEmail.includes('@')) {
      setError('Enter a valid email address');
      shake();
      return;
    }

    setLoading(true);
    setError('');
    try {
      await login(trimmedEmail, password);
    } catch (e: any) {
      const msg = e.message ?? 'Login failed. Check your credentials.';
      setError(msg);
      shake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo / Brand */}
          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoIcon}>🔍</Text>
            </View>
            <Text style={styles.title}>Product Search</Text>
            <Text style={styles.subtitle}>Sign in to continue</Text>
          </View>

          {/* Form */}
          <Animated.View style={[styles.card, shadow.md, { transform: [{ translateX: shakeAnim }] }]}>
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️  {error}</Text>
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@company.com"
              placeholderTextColor={colors.placeholder}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              value={email}
              onChangeText={(v) => { setEmail(v); setError(''); }}
              onSubmitEditing={() => passwordRef.current?.focus()}
              accessibilityLabel="Email address"
            />

            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                ref={passwordRef}
                style={[styles.input, styles.passwordInput]}
                placeholder="••••••••"
                placeholderTextColor={colors.placeholder}
                secureTextEntry={!showPass}
                textContentType="password"
                returnKeyType="done"
                value={password}
                onChangeText={(v) => { setPassword(v); setError(''); }}
                onSubmitEditing={handleLogin}
                accessibilityLabel="Password"
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPass((v) => !v)}
                accessibilityLabel={showPass ? 'Hide password' : 'Show password'}
              >
                <Text style={styles.eyeIcon}>{showPass ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>

            <Button
              label="Sign In"
              onPress={handleLogin}
              loading={loading}
              style={styles.loginBtn}
            />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: colors.bg },
  flex:         { flex: 1 },
  scroll:       { flexGrow: 1, justifyContent: 'center', padding: spacing.xxl },
  header:       { alignItems: 'center', marginBottom: spacing.xxxl },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  logoIcon:     { fontSize: 32 },
  title:        { ...typography.h1, marginBottom: spacing.xs },
  subtitle:     { ...typography.body, color: colors.textSecondary },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    padding: spacing.xxl,
  },
  errorBox: {
    backgroundColor: colors.errorLight, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.lg,
  },
  errorText:    { ...typography.small, color: colors.error },
  fieldLabel:   { ...typography.label, marginBottom: spacing.xs },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: 15, color: colors.text, backgroundColor: colors.bg,
  },
  passwordRow:  { position: 'relative' },
  passwordInput: { paddingRight: 48 },
  eyeBtn: {
    position: 'absolute', right: spacing.md,
    top: 0, bottom: 0, justifyContent: 'center',
  },
  eyeIcon:      { fontSize: 18 },
  loginBtn:     { marginTop: spacing.xl },
});
