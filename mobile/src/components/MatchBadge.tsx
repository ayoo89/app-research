import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../theme';

type Method = 'barcode' | 'text' | 'vector';

const CONFIG: Record<Method, { label: string; bg: string; text: string }> = {
  barcode: { label: '⬛ Barcode', bg: colors.badge.barcode.bg, text: colors.badge.barcode.text },
  text:    { label: '🔤 Text',    bg: colors.badge.text.bg,    text: colors.badge.text.text },
  vector:  { label: '🔍 Visual',  bg: colors.badge.vector.bg,  text: colors.badge.vector.text },
};

interface Props {
  methods: Method[];
}

export default function MatchBadge({ methods }: Props) {
  return (
    <View style={styles.row}>
      {methods.map((m) => {
        const cfg = CONFIG[m];
        return (
          <View key={m} style={[styles.badge, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.text, { color: cfg.text }]}>{cfg.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row:   { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  text:  { fontSize: 10, fontWeight: '600' },
});
