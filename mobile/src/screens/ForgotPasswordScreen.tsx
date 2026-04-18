import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { forgotPassword } from '../api/auth';
import { useI18n } from '../i18n';
import Button from '../components/Button';
import { colors, spacing, radius, typography, shadow } from '../theme';

export default function ForgotPasswordScreen() {
  const { t } = useI18n();
  const navigation = useNavigation<any>();
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [sent,    setSent]    = useState(false);

  const handleSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed.includes('@')) {
      setError(t('forgot_error_email'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await forgotPassword(trimmed);
      setSent(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError(t('forgot_error_generic'));
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
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoIcon}>🔑</Text>
            </View>
            <Text style={styles.title}>{t('forgot_title')}</Text>
            <Text style={styles.subtitle}>{t('forgot_subtitle')}</Text>
          </View>

          <View style={[styles.card, shadow.md]}>
            {sent ? (
              <>
                <View style={styles.successBox}>
                  <Text style={styles.successTitle}>{t('forgot_success_title')}</Text>
                  <Text style={styles.successBody}>{t('forgot_success_body')}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => navigation.goBack()}
                  style={styles.backLink}
                  accessibilityRole="button"
                >
                  <Text style={styles.backLinkText}>{t('forgot_back')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {error ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>⚠️  {error}</Text>
                  </View>
                ) : null}

                <Text style={styles.label}>{t('forgot_email_label')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('forgot_email_placeholder')}
                  placeholderTextColor={colors.placeholder}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType="send"
                  value={email}
                  onChangeText={(v) => { setEmail(v); setError(''); }}
                  onSubmitEditing={handleSubmit}
                  accessibilityLabel={t('forgot_email_label')}
                />

                <Button
                  label={t('forgot_submit')}
                  onPress={handleSubmit}
                  loading={loading}
                  style={styles.submitBtn}
                />

                <TouchableOpacity
                  onPress={() => navigation.goBack()}
                  style={styles.backLink}
                  accessibilityRole="button"
                >
                  <Text style={styles.backLinkText}>{t('forgot_back')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: colors.bg },
  flex:     { flex: 1 },
  scroll:   { flexGrow: 1, justifyContent: 'center', padding: spacing.xxl },
  header:   { alignItems: 'center', marginBottom: spacing.xxxl },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  logoIcon:  { fontSize: 32 },
  title:     { ...typography.h1, marginBottom: spacing.xs, textAlign: 'center' },
  subtitle:  { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    padding: spacing.xxl,
  },
  errorBox: {
    backgroundColor: colors.errorLight, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.lg,
  },
  errorText:    { ...typography.small, color: colors.error },
  successBox: {
    backgroundColor: '#e6f9ec', borderRadius: radius.lg,
    padding: spacing.lg, marginBottom: spacing.lg,
  },
  successTitle: { ...typography.h3, color: '#1a7a3a', marginBottom: spacing.xs },
  successBody:  { ...typography.body, color: '#1a7a3a' },
  label:        { ...typography.label, marginBottom: spacing.xs },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: 15, color: colors.text, backgroundColor: colors.surfaceMuted,
  },
  submitBtn: { marginTop: spacing.xl },
  backLink:  { alignItems: 'center', marginTop: spacing.lg },
  backLinkText: { ...typography.small, color: colors.primary, fontWeight: '600' },
});
