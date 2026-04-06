import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Button from './Button';
import { colors, spacing, typography } from '../theme';

interface Props {
  icon: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon, title, subtitle, actionLabel, onAction }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant="outline"
          style={styles.btn}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.xxxl, paddingVertical: spacing.xxxl * 2,
  },
  icon:     { fontSize: 52, marginBottom: spacing.lg },
  title:    { ...typography.h3, textAlign: 'center', marginBottom: spacing.sm },
  subtitle: { ...typography.small, textAlign: 'center', lineHeight: 20, color: colors.textMuted },
  btn:      { marginTop: spacing.xl },
});
