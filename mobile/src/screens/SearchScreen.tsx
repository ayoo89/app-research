import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, TextInput, FlatList, StyleSheet,
  TouchableOpacity, Text, Keyboard, Platform,
  ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNetworkStore } from '../store/networkStore';
import { useI18n } from '../i18n';
import {
  searchByText, searchByImage, searchByBarcode,
  SearchResult, SearchMeta, SearchFilters,
} from '../api/search';
import { getDistinctValues } from '../api/admin';
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
  const [filterCodeGold,    setFilterCodeGold]    = useState('');
  const [filterDesignation, setFilterDesignation] = useState('');
  const [filterEan,         setFilterEan]         = useState('');

  // Taxonomy picker state
  const [categories,   setCategories]   = useState<string[]>([]);
  const [families,     setFamilies]     = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [pickerField, setPickerField]   = useState<'category' | 'family' | 'subcategory' | null>(null);

  useEffect(() => {
    Promise.all([
      getDistinctValues('category'),
      getDistinctValues('family'),
      getDistinctValues('subcategory'),
    ]).then(([cats, fams, subs]) => {
      setCategories(cats);
      setFamilies(fams);
      setSubcategories(subs);
    }).catch(() => {});
  }, []);

  const activeFilters = React.useMemo((): SearchFilters | undefined => {
    const c  = filterCategory.trim();
    const s  = filterSubcategory.trim();
    const f  = filterFamily.trim();
    const cg = filterCodeGold.trim();
    const de = filterDesignation.trim();
    const ea = filterEan.trim();
    if (!c && !s && !f && !cg && !de && !ea) return undefined;
    return {
      ...(c  ? { category:    c  } : {}),
      ...(s  ? { subcategory: s  } : {}),
      ...(f  ? { family:      f  } : {}),
      ...(cg ? { codeGold:    cg } : {}),
      ...(de ? { designation: de } : {}),
      ...(ea ? { ean:         ea } : {}),
    };
  }, [filterCategory, filterSubcategory, filterFamily, filterCodeGold, filterDesignation, filterEan]);

  const activeFilterCount = React.useMemo(
    () => [filterCategory, filterSubcategory, filterFamily, filterCodeGold, filterDesignation, filterEan]
      .filter((s) => s.trim()).length,
    [filterCategory, filterSubcategory, filterFamily, filterCodeGold, filterDesignation, filterEan],
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
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
      });
      if (picked.canceled || !picked.assets?.[0]?.uri) return;
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
          actionLabel={t('nav_catalog')}
          onAction={() => navigation.navigate('Catalog')}
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
              {/* Category select */}
              <TouchableOpacity
                style={[styles.filterSelect, filterCategory ? styles.filterSelectActive : null]}
                onPress={() => setPickerField('category')}
                accessibilityRole="button"
                accessibilityLabel={t('search_placeholder_cat')}
              >
                <Text style={filterCategory ? styles.filterSelectValueText : styles.filterSelectPlaceholder} numberOfLines={1}>
                  {filterCategory || t('search_placeholder_cat')}
                </Text>
                <Text style={styles.filterSelectChevron}>▾</Text>
              </TouchableOpacity>

              {/* Family select */}
              <TouchableOpacity
                style={[styles.filterSelect, filterFamily ? styles.filterSelectActive : null]}
                onPress={() => setPickerField('family')}
                accessibilityRole="button"
                accessibilityLabel={t('search_placeholder_fam')}
              >
                <Text style={filterFamily ? styles.filterSelectValueText : styles.filterSelectPlaceholder} numberOfLines={1}>
                  {filterFamily || t('search_placeholder_fam')}
                </Text>
                <Text style={styles.filterSelectChevron}>▾</Text>
              </TouchableOpacity>

              {/* Sub-family select */}
              <TouchableOpacity
                style={[styles.filterSelect, filterSubcategory ? styles.filterSelectActive : null]}
                onPress={() => setPickerField('subcategory')}
                accessibilityRole="button"
                accessibilityLabel={t('search_placeholder_sub')}
              >
                <Text style={filterSubcategory ? styles.filterSelectValueText : styles.filterSelectPlaceholder} numberOfLines={1}>
                  {filterSubcategory || t('search_placeholder_sub')}
                </Text>
                <Text style={styles.filterSelectChevron}>▾</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.filterInput}
                placeholder={t('search_placeholder_codegold')}
                placeholderTextColor={colors.placeholder}
                value={filterCodeGold}
                onChangeText={setFilterCodeGold}
                autoCapitalize="characters"
                autoCorrect={false}
                accessibilityLabel={t('search_placeholder_codegold')}
              />
              <TextInput
                style={styles.filterInput}
                placeholder={t('search_placeholder_designation')}
                placeholderTextColor={colors.placeholder}
                value={filterDesignation}
                onChangeText={setFilterDesignation}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel={t('search_placeholder_designation')}
              />
              <TextInput
                style={styles.filterInput}
                placeholder={t('search_placeholder_ean')}
                placeholderTextColor={colors.placeholder}
                value={filterEan}
                onChangeText={setFilterEan}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="numeric"
                accessibilityLabel={t('search_placeholder_ean')}
              />
            </View>
            {(filterCategory || filterSubcategory || filterFamily || filterCodeGold || filterDesignation || filterEan) ? (
              <TouchableOpacity
                onPress={() => {
                  setFilterCategory('');
                  setFilterSubcategory('');
                  setFilterFamily('');
                  setFilterCodeGold('');
                  setFilterDesignation('');
                  setFilterEan('');
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

      {error ? <ErrorBanner message={error} onRetry={retryLastSearch} /> : null}

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

      {/* Taxonomy picker modal */}
      <Modal
        visible={pickerField !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerField(null)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setPickerField(null)}
        >
          <View style={[styles.pickerSheet, shadow.lg]}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>
                {pickerField === 'category'
                  ? t('search_placeholder_cat')
                  : pickerField === 'family'
                  ? t('search_placeholder_fam')
                  : t('search_placeholder_sub')}
              </Text>
              <TouchableOpacity onPress={() => setPickerField(null)} hitSlop={hitSlop}>
                <Text style={styles.pickerClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.pickerScroll}>
              {/* Clear option */}
              <TouchableOpacity
                style={styles.pickerOption}
                onPress={() => {
                  if (pickerField === 'category') setFilterCategory('');
                  else if (pickerField === 'family') setFilterFamily('');
                  else if (pickerField === 'subcategory') setFilterSubcategory('');
                  setPickerField(null);
                }}
              >
                <Text style={styles.pickerOptionClear}>{t('search_filter_clear')}</Text>
              </TouchableOpacity>
              {(pickerField === 'category' ? categories : pickerField === 'family' ? families : subcategories).map((opt) => {
                const selected =
                  pickerField === 'category' ? filterCategory === opt
                  : pickerField === 'family' ? filterFamily === opt
                  : filterSubcategory === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.pickerOption, selected && styles.pickerOptionSelected]}
                    onPress={() => {
                      if (pickerField === 'category') setFilterCategory(opt);
                      else if (pickerField === 'family') setFilterFamily(opt);
                      else if (pickerField === 'subcategory') setFilterSubcategory(opt);
                      setPickerField(null);
                    }}
                  >
                    <Text style={[styles.pickerOptionText, selected && styles.pickerOptionTextSelected]}>
                      {opt}
                    </Text>
                    {selected && <Text style={styles.pickerCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
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
  filterSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 88,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
  },
  filterSelectActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  filterSelectPlaceholder: {
    flex: 1,
    fontSize: 13,
    color: colors.placeholder,
  },
  filterSelectValueText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  filterSelectChevron: {
    fontSize: 11,
    color: colors.textMuted,
    marginLeft: 2,
  },
  pickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  pickerSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '60%',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerTitle: { ...typography.h3, color: colors.text },
  pickerClose: { fontSize: 16, color: colors.textMuted, padding: spacing.xs },
  pickerScroll: { paddingVertical: spacing.xs },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerOptionSelected: { backgroundColor: colors.primaryLight },
  pickerOptionClear: {
    flex: 1,
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  pickerOptionText: { flex: 1, fontSize: 14, color: colors.text },
  pickerOptionTextSelected: { color: colors.primary, fontWeight: '700' },
  pickerCheck: { fontSize: 14, color: colors.primary },
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
