import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, TouchableOpacity, Modal, FlatList, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { createProduct, updateProduct, ProductPayload } from '../api/admin';
import { apiClient } from '../api/client';
import { listFamilies, listSubFamilies, listCategories, FamilyItem, SubFamilyItem, CategoryItem } from '../api/hierarchy';
import { Product } from '../api/search';
import { useI18n } from '../i18n';
import { colors, spacing, radius, typography, shadow } from '../theme';

interface Props {
  visible: boolean;
  product?: Product | null;
  onClose: () => void;
  onSaved: () => void;
}

type PickerItem = { id: string; name: string };

function HierarchyPicker({
  label, value, placeholder, items, disabled, onSelect, loading,
}: {
  label: string; value: string; placeholder: string; items: PickerItem[];
  disabled?: boolean; onSelect: (item: PickerItem) => void; loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={fStyles.fieldWrap}>
      <Text style={fStyles.label}>{label}</Text>
      <TouchableOpacity
        style={[fStyles.pickerBtn, disabled && fStyles.pickerDisabled]}
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        accessibilityLabel={label}
      >
        {loading
          ? <ActivityIndicator size="small" color={colors.primary} />
          : <Text style={[fStyles.pickerText, !value && fStyles.pickerPlaceholder]}>{value || placeholder}</Text>
        }
        <Text style={fStyles.pickerChevron}>▼</Text>
      </TouchableOpacity>
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={fStyles.pickerOverlay}>
          <View style={fStyles.pickerSheet}>
            <Text style={fStyles.pickerSheetTitle}>{label}</Text>
            <FlatList
              data={items}
              keyExtractor={(i) => i.id}
              ListEmptyComponent={<Text style={fStyles.emptyText}>Aucun élément</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[fStyles.pickerItem, value === item.name && fStyles.pickerItemActive]}
                  onPress={() => { onSelect(item); setOpen(false); }}
                >
                  <Text style={[fStyles.pickerItemText, value === item.name && fStyles.pickerItemTextActive]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={fStyles.pickerCancel} onPress={() => setOpen(false)}>
              <Text style={fStyles.pickerCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Field({
  label, value, onChangeText, placeholder, required, multiline, keyboardType = 'default',
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; required?: boolean; multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View style={fStyles.fieldWrap}>
      <Text style={fStyles.label}>{label}{required ? ' *' : ''}</Text>
      <TextInput
        style={[fStyles.input, multiline && fStyles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        autoCorrect={false}
        autoCapitalize={multiline ? 'sentences' : 'none'}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
        accessibilityLabel={label}
      />
    </View>
  );
}

export default function ProductFormModal({ visible, product, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const isEdit = !!product;

  const [name,        setName]        = useState('');
  const [codeGold,    setCodeGold]    = useState('');
  const [brand,       setBrand]       = useState('');
  const [barcode,     setBarcode]     = useState('');
  const [description, setDescription] = useState('');
  const [price,       setPrice]       = useState('');
  const [stock,       setStock]       = useState('');
  const [pickedImage, setPickedImage] = useState<string | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [error,       setError]       = useState('');

  const [families,    setFamilies]    = useState<FamilyItem[]>([]);
  const [subFamilies, setSubFamilies] = useState<SubFamilyItem[]>([]);
  const [categories,  setCategories]  = useState<CategoryItem[]>([]);
  const [loadingHier, setLoadingHier] = useState(false);
  const [loadingSF,   setLoadingSF]   = useState(false);
  const [loadingCat,  setLoadingCat]  = useState(false);

  const [selectedFamily,    setSelectedFamily]    = useState('');
  const [selectedSubFamily, setSelectedSubFamily] = useState('');
  const [selectedCategory,  setSelectedCategory]  = useState('');
  const [selectedFamilyId,  setSelectedFamilyId]  = useState('');
  const [selectedSFId,      setSelectedSFId]      = useState('');

  useEffect(() => {
    if (!visible) return;

    setName(product?.name ?? '');
    setCodeGold(product?.codeGold ?? '');
    setBrand(product?.brand ?? '');
    setBarcode(product?.barcode ?? '');
    setDescription(product?.description ?? '');
    setPrice(product?.price != null ? String(product.price) : '');
    setStock(product?.stock != null ? String(product.stock) : '');
    setPickedImage(product?.images?.[0] ?? null);
    setError('');
    setSelectedFamily(product?.family ?? '');
    setSelectedSubFamily(product?.subcategory ?? '');
    setSelectedCategory(product?.category ?? '');
    setSelectedFamilyId('');
    setSelectedSFId('');
    setSubFamilies([]);
    setCategories([]);

    setLoadingHier(true);
    listFamilies()
      .then((data) => {
        setFamilies(data);
        if (product?.family) {
          const match = data.find((f) => f.name === product.family);
          if (match) {
            setSelectedFamilyId(match.id);
            setLoadingSF(true);
            listSubFamilies(match.id).then((sfs) => {
              setSubFamilies(sfs);
              if (product.subcategory) {
                const sfMatch = sfs.find((sf) => sf.name === product.subcategory);
                if (sfMatch) {
                  setSelectedSFId(sfMatch.id);
                  setLoadingCat(true);
                  listCategories(sfMatch.id)
                    .then((cats) => { setCategories(cats); setLoadingCat(false); })
                    .catch(() => setLoadingCat(false));
                }
              }
            }).catch(() => {}).finally(() => setLoadingSF(false));
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingHier(false));
  }, [visible, product]);

  const onSelectFamily = useCallback((item: PickerItem) => {
    setSelectedFamily(item.name);
    setSelectedFamilyId(item.id);
    setSelectedSubFamily('');
    setSelectedSFId('');
    setSelectedCategory('');
    setSubFamilies([]);
    setCategories([]);
    setLoadingSF(true);
    listSubFamilies(item.id).then(setSubFamilies).catch(() => {}).finally(() => setLoadingSF(false));
  }, []);

  const onSelectSubFamily = useCallback((item: PickerItem) => {
    setSelectedSubFamily(item.name);
    setSelectedSFId(item.id);
    setSelectedCategory('');
    setCategories([]);
    setLoadingCat(true);
    listCategories(item.id).then(setCategories).catch(() => {}).finally(() => setLoadingCat(false));
  }, []);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setPickedImage(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError(t('product_form_error_name'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setError('');

    const payload: ProductPayload = {
      name:        name.trim(),
      codeGold:    codeGold.trim()    || undefined,
      brand:       brand.trim()       || undefined,
      barcode:     barcode.trim()     || undefined,
      description: description.trim() || undefined,
      family:      selectedFamily     || undefined,
      subcategory: selectedSubFamily  || undefined,
      category:    selectedCategory   || undefined,
      price:       price.trim()  ? parseFloat(price.trim())  : undefined,
      stock:       stock.trim()  ? parseInt(stock.trim(), 10) : undefined,
    };

    setLoading(true);
    try {
      let productId: string;
      if (isEdit) {
        await updateProduct(product!.id, payload);
        productId = product!.id;
      } else {
        const created = await createProduct(payload);
        productId = created.id;
      }

      const isNewImage = pickedImage && pickedImage !== product?.images?.[0];
      if (isNewImage) {
        setUploadingImg(true);
        try {
          const imgName = pickedImage.split('/').pop() ?? 'product.jpg';
          const form = new FormData();
          form.append('image', { uri: pickedImage, name: imgName, type: 'image/jpeg' } as any);
          await apiClient.post(`/products/${productId}/image`, form, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch { /* non-fatal */ } finally {
          setUploadingImg(false);
        }
      }

      apiClient.post(`/products/${productId}/trigger-embedding`).catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message ?? t('product_form_error_generic'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const isBusy = loading || uploadingImg;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={fStyles.safe} edges={['top', 'bottom']}>

        {/* ── Header ── */}
        <View style={fStyles.header}>
          <TouchableOpacity onPress={onClose} style={fStyles.headerSide} disabled={isBusy}>
            <Text style={[fStyles.headerCancel, isBusy && fStyles.dimmed]}>{t('common_cancel')}</Text>
          </TouchableOpacity>
          <Text style={fStyles.headerTitle} numberOfLines={1}>
            {isEdit ? t('product_form_title_edit') : t('product_form_title_create')}
          </Text>
          <TouchableOpacity onPress={handleSave} style={[fStyles.headerSide, fStyles.headerSideRight]} disabled={isBusy}>
            {isBusy
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Text style={fStyles.headerSave}>{t('product_form_save')}</Text>
            }
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={fStyles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            contentContainerStyle={fStyles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            {!!error && (
              <View style={fStyles.errorBox}>
                <Text style={fStyles.errorText}>⚠️  {error}</Text>
              </View>
            )}

            {/* ── Section: Identification ── */}
            <View style={[fStyles.section, shadow.sm]}>
              <Text style={fStyles.sectionTitle}>{t('crud_section_identification')}</Text>
              <Field
                label={t('product_form_name')} required
                value={name} onChangeText={(v) => { setName(v); setError(''); }}
                placeholder="Ex. Fleur artificielle pivoine"
              />
              <Field label={t('product_form_codegold')} value={codeGold} onChangeText={setCodeGold} placeholder="Ex. CG-AF-001" />
              <Field label={t('product_form_brand')}    value={brand}    onChangeText={setBrand}    placeholder="Ex. Florart" />
              <Field label={t('product_form_barcode')}  value={barcode}  onChangeText={setBarcode}  placeholder="Ex. 3700123456789" keyboardType="numeric" />
            </View>

            {/* ── Section: Hierarchy ── */}
            <View style={[fStyles.section, shadow.sm]}>
              <Text style={fStyles.sectionTitle}>{t('product_form_hierarchy')}</Text>
              <HierarchyPicker
                label={t('product_form_family')}
                value={selectedFamily}
                placeholder={t('product_form_select_family')}
                items={families}
                loading={loadingHier}
                onSelect={onSelectFamily}
              />
              <HierarchyPicker
                label={t('product_form_subfamily')}
                value={selectedSubFamily}
                placeholder={t('product_form_select_subfamily')}
                items={subFamilies}
                disabled={!selectedFamilyId}
                loading={loadingSF}
                onSelect={onSelectSubFamily}
              />
              <HierarchyPicker
                label={t('product_form_category')}
                value={selectedCategory}
                placeholder={t('product_form_select_category')}
                items={categories}
                disabled={!selectedSFId}
                loading={loadingCat}
                onSelect={(item) => setSelectedCategory(item.name)}
              />
            </View>

            {/* ── Section: Details ── */}
            <View style={[fStyles.section, shadow.sm]}>
              <Text style={fStyles.sectionTitle}>{t('crud_section_details')}</Text>
              <Field label={t('product_form_price')} value={price} onChangeText={setPrice} placeholder="Ex. 9.99" keyboardType="numeric" />
              <Field label={t('product_form_stock')} value={stock} onChangeText={setStock} placeholder="Ex. 100" keyboardType="numeric" />
              <Field label={t('product_form_description')} value={description} onChangeText={setDescription} multiline />
            </View>

            {/* ── Section: Image ── */}
            <View style={[fStyles.section, shadow.sm]}>
              <Text style={fStyles.sectionTitle}>{t('product_form_image')}</Text>
              {pickedImage ? (
                <TouchableOpacity onPress={pickImage} activeOpacity={0.8}>
                  <Image source={{ uri: pickedImage }} style={fStyles.imagePreview} resizeMode="cover" />
                  <Text style={fStyles.imageHint}>{t('crud_image_tap_change')}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={fStyles.imagePickerBtn} onPress={pickImage}>
                  <Text style={fStyles.imagePickerEmoji}>📷</Text>
                  <Text style={fStyles.imagePickerText}>{t('crud_image_pick')}</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const fStyles = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: colors.bg },
  flex:  { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerSide:      { minWidth: 80 },
  headerSideRight: { alignItems: 'flex-end' },
  headerCancel:    { ...typography.body, color: colors.textMuted },
  headerTitle:     { flex: 1, ...typography.h3, textAlign: 'center' },
  headerSave:      { ...typography.body, color: colors.primary, fontWeight: '700' },
  dimmed:          { opacity: 0.4 },

  scroll: { padding: spacing.xl, gap: spacing.md, paddingBottom: 60 },

  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionTitle: { ...typography.label, color: colors.primary, marginBottom: spacing.lg },

  errorBox:  { backgroundColor: colors.errorLight, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  errorText: { ...typography.small, color: colors.error },

  fieldWrap: { marginBottom: spacing.lg },
  label:     { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: 15, color: colors.text, backgroundColor: colors.surfaceMuted,
  },
  inputMultiline: { height: 100, paddingTop: spacing.md },

  pickerBtn: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  pickerDisabled:  { opacity: 0.4 },
  pickerText:      { fontSize: 15, color: colors.text, flex: 1 },
  pickerPlaceholder: { color: colors.placeholder },
  pickerChevron:   { fontSize: 12, color: colors.textMuted },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    maxHeight: '70%', padding: spacing.lg,
  },
  pickerSheetTitle:    { ...typography.h3, textAlign: 'center', marginBottom: spacing.md },
  pickerItem:          { paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickerItemActive:    { backgroundColor: colors.primaryLight },
  pickerItemText:      { ...typography.body, color: colors.text },
  pickerItemTextActive: { color: colors.primary, fontWeight: '700' },
  pickerCancel: {
    marginTop: spacing.md, paddingVertical: spacing.md,
    backgroundColor: colors.border, borderRadius: radius.md, alignItems: 'center',
  },
  pickerCancelText: { ...typography.body, color: colors.text, fontWeight: '600' },
  emptyText:        { ...typography.body, color: colors.textMuted, textAlign: 'center', padding: spacing.xl },

  imagePreview: {
    width: '100%', height: 200, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
  },
  imageHint:      { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  imagePickerBtn: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    borderStyle: 'dashed', paddingVertical: spacing.xl,
    alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceMuted,
  },
  imagePickerEmoji: { fontSize: 32 },
  imagePickerText:  { ...typography.body, color: colors.textMuted },
});
