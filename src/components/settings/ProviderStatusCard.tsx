import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY} from '../../constants/theme';
import {
  providerDisplayName,
  providerReasonDetail,
  providerStateLabel,
} from '../../services/inference/providerPresentation';
import type {InferenceCapabilities} from '../../services/inference/types';

type Tone = 'ready' | 'attention' | 'muted';

export interface ProviderStatusView {
  name: string;
  status: string;
  detail: string;
  tone: Tone;
  modelIdentity?: string;
}

export function getProviderStatusView(capabilities: InferenceCapabilities): ProviderStatusView {
  return {
    name: providerDisplayName(capabilities.providerId),
    status: capabilities.state === 'disabled' ? 'Off by policy' : providerStateLabel(capabilities),
    detail: providerReasonDetail(capabilities),
    tone:
      capabilities.state === 'available'
        ? 'ready'
        : capabilities.state === 'downloadable' || capabilities.state === 'downloading'
        ? 'attention'
        : 'muted',
    modelIdentity: capabilities.modelIdentity,
  };
}

interface Props {
  providers: readonly InferenceCapabilities[];
  loading?: boolean;
  error?: string;
  onRefresh: () => void;
  onDownloadSystemAi?: () => void;
}

export function ProviderStatusCard({
  providers,
  loading = false,
  error,
  onRefresh,
  onDownloadSystemAi,
}: Props) {
  const androidDownload = providers.some(
    provider => provider.providerId === 'android-aicore' && provider.state === 'downloadable',
  );

  return (
    <View style={styles.card}>
      <View style={styles.introRow}>
        <View style={styles.introCopy}>
          <Text style={styles.title}>Answer order</Text>
          <Text style={styles.intro}>
            The app tries each permitted provider in this order and keeps customer text local unless
            the operator enables a cloud service.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={onRefresh}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Refresh provider status"
          accessibilityState={{disabled: loading}}>
          <Text style={styles.refreshText}>{loading ? 'Checking' : 'Refresh'}</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View accessibilityRole="list">
        {providers.map((provider, index) => {
          const view = getProviderStatusView(provider);
          return (
            <View
              key={provider.providerId}
              style={[styles.providerRow, index === providers.length - 1 && styles.providerRowLast]}
              accessibilityRole="text">
              <View style={styles.orderBadge}>
                <Text style={styles.orderText}>{index + 1}</Text>
              </View>
              <View style={styles.providerCopy}>
                <View style={styles.nameRow}>
                  <Text style={styles.providerName}>{view.name}</Text>
                  <View style={[styles.statusDot, styles[view.tone]]} />
                  <Text style={[styles.status, styles[`${view.tone}Text`]]}>{view.status}</Text>
                </View>
                <Text style={styles.detail}>{view.detail}</Text>
                {view.modelIdentity ? (
                  <Text style={styles.identity} selectable>
                    {view.modelIdentity}
                  </Text>
                ) : null}
                {provider.osVersion ? (
                  <Text style={styles.identity}>Device OS {provider.osVersion}</Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      {androidDownload && onDownloadSystemAi ? (
        <TouchableOpacity
          style={styles.downloadButton}
          onPress={onDownloadSystemAi}
          accessibilityRole="button"
          accessibilityLabel="Download Android system AI"
          accessibilityHint="Downloads the model managed by Android">
          <Text style={styles.downloadText}>Download Android system AI</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border + '60',
  },
  introRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.lg,
    backgroundColor: '#0B1F33',
  },
  introCopy: {flex: 1, paddingRight: SPACING.md},
  title: {...TYPOGRAPHY.title, color: '#FFFFFF'},
  intro: {...TYPOGRAPHY.bodySmall, color: '#CBD5E1', marginTop: SPACING.xs},
  refreshButton: {
    minHeight: 44,
    minWidth: 68,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#22D3EE',
    paddingHorizontal: SPACING.sm,
  },
  refreshText: {...TYPOGRAPHY.caption, color: '#A5F3FC', fontWeight: '700'},
  error: {...TYPOGRAPHY.bodySmall, color: COLORS.error, padding: SPACING.lg},
  providerRow: {
    flexDirection: 'row',
    padding: SPACING.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  providerRowLast: {borderBottomWidth: 0},
  orderBadge: {
    width: 26,
    height: 26,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.inputBg,
    marginRight: SPACING.md,
  },
  orderText: {...TYPOGRAPHY.caption, color: COLORS.primary, fontWeight: '800'},
  providerCopy: {flex: 1},
  nameRow: {flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap'},
  providerName: {...TYPOGRAPHY.body, color: COLORS.text, fontWeight: '600', flexGrow: 1},
  statusDot: {width: 8, height: 8, borderRadius: RADIUS.full, marginLeft: SPACING.sm},
  status: {...TYPOGRAPHY.caption, marginLeft: SPACING.xs},
  ready: {backgroundColor: COLORS.success},
  attention: {backgroundColor: COLORS.warning},
  muted: {backgroundColor: COLORS.textSecondary},
  readyText: {color: COLORS.success},
  attentionText: {color: COLORS.warning},
  mutedText: {color: COLORS.textSecondary},
  detail: {...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary, marginTop: SPACING.xs},
  identity: {...TYPOGRAPHY.micro, color: COLORS.textSecondary, marginTop: SPACING.xs},
  downloadButton: {
    minHeight: 44,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  downloadText: {...TYPOGRAPHY.caption, color: COLORS.textInverse, fontWeight: '700'},
});
