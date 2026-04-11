import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useI18n } from '../i18n';
import { colors, radius, spacing } from '../theme';

type Method = 'barcode' | 'text' | 'vector';

interface Props {
  methods: Method[];
}

export default function MatchBadge({ methods }: Props) {
  const { t } = useI18n();
  const config = useMemo(
    () =>
      ({
        barcode: { label: t('match_barcode'), bg: colors.badge.barcode.bg, text: colors.badge.barcode.text },
        text:    { label: t('match_text'),    bg: colors.badge.text.bg,    text: colors.badge.text.text },
        vector:  { label: t('match_visual'), bg: colors.badge.vector.bg,  text: colors.badge.vector.text },
      }) as Record<Method, { label: string; bg: string; text: string }>,
    [t],
  );

  return (
    <View style={styles.row}>
      {methods.map((m) => {
        const cfg = config[m];
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
