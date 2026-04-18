import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  FlatList, Dimensions, ActivityIndicator, NativeScrollEvent,
  NativeSyntheticEvent, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { getProduct, Product } from '../api/search';
import { useI18n } from '../i18n';
import EmptyState from '../components/EmptyState';
import { colors, spacing, radius, shadow, typography } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');

export default function ProductDetailScreen({ route }: any) {
  const { t } = useI18n();
  const { id } = route.params as { id: string; fromScan?: boolean };
  const navigation = useNavigation<any>();

  const [product,  setProduct]  = useState<Product | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [imgIndex, setImgIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const p = await getProduct(id);
      setProduct(p);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } catch (e: any) {
      setError(e.message ?? t('product_error_sub'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => { load(); }, [load]);

  const onImageScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setImgIndex(idx);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{t('product_loading')}</Text>
      </View>
    );
  }

  if (error || !product) {
    return (
      <SafeAreaView style={styles.center} edges={['bottom']}>
        <EmptyState
          icon="⚠️"
          title={t('product_error_title')}
          subtitle={error || t('product_error_sub')}
          actionLabel={t('product_retry')}
          onAction={load}
        />
      </SafeAreaView>
    );
  }

  const images = product.images ?? [];

  return (
    <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        bounces
      >
        {images.length > 0 ? (
          <View style={styles.carouselWrap}>
            <FlatList
              horizontal
              pagingEnabled
              data={images}
              keyExtractor={(_, i) => String(i)}
              showsHorizontalScrollIndicator={false}
              onScroll={onImageScroll}
              scrollEventThrottle={16}
              renderItem={({ item }) => (
                <Image
                  source={{ uri: item }}
                  style={styles.image}
                  contentFit="cover"
                  priority="high"
                />
              )}
            />
            {images.length > 1 && (
              <View style={styles.dots}>
                {images.map((_, i) => (
                  <View
                    key={i}
                    style={[styles.dot, i === imgIndex && styles.dotActive]}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderIcon}>📦</Text>
          </View>
        )}

        <View style={styles.content}>
          {product.category ? (
            <View style={styles.categoryPill}>
              <Text style={styles.categoryText}>{product.category}</Text>
            </View>
          ) : null}

          <Text style={styles.name}>{product.name}</Text>

          {product.brand ? (
            <Text style={styles.brand}>{product.brand}</Text>
          ) : null}

          <View style={[styles.infoCard, shadow.sm]}>
            {(() => {
              const rows: { icon: string; label: string; value: string }[] = [];
              if (product.barcode)    rows.push({ icon: '⬛', label: t('product_label_ean'),      value: product.barcode });
              if (product.codeGold)   rows.push({ icon: '🔢', label: t('product_label_gold'),     value: product.codeGold });
              if (product.brand)      rows.push({ icon: '🏷️', label: t('product_label_brand'),    value: product.brand });
              if (product.category)   rows.push({ icon: '📂', label: t('product_label_category'), value: product.category });
              if (product.family)     rows.push({ icon: '👪', label: t('product_label_family'),   value: product.family });
              if (product.subcategory) rows.push({ icon: '📁', label: t('product_label_subfamily'), value: product.subcategory });
              return rows.map((row, i) => (
                <InfoRow
                  key={row.label + row.value.slice(0, 20)}
                  icon={row.icon}
                  label={row.label}
                  value={row.value}
                  last={i === rows.length - 1}
                />
              ));
            })()}
          </View>

          {product.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('product_section_desc')}</Text>
              <Text style={styles.description}>{product.description}</Text>
            </View>
          ) : null}

          {!product.description && !product.brand && !product.barcode ? (
            <Text style={styles.noData}>{t('product_noData')}</Text>
          ) : null}
        </View>
      </ScrollView>

      <SafeAreaView style={styles.footer} edges={['bottom']}>
        <TouchableOpacity
          style={styles.searchSimilarBtn}
          onPress={() => navigation.navigate('Search', {})}
          accessibilityRole="button"
          accessibilityLabel={t('product_similarA11y')}
        >
          <Text style={styles.searchSimilarText}>{t('product_similar')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </Animated.View>
  );
}

function InfoRow({ icon, label, value, last }: { icon: string; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} selectable>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex:            { flex: 1, backgroundColor: colors.surface },
  container:       { flex: 1, backgroundColor: colors.surface },
  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.bg,
  },
  loadingText:     { ...typography.small, color: colors.textMuted, marginTop: spacing.md },
  carouselWrap:    { position: 'relative' },
  image:           { width: SCREEN_W, height: 300 },
  imagePlaceholder: {
    height: 220, backgroundColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  imagePlaceholderIcon: { fontSize: 64 },
  dots: {
    position: 'absolute', bottom: spacing.md,
    left: 0, right: 0, flexDirection: 'row',
    justifyContent: 'center', gap: spacing.xs,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: { backgroundColor: '#fff', width: 18 },
  content:         { padding: spacing.xl },
  categoryPill: {
    alignSelf: 'flex-start', backgroundColor: colors.primaryLight,
    borderRadius: radius.full, paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs, marginBottom: spacing.md,
  },
  categoryText:    { ...typography.caption, color: colors.primary, fontWeight: '600' },
  name:            { ...typography.h2, lineHeight: 30, marginBottom: spacing.xs },
  brand:           { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  infoCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.xl, overflow: 'hidden',
  },
  infoRow:         { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  infoRowBorder:   { borderBottomWidth: 1, borderBottomColor: colors.border },
  infoIcon:        { fontSize: 18, marginRight: spacing.md, width: 28, textAlign: 'center' },
  infoContent:     { flex: 1 },
  infoLabel:       { ...typography.label, marginBottom: 2 },
  infoValue:       { ...typography.body, color: colors.text },
  section:         { marginBottom: spacing.xl },
  sectionTitle:    { ...typography.label, marginBottom: spacing.sm },
  description:     { ...typography.body, lineHeight: 24, color: colors.textSecondary },
  noData:          { ...typography.small, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  footer:          { backgroundColor: colors.surface, paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  searchSimilarBtn: {
    backgroundColor: colors.primaryLight, borderRadius: radius.md,
    paddingVertical: spacing.lg, alignItems: 'center', marginBottom: spacing.sm,
    minHeight: 52,
  },
  searchSimilarText: { ...typography.body, color: colors.primary, fontWeight: '600' },
});
