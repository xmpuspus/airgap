import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY} from '../../constants/theme';
import {
  isSystemProvider,
  providerDisplayName,
  providerReasonDetail,
  providerStateLabel,
} from '../../services/inference/providerPresentation';
import type {InferenceCapabilities} from '../../services/inference/types';

type Tone = 'ready' | 'attention' | 'muted';

export interface ProviderSetupView {
  title: string;
  detail: string;
  action?: string;
  tone: Tone;
}

export function getProviderSetupView(capabilities: InferenceCapabilities): ProviderSetupView {
  const systemProvider = isSystemProvider(capabilities.providerId);
  if (capabilities.state === 'available') {
    return {
      title: systemProvider
        ? 'System AI ready'
        : `${providerDisplayName(capabilities.providerId)} ready`,
      detail: providerReasonDetail(capabilities),
      action: 'Continue',
      tone: 'ready',
    };
  }
  if (capabilities.state === 'downloadable') {
    return {
      title: systemProvider ? 'System AI needs setup' : 'Model download needed',
      detail: providerReasonDetail(capabilities),
      action: systemProvider ? 'Download system AI' : 'Download model',
      tone: 'attention',
    };
  }
  if (capabilities.state === 'downloading') {
    return {
      title: systemProvider ? 'System AI is downloading' : 'Model is downloading',
      detail: 'Keep this screen open until the download finishes.',
      action: undefined,
      tone: 'attention',
    };
  }
  return {
    title: systemProvider
      ? 'System AI is not available'
      : `${providerDisplayName(capabilities.providerId)} is not ready`,
    detail: providerReasonDetail(capabilities),
    action: 'Use another option',
    tone: 'muted',
  };
}

interface Props {
  providers: readonly InferenceCapabilities[];
  loading?: boolean;
  downloadProgress?: number;
  onDownloadSystemAi?: () => void;
  onContinue: () => void;
}

export function ProviderSetupCard({
  providers,
  loading = false,
  downloadProgress,
  onDownloadSystemAi,
  onContinue,
}: Props) {
  const primary = providers.find(provider => isSystemProvider(provider.providerId)) ?? providers[0];
  const view = primary ? getProviderSetupView(primary) : undefined;
  const progressPercent = Math.round(Math.max(0, Math.min(1, downloadProgress ?? 0)) * 100);
  const action = view?.action;
  const handleAction = action === 'Download system AI' ? onDownloadSystemAi : onContinue;

  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>AI FOR THIS DEVICE</Text>
          <Text style={styles.title}>{loading && !view ? 'Checking device AI' : view?.title}</Text>
        </View>
        <View style={[styles.statusMark, view ? styles[view.tone] : styles.muted]} />
      </View>
      <Text style={styles.detail}>
        {view?.detail ?? 'Checking the configured answer providers.'}
      </Text>

      <View style={styles.rail} accessibilityRole="list">
        {providers.map((provider, index) => (
          <View
            key={provider.providerId}
            style={[styles.providerRow, index === providers.length - 1 && styles.providerRowLast]}
            accessibilityRole="text"
            accessibilityLabel={`${index + 1}. ${providerDisplayName(
              provider.providerId,
            )}. ${providerStateLabel(provider)}`}>
            <View style={styles.orderBadge}>
              <Text style={styles.orderText}>{index + 1}</Text>
            </View>
            <Text style={styles.providerName}>{providerDisplayName(provider.providerId)}</Text>
            <Text
              style={[
                styles.providerState,
                provider.state === 'available' && styles.providerStateReady,
              ]}>
              {providerStateLabel(provider)}
            </Text>
          </View>
        ))}
      </View>

      {primary?.state === 'downloading' && (
        <View
          style={styles.progressTrack}
          accessibilityRole="progressbar"
          accessibilityLabel="System AI download progress"
          accessibilityValue={{min: 0, max: 100, now: progressPercent}}>
          <View style={[styles.progressFill, {width: `${progressPercent}%`}]} />
        </View>
      )}

      {action && handleAction && (
        <TouchableOpacity
          style={[styles.action, view?.tone === 'ready' && styles.actionReady]}
          onPress={handleAction}
          accessibilityRole="button"
          accessibilityLabel={action}
          accessibilityHint={
            action === 'Download system AI'
              ? 'Downloads the device system model, then checks readiness again'
              : 'Continues with the next available answer provider'
          }>
          <Text style={styles.actionText}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
    padding: SPACING.lg,
    backgroundColor: '#0B1F33',
    borderRadius: RADIUS.lg,
    ...SHADOWS.md,
  },
  headerRow: {flexDirection: 'row', alignItems: 'flex-start'},
  headerCopy: {flex: 1, paddingRight: SPACING.md},
  eyebrow: {...TYPOGRAPHY.micro, color: '#67E8F9', letterSpacing: 1},
  title: {...TYPOGRAPHY.title, color: '#FFFFFF', marginTop: SPACING.xs},
  detail: {...TYPOGRAPHY.bodySmall, color: '#CBD5E1', marginTop: SPACING.xs},
  statusMark: {width: 10, height: 10, borderRadius: RADIUS.full, marginTop: SPACING.sm},
  ready: {backgroundColor: '#34D399'},
  attention: {backgroundColor: '#FBBF24'},
  muted: {backgroundColor: '#64748B'},
  rail: {
    marginTop: SPACING.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#334155',
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  providerRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#334155',
  },
  providerRowLast: {borderBottomWidth: 0},
  orderBadge: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#164E63',
    marginRight: SPACING.sm,
  },
  orderText: {...TYPOGRAPHY.micro, color: '#CFFAFE', fontWeight: '800'},
  providerName: {...TYPOGRAPHY.bodySmall, color: '#F8FAFC', flex: 1},
  providerState: {...TYPOGRAPHY.caption, color: '#94A3B8', marginLeft: SPACING.sm},
  providerStateReady: {color: '#6EE7B7'},
  progressTrack: {
    height: 6,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    backgroundColor: '#334155',
    marginTop: SPACING.md,
  },
  progressFill: {height: '100%', borderRadius: RADIUS.full, backgroundColor: '#22D3EE'},
  action: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
    backgroundColor: '#0E7490',
    marginTop: SPACING.lg,
  },
  actionReady: {backgroundColor: COLORS.success},
  actionText: {...TYPOGRAPHY.caption, color: '#FFFFFF', fontWeight: '800'},
});
