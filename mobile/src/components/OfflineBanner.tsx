import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme';

export default function OfflineBanner() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>📡  No internet connection</Text>
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
