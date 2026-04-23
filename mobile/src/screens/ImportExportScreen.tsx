import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
  ScrollView, FlatList, TextInput, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import {
  exportProductsCsv, importProductsCsv, uploadProductImages,
  ImportResult, ImageUploadDetail, ImageUploadResult, ProductImportRow,
  listProducts, deleteProduct,
} from '../api/admin';
import { listFamilies, FamilyItem } from '../api/hierarchy';
import { Product } from '../api/search';
import { useI18n } from '../i18n';
import { colors, spacing, radius, typography, shadow } from '../theme';
import ProductFormModal from '../components/ProductFormModal';

type Tab = 'io' | 'products';
const PAGE_SIZE = 20;

interface PickedFile { uri: string; name: string }

export default function ImportExportScreen() {
  const { t } = useI18n();
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<Tab>('io');

  // ── Import/Export state ──────────────────────────────────────────────
  const [importing,     setImporting]     = useState(false);
  const [exporting,     setExporting]     = useState(false);
  const [productFile,   setProductFile]   = useState<PickedFile | null>(null);
  const [imageFiles,    setImageFiles]    = useState<PickedFile[]>([]);
  const [strategy,      setStrategy]      = useState<'order' | 'codegold'>('codegold');
  const [importResult,  setImportResult]  = useState<ImportResult | null>(null);
  const [importPct,     setImportPct]     = useState(0);
  const [importPhase,   setImportPhase]   = useState<'upload' | 'processing'>('upload');

  // ── Standalone image-upload state ────────────────────────────────────
  const [imgOnlyFiles,    setImgOnlyFiles]    = useState<PickedFile[]>([]);
  const [imgOnlyStrat,    setImgOnlyStrat]    = useState<'codegold' | 'barcode'>('codegold');
  const [uploadingImgs,   setUploadingImgs]   = useState(false);
  const [imgUploadDone,   setImgUploadDone]   = useState(0);
  const [imgUploadTotal,  setImgUploadTotal]  = useState(0);
  const [imgUploadPct,    setImgUploadPct]    = useState(0);
  const [imgUploadPhase,  setImgUploadPhase]  = useState<'upload' | 'processing'>('upload');
  const [imgUploadResult, setImgUploadResult] = useState<ImageUploadResult | null>(null);

  // ── Products tab state ───────────────────────────────────────────────
  const [products,        setProducts]       = useState<Product[]>([]);
  const [prodTotal,       setProdTotal]      = useState(0);
  const [prodPage,        setProdPage]       = useState(1);
  const [prodLoading,     setProdLoading]    = useState(false);
  const [prodLoadingMore, setProdLoadingMore] = useState(false);
  const [prodError,       setProdError]      = useState('');
  const [searchQuery,     setSearchQuery]    = useState('');
  const [filterFamily,    setFilterFamily]   = useState('');
  const [families,        setFamilies]       = useState<FamilyItem[]>([]);
  const [famLoading,      setFamLoading]     = useState(false);

  // ── CRUD modal state ─────────────────────────────────────────────────
  const [formVisible,    setFormVisible]    = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Refs to avoid stale closures in listeners
  const activeTabRef    = useRef(activeTab);
  const searchQueryRef  = useRef(searchQuery);
  const filterFamilyRef = useRef(filterFamily);
  useEffect(() => { activeTabRef.current = activeTab; },       [activeTab]);
  useEffect(() => { searchQueryRef.current = searchQuery; },   [searchQuery]);
  useEffect(() => { filterFamilyRef.current = filterFamily; }, [filterFamily]);

  // ── Load products ────────────────────────────────────────────────────
  const loadProds = useCallback(async (
    p: number, q: string, fam: string, reset: boolean,
  ) => {
    if (reset) setProdLoading(true); else setProdLoadingMore(true);
    setProdError('');
    try {
      const res = await listProducts(p, PAGE_SIZE, q || undefined, fam || undefined);
      setProducts(prev => reset ? res.data : [...prev, ...res.data]);
      setProdTotal(res.total);
      setProdPage(p);
    } catch {
      setProdError(t('products_error_load'));
    } finally {
      setProdLoading(false);
      setProdLoadingMore(false);
    }
  }, [t]);

  // Load families for filter chips on first products-tab visit
  const loadFamilies = useCallback(async () => {
    setFamLoading(true);
    try {
      const data = await listFamilies();
      setFamilies(data);
    } catch { /* non-fatal */ } finally {
      setFamLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'products') {
      setSearchQuery('');
      setFilterFamily('');
      loadProds(1, '', '', true);
      if (families.length === 0) loadFamilies();
    }
  }, [activeTab]);

  // Reload on screen focus
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      if (activeTabRef.current === 'products') {
        loadProds(1, searchQueryRef.current, filterFamilyRef.current, true);
      }
    });
    return unsub;
  }, [navigation]);

  // Debounced search / filter
  useEffect(() => {
    if (activeTab !== 'products') return;
    const timer = setTimeout(() => loadProds(1, searchQuery, filterFamily, true), 350);
    return () => clearTimeout(timer);
  }, [searchQuery, filterFamily]);

  // ── Export ───────────────────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    try {
      await exportProductsCsv();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert(t('common_error'), e.message ?? t('import_export_error_export'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setExporting(false);
    }
  };

  // ── Pick product file ────────────────────────────────────────────────
  const pickProductFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv', 'text/comma-separated-values',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel', 'application/octet-stream',
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const { uri, name } = result.assets[0];
      setProductFile({ uri, name: name ?? 'products' });
    } catch (e: any) {
      if (e?.code !== 'DOCUMENT_PICKER_CANCELED') Alert.alert(t('common_error'), e.message);
    }
  };

  // ── Pick images (CSV import) — opens native gallery with multi-select ──
  const pickImages = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission requise',
          'Autorisez l\'accès à la galerie pour sélectionner des photos.',
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 0, // 0 = unlimited
        quality: 1,
        exif: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const picked = result.assets.map((a) => ({
        uri: a.uri,
        name: a.fileName ?? a.uri.split('/').pop() ?? 'image.jpg',
      }));
      setImageFiles((prev) => {
        const seen = new Set(prev.map((f) => f.uri));
        return [...prev, ...picked.filter((f) => !seen.has(f.uri))];
      });
    } catch (e: any) {
      Alert.alert(t('common_error'), e.message);
    }
  };

  // ── Pick images (standalone upload) — opens native gallery with multi-select ─
  const pickImgOnly = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission requise',
          'Autorisez l\'accès à la galerie pour sélectionner des photos.',
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 0, // 0 = unlimited
        quality: 1,
        exif: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const picked = result.assets.map((a) => ({
        uri: a.uri,
        name: a.fileName ?? a.uri.split('/').pop() ?? 'image.jpg',
      }));
      setImgOnlyFiles((prev) => {
        const seen = new Set(prev.map((f) => f.uri));
        return [...prev, ...picked.filter((f) => !seen.has(f.uri))];
      });
    } catch (e: any) {
      Alert.alert(t('common_error'), e.message);
    }
  };

  // ── CSV/Excel Import ─────────────────────────────────────────────────
  const handleImport = async () => {
    if (!productFile) return;
    setImporting(true);
    setImportPct(0);
    setImportPhase('upload');
    setImportResult(null);
    try {
      const result = await importProductsCsv(
        productFile.uri,
        imageFiles.map((f) => f.uri),
        imageFiles.length ? strategy : 'codegold',
        (pct, phase) => { setImportPct(pct); setImportPhase(phase); },
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setImportResult(result);
      setProductFile(null);
      setImageFiles([]);
    } catch (e: any) {
      Alert.alert(t('common_error'), e.message ?? t('import_export_error_import'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setImporting(false);
      setImportPct(0);
    }
  };

  // ── Standalone image upload ──────────────────────────────────────────
  const handleUploadImages = async () => {
    if (!imgOnlyFiles.length) return;
    const total = imgOnlyFiles.length;
    setUploadingImgs(true);
    setImgUploadDone(0);
    setImgUploadTotal(total);
    setImgUploadPct(0);
    setImgUploadPhase('upload');
    setImgUploadResult(null);
    try {
      const result = await uploadProductImages(
        imgOnlyFiles.map((f) => f.uri),
        imgOnlyStrat,
        (done, tot, phase) => {
          setImgUploadDone(done);
          setImgUploadTotal(tot);
          setImgUploadPct(tot > 0 ? Math.round((done / tot) * 100) : 0);
          setImgUploadPhase(phase);
        },
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setImgUploadResult(result);
      setImgOnlyFiles([]);
    } catch (e: any) {
      Alert.alert(t('common_error'), e.message ?? t('import_export_error_import'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setUploadingImgs(false);
      setImgUploadPct(0);
    }
  };

  // ── CRUD handlers ────────────────────────────────────────────────────
  const openCreate = () => { setEditingProduct(null); setFormVisible(true); };
  const openEdit   = (product: Product) => { setEditingProduct(product); setFormVisible(true); };

  const handleDeleteProduct = (product: Product) => {
    Alert.alert(
      t('products_delete_confirm').replace('{name}', product.name), '',
      [
        { text: t('common_cancel'), style: 'cancel' },
        {
          text: t('common_delete'), style: 'destructive',
          onPress: async () => {
            try {
              await deleteProduct(product.id);
              loadProds(1, searchQuery, filterFamily, true);
            } catch (e: any) {
              Alert.alert(t('common_error'), e.response?.data?.message ?? 'Suppression impossible');
            }
          },
        },
      ],
    );
  };

  const handleSaved = () => loadProds(1, searchQuery, filterFamily, true);

  // ── Derived ──────────────────────────────────────────────────────────
  const hasImages      = imageFiles.length > 0;
  const canImport      = !!productFile && !importing;
  const hasMore        = products.length < prodTotal;
  const progressVisible = importing || uploadingImgs;
  const activePct      = uploadingImgs ? imgUploadPct   : importPct;
  const activePhase    = uploadingImgs ? imgUploadPhase  : importPhase;
  const activeFiles    = uploadingImgs ? imgOnlyFiles    : imageFiles;

  // ── Product row renderer ─────────────────────────────────────────────
  const renderProduct = useCallback(({ item }: { item: Product }) => (
    <View style={styles.prodRow}>
      <View style={styles.prodMain}>
        <Text style={styles.prodName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.prodMeta} numberOfLines={1}>
          {[item.codeGold, item.brand].filter(Boolean).join(' · ') || '—'}
        </Text>
        {(item.family || item.category) && (
          <Text style={styles.prodHierarchy} numberOfLines={1}>
            {[item.family, item.subcategory, item.category].filter(Boolean).join(' › ')}
          </Text>
        )}
      </View>
      <View style={styles.prodRight}>
        {item.price != null && (
          <Text style={styles.prodPrice}>{item.price.toFixed(2)} €</Text>
        )}
        <View style={styles.prodActions}>
          <TouchableOpacity
            onPress={() => openEdit(item)}
            style={styles.rowActionBtn}
            accessibilityLabel="Modifier"
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Text style={styles.actionIcon}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDeleteProduct(item)}
            style={styles.rowActionBtn}
            accessibilityLabel="Supprimer"
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Text style={styles.actionIcon}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  ), [searchQuery, filterFamily]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>

      {/* ── Tab bar ──────────────────────────────────────────────────── */}
      <View style={styles.tabs}>
        {(['io', 'products'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'io' ? t('tab_import_export') : t('tab_products')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Import / Export tab ──────────────────────────────────────── */}
      {activeTab === 'io' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>

          {/* Export card */}
          <View style={[styles.card, shadow.md]}>
            <Text style={styles.cardTitle}>{t('import_export_export_title')}</Text>
            <Text style={styles.cardDesc}>{t('import_export_export_desc')}</Text>
            <TouchableOpacity
              style={[styles.btn, styles.btnExport, exporting && styles.btnDisabled]}
              onPress={handleExport}
              disabled={exporting}
            >
              {exporting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.btnText}>{t('import_export_export_action')}</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Import card */}
          <View style={[styles.card, shadow.md]}>
            <Text style={styles.cardTitle}>{t('import_export_import_title')}</Text>
            <Text style={styles.cardDesc}>{t('import_export_import_desc')}</Text>

            <TouchableOpacity style={styles.pickerRow} onPress={pickProductFile}>
              <View style={styles.pickerIcon}><Text style={styles.pickerEmoji}>📄</Text></View>
              <View style={styles.pickerInfo}>
                <Text style={styles.pickerLabel}>{t('import_export_import_pick_file')}</Text>
                <Text style={[styles.pickerValue, !productFile && styles.pickerValueEmpty]} numberOfLines={1}>
                  {productFile?.name ?? t('import_export_import_file_none')}
                </Text>
              </View>
              <Text style={styles.pickerChevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.pickerRow} onPress={pickImages}>
              <View style={styles.pickerIcon}><Text style={styles.pickerEmoji}>🖼️</Text></View>
              <View style={styles.pickerInfo}>
                <Text style={styles.pickerLabel}>Photos produits (galerie)</Text>
                <Text style={[styles.pickerValue, !hasImages && styles.pickerValueEmpty]} numberOfLines={1}>
                  {hasImages
                    ? `${imageFiles.length} photo${imageFiles.length > 1 ? 's' : ''} sélectionnée${imageFiles.length > 1 ? 's' : ''}`
                    : 'Appuyer pour ouvrir la galerie'}
                </Text>
              </View>
              {hasImages ? (
                <TouchableOpacity onPress={() => setImageFiles([])} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.clearBtn}>✕</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.pickerChevron}>›</Text>
              )}
            </TouchableOpacity>

            {hasImages && (
              <>
                <View style={styles.divider} />
                <View style={styles.strategySection}>
                  <Text style={styles.strategyLabel}>{t('import_export_import_strategy_label')}</Text>
                  <View style={styles.strategyRow}>
                    <StrategyOption
                      selected={strategy === 'order'}
                      onPress={() => setStrategy('order')}
                      title={t('import_export_import_strategy_order')}
                      hint={t('import_export_import_strategy_order_hint')}
                    />
                    <View style={styles.strategyGap} />
                    <StrategyOption
                      selected={strategy === 'codegold'}
                      onPress={() => setStrategy('codegold')}
                      title={t('import_export_import_strategy_codegold')}
                      hint={t('import_export_import_strategy_codegold_hint')}
                    />
                  </View>
                </View>
              </>
            )}

            <TouchableOpacity
              style={[styles.btn, styles.btnImport, !canImport && styles.btnDisabled]}
              onPress={handleImport}
              disabled={!canImport}
            >
              {importing
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.btnText}>{t('import_export_import_start')}</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Standalone image upload card */}
          <View style={[styles.card, shadow.md]}>
            <Text style={styles.cardTitle}>{t('img_upload_title')}</Text>
            <Text style={styles.cardDesc}>{t('img_upload_desc')}</Text>

            <TouchableOpacity style={styles.pickerRow} onPress={pickImgOnly}>
              <View style={styles.pickerIcon}><Text style={styles.pickerEmoji}>🖼️</Text></View>
              <View style={styles.pickerInfo}>
                <Text style={styles.pickerLabel}>Photos produits (galerie)</Text>
                <Text style={[styles.pickerValue, !imgOnlyFiles.length && styles.pickerValueEmpty]} numberOfLines={1}>
                  {imgOnlyFiles.length
                    ? `${imgOnlyFiles.length} photo${imgOnlyFiles.length > 1 ? 's' : ''} sélectionnée${imgOnlyFiles.length > 1 ? 's' : ''}`
                    : 'Appuyer pour ouvrir la galerie'}
                </Text>
              </View>
              {imgOnlyFiles.length ? (
                <TouchableOpacity onPress={() => setImgOnlyFiles([])} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.clearBtn}>✕</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.pickerChevron}>›</Text>
              )}
            </TouchableOpacity>

            {imgOnlyFiles.length > 0 && (
              <>
                <View style={styles.divider} />
                <View style={styles.strategySection}>
                  <Text style={styles.strategyLabel}>{t('import_export_import_strategy_label')}</Text>
                  <View style={styles.strategyRow}>
                    <StrategyOption
                      selected={imgOnlyStrat === 'codegold'}
                      onPress={() => setImgOnlyStrat('codegold')}
                      title={t('import_export_import_strategy_codegold')}
                      hint={t('import_export_import_strategy_codegold_hint')}
                    />
                    <View style={styles.strategyGap} />
                    <StrategyOption
                      selected={imgOnlyStrat === 'barcode'}
                      onPress={() => setImgOnlyStrat('barcode')}
                      title={t('img_upload_strategy_barcode')}
                      hint={t('img_upload_strategy_barcode_hint')}
                    />
                  </View>
                </View>
              </>
            )}

            <TouchableOpacity
              style={[styles.btn, styles.btnImgUpload, (!imgOnlyFiles.length || uploadingImgs) && styles.btnDisabled]}
              onPress={handleUploadImages}
              disabled={!imgOnlyFiles.length || uploadingImgs}
            >
              {uploadingImgs
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.btnText}>{t('img_upload_action')}</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Import report */}
          {importResult && (
            <View style={[styles.card, shadow.md, styles.reportCard]}>
              <Text style={styles.reportTitle}>✅ {t('import_export_import_done')}</Text>
              <View style={styles.reportRow}>
                <Text style={styles.reportKey}>{t('import_report_imported')}</Text>
                <Text style={styles.reportVal}>{importResult.imported}</Text>
              </View>
              {importResult.imagesUploaded > 0 && (
                <View style={styles.reportRow}>
                  <Text style={styles.reportKey}>{t('import_report_images')}</Text>
                  <Text style={styles.reportVal}>{importResult.imagesMatched} / {importResult.imagesUploaded}</Text>
                </View>
              )}
              {importResult.errors.length > 0 && (
                <View style={styles.reportErrors}>
                  <Text style={styles.reportErrTitle}>⚠️ {importResult.errors.length} {t('import_report_errors')}</Text>
                  {importResult.errors.slice(0, 10).map((e, i) => (
                    <Text key={i} style={styles.reportErrItem} numberOfLines={2}>• {e}</Text>
                  ))}
                </View>
              )}
              {(importResult.productResults ?? []).length > 0 && (
                <ProductImportResultsList
                  title={t('import_report_per_product')}
                  results={importResult.productResults!}
                  showAllLabel={t('img_upload_show_all')}
                />
              )}
              {(importResult.imageResults ?? []).length > 0 && (
                <ImageResultsList
                  title={t('import_report_per_image')}
                  results={importResult.imageResults!}
                  showAllLabel={t('img_upload_show_all')}
                />
              )}
              <TouchableOpacity onPress={() => setImportResult(null)} style={styles.reportClose}>
                <Text style={styles.reportCloseText}>{t('common_close')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Standalone image upload report */}
          {imgUploadResult && (
            <View style={[styles.card, shadow.md, styles.reportCard]}>
              <Text style={styles.reportTitle}>
                {imgUploadResult.matched > 0 ? '✅' : '⚠️'} {t('img_upload_done')}
              </Text>
              {/* Stats bar */}
              <View style={styles.statsBar}>
                <View style={[styles.statsPill, styles.statsPillGreen]}>
                  <Text style={styles.statsPillNum}>{imgUploadResult.matched}</Text>
                  <Text style={styles.statsPillLabel}>{t('img_upload_matched')}</Text>
                </View>
                <View style={[styles.statsPill, imgUploadResult.uploaded - imgUploadResult.matched > 0 ? styles.statsPillRed : styles.statsPillGray]}>
                  <Text style={styles.statsPillNum}>{imgUploadResult.uploaded - imgUploadResult.matched}</Text>
                  <Text style={styles.statsPillLabel}>{t('img_upload_failed')}</Text>
                </View>
                <View style={[styles.statsPill, styles.statsPillGray]}>
                  <Text style={styles.statsPillNum}>{imgUploadResult.uploaded}</Text>
                  <Text style={styles.statsPillLabel}>Total</Text>
                </View>
              </View>
              {imgUploadResult.imageResults.length > 0 && (
                <ImageResultsList
                  title={t('img_upload_detail_title')}
                  results={imgUploadResult.imageResults}
                  showAllLabel={t('img_upload_show_all')}
                />
              )}
              <TouchableOpacity onPress={() => setImgUploadResult(null)} style={styles.reportClose}>
                <Text style={styles.reportCloseText}>{t('common_close')}</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      )}

      {/* ── Products tab ─────────────────────────────────────────────── */}
      {activeTab === 'products' && (
        <View style={styles.prodContainer}>

          {/* Search bar */}
          <View style={styles.searchWrap}>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('products_search_placeholder')}
              placeholderTextColor={colors.placeholder}
              clearButtonMode="while-editing"
              returnKeyType="search"
            />
            {!!searchQuery && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClear}>
                <Text style={styles.searchClearText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Family filter chips */}
          {(families.length > 0 || famLoading) && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterRow}
              contentContainerStyle={styles.filterContent}
            >
              {famLoading ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginHorizontal: spacing.md }} />
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.filterChip, !filterFamily && styles.filterChipActive]}
                    onPress={() => setFilterFamily('')}
                  >
                    <Text style={[styles.filterChipText, !filterFamily && styles.filterChipTextActive]}>
                      {t('products_filter_all')}
                    </Text>
                  </TouchableOpacity>
                  {families.map((f) => (
                    <TouchableOpacity
                      key={f.id}
                      style={[styles.filterChip, filterFamily === f.name && styles.filterChipActive]}
                      onPress={() => setFilterFamily(filterFamily === f.name ? '' : f.name)}
                    >
                      <Text style={[styles.filterChipText, filterFamily === f.name && styles.filterChipTextActive]}>
                        {f.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </ScrollView>
          )}

          {/* Count indicator */}
          {!prodLoading && (
            <View style={styles.countBar}>
              <Text style={styles.countText}>
                {prodTotal} produit{prodTotal !== 1 ? 's' : ''}
                {filterFamily ? ` · ${filterFamily}` : ''}
                {searchQuery ? ` · "${searchQuery}"` : ''}
              </Text>
              {(filterFamily || searchQuery) && (
                <TouchableOpacity onPress={() => { setSearchQuery(''); setFilterFamily(''); }}>
                  <Text style={styles.clearFilters}>Effacer</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {prodLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} size="large" />
          ) : prodError ? (
            <View style={styles.centerWrap}>
              <Text style={styles.errorText}>{prodError}</Text>
              <TouchableOpacity onPress={() => loadProds(1, searchQuery, filterFamily, true)}>
                <Text style={styles.retryText}>{t('common_retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={products}
              keyExtractor={(item) => item.id}
              renderItem={renderProduct}
              contentContainerStyle={products.length === 0 ? styles.centerWrap : styles.prodList}
              windowSize={10}
              maxToRenderPerBatch={10}
              initialNumToRender={10}
              ListEmptyComponent={<Text style={styles.emptyText}>{t('products_empty')}</Text>}
              ListFooterComponent={
                hasMore ? (
                  <TouchableOpacity
                    style={styles.loadMoreBtn}
                    onPress={() => loadProds(prodPage + 1, searchQuery, filterFamily, false)}
                    disabled={prodLoadingMore}
                  >
                    {prodLoadingMore
                      ? <ActivityIndicator color={colors.primary} size="small" />
                      : <Text style={styles.loadMoreText}>{t('products_load_more')}</Text>
                    }
                  </TouchableOpacity>
                ) : null
              }
            />
          )}

          {/* FAB: create new product */}
          <TouchableOpacity
            style={styles.fab}
            onPress={openCreate}
            accessibilityLabel={t('nav_add_product')}
          >
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Progress overlay ─────────────────────────────────────────── */}
      <Modal visible={progressVisible} transparent animationType="fade">
        <View style={styles.progressOverlay}>
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>
              {uploadingImgs ? t('img_upload_progress_title') : t('import_progress_title')}
            </Text>
            <Text style={styles.progressPhase}>
              {uploadingImgs
                ? activePhase === 'upload'
                  ? t('img_upload_progress_count')
                      .replace('{done}', String(imgUploadDone))
                      .replace('{total}', String(imgUploadTotal))
                  : t('import_progress_processing')
                : activePhase === 'upload'
                  ? t('import_progress_uploading').replace('{pct}', String(activePct))
                  : t('import_progress_processing')}
            </Text>
            <View style={styles.progressTrack}>
              <View style={[
                styles.progressFill,
                {
                  width: `${activePhase === 'processing' ? 100
                    : uploadingImgs && imgUploadTotal > 0
                      ? Math.round((imgUploadDone / imgUploadTotal) * 100)
                      : activePct}%` as any,
                },
              ]} />
            </View>
            <Text style={styles.progressPct}>
              {uploadingImgs
                ? activePhase === 'processing'
                  ? `${imgUploadTotal} / ${imgUploadTotal}`
                  : `${imgUploadDone} / ${imgUploadTotal}`
                : activePhase === 'processing' ? '100%' : `${activePct}%`}
            </Text>
            <View style={styles.fileList}>
              {!uploadingImgs && productFile && (
                <FileStatusRow name={productFile.name} emoji="📄"
                  status={importPct > 0 || importPhase === 'processing' ? 'done' : 'pending'} />
              )}
              {activeFiles.slice(0, 5).map((f, i) => {
                const batchSize = 10;
                const status: FileStatus = uploadingImgs
                  ? (imgUploadPhase === 'processing' || i < imgUploadDone) ? 'done'
                    : i < imgUploadDone + batchSize ? 'uploading'
                    : 'pending'
                  : (() => {
                      const batchStart = i * 20;
                      return importPhase === 'processing' ? 'done'
                        : importPct >= batchStart + 20 ? 'done'
                        : importPct >= batchStart ? 'uploading'
                        : 'pending';
                    })();
                return <FileStatusRow key={f.uri} name={f.name} emoji="🖼️" status={status} />;
              })}
              {activeFiles.length > 5 && (
                <Text style={styles.moreFiles}>
                  {t('import_progress_more_files').replace('{count}', String(activeFiles.length - 5))}
                </Text>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Product form modal (inline CRUD) ────────────────────────── */}
      <ProductFormModal
        visible={formVisible}
        product={editingProduct}
        onClose={() => setFormVisible(false)}
        onSaved={handleSaved}
      />

    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────

function StrategyOption({
  selected, onPress, title, hint,
}: { selected: boolean; onPress: () => void; title: string; hint: string }) {
  return (
    <TouchableOpacity
      style={[styles.strategyOption, selected && styles.strategyOptionSelected]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <View style={styles.strategyRadioRow}>
        <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
          {selected && <View style={styles.radioInner} />}
        </View>
        <Text style={[styles.strategyOptionTitle, selected && styles.strategyOptionTitleSelected]}>
          {title}
        </Text>
      </View>
      <Text style={styles.strategyOptionHint} numberOfLines={2}>{hint}</Text>
    </TouchableOpacity>
  );
}

type FileStatus = 'pending' | 'uploading' | 'done' | 'error';

function FileStatusRow({ name, emoji, status }: { name: string; emoji: string; status: FileStatus }) {
  const badge = status === 'done' ? '✅' : status === 'uploading' ? '⬆️' : status === 'error' ? '❌' : '⏳';
  return (
    <View style={styles.fileRow}>
      <Text style={styles.fileEmoji}>{emoji}</Text>
      <Text style={styles.fileName} numberOfLines={1}>{name}</Text>
      <Text style={styles.fileBadge}>{badge}</Text>
    </View>
  );
}

const INITIAL_SHOW = 10;

function ImageResultsList({
  title, results, showAllLabel,
}: { title: string; results: ImageUploadDetail[]; showAllLabel: string }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? results : results.slice(0, INITIAL_SHOW);
  const extra = results.length - INITIAL_SHOW;
  return (
    <View style={styles.imgResultSection}>
      <Text style={styles.imgResultSectionTitle}>{title}</Text>
      {visible.map((r, i) => (
        <View key={i} style={[styles.imgResultRow, r.matched ? styles.imgResultRowOk : styles.imgResultRowErr]}>
          <Text style={styles.imgResultBadge}>{r.matched ? '✅' : '❌'}</Text>
          <View style={styles.imgResultInfo}>
            <Text style={styles.imgResultFile} numberOfLines={1}>{r.filename}</Text>
            {r.matched
              ? <Text style={styles.imgResultProduct} numberOfLines={1}>→ {r.productName}</Text>
              : <Text style={styles.imgResultReason} numberOfLines={2}>{r.reason}</Text>
            }
          </View>
        </View>
      ))}
      {!expanded && extra > 0 && (
        <TouchableOpacity onPress={() => setExpanded(true)} style={styles.showAllBtn}>
          <Text style={styles.showAllText}>{showAllLabel.replace('{count}', String(extra))}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function ProductImportResultsList({
  title, results, showAllLabel,
}: { title: string; results: ProductImportRow[]; showAllLabel: string }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? results : results.slice(0, INITIAL_SHOW);
  const extra = results.length - INITIAL_SHOW;
  return (
    <View style={styles.imgResultSection}>
      <Text style={styles.imgResultSectionTitle}>{title}</Text>
      {visible.map((r, i) => (
        <View key={i} style={[styles.imgResultRow, r.success ? styles.imgResultRowOk : styles.imgResultRowErr]}>
          <Text style={styles.imgResultBadge}>{r.success ? '✅' : '❌'}</Text>
          <View style={styles.imgResultInfo}>
            <Text style={styles.imgResultFile} numberOfLines={1}>
              {r.name}{r.codeGold ? ` · ${r.codeGold}` : ''}
            </Text>
            {!r.success && r.reason && (
              <Text style={styles.imgResultReason} numberOfLines={2}>{r.reason}</Text>
            )}
          </View>
        </View>
      ))}
      {!expanded && extra > 0 && (
        <TouchableOpacity onPress={() => setExpanded(true)} style={styles.showAllBtn}>
          <Text style={styles.showAllText}>{showAllLabel.replace('{count}', String(extra))}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: colors.bg },
  scroll:    { flex: 1 },
  container: { padding: spacing.xl, gap: spacing.lg, paddingBottom: 40 },

  tabs:          { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab:           { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:     { borderBottomColor: colors.primary },
  tabText:       { ...typography.small, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.primary },

  card:      { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xxl },
  cardTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  cardDesc:  { ...typography.small, color: colors.textMuted, marginBottom: spacing.lg },

  pickerRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  pickerIcon:       { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  pickerEmoji:      { fontSize: 20 },
  pickerInfo:       { flex: 1 },
  pickerLabel:      { ...typography.label, color: colors.text, marginBottom: 2 },
  pickerValue:      { ...typography.small, color: colors.primary },
  pickerValueEmpty: { color: colors.placeholder },
  pickerChevron:    { fontSize: 20, color: colors.placeholder, marginLeft: spacing.sm },
  clearBtn:         { fontSize: 14, color: colors.error, fontWeight: '700', marginLeft: spacing.sm },
  divider:          { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },

  strategySection: { paddingVertical: spacing.md },
  strategyLabel:   { ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm },
  strategyRow:     { flexDirection: 'row' },
  strategyGap:     { width: spacing.sm },
  strategyOption: {
    flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, backgroundColor: colors.bg,
  },
  strategyOptionSelected:      { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  strategyRadioRow:            { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  radioOuter:                  { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.placeholder, alignItems: 'center', justifyContent: 'center', marginRight: spacing.xs },
  radioOuterSelected:          { borderColor: colors.primary },
  radioInner:                  { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  strategyOptionTitle:         { ...typography.label, color: colors.text, fontWeight: '600' },
  strategyOptionTitleSelected: { color: colors.primary },
  strategyOptionHint:          { ...typography.caption, color: colors.textMuted, fontSize: 11 },

  btn:          { borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.lg },
  btnExport:    { backgroundColor: colors.primary },
  btnImport:    { backgroundColor: '#16a34a' },
  btnImgUpload: { backgroundColor: '#7c3aed' },
  btnDisabled:  { opacity: 0.4 },
  btnText:      { color: '#fff', fontSize: 15, fontWeight: '700' },

  reportCard:      { backgroundColor: '#f0fdf4' },
  reportTitle:     { ...typography.h3, color: '#15803d', marginBottom: spacing.md },
  reportRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: '#bbf7d0' },
  reportKey:       { ...typography.body, color: colors.text },
  reportVal:       { ...typography.body, color: '#15803d', fontWeight: '700' },
  reportErrors:    { marginTop: spacing.md, backgroundColor: '#fff7ed', borderRadius: radius.sm, padding: spacing.sm },
  reportErrTitle:  { ...typography.label, color: '#c2410c', marginBottom: spacing.xs },
  reportErrItem:   { ...typography.small, color: '#9a3412', marginBottom: 2 },
  reportClose:     { marginTop: spacing.md, paddingVertical: spacing.sm, alignItems: 'center' },
  reportCloseText: { ...typography.label, color: colors.textMuted },

  statsBar:       { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md },
  statsPill:      { flex: 1, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
  statsPillGreen: { backgroundColor: '#dcfce7' },
  statsPillRed:   { backgroundColor: '#fee2e2' },
  statsPillGray:  { backgroundColor: '#f3f4f6' },
  statsPillNum:   { fontSize: 20, fontWeight: '800', color: colors.text },
  statsPillLabel: { ...typography.caption, color: colors.textMuted, marginTop: 2 },

  imgResultSection:      { marginTop: spacing.md },
  imgResultSectionTitle: { ...typography.label, color: colors.text, marginBottom: spacing.sm, fontWeight: '700' },
  imgResultRow:          { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  imgResultRowOk:        { backgroundColor: '#f0fdf4' },
  imgResultRowErr:       { backgroundColor: '#fef2f2' },
  imgResultBadge:        { fontSize: 14, width: 24, marginRight: spacing.xs, marginTop: 1 },
  imgResultInfo:         { flex: 1 },
  imgResultFile:         { ...typography.small, color: colors.text, fontWeight: '600' },
  imgResultProduct:      { ...typography.caption, color: '#15803d' },
  imgResultReason:       { ...typography.caption, color: colors.error },
  showAllBtn:            { paddingVertical: spacing.sm, alignItems: 'center' },
  showAllText:           { ...typography.label, color: colors.primary },

  // Products tab
  prodContainer: { flex: 1 },
  searchWrap: {
    margin: spacing.md, marginBottom: 0,
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, height: 44, fontSize: 15, color: colors.text },
  searchClear: { padding: spacing.xs },
  searchClearText: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },

  filterRow:    { maxHeight: 44, marginTop: spacing.sm },
  filterContent: { paddingHorizontal: spacing.md, gap: spacing.xs, alignItems: 'center' },
  filterChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipActive:    { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  filterChipText:      { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  filterChipTextActive: { color: colors.primary },

  countBar:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  countText:   { ...typography.caption, color: colors.textMuted },
  clearFilters: { ...typography.caption, color: colors.primary, fontWeight: '700' },

  prodList:    { padding: spacing.md, paddingBottom: 100 },
  prodRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.md,
    marginBottom: spacing.sm, padding: spacing.md, ...shadow.sm,
  },
  prodMain:      { flex: 1, marginRight: spacing.sm },
  prodName:      { ...typography.body, color: colors.text, fontWeight: '600' },
  prodMeta:      { ...typography.small, color: colors.textMuted, marginTop: 2 },
  prodHierarchy: { ...typography.caption, color: colors.primary, marginTop: 2 },
  prodRight:     { alignItems: 'flex-end', gap: spacing.xs },
  prodPrice:     { ...typography.small, color: colors.success, fontWeight: '700' },
  prodActions:   { flexDirection: 'row' },
  rowActionBtn:  { paddingHorizontal: spacing.xs },
  actionIcon:    { fontSize: 18 },

  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  emptyText:  { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  errorText:  { ...typography.body, color: colors.error, marginBottom: spacing.sm },
  retryText:  { ...typography.label, color: colors.primary },

  loadMoreBtn:  { alignItems: 'center', paddingVertical: spacing.lg, marginBottom: spacing.xxl },
  loadMoreText: { ...typography.label, color: colors.primary },

  fab:     { position: 'absolute', bottom: 28, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadow.md },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 32 },

  progressOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  progressCard:    { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xxl, width: '100%', ...shadow.md },
  progressTitle:   { ...typography.h3, color: colors.text, marginBottom: spacing.md, textAlign: 'center' },
  progressPhase:   { ...typography.small, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.md },
  progressTrack:   { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden', marginBottom: spacing.xs },
  progressFill:    { height: 8, backgroundColor: colors.primary, borderRadius: 4 },
  progressPct:     { ...typography.label, color: colors.primary, textAlign: 'right', marginBottom: spacing.lg },
  fileList:        { gap: spacing.sm },
  fileRow:         { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  fileEmoji:       { fontSize: 16, width: 22 },
  fileName:        { flex: 1, ...typography.small, color: colors.text },
  fileBadge:       { fontSize: 16, width: 24, textAlign: 'center' },
  moreFiles:       { ...typography.small, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
});
