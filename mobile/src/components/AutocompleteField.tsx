import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet,
} from 'react-native';
import { colors, spacing, radius, typography } from '../theme';

interface Props {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  suggestions: string[];
  placeholder?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

export default function AutocompleteField({
  label, value, onChangeText, suggestions, placeholder, autoCapitalize,
}: Props) {
  const [open, setOpen] = useState(false);

  const filtered = suggestions.filter(
    (s) => s.toLowerCase().includes(value.toLowerCase()) && s !== value,
  ).slice(0, 6);

  const select = useCallback((s: string) => {
    onChangeText(s);
    setOpen(false);
  }, [onChangeText]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={(v) => { onChangeText(v); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        autoCorrect={false}
        autoCapitalize={autoCapitalize ?? 'none'}
        accessibilityLabel={label}
      />
      {open && filtered.length > 0 && (
        <View style={styles.dropdown}>
          <ScrollView keyboardShouldPersistTaps="always" nestedScrollEnabled>
            {filtered.map((s) => (
              <TouchableOpacity key={s} style={styles.item} onPress={() => select(s)}>
                <Text style={styles.itemText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:  { marginBottom: spacing.lg, zIndex: 10 },
  label: { ...typography.label, marginBottom: spacing.xs },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0, right: 0,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    maxHeight: 180,
    zIndex: 100,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  item: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  itemText: { ...typography.body, color: colors.text },
});
