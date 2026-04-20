import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, TextInput, Modal,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  listFamilies, createFamily, updateFamily, deleteFamily, FamilyItem,
  listSubFamilies, createSubFamily, updateSubFamily, deleteSubFamily, SubFamilyItem,
  listCategories, createCategory, updateCategory, deleteCategory, CategoryItem,
} from '../api/hierarchy';
import { useI18n } from '../i18n';
import { colors, spacing, radius, typography, shadow } from '../theme';

type Tab = 'family' | 'subfamily' | 'category';

const TAB_COLOR: Record<Tab, string> = {
  family:    '#0284c7',
  subfamily: '#059669',
  category:  '#7c3aed',
};

export default function TaxonomyScreen() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<Tab>('family');

  const [families,    setFamilies]    = useState<FamilyItem[]>([]);
  const [subFamilies, setSubFamilies] = useState<SubFamilyItem[]>([]);
  const [categories,  setCategories]  = useState<CategoryItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [nameInput,    setNameInput]    = useState('');
  const [parentId,     setParentId]     = useState('');
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState('');

  // Parent pickers
  const [parentPickerOpen, setParentPickerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'family') {
        setFamilies(await listFamilies());
      } else if (activeTab === 'subfamily') {
        const [sfs, fams] = await Promise.all([listSubFamilies(), listFamilies()]);
        setSubFamilies(sfs);
        setFamilies(fams);
      } else {
        const [cats, sfs, fams] = await Promise.all([listCategories(), listSubFamilies(), listFamilies()]);
        setCategories(cats);
        setSubFamilies(sfs);
        setFamilies(fams);
      }
    } catch {
      setError(t('taxonomy_error_load'));
    } finally {
      setLoading(false);
    }
  }, [activeTab, t]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditingId(null);
    setNameInput('');
    setParentId('');
    setSaveError('');
    setModalVisible(true);
  };

  const openEdit = (id: string, name: string, pid = '') => {
    setEditingId(id);
    setNameInput(name);
    setParentId(pid);
    setSaveError('');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!nameInput.trim()) { setSaveError('Le nom est requis'); return; }
    if ((activeTab === 'subfamily' || activeTab === 'category') && !parentId && !editingId) {
      setSaveError(activeTab === 'subfamily' ? 'Sélectionnez une famille' : 'Sélectionnez une sous-famille');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      if (activeTab === 'family') {
        if (editingId) await updateFamily(editingId, nameInput.trim());
        else await createFamily(nameInput.trim());
      } else if (activeTab === 'subfamily') {
        if (editingId) await updateSubFamily(editingId, { name: nameInput.trim(), familyId: parentId || undefined });
        else await createSubFamily(nameInput.trim(), parentId);
      } else {
        if (editingId) await updateCategory(editingId, { name: nameInput.trim(), subFamilyId: parentId || undefined });
        else await createCategory(nameInput.trim(), parentId);
      }
      setModalVisible(false);
      load();
    } catch (e: any) {
      setSaveError(e.response?.data?.message ?? t('taxonomy_error_save'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      t('taxonomy_delete_confirm').replace('{name}', name),
      '',
      [
        { text: t('common_cancel'), style: 'cancel' },
        {
          text: t('common_delete'), style: 'destructive',
          onPress: async () => {
            try {
              if (activeTab === 'family') await deleteFamily(id);
              else if (activeTab === 'subfamily') await deleteSubFamily(id);
              else await deleteCategory(id);
              load();
            } catch (e: any) {
              Alert.alert('Erreur', e.response?.data?.message ?? 'Suppression impossible');
            }
          },
        },
      ],
    );
  };

  const parentLabel = activeTab === 'subfamily'
    ? families.find((f) => f.id === parentId)?.name ?? 'Sélectionner une famille…'
    : subFamilies.find((sf) => sf.id === parentId)?.name ?? 'Sélectionner une sous-famille…';

  const parentItems = activeTab === 'subfamily' ? families : subFamilies;

  const accentColor = TAB_COLOR[activeTab];

  const renderFamily = ({ item }: { item: FamilyItem }) => (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.rowName}>{item.name}</Text>
        <Text style={styles.rowMeta}>{item.subFamilyCount} sous-famille(s)</Text>
      </View>
      <TouchableOpacity onPress={() => openEdit(item.id, item.name)} style={styles.editBtn}>
        <Text style={styles.editText}>✏️</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => handleDelete(item.id, item.name)} style={styles.deleteBtn}>
        <Text style={styles.deleteText}>🗑️</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSubFamily = ({ item }: { item: SubFamilyItem }) => (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.rowName}>{item.name}</Text>
        <Text style={styles.rowMeta}>{item.familyName} · {item.categoryCount} catégorie(s)</Text>
      </View>
      <TouchableOpacity onPress={() => openEdit(item.id, item.name, item.familyId)} style={styles.editBtn}>
        <Text style={styles.editText}>✏️</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => handleDelete(item.id, item.name)} style={styles.deleteBtn}>
        <Text style={styles.deleteText}>🗑️</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCategory = ({ item }: { item: CategoryItem }) => (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.rowName}>{item.name}</Text>
        <Text style={styles.rowMeta}>{item.familyName} › {item.subFamilyName} · {item.productCount} produit(s)</Text>
      </View>
      <TouchableOpacity onPress={() => openEdit(item.id, item.name, item.subFamilyId)} style={styles.editBtn}>
        <Text style={styles.editText}>✏️</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => handleDelete(item.id, item.name)} style={styles.deleteBtn}>
        <Text style={styles.deleteText}>🗑️</Text>
      </TouchableOpacity>
    </View>
  );

  const data = activeTab === 'family' ? families : activeTab === 'subfamily' ? subFamilies : categories;
  const renderItem = activeTab === 'family' ? renderFamily : activeTab === 'subfamily' ? renderSubFamily : renderCategory;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Tab bar */}
      <View style={styles.tabs}>
        {(['family', 'subfamily', 'category'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && { borderBottomColor: TAB_COLOR[tab], borderBottomWidth: 2 }]}
            onPress={() => { setActiveTab(tab); }}
          >
            <Text style={[styles.tabText, activeTab === tab && { color: TAB_COLOR[tab] }]}>
              {tab === 'family' ? 'Familles' : tab === 'subfamily' ? 'Sous-Fam.' : 'Catégories'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} size="large" />
      ) : error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load}><Text style={styles.retryText}>{t('common_retry')}</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={data as any[]}
          keyExtractor={(item: any) => item.id}
          renderItem={renderItem as any}
          contentContainerStyle={data.length === 0 ? styles.emptyWrap : styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>{t('taxonomy_empty')}</Text>}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: accentColor }]}
        onPress={openAdd}
        accessibilityLabel="Ajouter"
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Create / Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={styles.overlayBg} activeOpacity={1} onPress={() => setModalVisible(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {editingId ? 'Modifier' : 'Ajouter'} {activeTab === 'family' ? 'famille' : activeTab === 'subfamily' ? 'sous-famille' : 'catégorie'}
            </Text>

            {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}

            <Text style={styles.fieldLabel}>Nom</Text>
            <TextInput
              style={styles.input}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Ex. ART FLORAL"
              placeholderTextColor={colors.placeholder}
              autoCapitalize="characters"
              autoFocus
            />

            {/* Parent picker for SubFamily and Category */}
            {(activeTab === 'subfamily' || activeTab === 'category') && (
              <>
                <Text style={styles.fieldLabel}>
                  {activeTab === 'subfamily' ? 'Famille parente' : 'Sous-famille parente'}
                </Text>
                <TouchableOpacity style={styles.input} onPress={() => setParentPickerOpen(true)}>
                  <Text style={[styles.pickerText, !parentId && { color: colors.placeholder }]}>
                    {parentLabel}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.sheetBtns}>
              <TouchableOpacity style={[styles.sheetBtn, styles.cancelBtn]} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>{t('common_cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sheetBtn, { backgroundColor: accentColor }]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveText}>{t('taxonomy_add_action')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Parent picker modal */}
      <Modal visible={parentPickerOpen} animationType="slide" transparent onRequestClose={() => setParentPickerOpen(false)}>
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.overlayBg} activeOpacity={1} onPress={() => setParentPickerOpen(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {activeTab === 'subfamily' ? 'Choisir une famille' : 'Choisir une sous-famille'}
            </Text>
            <ScrollView>
              {parentItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.pickerItem, parentId === item.id && { backgroundColor: colors.primaryLight }]}
                  onPress={() => { setParentId(item.id); setParentPickerOpen(false); }}
                >
                  <Text style={[styles.pickerItemText, parentId === item.id && { color: colors.primary, fontWeight: '700' }]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: colors.bg },
  tabs:       { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab:        { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText:    { ...typography.small, fontWeight: '600', color: colors.textMuted },
  list:       { padding: spacing.md },
  emptyWrap:  { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  emptyText:  { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  errorWrap:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText:  { ...typography.body, color: colors.error, marginBottom: spacing.sm },
  retryText:  { ...typography.label, color: colors.primary },

  row:        { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, marginBottom: spacing.sm, padding: spacing.md, ...shadow.sm },
  rowMain:    { flex: 1 },
  rowName:    { ...typography.body, color: colors.text, fontWeight: '600' },
  rowMeta:    { ...typography.small, color: colors.textMuted, marginTop: 2 },
  editBtn:    { paddingHorizontal: spacing.sm },
  editText:   { fontSize: 18 },
  deleteBtn:  { paddingHorizontal: spacing.sm },
  deleteText: { fontSize: 18 },

  fab:        { position: 'absolute', bottom: 28, right: 20, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', ...shadow.md },
  fabText:    { color: '#fff', fontSize: 28, lineHeight: 32 },

  overlay:    { flex: 1, justifyContent: 'flex-end' },
  overlayBg:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:      { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xxl, maxHeight: '80%' },
  sheetTitle: { ...typography.h3, marginBottom: spacing.lg },
  saveError:  { ...typography.small, color: colors.error, marginBottom: spacing.sm },
  fieldLabel: { ...typography.label, marginBottom: spacing.xs },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: 15, color: colors.text, backgroundColor: colors.surfaceMuted,
    marginBottom: spacing.lg, justifyContent: 'center',
  },
  pickerText: { fontSize: 15, color: colors.text },
  sheetBtns:  { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  sheetBtn:   { flex: 1, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  cancelBtn:  { backgroundColor: colors.border },
  cancelText: { ...typography.body, color: colors.text, fontWeight: '600' },
  saveText:   { color: '#fff', fontWeight: '700', fontSize: 15 },

  pickerItem:     { paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickerItemText: { ...typography.body, color: colors.text },
});
