import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, StyleSheet, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDashboardStats, DashboardStats } from '../api/dashboard';
import { useI18n } from '../i18n';
import { colors, spacing, radius, typography, shadow } from '../theme';

const REFRESH_INTERVAL = 30_000;

function KpiCard({ label, value, emoji }: { label: string; value: string | number; emoji: string }) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiEmoji}>{emoji}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function BarChart({ data, labels, title }: { data: number[]; labels: string[]; title: string }) {
  const max = Math.max(...data, 1);
  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>{title}</Text>
      {data.map((v, i) => (
        <View key={i} style={styles.barRow}>
          <Text style={styles.barLabel}>{labels[i]}</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${(v / max) * 100}%` }]} />
          </View>
          <Text style={styles.barValue}>{v.toLocaleString()}</Text>
        </View>
      ))}
    </View>
  );
}

function Sparkline({ values, title }: { values: number[]; title: string }) {
  const max = Math.max(...values, 1);
  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>{title}</Text>
      <View style={styles.sparklineRow}>
        {values.map((v, i) => (
          <View key={i} style={styles.sparkCol}>
            <View style={[styles.sparkBar, { height: Math.max(4, (v / max) * 80) }]} />
            <Text style={styles.sparkLabel}>{['D-6','D-5','D-4','D-3','D-2','D-1','Auj'][i]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const { t } = useI18n();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await getDashboardStats();
      setStats(data);
      setLastUpdated(new Date());
    } catch (e: any) {
      setError(e.message ?? t('dashboard_error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(() => load(true), REFRESH_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  if (loading && !stats) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (error && !stats) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
          <Text style={styles.retryText}>{t('common_retry')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const db = stats?.database;
  const search = stats?.search;
  const top = stats?.topProducts ?? [];
  const reindex = stats?.reindex;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {lastUpdated && (
          <Text style={styles.updatedAt}>
            {t('dashboard_last_updated')} {lastUpdated.toLocaleTimeString()}
          </Text>
        )}

        {/* Database KPIs */}
        <Text style={styles.sectionTitle}>{t('dashboard_section_database')}</Text>
        <View style={styles.kpiGrid}>
          <KpiCard emoji="📦" label={t('dashboard_kpi_products')} value={(db?.totalProducts ?? 0).toLocaleString()} />
          <KpiCard emoji="🗂️" label={t('dashboard_kpi_families')} value={db?.totalFamilies ?? 0} />
          <KpiCard emoji="📁" label={t('dashboard_kpi_subfamilies')} value={db?.totalSubFamilies ?? 0} />
          <KpiCard emoji="🏷️" label={t('dashboard_kpi_categories')} value={db?.totalCategories ?? 0} />
          <KpiCard emoji="👤" label={t('dashboard_kpi_users')} value={db?.totalUsers ?? 0} />
          <KpiCard emoji="🔑" label={t('dashboard_kpi_admins')} value={db?.totalAdmins ?? 0} />
        </View>

        {/* Search KPIs */}
        <Text style={styles.sectionTitle}>{t('dashboard_section_search')}</Text>
        <View style={styles.kpiGrid}>
          <KpiCard emoji="🔍" label={t('dashboard_kpi_searches_total')} value={(search?.totalSearchesAllTime ?? 0).toLocaleString()} />
          <KpiCard emoji="📅" label={t('dashboard_kpi_searches_today')} value={(search?.searchesToday ?? 0).toLocaleString()} />
          <KpiCard emoji="📆" label={t('dashboard_kpi_searches_week')} value={(search?.searchesThisWeek ?? 0).toLocaleString()} />
          <KpiCard emoji="⚡" label={t('dashboard_kpi_avg_latency')} value={`${search?.avgLatencyMs ?? 0}ms`} />
          <KpiCard emoji="🎯" label={t('dashboard_kpi_cache_hit')} value={`${((search?.cacheHitRate ?? 0) * 100).toFixed(1)}%`} />
          <KpiCard emoji="⏳" label={t('dashboard_kpi_pending_embed')} value={reindex?.pendingEmbeddings ?? 0} />
        </View>

        {/* Searches by type */}
        {search && (
          <BarChart
            title={t('dashboard_searches_by_type')}
            data={[search.byType.barcode, search.byType.text, search.byType.image]}
            labels={[t('dashboard_type_barcode'), t('dashboard_type_text'), t('dashboard_type_image')]}
          />
        )}

        {/* Searches last 7 days */}
        {search && (
          <Sparkline
            title={t('dashboard_searches_last7days')}
            values={search.searchesLast7Days}
          />
        )}

        {/* Top 10 products */}
        {top.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>{t('dashboard_top_products')}</Text>
            {top.map((p, i) => (
              <View key={p.id} style={styles.topRow}>
                <Text style={styles.topRank}>#{i + 1}</Text>
                {p.image ? (
                  <Image source={{ uri: p.image }} style={styles.topImage} />
                ) : (
                  <View style={[styles.topImage, styles.topImagePlaceholder]}>
                    <Text>📦</Text>
                  </View>
                )}
                <Text style={styles.topName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.topCount}>{p.searchCount.toLocaleString()}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Reindex / import info */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>{t('dashboard_section_system')}</Text>
          <Text style={styles.infoRow}>🔄 {t('dashboard_total_indexed')}: {(reindex?.totalIndexed ?? 0).toLocaleString()}</Text>
          {reindex?.lastFullReindexAt && (
            <Text style={styles.infoRow}>⏱️ {t('dashboard_last_reindex')}: {new Date(reindex.lastFullReindexAt).toLocaleString()}</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.bg },
  scroll:       { padding: spacing.md, paddingBottom: 40 },
  updatedAt:    { ...typography.small, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.sm },
  sectionTitle: { ...typography.h3, color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  errorText:    { ...typography.body, color: colors.error, textAlign: 'center', marginTop: 40 },
  retryBtn:     { alignSelf: 'center', marginTop: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.md },
  retryText:    { color: '#fff', fontWeight: '600' },

  kpiGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  kpiCard:      {
    width: '47%', backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, alignItems: 'center', ...shadow.sm,
  },
  kpiEmoji:     { fontSize: 24, marginBottom: 4 },
  kpiValue:     { ...typography.h2, color: colors.primary },
  kpiLabel:     { ...typography.small, color: colors.textMuted, textAlign: 'center', marginTop: 2 },

  chartCard:    {
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.md, ...shadow.sm,
  },
  chartTitle:   { ...typography.h3, color: colors.text, marginBottom: spacing.sm },

  barRow:       { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  barLabel:     { ...typography.small, color: colors.textMuted, width: 70 },
  barTrack:     { flex: 1, height: 12, backgroundColor: colors.border, borderRadius: 6, overflow: 'hidden', marginHorizontal: spacing.sm },
  barFill:      { height: '100%', backgroundColor: colors.primary, borderRadius: 6 },
  barValue:     { ...typography.small, color: colors.text, width: 60, textAlign: 'right' },

  sparklineRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 100 },
  sparkCol:     { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  sparkBar:     { width: '70%', backgroundColor: colors.primary, borderRadius: 4, minHeight: 4 },
  sparkLabel:   { ...typography.small, color: colors.textMuted, fontSize: 9, marginTop: 4 },

  topRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  topRank:      { ...typography.small, color: colors.textMuted, width: 28, fontWeight: '700' },
  topImage:     { width: 36, height: 36, borderRadius: radius.sm, marginRight: spacing.sm },
  topImagePlaceholder: { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  topName:      { flex: 1, ...typography.body, color: colors.text },
  topCount:     { ...typography.small, color: colors.primary, fontWeight: '700' },

  infoRow:      { ...typography.body, color: colors.textMuted, marginBottom: spacing.xs },
});
