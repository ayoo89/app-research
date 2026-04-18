import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../store/authStore';
import { useI18n } from '../i18n';
import Button from '../components/Button';
import { colors, spacing, radius, typography, shadow } from '../theme';
import { validatePassword } from '../utils/validation';

export default function ProfileScreen() {
  const { t, lang, setLang } = useI18n();
  const { user, updateProfile } = useAuthStore();

  const [name,            setName]            = useState(user?.name ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [showCurrent,     setShowCurrent]     = useState(false);
  const [showNew,         setShowNew]         = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState('');
  const [success,         setSuccess]         = useState(false);

  const handleSave = async () => {
    setError('');
    setSuccess(false);

    if (newPassword) {
      if (!currentPassword) { setError(t('profile_error_current')); return; }
      const complexErr = validatePassword(newPassword, t);
      if (complexErr) { setError(complexErr); return; }
    }

    const payload: Parameters<typeof updateProfile>[0] = {};
    if (name.trim())     payload.name            = name.trim();
    if (currentPassword) payload.currentPassword = currentPassword;
    if (newPassword)     payload.newPassword     = newPassword;

    setLoading(true);
    try {
      await updateProfile(payload);
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message ?? t('profile_error_generic'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[styles.card, shadow.md]}>

            {error   ? <View style={styles.errorBox} accessibilityRole="alert"><Text style={styles.errorText}>⚠️  {error}</Text></View>   : null}
            {success ? <View style={styles.successBox} accessibilityRole="alert"><Text style={styles.successText}>✓  {t('profile_success')}</Text></View> : null}

            {/* Email — read-only */}
            <Text style={styles.label}>{t('profile_email_label')}</Text>
            <View
              style={styles.readonlyField}
              accessibilityLabel={`${t('profile_email_label')}: ${user?.email}`}
              accessibilityHint={t('profile_email_readonly_hint')}
            >
              <Text style={styles.readonlyText}>{user?.email}</Text>
            </View>

            {/* Name */}
            <Text style={[styles.label, { marginTop: spacing.md }]}>{t('profile_name_label')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('profile_name_placeholder')}
              placeholderTextColor={colors.placeholder}
              value={name}
              onChangeText={(v) => { setName(v); setError(''); setSuccess(false); }}
              autoCorrect={false}
              returnKeyType="next"
              accessibilityLabel={t('profile_name_label')}
            />

            {/* Password section */}
            <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>{t('profile_section_password')}</Text>

            <Text style={[styles.label, { marginTop: spacing.md }]}>{t('profile_current_password')}</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                placeholder={t('profile_current_placeholder')}
                placeholderTextColor={colors.placeholder}
                secureTextEntry={!showCurrent}
                value={currentPassword}
                onChangeText={(v) => { setCurrentPassword(v); setError(''); setSuccess(false); }}
                returnKeyType="next"
                accessibilityLabel={t('profile_current_password')}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowCurrent((v) => !v)}
                accessibilityLabel={showCurrent ? t('profile_passToggleHide') : t('profile_passToggleShow')}
                accessibilityRole="button"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.eyeIcon}>{showCurrent ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { marginTop: spacing.md }]}>{t('profile_new_password')}</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                placeholder={t('profile_new_placeholder')}
                placeholderTextColor={colors.placeholder}
                secureTextEntry={!showNew}
                value={newPassword}
                onChangeText={(v) => { setNewPassword(v); setError(''); setSuccess(false); }}
                returnKeyType="done"
                onSubmitEditing={handleSave}
                accessibilityLabel={t('profile_new_password')}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowNew((v) => !v)}
                accessibilityLabel={showNew ? t('profile_passToggleHide') : t('profile_passToggleShow')}
                accessibilityRole="button"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.eyeIcon}>{showNew ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.passwordHint}>{t('profile_password_hint')}</Text>

            <Button label={t('profile_save')} onPress={handleSave} loading={loading} style={styles.saveBtn} />
          </View>

          {/* Language picker */}
          <View style={[styles.card, shadow.sm, { marginTop: spacing.lg }]}>
            <Text style={styles.sectionTitle}>{t('profile_lang_title')}</Text>
            <View style={styles.langRow}>
              {(['fr', 'en'] as const).map((l) => (
                <TouchableOpacity
                  key={l}
                  style={[styles.langOption, lang === l && styles.langOptionActive]}
                  onPress={() => setLang(l)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: lang === l }}
                  accessibilityLabel={l === 'fr' ? 'Français' : 'English'}
                >
                  <Text style={[styles.langText, lang === l && styles.langTextActive]}>
                    {l === 'fr' ? '🇫🇷  Français' : '🇬🇧  English'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: colors.bg },
  flex:  { flex: 1 },
  scroll: { padding: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xxl },
  errorBox: { backgroundColor: colors.errorLight, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  errorText: { ...typography.small, color: colors.error },
  successBox: { backgroundColor: '#e6f9ec', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  successText: { ...typography.small, color: '#1a7a3a' },
  label:  { ...typography.label, marginBottom: spacing.xs },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.md },
  readonlyField: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: colors.surfaceMuted,
  },
  readonlyText: { fontSize: 15, color: colors.textMuted },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: 15, color: colors.text, backgroundColor: colors.surfaceMuted,
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
  eyeIcon: { fontSize: 18 },
  passwordHint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  saveBtn: { marginTop: spacing.xl },
  langRow: { flexDirection: 'row', gap: spacing.sm },
  langOption: {
    flex: 1, paddingVertical: spacing.md, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', backgroundColor: colors.surfaceMuted,
  },
  langOptionActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  langText:       { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  langTextActive: { color: colors.primary },
});
