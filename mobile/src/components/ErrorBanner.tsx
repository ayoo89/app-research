import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '../theme';

interface Props {
  message: string;
  onRetry?: () => void;
}

export default function ErrorBanner({ message, onRetry }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.message} numberOfLines={2}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity onPress={onRetry} style={styles.retry} accessibilityRole="button">
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.errorLight, borderRadius: radius.md,
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
