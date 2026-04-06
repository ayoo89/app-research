import React from 'react';
import { Text, TextStyle } from 'react-native';
import { colors } from '../theme';

interface Props {
  text: string;
  query: string;
  style?: TextStyle;
  numberOfLines?: number;
}

/**
 * Renders text with query terms highlighted in primary color.
 * Bug fix: regex replacement was using a UUID instead of '\\$&'
 */
export default function HighlightText({ text, query, style, numberOfLines }: Props) {
  if (!query.trim() || !text) {
    return <Text style={style} numberOfLines={numberOfLines}>{text}</Text>;
  }

  const trimmed = query.trim();
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts   = text.split(new RegExp(`(${escaped})`, 'gi'));

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, i) =>
        part.toLowerCase() === trimmed.toLowerCase()
          ? <Text key={i} style={{ color: colors.primary, fontWeight: '700' }}>{part}</Text>
          : part,
      )}
    </Text>
  );
}
