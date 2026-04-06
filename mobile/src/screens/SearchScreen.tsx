import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, TextInput, FlatList, StyleSheet,
  TouchableOpacity, Text, Keyboard, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useNetworkStore } from '../store/networkStore';
import { useAuthStore } from '../store/authStore';
import {
  searchByText, searchByImage, searchByBarcode,
  SearchResult, SearchMeta,
} from '../api/search';
import ProductCard from '../components/ProductCard';
import EmptyState from '../components/EmptyState';
import ErrorBanner from '../components/ErrorBanner';
import OfflineBanner from '../components/OfflineBanner';
import { colors, spacing, radius, shadow, typography } from '../theme';

type SearchPhase = 'idle' | 'searching' | 'done';

export default function SearchScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const isOnline   = useNetworkStore((s) => s.isOnline);
  const logout     = useAuthStore((s) => s.logout);

  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [phase,   setPhase]   = useState<SearchPhase>('idle');
  const [meta,    setMeta]    = useState<SearchMeta | null>(null);
  const [error,   setError]   = useState('');
  const inputRef    = useRef<TextInput>(null);
  const lastQuery   = useRef('');
  const wasOffline  = useRef(false);

  // Handle barcode passed from scanner
  useEffect(() => {
    if (route.params?.barcode) {
      const bc = route.params.barcode as string;
      setQuery(bc);
      runBarcodeSearch(bc);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.barcode]);

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
      const res = await searchByText(text.trim());
      setResults(res.results);
      setMeta(res.meta);
    } catch (e: any) {
      setError(e.message ?? 'Search failed');
      setResults([]);
    } finally {
      setPhase('done');
    }
  }, [isOnline]);

  const runBarcodeSearch = useCallback(async (barcode: string) => {
    if (!isOnline) return;
    lastQuery.current = barcode;
    setLastSearchType('barcode');
    setPhase('searching');
    setError('');
    try {
      const res = await searchByBarcode(barcode);
      setResults(res.results);
      setMeta(res.meta);
    } catch (e: any) {
      setError(e.message ?? 'Barcode lookup failed');
      setResults([]);
    } finally {
      setPhase('done');
    }
  }, [isOnline]);

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
      const res = await searchByImage(imageUri);
      setResults(res.results);
      setMeta(res.meta);
    } catch (e: any) {
      setError(e.message ?? 'Image search failed');
      setResults([]);
    } finally {
      setPhase('done');
    }
  }, [isOnline]);

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

  const renderItem = useCallback(({ item }: { item: SearchResult }) => (
    <ProductCard
      item={item}
      query={lastQuery.current}
      onPress={() => navigation.navigate('ProductDetail', { id: item.id })}
    />
  ), [navigation]);

  const ListHeader = () => (
    <>
      {error ? <ErrorBanner message={error} onRetry={retryLastSearch} /> : null}
      {phase === 'done' && results.length > 0 && meta ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            {results.length} result{results.length !== 1 ? 's' : ''}
            {meta.cacheHit ? '  ⚡ cached' : ''}
            {'  ·  '}{meta.totalMs}ms
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
          title="Search for products"
          subtitle="Type a product name, scan a barcode, or search by photo"
        />
      );
    }
    return (
      <EmptyState
        icon="📭"
        title="No results found"
        subtitle={`Nothing matched "${lastQuery.current || 'your search'}". Try different keywords.`}
        actionLabel="Clear search"
        onAction={clearSearch}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {!isOnline && <OfflineBanner />}

      {/* Search bar */}
      <View style={[styles.searchBar, shadow.sm]}>
        <View style={styles.inputWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Search products..."
            placeholderTextColor={colors.placeholder}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => runTextSearch(query)}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel="Search products"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearBtn} accessibilityLabel="Clear search">
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.iconBtn, !isOnline && styles.iconBtnDisabled]}
          onPress={() => runImageSearch()}
          disabled={!isOnline}
          accessibilityLabel="Search by photo"
          accessibilityRole="button"
        >
          <Text style={styles.iconBtnText}>📷</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconBtn, styles.iconBtnPrimary, !isOnline && styles.iconBtnDisabled]}
          onPress={() => navigation.navigate('Scanner')}
          disabled={!isOnline}
          accessibilityLabel="Scan barcode"
          accessibilityRole="button"
        >
          <Text style={styles.iconBtnText}>⬛</Text>
        </TouchableOpacity>
      </View>

      {/* Searching indicator */}
      {phase === 'searching' && (
        <View style={styles.searchingBanner}>
          <Text style={styles.searchingText}>Searching…</Text>
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
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={8}
        getItemLayout={(_, index) => ({ length: 104, offset: 104 * index, index })}
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
    backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing.sm,
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
  searchingBanner: {
    backgroundColor: colors.primaryLight, paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  searchingText: { ...typography.small, color: colors.primary, fontWeight: '600' },
  metaRow: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  metaText:      { ...typography.caption, color: colors.textMuted },
  listContent:   { paddingBottom: spacing.xxl },
  emptyContainer: { flexGrow: 1 },
});
