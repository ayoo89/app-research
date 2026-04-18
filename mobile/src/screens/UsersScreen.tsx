import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { listUsers, resetUserPassword, deleteUser, updateUser, AppUser } from '../api/admin';
import { useI18n } from '../i18n';
import { colors, spacing, radius, typography, shadow } from '../theme';

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  user: 'Utilisateur',
};

const ROLE_COLOR: Record<string, string> = {
  super_admin: '#7c3aed',
  admin: '#0284c7',
  user: '#475569',
};

export default function UsersScreen() {
  const { t } = useI18n();
  const navigation = useNavigation<any>();
  const [users,     setUsers]     = useState<AppUser[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,     setError]     = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message ?? t('users_error_load'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const handleResetPassword = useCallback((user: AppUser) => {
    Alert.alert(
      t('users_reset_title'),
      t('users_reset_confirm', { name: user.name ?? user.email }),
      [
        { text: t('common_cancel'), style: 'cancel' },
        {
          text: t('users_reset_action'),
          style: 'destructive',
          onPress: async () => {
            try {
              await resetUserPassword(user.id);
              Alert.alert(t('users_reset_done_title'), t('users_reset_done_body'));
            } catch (e: any) {
              Alert.alert(t('common_error'), e.response?.data?.message ?? e.message);
            }
          },
        },
      ],
    );
  }, [t]);

  const handleToggleActive = useCallback((user: AppUser) => {
    const action = user.isActive ? t('users_deactivate_action') : t('users_activate_action');
    Alert.alert(
      action,
      t(user.isActive ? 'users_deactivate_confirm' : 'users_activate_confirm', { name: user.name ?? user.email }),
      [
        { text: t('common_cancel'), style: 'cancel' },
        {
          text: action,
          style: user.isActive ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const updated = await updateUser(user.id, { isActive: !user.isActive });
              setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, isActive: updated.isActive } : u));
            } catch (e: any) {
              Alert.alert(t('common_error'), e.response?.data?.message ?? e.message);
            }
          },
        },
      ],
    );
  }, [t]);

  const handleDelete = useCallback((user: AppUser) => {
    Alert.alert(
      t('users_delete_title'),
      t('users_delete_confirm', { name: user.name ?? user.email }),
      [
        { text: t('common_cancel'), style: 'cancel' },
        {
          text: t('users_delete_action'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUser(user.id);
              setUsers((prev) => prev.filter((u) => u.id !== user.id));
            } catch (e: any) {
              Alert.alert(t('common_error'), e.response?.data?.message ?? e.message);
            }
          },
        },
      ],
    );
  }, [t]);

  const renderItem = useCallback(({ item }: { item: AppUser }) => (
    <View style={[styles.card, shadow.sm]}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(item.name ?? item.email).charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.userName}>{item.name ?? '—'}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: ROLE_COLOR[item.role] + '1a' }]}>
          <Text style={[styles.roleText, { color: ROLE_COLOR[item.role] }]}>
            {ROLE_LABEL[item.role] ?? item.role}
          </Text>
        </View>
      </View>

      {!item.isActive && (
        <View style={styles.inactiveBanner} accessibilityRole="alert">
          <Text style={styles.inactiveText}>{t('users_inactive')}</Text>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionReset]}
          onPress={() => handleResetPassword(item)}
          accessibilityRole="button"
          accessibilityLabel={t('users_reset_action')}
          accessibilityHint={t('users_reset_hint', { name: item.name ?? item.email })}
        >
          <Text style={styles.actionResetText}>{t('users_reset_action')}</Text>
        </TouchableOpacity>
        {item.role !== 'super_admin' && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionToggle]}
            onPress={() => handleToggleActive(item)}
            accessibilityRole="button"
            accessibilityLabel={item.isActive ? t('users_deactivate_action') : t('users_activate_action')}
          >
            <Text style={[styles.actionToggleText, item.isActive && styles.actionToggleDeactivate]}>
              {item.isActive ? t('users_deactivate_action') : t('users_activate_action')}
            </Text>
          </TouchableOpacity>
        )}
        {item.role !== 'super_admin' && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionDelete]}
            onPress={() => handleDelete(item)}
            accessibilityRole="button"
            accessibilityLabel={t('users_delete_action')}
            accessibilityHint={t('users_delete_hint', { name: item.name ?? item.email })}
          >
            <Text style={styles.actionDeleteText}>{t('users_delete_action')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  ), [handleResetPassword, handleDelete, t]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️  {error}</Text>
        </View>
      ) : null}

      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>{t('users_empty')}</Text>
          </View>
        }
      />

      {/* FAB — invite user */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('InviteUser', { onDone: () => load(true) })}
        accessibilityLabel={t('users_invite_action')}
        accessibilityRole="button"
      >
        <Text style={styles.fabText}>+ {t('users_invite_action')}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  list:   { padding: spacing.md, paddingBottom: 96 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  errorBox: {
    backgroundColor: colors.errorLight, padding: spacing.md,
    margin: spacing.md, borderRadius: radius.md,
  },
  errorText: { ...typography.small, color: colors.error },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    marginBottom: spacing.md, overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.md, gap: spacing.md,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText:  { fontSize: 18, fontWeight: '700', color: colors.primary },
  cardInfo:    { flex: 1 },
  userName:    { ...typography.h3, color: colors.text },
  userEmail:   { ...typography.small, color: colors.textMuted, marginTop: 2 },
  roleBadge: {
    borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  roleText:    { fontSize: 11, fontWeight: '700' },
  inactiveBanner: {
    backgroundColor: colors.errorLight,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  inactiveText: { ...typography.caption, color: colors.error },
  actions: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border,
  },
  actionBtn: {
    flex: 1, paddingVertical: spacing.md, alignItems: 'center',
  },
  actionReset: { borderRightWidth: 1, borderRightColor: colors.border },
  actionResetText: { ...typography.small, color: colors.primary, fontWeight: '600' },
  actionToggle: { borderRightWidth: 1, borderRightColor: colors.border },
  actionToggleText: { ...typography.small, color: '#16a34a', fontWeight: '600' },
  actionToggleDeactivate: { color: '#d97706' },
  actionDelete:    {},
  actionDeleteText: { ...typography.small, color: colors.error, fontWeight: '600' },
  fab: {
    position: 'absolute', bottom: spacing.xxl, right: spacing.xl,
    left: spacing.xl,
    backgroundColor: colors.primary, borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...shadow.md,
  },
  fabText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
