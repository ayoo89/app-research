import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
  TouchableOpacity, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../store/authStore';
import { useI18n } from '../i18n';
import Button from '../components/Button';
import { colors, spacing, radius, typography, shadow } from '../theme';

export default function LoginScreen() {
  const { t } = useI18n();
  const navigation = useNavigation<any>();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [focused,  setFocused]  = useState<'email' | 'password' | null>(null);
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
      setError(t('login_error_fill'));
      shake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (!trimmedEmail.includes('@')) {
      setError(t('login_error_email'));
      shake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setLoading(true);
    setError('');
    try {
      await login(trimmedEmail, password);
    } catch (e: any) {
      const msg = e.message ?? t('login_error_generic');
      setError(msg);
      shake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
            <Text style={styles.title}>{t('login_title')}</Text>
            <Text style={styles.subtitle}>{t('login_subtitle')}</Text>
          </View>

          {/* Form */}
          <Animated.View style={[styles.card, shadow.md, { transform: [{ translateX: shakeAnim }] }]}>
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️  {error}</Text>
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>{t('login_email')}</Text>
            <TextInput
              style={[
                styles.input,
                focused === 'email' && styles.inputFocused,
              ]}
              placeholder={t('login_placeholder_email')}
              placeholderTextColor={colors.placeholder}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              value={email}
              onChangeText={(v) => { setEmail(v); setError(''); }}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused((f) => (f === 'email' ? null : f))}
              onSubmitEditing={() => passwordRef.current?.focus()}
              accessibilityLabel={t('login_email')}
            />

            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>{t('login_password')}</Text>
            <View style={[styles.passwordRow, focused === 'password' && styles.inputFocused]}>
              <TextInput
                ref={passwordRef}
                style={styles.passwordInput}
                placeholder="••••••••"
                placeholderTextColor={colors.placeholder}
                secureTextEntry={!showPass}
                textContentType="password"
                returnKeyType="done"
                value={password}
                onChangeText={(v) => { setPassword(v); setError(''); }}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused((f) => (f === 'password' ? null : f))}
                onSubmitEditing={handleLogin}
                accessibilityLabel={t('login_password')}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPass((v) => !v)}
                accessibilityLabel={showPass ? t('login_passToggleHide') : t('login_passToggleShow')}
                accessibilityRole="button"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.eyeIcon}>{showPass ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>

            <Button
              label={t('login_submit')}
              onPress={handleLogin}
              loading={loading}
              style={styles.loginBtn}
            />

            <TouchableOpacity
              onPress={() => navigation.navigate('ForgotPassword')}
              style={styles.forgotLink}
              accessibilityRole="button"
            >
              <Text style={styles.forgotText}>{t('forgot_link')}</Text>
            </TouchableOpacity>
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
    fontSize: 15, color: colors.text, backgroundColor: colors.surfaceMuted,
  },
  inputFocused: {
    borderColor: colors.borderFocus,
    backgroundColor: colors.surface,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  passwordRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  passwordInput: {
    flex: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: 15, color: colors.text,
  },
  eyeBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  eyeIcon:      { fontSize: 18 },
  loginBtn:   { marginTop: spacing.xl },
  forgotLink: { alignItems: 'center', marginTop: spacing.lg },
  forgotText: { ...typography.small, color: colors.primary, fontWeight: '600' },
});
