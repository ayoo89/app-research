import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { exportProductsCsv, importProductsCsv } from '../api/admin';
import { useI18n } from '../i18n';
import { colors, spacing, radius, typography, shadow } from '../theme';

export default function ImportExportScreen() {
  const { t } = useI18n();
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

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

  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/octet-stream'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;

      const file = result.assets[0];
      setImporting(true);

      const { imported, errors } = await importProductsCsv(file.uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const msg = errors.length > 0
        ? `${t('import_export_imported', { count: String(imported) })}\n\n${t('import_export_errors', { count: String(errors.length) })}:\n${errors.slice(0, 5).join('\n')}`
        : t('import_export_imported', { count: String(imported) });
      Alert.alert(t('import_export_import_done'), msg);
    } catch (e: any) {
      if ((e as any)?.code !== 'DOCUMENT_PICKER_CANCELED') {
        Alert.alert(t('common_error'), e.message ?? t('import_export_error_import'));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.container}>

        <View style={[styles.card, shadow.md]}>
          <Text style={styles.cardTitle}>{t('import_export_export_title')}</Text>
          <Text style={styles.cardDesc}>{t('import_export_export_desc')}</Text>
          <TouchableOpacity
            style={[styles.btn, styles.btnExport, exporting && styles.btnDisabled]}
            onPress={handleExport}
            disabled={exporting}
            accessibilityRole="button"
            accessibilityLabel={t('import_export_export_action')}
          >
            {exporting
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.btnText}>{t('import_export_export_action')}</Text>
            }
          </TouchableOpacity>
        </View>

        <View style={[styles.card, shadow.md]}>
          <Text style={styles.cardTitle}>{t('import_export_import_title')}</Text>
          <Text style={styles.cardDesc}>{t('import_export_import_desc')}</Text>
          <TouchableOpacity
            style={[styles.btn, styles.btnImport, importing && styles.btnDisabled]}
            onPress={handleImport}
            disabled={importing}
            accessibilityRole="button"
            accessibilityLabel={t('import_export_import_action')}
          >
            {importing
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.btnText}>{t('import_export_import_action')}</Text>
            }
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
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
  btn: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  btnExport:   { backgroundColor: colors.primary },
  btnImport:   { backgroundColor: '#16a34a' },
  btnDisabled: { opacity: 0.5 },
  btnText:     { color: '#fff', fontSize: 15, fontWeight: '700' },
});
