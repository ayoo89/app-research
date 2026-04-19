import React, { useLayoutEffect, useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useI18n } from '../i18n';
import Button from '../components/Button';
import AutocompleteField from '../components/AutocompleteField';
import { createProduct, updateProduct, getDistinctValues, ProductPayload } from '../api/admin';
import { Product } from '../api/search';
import { colors, spacing, radius, typography, shadow } from '../theme';

interface Props {
  navigation: any;
  route: { params?: { product?: Product } };
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
  const [category,    setCategory]    = useState(existing?.category    ?? '');
  const [family,      setFamily]      = useState(existing?.family      ?? '');
  const [subcategory, setSubcategory] = useState(existing?.subcategory ?? '');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [categories,  setCategories]  = useState<string[]>([]);
  const [families,    setFamilies]    = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState<string[]>([]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEdit ? t('product_form_title_edit') : t('product_form_title_create'),
    });
  }, [isEdit, t]);

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
      category:    category.trim()    || undefined,
      family:      family.trim()      || undefined,
      subcategory: subcategory.trim() || undefined,
    };

    setLoading(true);
    try {
      if (isEdit) {
        await updateProduct(existing!.id, payload);
      } else {
        await createProduct(payload);
      }
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
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, shadow.md]}>
            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️  {error}</Text>
              </View>
            )}

            <Field label={t('product_form_name')} required value={name} onChangeText={(v) => { setName(v); setError(''); }} placeholder="Ex. Fleur artificielle pivoine" />
            <Field label={t('product_form_codegold')} value={codeGold} onChangeText={setCodeGold} placeholder="Ex. CG-AF-001" />
            <Field label={t('product_form_brand')} value={brand} onChangeText={setBrand} placeholder="Ex. Florart" />
            <Field label={t('product_form_barcode')} value={barcode} onChangeText={setBarcode} placeholder="Ex. 3700123456789" keyboardType="numeric" />
            <AutocompleteField label={t('product_form_category')} value={category} onChangeText={setCategory} suggestions={categories} placeholder="Ex. DÉCORATION" autoCapitalize="characters" />
            <AutocompleteField label={t('product_form_family')} value={family} onChangeText={setFamily} suggestions={families} placeholder="Ex. ART FLORAL" autoCapitalize="characters" />
            <AutocompleteField label={t('product_form_subfamily')} value={subcategory} onChangeText={setSubcategory} suggestions={subcategories} placeholder="Ex. FLEUR ARTIFICIELLE" autoCapitalize="characters" />
            <Field label={t('product_form_description')} value={description} onChangeText={setDescription} multiline />

            <Button
              label={t('product_form_save')}
              onPress={handleSave}
              loading={loading}
              style={styles.saveBtn}
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
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

function Field({ label, value, onChangeText, placeholder, required, multiline, keyboardType = 'default', autoCapitalize }: FieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}{required ? ' *' : ''}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        autoCorrect={false}
        autoCapitalize={autoCapitalize ?? (multiline ? 'sentences' : 'none')}
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

const styles = StyleSheet.create({
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
  errorText: { ...typography.small, color: colors.error },
  fieldWrap: { marginBottom: spacing.lg },
  label: { ...typography.label, marginBottom: spacing.xs },
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
  inputMultiline: {
    height: 100,
    paddingTop: spacing.md,
  },
  saveBtn: { marginTop: spacing.md },
});
