import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, TextInput, FlatList, StyleSheet,
  TouchableOpacity, Text, Keyboard, Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNetworkStore } from '../store/networkStore';
import { useI18n } from '../i18n';
import {
  searchByText, searchByImage, searchByBarcode,
  SearchResult, SearchMeta, SearchFilters,
} from '../api/search';
import ProductCard from '../components/ProductCard';
import EmptyState from '../components/EmptyState';
import ErrorBanner from '../components/ErrorBanner';
import OfflineBanner from '../components/OfflineBanner';
import { colors, spacing, radius, shadow, typography, hitSlop } from '../theme';

type SearchPhase = 'idle' | 'searching' | 'done';

export default function SearchScreen() {
  const { t } = useI18n();
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const isOnline   = useNetworkStore((s) => s.isOnline);

  const [query,   setQuery]   = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [phase,   setPhase]   = useState<SearchPhase>('idle');
  const [meta,    setMeta]    = useState<SearchMeta | null>(null);
  const [error,   setError]   = useState('');
  const inputRef    = useRef<TextInput>(null);
  const lastQuery   = useRef('');
  const wasOffline  = useRef(false);

  const [filterCategory,    setFilterCategory]    = useState('');
  const [filterSubcategory, setFilterSubcategory] = useState('');
  const [filterFamily,      setFilterFamily]      = useState('');

  const activeFilters = React.useMemo((): SearchFilters | undefined => {
    const c = filterCategory.trim();
    const s = filterSubcategory.trim();
    const f = filterFamily.trim();
    if (!c && !s && !f) return undefined;
    return {
      ...(c ? { category: c } : {}),
      ...(s ? { subcategory: s } : {}),
      ...(f ? { family: f } : {}),
    };
  }, [filterCategory, filterSubcategory, filterFamily]);

  const activeFilterCount = React.useMemo(
    () => [filterCategory, filterSubcategory, filterFamily].filter((s) => s.trim()).length,
    [filterCategory, filterSubcategory, filterFamily],
  );

  // Retry last search when coming back online
  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
      return;
    }
    if (wasOffline.current && lastQuery.current) {
      wasOffline.current = false;
      runTextSearch(lastQuery.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  const [lastSearchType, setLastSearchType] = useState<'text' | 'barcode' | 'image'>('text');

  // ── Search handlers ─────────────────────────────────────────────

  const runTextSearch = useCallback(async (text: string) => {
    if (!text.trim() || !isOnline) return;
    Keyboard.dismiss();
    lastQuery.current = text.trim();
    setLastSearchType('text');
    setPhase('searching');
    setError('');
    try {
      const res = await searchByText(text.trim(), 20, activeFilters);
      setResults(res.results);
      setMeta(res.meta);
    } catch (e: any) {
      setError(e.message ?? t('search_error_text'));
      setResults([]);
    } finally {
      setPhase('done');
    }
  }, [isOnline, activeFilters, t]);

  const runBarcodeSearch = useCallback(async (barcode: string, filtersOverride?: SearchFilters) => {
    if (!isOnline) return;
    const filters = filtersOverride ?? activeFilters;
    lastQuery.current = barcode;
    setLastSearchType('barcode');
    setPhase('searching');
    setError('');
    try {
      const res = await searchByBarcode(barcode, filters);
      setResults(res.results);
      setMeta(res.meta);
    } catch (e: any) {
      setError(e.message ?? t('search_error_barcode'));
      setResults([]);
    } finally {
      setPhase('done');
    }
  }, [isOnline, activeFilters, t]);

  const lastImageUri = useRef('');
  const runImageSearch = useCallback(async (uri?: string) => {
    if (!isOnline) return;
    let imageUri = uri;
    if (!imageUri) {
      const picked = await launchImageLibrary({ mediaType: 'photo', quality: 0.9 });
      if (!picked.assets?.[0]?.uri) return;
      imageUri = picked.assets[0].uri;
    }
    lastImageUri.current = imageUri;
    setLastSearchType('image');
    setPhase('searching');
    setError('');
    lastQuery.current = '';
    try {
      const res = await searchByImage(imageUri, activeFilters);
      setResults(res.results);
      setMeta(res.meta);
    } catch (e: any) {
      setError(e.message ?? t('search_error_image'));
      setResults([]);
    } finally {
      setPhase('done');
    }
  }, [isOnline, activeFilters, t]);

  // Code-barres / QR depuis le scanner (+ filtres passés en paramètres de navigation)
  useEffect(() => {
    const bc = route.params?.barcode as string | undefined;
    const rf = route.params?.filters as SearchFilters | undefined;
    const rfHas =
      !!(rf?.category?.trim() || rf?.subcategory?.trim() || rf?.family?.trim());
    if (rfHas) {
      setFilterCategory(rf!.category ?? '');
      setFilterSubcategory(rf!.subcategory ?? '');
      setFilterFamily(rf!.family ?? '');
      setFiltersExpanded(true);
    }
    if (bc) {
      setQuery(bc);
      // rf explicite depuis le scanner ; sinon `runBarcodeSearch` applique `activeFilters` courants
      runBarcodeSearch(bc, rfHas ? rf : undefined);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.barcode, route.params?.filters]);

  const retryLastSearch = useCallback(() => {
    if (lastSearchType === 'text' && lastQuery.current) runTextSearch(lastQuery.current);
    else if (lastSearchType === 'barcode' && lastQuery.current) runBarcodeSearch(lastQuery.current);
    else if (lastSearchType === 'image' && lastImageUri.current) runImageSearch(lastImageUri.current);
  }, [lastSearchType, runTextSearch, runBarcodeSearch, runImageSearch]);

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setPhase('idle');
    setError('');
    setMeta(null);
    lastQuery.current = '';
    inputRef.current?.focus();
  };

  // ── Render ──────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item, index }: { item: SearchResult; index: number }) => (
      <Animated.View
        entering={FadeInDown.duration(400).delay(Math.min(index * 48, 400))}
      >
        <ProductCard
          item={item}
          query={lastQuery.current}
          onPress={() => navigation.navigate('ProductDetail', { id: item.id })}
        />
      </Animated.View>
    ),
    [navigation],
  );

  const ListHeader = () => (
    <>
      {error ? <ErrorBanner message={error} onRetry={retryLastSearch} /> : null}
      {phase === 'done' && results.length > 0 && meta ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            {results.length}{' '}
            {results.length === 1 ? t('search_word_result') : t('search_word_results')}
            {meta.cacheHit ? `  · ${t('search_meta_cache')}` : ''}
            {'  ·  '}{meta.totalMs} ms
          </Text>
        </View>
      ) : null}
    </>
  );

  const ListEmpty = () => {
    if (phase === 'searching') return null;
    if (phase === 'idle') {
      return (
        <EmptyState
          icon="🔍"
          title={t('search_empty_title')}
          subtitle={t('search_empty_subtitle')}
        />
      );
    }
    return (
      <EmptyState
        icon="📭"
        title={t('search_noResults_title')}
        subtitle={t('search_noMatch', {
          query: lastQuery.current || t('search_yourSearch'),
        })}
        actionLabel={t('search_reset')}
        onAction={clearSearch}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {!isOnline && <OfflineBanner />}

      {/* Search bar */}
      <View style={[styles.searchBar, shadow.sm]}>
        <View style={[
          styles.inputWrap,
          searchFocused && styles.inputWrapFocused,
        ]}
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder={t('search_placeholder')}
            placeholderTextColor={colors.placeholder}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => runTextSearch(query)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel={t('search_a11y_input')}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearBtn} accessibilityLabel={t('search_a11y_clear')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.iconBtn, !isOnline && styles.iconBtnDisabled]}
          onPress={() => runImageSearch()}
          disabled={!isOnline}
          hitSlop={hitSlop}
          accessibilityLabel={t('search_a11y_photo')}
          accessibilityRole="button"
        >
          <Text style={styles.iconBtnText}>📷</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconBtn, styles.iconBtnPrimary, !isOnline && styles.iconBtnDisabled]}
          onPress={() => navigation.navigate('Scanner', { filters: activeFilters })}
          disabled={!isOnline}
          hitSlop={hitSlop}
          accessibilityLabel={t('search_a11y_scan')}
          accessibilityRole="button"
        >
          <Text style={styles.iconBtnText}>⬛</Text>
        </TouchableOpacity>
      </View>

      {/* Filtres repliables (ERP) */}
      <View style={styles.filtersBlock}>
        <TouchableOpacity
          style={styles.filtersToggle}
          onPress={() => setFiltersExpanded((e) => !e)}
          accessibilityRole="button"
          accessibilityState={{ expanded: filtersExpanded }}
          accessibilityLabel={filtersExpanded ? t('search_filters_a11y_expanded') : t('search_filters_a11y_collapsed')}
        >
          <Text style={styles.filtersToggleText}>
            {filtersExpanded ? t('search_filters_hide') : t('search_filters_show')}
          </Text>
          {activeFilterCount > 0 ? (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
        {filtersExpanded ? (
          <>
            <View style={styles.filterInputs}>
              <TextInput
                style={styles.filterInput}
                placeholder={t('search_placeholder_cat')}
                placeholderTextColor={colors.placeholder}
                value={filterCategory}
                onChangeText={setFilterCategory}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                style={styles.filterInput}
                placeholder={t('search_placeholder_fam')}
                placeholderTextColor={colors.placeholder}
                value={filterFamily}
                onChangeText={setFilterFamily}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                style={styles.filterInput}
                placeholder={t('search_placeholder_sub')}
                placeholderTextColor={colors.placeholder}
                value={filterSubcategory}
                onChangeText={setFilterSubcategory}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {(filterCategory || filterSubcategory || filterFamily) ? (
              <TouchableOpacity
                onPress={() => {
                  setFilterCategory('');
                  setFilterSubcategory('');
                  setFilterFamily('');
                }}
                accessibilityRole="button"
                accessibilityLabel={t('search_filter_clearA11y')}
              >
                <Text style={styles.clearFiltersText}>{t('search_filter_clear')}</Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : null}
      </View>

      {phase === 'searching' && (
        <View style={styles.searchingBanner}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.searchingText}>{t('search_searching')}</Text>
        </View>
      )}

      {/* Results */}
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={results.length === 0 ? styles.emptyContainer : styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={8}
      />

      {/* Logout (top-right via header button — set in navigator) */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.bg },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, gap: spacing.sm,
  },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surfaceMuted, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing.sm,
  },
  inputWrapFocused: {
    borderColor: colors.borderFocus,
    backgroundColor: colors.surface,
  },
  searchIcon:  { fontSize: 16, marginRight: spacing.xs },
  input: {
    flex: 1, paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    fontSize: 15, color: colors.text,
  },
  clearBtn:    { padding: spacing.xs },
  clearIcon:   { fontSize: 14, color: colors.textMuted },
  iconBtn: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnPrimary:  { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  iconBtnDisabled: { opacity: 0.4 },
  iconBtnText:     { fontSize: 18 },
  filtersBlock: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    paddingTop: spacing.xs,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filtersToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  filtersToggleText: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '600',
    flex: 1,
  },
  filterBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: spacing.sm,
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  filterInputs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  filterInput: {
    flex: 1,
    minWidth: 88,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
    fontSize: 13,
    color: colors.text,
  },
  clearFiltersText: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.xs,
    fontWeight: '600',
  },
  searchingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    paddingVertical: spacing.sm,
  },
  searchingText: { ...typography.small, color: colors.primary, fontWeight: '600' },
  metaRow: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  metaText:      { ...typography.caption, color: colors.textMuted },
  listContent:   { paddingBottom: spacing.xxl },
  emptyContainer: { flexGrow: 1 },
});
