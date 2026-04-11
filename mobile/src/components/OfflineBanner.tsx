import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useI18n } from '../i18n';
import { colors, spacing, typography } from '../theme';

export default function OfflineBanner() {
  const { t } = useI18n();
  return (
    <View style={styles.container}>
      <Text style={styles.text}>📡  {t('offline_msg')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.warning,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  text: { ...typography.small, color: '#fff', fontWeight: '600' },
});
