import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, TextInput, Modal,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  listTaxonomy, createTaxonomy, updateTaxonomy, deleteTaxonomy,
  TaxonomyEntry, TaxonomyType,
} from '../api/admin';
import { useI18n } from '../i18n';
import { colors, spacing, radius, typography, shadow } from '../theme';

const TABS: TaxonomyType[] = ['category', 'family', 'subcategory'];

const TAB_COLOR: Record<TaxonomyType, string> = {
  category: '#7c3aed',
  family: '#0284c7',
  subcategory: '#059669',
};

export default function TaxonomyScreen() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TaxonomyType>('category');
  const [items, setItems] = useState<TaxonomyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TaxonomyEntry | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [parentInput, setParentInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const load = useCallback(async (tab: TaxonomyType) => {
    setLoading(true);
    setError('');
    try {
      const data = await listTaxonomy(tab);
      setItems(data);
    } catch {
      setError(t('taxonomy_error_load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(activeTab); }, [activeTab, load]);

  const switchTab = (tab: TaxonomyType) => {
    setActiveTab(tab);
    setItems([]);
  };

  const openAdd = () => {
    setEditingEntry(null);
    setNameInput('');
    setParentInput('');
    setSaveError('');
    setModalVisible(true);
  };

  const openEdit = (entry: TaxonomyEntry) => {
    setEditingEntry(entry);
    setNameInput(entry.name);
    setParentInput(entry.parentName ?? '');
    setSaveError('');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!nameInput.trim()) return;
    setSaving(true);
    setSaveError('');
    try {
      if (editingEntry) {
        const updated = await updateTaxonomy(editingEntry.id, {
          name: nameInput.trim(),
          parentName: parentInput.trim() || undefined,
        });
        setItems((prev) => prev.map((i) => i.id === updated.id ? updated : i));
      } else {
        const created = await createTaxonomy({
          type: activeTab,
          name: nameInput.trim(),
          parentName: parentInput.trim() || undefined,
        });
        setItems((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setModalVisible(false);
    } catch {
      setSaveError(t('taxonomy_error_save'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (entry: TaxonomyEntry) => {
    Alert.alert(
      t('taxonomy_edit_title'),
      t('taxonomy_delete_confirm', { name: entry.name }),
      [
        { text: t('common_cancel'), style: 'cancel' },
        {
          text: t('common_delete') ?? 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTaxonomy(entry.id);
              setItems((prev) => prev.filter((i) => i.id !== entry.id));
            } catch {
              Alert.alert(t('common_error'), t('taxonomy_error_save'));
            }
          },
        },
      ],
    );
  };

  const tabLabel: Record<TaxonomyType, string> = {
    category: t('taxonomy_tab_category'),
    family: t('taxonomy_tab_family'),
    subcategory: t('taxonomy_tab_subcategory'),
  };

  const addTitle: Record<TaxonomyType, string> = {
    category: t('taxonomy_add_title_category'),
    family: t('taxonomy_add_title_family'),
    subcategory: t('taxonomy_add_title_subcategory'),
  };

  const showParent = activeTab === 'family' || activeTab === 'subcategory';
  const parentLabel = activeTab === 'family'
    ? t('taxonomy_parent_label_family')
    : t('taxonomy_parent_label_subcategory');

  const renderItem = ({ item }: { item: TaxonomyEntry }) => (
    <View style={[styles.item, shadow.sm]}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        {item.parentName ? (
          <Text style={styles.itemParent}>↳ {item.parentName}</Text>
        ) : null}
      </View>
      <View style={styles.itemActions}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.primaryLight }]}
          onPress={() => openEdit(item)}
          accessibilityRole="button"
          accessibilityLabel={t('taxonomy_edit_title')}
        >
          <Text style={[styles.actionText, { color: colors.primary }]}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.errorLight }]}
          onPress={() => handleDelete(item)}
          accessibilityRole="button"
          accessibilityLabel="Supprimer"
        >
          <Text style={[styles.actionText, { color: colors.error }]}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && { borderBottomColor: TAB_COLOR[tab], borderBottomWidth: 3 }]}
            onPress={() => switchTab(tab)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab }}
          >
            <Text style={[styles.tabText, activeTab === tab && { color: TAB_COLOR[tab], fontWeight: '700' }]}>
              {tabLabel[tab]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️  {error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>{t('taxonomy_empty')}</Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: TAB_COLOR[activeTab] }]}
        onPress={openAdd}
        accessibilityRole="button"
        accessibilityLabel={addTitle[activeTab]}
      >
        <Text style={styles.fabText}>+ {addTitle[activeTab]}</Text>
      </TouchableOpacity>

      {/* Add / Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalCard, shadow.lg]}>
            <Text style={styles.modalTitle}>
              {editingEntry ? t('taxonomy_edit_title') : addTitle[activeTab]}
            </Text>

            {saveError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️  {saveError}</Text>
              </View>
            ) : null}

            <Text style={styles.modalLabel}>{t('taxonomy_name_label')}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t('taxonomy_name_placeholder')}
              placeholderTextColor={colors.placeholder}
              value={nameInput}
              onChangeText={setNameInput}
              autoCapitalize="characters"
              autoFocus
              accessibilityLabel={t('taxonomy_name_label')}
            />

            {showParent && (
              <>
                <Text style={[styles.modalLabel, { marginTop: spacing.md }]}>{parentLabel}</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder={t('taxonomy_parent_placeholder')}
                  placeholderTextColor={colors.placeholder}
                  value={parentInput}
                  onChangeText={setParentInput}
                  autoCapitalize="characters"
                  accessibilityLabel={parentLabel}
                />
              </>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setModalVisible(false)}
                disabled={saving}
              >
                <Text style={styles.cancelText}>{t('common_cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.saveBtn, !nameInput.trim() && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving || !nameInput.trim()}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.saveText}>{t('taxonomy_add_action')}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: colors.bg },
  tabs:  { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: {
    flex: 1, paddingVertical: spacing.md, alignItems: 'center',
    borderBottomWidth: 3, borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  list:  { padding: spacing.md, paddingBottom: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, marginTop: 60 },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  errorBox: { backgroundColor: colors.errorLight, margin: spacing.md, borderRadius: radius.md, padding: spacing.md },
  errorText: { ...typography.small, color: colors.error },
  item: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.lg,
    marginBottom: spacing.sm, padding: spacing.md,
  },
  itemInfo: { flex: 1 },
  itemName: { ...typography.body, color: colors.text, fontWeight: '600' },
  itemParent: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  itemActions: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 16 },
  fab: {
    position: 'absolute', bottom: spacing.xxl, left: spacing.xl, right: spacing.xl,
    borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center',
    ...shadow.md,
  },
  fabText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalCard: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.xxl, paddingBottom: spacing.xxxl ?? spacing.xxl + 16,
  },
  modalTitle: { ...typography.h2, marginBottom: spacing.lg },
  modalLabel: { ...typography.label, marginBottom: spacing.xs },
  modalInput: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: 15, color: colors.text, backgroundColor: colors.surfaceMuted,
  },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  modalBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center' },
  cancelBtn: { backgroundColor: colors.surfaceMuted, borderWidth: 1.5, borderColor: colors.border },
  cancelText: { ...typography.body, color: colors.textMuted, fontWeight: '600' },
  saveBtn: { backgroundColor: colors.primary },
  saveBtnDisabled: { opacity: 0.5 },
  saveText: { ...typography.body, color: '#fff', fontWeight: '700' },
});
