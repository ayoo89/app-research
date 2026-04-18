import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { inviteUser, UserRole } from '../api/admin';
import { useI18n } from '../i18n';
import Button from '../components/Button';
import { colors, spacing, radius, typography, shadow } from '../theme';

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'admin',  label: 'Admin' },
  { value: 'user',   label: 'Utilisateur' },
];

export default function InviteUserScreen() {
  const { t } = useI18n();
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();

  const [email,   setEmail]   = useState('');
  const [name,    setName]    = useState('');
  const [role,    setRole]    = useState<UserRole>('user');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleInvite = async () => {
    const trimEmail = email.trim();
    const trimName  = name.trim();
    if (!trimEmail.includes('@')) {
      setError(t('forgot_error_email'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (!trimName) {
      setError(t('invite_error_name'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setLoading(true);
    setError('');
    try {
      await inviteUser({ email: trimEmail, name: trimName, role });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      route.params?.onDone?.();
      navigation.goBack();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message ?? t('invite_error_generic'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, shadow.md]}>
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️  {error}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>{t('invite_email_label')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('forgot_email_placeholder')}
              placeholderTextColor={colors.placeholder}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              value={email}
              onChangeText={(v) => { setEmail(v); setError(''); }}
              accessibilityLabel={t('invite_email_label')}
            />

            <Text style={[styles.label, { marginTop: spacing.md }]}>{t('invite_name_label')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('invite_name_placeholder')}
              placeholderTextColor={colors.placeholder}
              autoCorrect={false}
              returnKeyType="next"
              value={name}
              onChangeText={(v) => { setName(v); setError(''); }}
              accessibilityLabel={t('invite_name_label')}
            />

            <Text style={[styles.label, { marginTop: spacing.md }]}>{t('invite_role_label')}</Text>
            <View style={styles.roleRow}>
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.roleOption, role === r.value && styles.roleOptionActive]}
                  onPress={() => setRole(r.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: role === r.value }}
                  accessibilityLabel={r.label}
                >
                  <Text style={[styles.roleOptionText, role === r.value && styles.roleOptionTextActive]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Button
              label={t('invite_submit')}
              onPress={handleInvite}
              loading={loading}
              style={styles.submitBtn}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  flex:   { flex: 1 },
  scroll: { padding: spacing.xl },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    padding: spacing.xxl,
  },
  errorBox: {
    backgroundColor: colors.errorLight, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.lg,
  },
  errorText:  { ...typography.small, color: colors.error },
  label:      { ...typography.label, marginBottom: spacing.xs },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: 15, color: colors.text, backgroundColor: colors.surfaceMuted,
  },
  roleRow: {
    flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs,
  },
  roleOption: {
    flex: 1, paddingVertical: spacing.md, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', backgroundColor: colors.surfaceMuted,
  },
  roleOptionActive: {
    borderColor: colors.primary, backgroundColor: colors.primaryLight,
  },
  roleOptionText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  roleOptionTextActive: { color: colors.primary },
  submitBtn: { marginTop: spacing.xl },
});
