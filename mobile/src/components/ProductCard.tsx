import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import HighlightText from './HighlightText';
import MatchBadge from './MatchBadge';
import { colors, spacing, radius, shadow, typography } from '../theme';
import { SearchResult } from '../api/search';

interface Props {
  item: SearchResult;
  query: string;
  onPress: () => void;
}

function ProductCard({ item, query, onPress }: Props) {
  return (
    <TouchableOpacity
      style={[styles.card, shadow.sm]}
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}${item.brand ? `, ${item.brand}` : ''}`}
    >
      {item.images?.[0] ? (
        <Image
          source={{ uri: item.images[0] }}
          style={styles.thumb}
          contentFit="cover"
          priority="normal"
        />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Text style={styles.thumbIcon}>📦</Text>
        </View>
      )}

      <View style={styles.info}>
        <HighlightText
          text={item.name}
          query={query}
          style={styles.name}
          numberOfLines={2}
        />
        {item.brand ? (
          <HighlightText
            text={item.brand}
            query={query}
            style={styles.brand}
            numberOfLines={1}
          />
        ) : null}
        {item.codeGold ? (
          <Text style={styles.codeGold} numberOfLines={1}>#{item.codeGold}</Text>
        ) : null}
        {item.category ? (
          <Text style={styles.category} numberOfLines={1}>{item.category}</Text>
        ) : null}
        {item.family ? (
          <Text style={styles.subMeta} numberOfLines={1}>{item.family}</Text>
        ) : null}
        {item.subcategory ? (
          <Text style={styles.subMeta} numberOfLines={1}>{item.subcategory}</Text>
        ) : null}
        <MatchBadge methods={item.matchedBy ?? [item.matchType as any]} />
      </View>

      <View style={styles.scoreCol}>
        <Text style={styles.score}>{Math.round((item.score ?? 0) * 100)}%</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

export default memo(ProductCard);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', backgroundColor: colors.surface,
    marginHorizontal: spacing.md, marginVertical: spacing.xs,
    borderRadius: radius.lg, overflow: 'hidden',
  },
  thumb:            { width: 88, height: 88 },
  thumbPlaceholder: { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  thumbIcon:        { fontSize: 28 },
  info:             { flex: 1, padding: spacing.md, justifyContent: 'center' },
  name:             { ...typography.h3, fontSize: 14, lineHeight: 20 },
  brand:            { ...typography.small, marginTop: 2 },
  codeGold: {
    ...typography.caption,
    fontSize: 11,
    marginTop: 2,
    color: colors.primary,
    fontWeight: '600',
  },
  category: {
    ...typography.caption, marginTop: spacing.xs,
    color: colors.textMuted,
  },
  subMeta: {
    ...typography.caption,
    fontSize: 11,
    marginTop: 2,
    color: colors.textMuted,
  },
  scoreCol: {
    width: 44, alignItems: 'center', justifyContent: 'center',
    paddingRight: spacing.sm,
  },
  score:   { fontSize: 11, fontWeight: '700', color: colors.primary },
  chevron: { fontSize: 20, color: colors.placeholder, marginTop: 2 },
});
