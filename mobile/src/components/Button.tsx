import React from 'react';
import {
  TouchableOpacity, Text, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
}

export default function Button({
  label, onPress, loading, disabled,
  variant = 'primary', style, textStyle, accessibilityLabel,
}: Props) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[styles.base, styles[variant], isDisabled && styles.disabled, style]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading
        ? <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#fff' : colors.primary} />
        : <Text style={[styles.label, styles[`${variant}Text`], textStyle]}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md, paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl, alignItems: 'center', justifyContent: 'center',
    minHeight: 50,
  },
  primary:     { backgroundColor: colors.primary },
  outline:     { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary },
  ghost:       { backgroundColor: 'transparent' },
  danger:      { backgroundColor: colors.error },
  disabled:    { opacity: 0.5 },
  label:       { ...typography.body, fontWeight: '600' },
  primaryText: { color: '#fff' },
  outlineText: { color: colors.primary },
  ghostText:   { color: colors.primary },
  dangerText:  { color: '#fff' },
});
