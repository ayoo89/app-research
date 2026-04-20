import React, { useLayoutEffect, useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform,
  TouchableOpacity, Modal, FlatList, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useI18n } from '../i18n';
import Button from '../components/Button';
import { createProduct, updateProduct, ProductPayload } from '../api/admin';
import { apiClient } from '../api/client';
import { listFamilies, listSubFamilies, listCategories, FamilyItem, SubFamilyItem, CategoryItem } from '../api/hierarchy';
import { Product } from '../api/search';
import { colors, spacing, radius, typography, shadow } from '../theme';

interface Props {
  navigation: any;
  route: { params?: { product?: Product } };
}

type PickerItem = { id: string; name: string };

function HierarchyPicker({
  label, value, placeholder, items, disabled, onSelect, loading,
}: {
  label: string;
  value: string;
  placeholder: string;
  items: PickerItem[];
  disabled?: boolean;
  onSelect: (item: PickerItem) => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={pStyles.fieldWrap}>
      <Text style={pStyles.label}>{label}</Text>
      <TouchableOpacity
        style={[pStyles.pickerBtn, disabled && pStyles.pickerDisabled]}
        onPress={() => !disabled && setOpen(true)}
        accessibilityLabel={label}
        disabled={disabled}
      >
        {loading
          ? <ActivityIndicator size="small" color={colors.primary} />
          : <Text style={[pStyles.pickerText, !value && pStyles.pickerPlaceholder]}>
              {value || placeholder}
            </Text>
        }
        <Text style={pStyles.pickerChevron}>▼</Text>
      </TouchableOpacity>
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={pStyles.modalOverlay}>
          <View style={pStyles.modalSheet}>
            <Text style={pStyles.modalTitle}>{label}</Text>
            <FlatList
              data={items}
              keyExtractor={(i) => i.id}
              ListEmptyComponent={<Text style={pStyles.emptyText}>Aucun élément</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[pStyles.modalItem, value === item.name && pStyles.modalItemActive]}
                  onPress={() => { onSelect(item); setOpen(false); }}
                >
                  <Text style={[pStyles.modalItemText, value === item.name && pStyles.modalItemTextActive]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={pStyles.modalCancel} onPress={() => setOpen(false)}>
              <Text style={pStyles.modalCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function ProductFormScreen({ navigation, route }: Props) {
  const { t } = useI18n();
  const existing = route.params?.product;
  const isEdit = !!existing;

  const [name,        setName]        = useState(existing?.name        ?? '');
  const [codeGold,    setCodeGold]    = useState(existing?.codeGold    ?? '');
  const [brand,       setBrand]       = useState(existing?.brand       ?? '');
  const [barcode,     setBarcode]     = useState(existing?.barcode     ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [price,       setPrice]       = useState(existing?.price != null ? String(existing.price) : '');
  const [stock,       setStock]       = useState(existing?.stock != null ? String(existing.stock) : '');
  const [pickedImage, setPickedImage] = useState<string | null>(existing?.images?.[0] ?? null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  const [families,    setFamilies]    = useState<FamilyItem[]>([]);
  const [subFamilies, setSubFamilies] = useState<SubFamilyItem[]>([]);
  const [categories,  setCategories]  = useState<CategoryItem[]>([]);
  const [loadingHier, setLoadingHier] = useState(false);
  const [loadingSF,   setLoadingSF]   = useState(false);
  const [loadingCat,  setLoadingCat]  = useState(false);

  const [selectedFamily,    setSelectedFamily]    = useState<string>(existing?.family ?? '');
  const [selectedSubFamily, setSelectedSubFamily] = useState<string>(existing?.subcategory ?? '');
  const [selectedCategory,  setSelectedCategory]  = useState<string>(existing?.category ?? '');
  const [selectedFamilyId,  setSelectedFamilyId]  = useState('');
  const [selectedSFId,      setSelectedSFId]      = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEdit ? t('product_form_title_edit') : t('product_form_title_create'),
    });
  }, [isEdit, t]);

  useEffect(() => {
    setLoadingHier(true);
    listFamilies()
      .then((data) => {
        setFamilies(data);
        // If editing, try to match existing family name to an id
        if (existing?.family) {
          const match = data.find((f) => f.name === existing.family);
          if (match) {
            setSelectedFamilyId(match.id);
            setLoadingSF(true);
            listSubFamilies(match.id).then((sfs) => {
              setSubFamilies(sfs);
              if (existing.subcategory) {
                const sfMatch = sfs.find((sf) => sf.name === existing.subcategory);
                if (sfMatch) {
                  setSelectedSFId(sfMatch.id);
                  setLoadingCat(true);
                  listCategories(sfMatch.id).then((cats) => { setCategories(cats); setLoadingCat(false); }).catch(() => setLoadingCat(false));
                }
              }
            }).catch(() => {}).finally(() => setLoadingSF(false));
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingHier(false));
  }, []);

  const onSelectFamily = useCallback((item: PickerItem) => {
    setSelectedFamily(item.name);
    setSelectedFamilyId(item.id);
    setSelectedSubFamily('');
    setSelectedSFId('');
    setSelectedCategory('');
    setSubFamilies([]);
    setCategories([]);
    setLoadingSF(true);
    listSubFamilies(item.id)
      .then(setSubFamilies)
      .catch(() => {})
      .finally(() => setLoadingSF(false));
  }, []);

  const onSelectSubFamily = useCallback((item: PickerItem) => {
    setSelectedSubFamily(item.name);
    setSelectedSFId(item.id);
    setSelectedCategory('');
    setCategories([]);
    setLoadingCat(true);
    listCategories(item.id)
      .then(setCategories)
      .catch(() => {})
      .finally(() => setLoadingCat(false));
  }, []);

  const onSelectCategory = useCallback((item: PickerItem) => {
    setSelectedCategory(item.name);
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
      name: name.trim(),
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
        await updateProduct(existing!.id, payload);
        productId = existing!.id;
      } else {
        const created = await createProduct(payload);
        productId = created.id;
      }
      // Upload image if one was picked (new or changed)
      const isNewImage = pickedImage && pickedImage !== existing?.images?.[0];
      if (isNewImage) {
        setUploadingImg(true);
        try {
          const imgName = pickedImage.split('/').pop() ?? 'product.jpg';
          const form = new FormData();
          form.append('image', { uri: pickedImage, name: imgName, type: 'image/jpeg' } as any);
          await apiClient.post(`/products/${productId}/image`, form, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch { /* image upload failure is non-fatal */ } finally {
          setUploadingImg(false);
        }
      }
      // Trigger embedding re-generation on both create and update
      apiClient.post(`/products/${productId}/trigger-embedding`).catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message ?? t('product_form_error_generic'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={pStyles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={pStyles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={pStyles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[pStyles.card, shadow.md]}>
            {!!error && (
              <View style={pStyles.errorBox}>
                <Text style={pStyles.errorText}>⚠️  {error}</Text>
              </View>
            )}

            <Field label={t('product_form_name')} required value={name} onChangeText={(v) => { setName(v); setError(''); }} placeholder="Ex. Fleur artificielle pivoine" />
            <Field label={t('product_form_codegold')} value={codeGold} onChangeText={setCodeGold} placeholder="Ex. CG-AF-001" />
            <Field label={t('product_form_brand')} value={brand} onChangeText={setBrand} placeholder="Ex. Florart" />
            <Field label={t('product_form_barcode')} value={barcode} onChangeText={setBarcode} placeholder="Ex. 3700123456789" keyboardType="numeric" />

            <View style={pStyles.sectionDivider}>
              <Text style={pStyles.sectionLabel}>{t('product_form_hierarchy')}</Text>
            </View>

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
              onSelect={onSelectCategory}
            />

            <Field label={t('product_form_price')} value={price} onChangeText={setPrice} placeholder="Ex. 9.99" keyboardType="numeric" />
            <Field label={t('product_form_stock')} value={stock} onChangeText={setStock} placeholder="Ex. 100" keyboardType="numeric" />

            <Field label={t('product_form_description')} value={description} onChangeText={setDescription} multiline />

            <View style={pStyles.fieldWrap}>
              <Text style={pStyles.label}>{t('product_form_image')}</Text>
              {pickedImage ? (
                <TouchableOpacity onPress={pickImage} activeOpacity={0.8}>
                  <Image source={{ uri: pickedImage }} style={pStyles.imagePreview} resizeMode="cover" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={pStyles.imagePickerBtn} onPress={pickImage}>
                  <Text style={pStyles.imagePickerText}>📷  {t('product_form_image')}</Text>
                </TouchableOpacity>
              )}
            </View>

            <Button
              label={t('product_form_save')}
              onPress={handleSave}
              loading={loading}
              style={pStyles.saveBtn}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
}

function Field({ label, value, onChangeText, placeholder, required, multiline, keyboardType = 'default' }: FieldProps) {
  return (
    <View style={pStyles.fieldWrap}>
      <Text style={pStyles.label}>{label}{required ? ' *' : ''}</Text>
      <TextInput
        style={[pStyles.input, multiline && pStyles.inputMultiline]}
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
        accessibilityHint={required ? 'required' : undefined}
      />
    </View>
  );
}

const pStyles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  flex:   { flex: 1 },
  scroll: { padding: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xxl,
  },
  errorBox: {
    backgroundColor: colors.errorLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText:     { ...typography.small, color: colors.error },
  fieldWrap:     { marginBottom: spacing.lg },
  label:         { ...typography.label, marginBottom: spacing.xs },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
  },
  inputMultiline: { height: 100, paddingTop: spacing.md },
  saveBtn:        { marginTop: spacing.md },

  sectionDivider: {
    borderTopWidth: 1, borderTopColor: colors.border,
    marginBottom: spacing.md, marginTop: spacing.xs, paddingTop: spacing.md,
  },
  sectionLabel:   { ...typography.label, color: colors.primary },

  pickerBtn: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  pickerDisabled: { opacity: 0.4 },
  pickerText:     { fontSize: 15, color: colors.text, flex: 1 },
  pickerPlaceholder: { color: colors.placeholder },
  pickerChevron:  { fontSize: 12, color: colors.textMuted },

  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    maxHeight: '70%', padding: spacing.lg,
  },
  modalTitle:     { ...typography.h3, color: colors.text, textAlign: 'center', marginBottom: spacing.md },
  modalItem: {
    paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalItemActive: { backgroundColor: colors.primaryLight },
  modalItemText:   { ...typography.body, color: colors.text },
  modalItemTextActive: { color: colors.primary, fontWeight: '700' },
  emptyText:      { ...typography.body, color: colors.textMuted, textAlign: 'center', padding: spacing.xl },
  modalCancel: {
    marginTop: spacing.md, paddingVertical: spacing.md,
    backgroundColor: colors.border, borderRadius: radius.md, alignItems: 'center',
  },
  modalCancelText: { ...typography.body, color: colors.text, fontWeight: '600' },

  imagePreview: {
    width: '100%', height: 180, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
  },
  imagePickerBtn: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    borderStyle: 'dashed', paddingVertical: spacing.xl,
    alignItems: 'center', backgroundColor: colors.surfaceMuted,
  },
  imagePickerText: { ...typography.body, color: colors.textMuted },
});
