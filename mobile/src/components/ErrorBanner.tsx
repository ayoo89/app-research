import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useI18n } from '../i18n';
import { colors, spacing, radius, typography } from '../theme';

interface Props {
  message: string;
  onRetry?: () => void;
}

export default function ErrorBanner({ message, onRetry }: Props) {
  const { t } = useI18n();
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.message} numberOfLines={2}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity onPress={onRetry} style={styles.retry} accessibilityRole="button">
          <Text style={styles.retryText}>{t('error_retry')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.errorLight, borderRadius: radius.lg,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
    marginHorizontal: spacing.md, marginVertical: spacing.sm,
    padding: spacing.md, gap: spacing.sm,
  },
  icon:      { fontSize: 16 },
  message:   { flex: 1, ...typography.small, color: colors.error },
  retry: {
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    backgroundColor: colors.error, borderRadius: radius.sm,
  },
  retryText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
