import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { listProducts } from '../api/admin';
import { Product } from '../api/search';
import { useI18n } from '../i18n';
import { useAuthStore } from '../store/authStore';
import ProductCard from '../components/ProductCard';
import { colors, spacing, radius, typography, shadow } from '../theme';

const PAGE_SIZE = 20;

export default function CatalogScreen() {
  const { t } = useI18n();
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const canEdit = user?.role === 'super_admin' || user?.role === 'admin';

  const [products,   setProducts]   = useState<Product[]>([]);
  const [page,       setPage]       = useState(1);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');

  const load = useCallback(async (pageNum: number, replace: boolean) => {
    if (replace) setLoading(true); else setLoadingMore(true);
    setError('');
    try {
      const res = await listProducts(pageNum, PAGE_SIZE);
      const items: Product[] = Array.isArray(res) ? res : (res.data ?? []);
      const tot = (res as any).total ?? items.length;
      setTotal(tot);
      setProducts((prev) => replace ? items : [...prev, ...items]);
      setPage(pageNum);
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message ?? t('catalog_error_load'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => { load(1, true); }, [load]);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || loading) return;
    if (products.length >= total && total > 0) return;
    load(page + 1, false);
  }, [loadingMore, loading, products.length, total, page, load]);

  const renderItem = useCallback(({ item, index }: { item: Product; index: number }) => (
    <Animated.View entering={FadeInDown.duration(300).delay(Math.min(index * 30, 200))}>
      <ProductCard
        item={{ ...item, score: 0, matchedBy: [] }}
        query=""
        onPress={() => navigation.navigate('ProductDetail', { id: item.id })}
      />
    </Animated.View>
  ), [navigation]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️  {error}</Text>
          <TouchableOpacity onPress={() => load(1, true)}>
            <Text style={styles.retryText}>{t('error_retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, canEdit && styles.listWithFab]}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(1, true); }}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          total > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalText}>
                {total} {total === 1 ? t('search_word_result') : t('search_word_results')}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerSpinner}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>{t('catalog_empty')}</Text>
          </View>
        }
      />

      {canEdit && (
        <TouchableOpacity
          style={[styles.fab, shadow.md]}
          onPress={() => navigation.navigate('ProductForm')}
          accessibilityLabel={t('nav_add_product')}
          accessibilityHint={t('catalog_fab_hint')}
          accessibilityRole="button"
        >
          <Text style={styles.fabIcon}>＋</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bg },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  list:    { paddingBottom: spacing.xxl },
  errorBox: {
    backgroundColor: colors.errorLight, padding: spacing.md,
    margin: spacing.md, borderRadius: radius.md,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  errorText:  { ...typography.small, color: colors.error, flex: 1 },
  retryText:  { ...typography.small, color: colors.primary, fontWeight: '600', marginLeft: spacing.sm },
  totalRow:   { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  totalText:  { ...typography.caption, color: colors.textMuted },
  emptyText:  { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  footerSpinner: { paddingVertical: spacing.lg, alignItems: 'center' },
  listWithFab: { paddingBottom: 90 },
  fab: {
    position: 'absolute', bottom: spacing.xxl, right: spacing.xxl,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  fabIcon: { color: '#fff', fontSize: 28, lineHeight: 32 },
});
