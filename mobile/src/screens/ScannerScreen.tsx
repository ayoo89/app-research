import React, { useCallback, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Animated, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { SearchFilters } from '../api/search';
import { searchByBarcode } from '../api/search';
import { useNetworkStore } from '../store/networkStore';
import { useI18n } from '../i18n';
import { colors, spacing, radius, typography } from '../theme';

type ScanState = 'scanning' | 'found' | 'searching' | 'not_found' | 'error';

export default function ScannerScreen() {
  const { t } = useI18n();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const scanFilters = route.params?.filters as SearchFilters | undefined;
  const isOnline = useNetworkStore((s) => s.isOnline);

  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>('scanning');
  const [lastBarcode, setLastBarcode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (scanState !== 'scanning') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scanState]);

  const handleBarcode = useCallback(async ({ data }: { type: string; data: string }) => {
    if (scanState !== 'scanning' || !data.trim()) return;
    setScanState('found');
    setLastBarcode(data);

    if (!isOnline) {
      setErrorMsg(t('scanner_offline'));
      setScanState('error');
      return;
    }

    setScanState('searching');
    try {
      const res = await searchByBarcode(data, scanFilters);
      if (res.results.length > 0) {
        navigation.replace('ProductDetail', { id: res.results[0].id, fromScan: true });
      } else {
        setScanState('not_found');
      }
    } catch (e: any) {
      setErrorMsg(e.message ?? t('scanner_error'));
      setScanState('error');
    }
  }, [scanState, isOnline, navigation, scanFilters, t]);

  const reset = () => {
    setScanState('scanning');
    setLastBarcode('');
    setErrorMsg('');
  };

  const searchManually = () => {
    navigation.replace('Search', { barcode: lastBarcode, filters: scanFilters });
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.permIcon}>📷</Text>
        <Text style={styles.permTitle}>{t('scanner_perm_title')}</Text>
        <Text style={styles.permSub}>{t('scanner_perm_sub')}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={requestPermission} accessibilityRole="button">
          <Text style={styles.backBtnText}>{t('scanner_grant_perm') ?? 'Grant Permission'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.backBtn, styles.backBtnOutline]}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.backBtnText, styles.backBtnOutlineText]}>{t('scanner_back')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {scanState === 'scanning' && (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          onBarcodeScanned={handleBarcode}
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr', 'code128', 'code39', 'datamatrix'],
          }}
        />
      )}

      {/* Dark overlay with scan cutout */}
      <View style={styles.overlay}>
        <View style={styles.overlayTop} />
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <Animated.View style={[styles.scanBox, { transform: [{ scale: pulseAnim }] }]}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </Animated.View>
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom}>
          <Text style={styles.hint}>
            {scanState === 'scanning' ? t('scanner_hint') : ''}
          </Text>
        </View>
      </View>

      {scanState === 'searching' && (
        <View style={styles.statusOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.statusText}>{t('scanner_status_search')}</Text>
          <Text style={styles.statusSub}>{lastBarcode}</Text>
        </View>
      )}

      {scanState === 'not_found' && (
        <View style={styles.statusOverlay} accessibilityRole="alert">
          <Text style={styles.statusIcon}>📭</Text>
          <Text style={styles.statusText}>{t('scanner_status_notfound')}</Text>
          <Text style={styles.statusSub}>{lastBarcode}</Text>
          <View style={styles.statusActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={searchManually}>
              <Text style={styles.actionBtnText}>{t('scanner_manual')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]} onPress={reset}>
              <Text style={styles.actionBtnOutlineText}>{t('scanner_again')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {scanState === 'error' && (
        <View style={styles.statusOverlay} accessibilityRole="alert">
          <Text style={styles.statusIcon}>⚠️</Text>
          <Text style={styles.statusText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.actionBtn} onPress={reset}>
            <Text style={styles.actionBtnText}>{t('scanner_retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <SafeAreaView style={styles.closeWrap} edges={['top']}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel={t('scanner_close_a11y')}
          accessibilityRole="button"
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const BOX_W = 280;
const BOX_H = 170;
const CORNER = 22;
const BORDER = 3;

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#000' },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: spacing.xxl },
  overlay:       { ...StyleSheet.absoluteFillObject },
  overlayTop:    { flex: 1, backgroundColor: colors.overlay },
  overlayMiddle: { flexDirection: 'row', height: BOX_H },
  overlaySide:   { flex: 1, backgroundColor: colors.overlay },
  overlayBottom: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', paddingTop: spacing.xl },
  scanBox:       { width: BOX_W, height: BOX_H },
  corner: {
    position: 'absolute', width: CORNER, height: CORNER,
    borderColor: '#fff',
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: BORDER, borderLeftWidth: BORDER, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: BORDER, borderRightWidth: BORDER, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: BORDER, borderLeftWidth: BORDER, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: BORDER, borderRightWidth: BORDER, borderBottomRightRadius: 4 },
  hint:          { color: 'rgba(255,255,255,0.8)', fontSize: 14, textAlign: 'center' },
  statusOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center', alignItems: 'center', padding: spacing.xxl,
  },
  statusIcon:    { fontSize: 48, marginBottom: spacing.lg },
  statusText:    { color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: spacing.sm },
  statusSub:     { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: spacing.xl },
  statusActions: { flexDirection: 'row', gap: spacing.md },
  actionBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  actionBtnText:        { color: '#fff', fontWeight: '600', fontSize: 14 },
  actionBtnOutline:     { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#fff' },
  actionBtnOutlineText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  closeWrap:     { position: 'absolute', top: 0, left: 0, right: 0 },
  closeBtn: {
    position: 'absolute', top: Platform.OS === 'ios' ? 0 : spacing.md,
    right: spacing.lg, width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText:       { color: '#fff', fontSize: 16, fontWeight: '600' },
  permIcon:           { fontSize: 48, marginBottom: spacing.lg },
  permTitle:          { ...typography.h2, textAlign: 'center', marginBottom: spacing.sm },
  permSub:            { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl },
  backBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  backBtnText:        { color: '#fff', fontWeight: '600' },
  backBtnOutline:     { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary },
  backBtnOutlineText: { color: colors.primary },
});
