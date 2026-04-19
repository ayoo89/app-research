import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { exportProductsCsv, importProductsCsv, ImageMatchStrategy } from '../api/admin';
import { useI18n } from '../i18n';
import { colors, spacing, radius, typography, shadow } from '../theme';

interface PickedFile { uri: string; name: string }

export default function ImportExportScreen() {
  const { t } = useI18n();

  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [productFile, setProductFile] = useState<PickedFile | null>(null);
  const [imageFiles,  setImageFiles]  = useState<PickedFile[]>([]);
  const [strategy,    setStrategy]    = useState<ImageMatchStrategy>('order');

  // ── Export ──────────────────────────────────────────────────────
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

  // ── Pick product file ───────────────────────────────────────────
  const pickProductFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'text/comma-separated-values',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'application/octet-stream',
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

  // ── Pick images ─────────────────────────────────────────────────
  const pickImages = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/webp', 'image/*'],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const picked = result.assets.map((a) => ({
        uri:  a.uri,
        name: a.name ?? a.uri.split('/').pop() ?? 'image.jpg',
      }));
      setImageFiles((prev) => {
        const seen = new Set(prev.map((f) => f.uri));
        return [...prev, ...picked.filter((f) => !seen.has(f.uri))];
      });
    } catch (e: any) {
      if (e?.code !== 'DOCUMENT_PICKER_CANCELED') Alert.alert(t('common_error'), e.message);
    }
  };

  // ── Import ──────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!productFile) return;
    setImporting(true);
    try {
      const { imported, imagesUploaded, imagesMatched, errors } = await importProductsCsv(
        productFile.uri,
        imageFiles.map((f) => f.uri),
        imageFiles.length ? strategy : 'codegold',
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const lines = [t('import_export_imported', { count: String(imported) })];
      if (imagesUploaded > 0) {
        lines.push(t('import_export_images_result', {
          uploaded: String(imagesUploaded),
          matched:  String(imagesMatched),
        }));
      }
      if (errors.length > 0) {
        lines.push(
          `${t('import_export_errors', { count: String(errors.length) })}:\n${errors.slice(0, 5).join('\n')}`,
        );
      }

      Alert.alert(t('import_export_import_done'), lines.join('\n\n'));
      setProductFile(null);
      setImageFiles([]);
    } catch (e: any) {
      Alert.alert(t('common_error'), e.message ?? t('import_export_error_import'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setImporting(false);
    }
  };

  const hasImages  = imageFiles.length > 0;
  const canImport  = !!productFile && !importing;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.container}>

        {/* ── Export card ─────────────────────────────────────── */}
        <View style={[styles.card, shadow.md]}>
          <Text style={styles.cardTitle}>{t('import_export_export_title')}</Text>
          <Text style={styles.cardDesc}>{t('import_export_export_desc')}</Text>
          <TouchableOpacity
            style={[styles.btn, styles.btnExport, exporting && styles.btnDisabled]}
            onPress={handleExport}
            disabled={exporting}
            accessibilityRole="button"
          >
            {exporting
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.btnText}>{t('import_export_export_action')}</Text>
            }
          </TouchableOpacity>
        </View>

        {/* ── Import card ─────────────────────────────────────── */}
        <View style={[styles.card, shadow.md]}>
          <Text style={styles.cardTitle}>{t('import_export_import_title')}</Text>
          <Text style={styles.cardDesc}>{t('import_export_import_desc')}</Text>

          {/* Product file row */}
          <TouchableOpacity
            style={styles.pickerRow}
            onPress={pickProductFile}
            accessibilityRole="button"
            accessibilityLabel={t('import_export_import_pick_file')}
          >
            <View style={styles.pickerIcon}>
              <Text style={styles.pickerEmoji}>📄</Text>
            </View>
            <View style={styles.pickerInfo}>
              <Text style={styles.pickerLabel}>{t('import_export_import_pick_file')}</Text>
              <Text
                style={[styles.pickerValue, !productFile && styles.pickerValueEmpty]}
                numberOfLines={1}
              >
                {productFile?.name ?? t('import_export_import_file_none')}
              </Text>
            </View>
            <Text style={styles.pickerChevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Images row */}
          <TouchableOpacity
            style={styles.pickerRow}
            onPress={pickImages}
            accessibilityRole="button"
            accessibilityLabel={t('import_export_import_pick_images')}
          >
            <View style={styles.pickerIcon}>
              <Text style={styles.pickerEmoji}>🖼️</Text>
            </View>
            <View style={styles.pickerInfo}>
              <Text style={styles.pickerLabel}>{t('import_export_import_pick_images')}</Text>
              <Text
                style={[styles.pickerValue, !hasImages && styles.pickerValueEmpty]}
                numberOfLines={1}
              >
                {hasImages
                  ? t('import_export_import_images_count', { count: String(imageFiles.length) })
                  : t('import_export_import_images_none')}
              </Text>
            </View>
            {hasImages ? (
              <TouchableOpacity
                onPress={() => setImageFiles([])}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.clearBtn}>✕</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.pickerChevron}>›</Text>
            )}
          </TouchableOpacity>

          {/* Strategy selector — only visible when images are picked */}
          {hasImages && (
            <>
              <View style={styles.divider} />
              <View style={styles.strategySection}>
                <Text style={styles.strategyLabel}>
                  {t('import_export_import_strategy_label')}
                </Text>
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
            accessibilityRole="button"
          >
            {importing
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.btnText}>{t('import_export_import_start')}</Text>
            }
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

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

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, padding: spacing.xl, gap: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xxl,
  },
  cardTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  cardDesc:  { ...typography.small, color: colors.textMuted, marginBottom: spacing.lg },

  pickerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.md,
  },
  pickerIcon: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.md,
  },
  pickerEmoji:  { fontSize: 20 },
  pickerInfo:   { flex: 1 },
  pickerLabel:  { ...typography.label, color: colors.text, marginBottom: 2 },
  pickerValue:  { ...typography.small, color: colors.primary },
  pickerValueEmpty: { color: colors.placeholder },
  pickerChevron: { fontSize: 20, color: colors.placeholder, marginLeft: spacing.sm },
  clearBtn: { fontSize: 14, color: colors.error, fontWeight: '700', marginLeft: spacing.sm },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },

  strategySection: { paddingVertical: spacing.md },
  strategyLabel: {
    ...typography.label, color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  strategyRow: { flexDirection: 'row' },
  strategyGap: { width: spacing.sm },

  strategyOption: {
    flex: 1,
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.bg,
  },
  strategyOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  strategyRadioRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  radioOuter: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: colors.placeholder,
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.xs,
  },
  radioOuterSelected: { borderColor: colors.primary },
  radioInner: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.primary,
  },
  strategyOptionTitle: {
    ...typography.label, color: colors.text, fontWeight: '600',
  },
  strategyOptionTitleSelected: { color: colors.primary },
  strategyOptionHint: {
    ...typography.caption, color: colors.textMuted, fontSize: 11,
  },

  btn: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  btnExport:   { backgroundColor: colors.primary },
  btnImport:   { backgroundColor: '#16a34a' },
  btnDisabled: { opacity: 0.4 },
  btnText:     { color: '#fff', fontSize: 15, fontWeight: '700' },
});
