import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import type {BotMessage} from '../../types/chat';
import {COLORS, SPACING, RADIUS, TYPOGRAPHY} from '../../constants/theme';
import type {InferenceProviderId} from '../../services/inference/types';

export interface ProvenanceInput {
  source?: BotMessage['source'];
  kbVersion?: string | null;
  docIds?: string[];
  providerId?: InferenceProviderId;
  modelIdentity?: string;
  providerFailure?: {providerId?: InferenceProviderId; reason: string; message: string};
}

const SOURCE_LABELS: Record<string, string> = {
  llm: 'On-device model',
  search: 'Local knowledge',
  system: 'App guidance',
  queue: 'Outbox',
  tool: 'Set-up service',
  refusal: 'Safety rule',
};

const PROVIDER_LABELS: Record<InferenceProviderId, string> = {
  'apple-foundation-models': 'Apple on-device model',
  'android-aicore': 'Android on-device model',
  'llama-rn': 'Downloaded Airgap model',
  cloud: 'Cloud model',
  demo: 'Document answer',
};

export function getProvenanceView(input: ProvenanceInput) {
  const count = input.docIds?.filter(id => !id.startsWith('tool:')).length ?? 0;
  return {
    sourceLabel:
      (input.source === 'llm' && input.providerId
        ? PROVIDER_LABELS[input.providerId]
        : SOURCE_LABELS[input.source ?? 'system']) ?? 'App guidance',
    versionLabel: input.kbVersion ? `v${input.kbVersion}` : 'Built-in release',
    sourceCountLabel: `${count} ${count === 1 ? 'source' : 'sources'}`,
    ...(input.modelIdentity ? {modelLabel: input.modelIdentity} : {}),
    // The user sees why the model did not answer, not only that records did.
    ...(input.providerFailure
      ? {
          failureLabel: `${
            input.providerFailure.providerId
              ? PROVIDER_LABELS[input.providerFailure.providerId]
              : 'The model'
          } did not answer (${input.providerFailure.reason}): ${input.providerFailure.message}`,
        }
      : {}),
  };
}

export function AnswerProvenance(props: ProvenanceInput) {
  const view = getProvenanceView(props);
  return (
    <View style={styles.rail} accessibilityLabel="Answer source">
      <View style={styles.marker} />
      <View style={styles.content}>
        <Text style={styles.source}>{view.sourceLabel}</Text>
        <Text style={styles.fact}>
          {view.versionLabel} · {view.sourceCountLabel}
        </Text>
        {'modelLabel' in view && <Text style={styles.model}>{view.modelLabel}</Text>}
        {'failureLabel' in view && <Text style={styles.model}>{view.failureLabel}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: SPACING.sm,
    backgroundColor: '#E8F4F7',
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  marker: {width: 4, backgroundColor: '#0E7490'},
  content: {paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm},
  source: {...TYPOGRAPHY.caption, color: '#0B1F33', fontWeight: '700'},
  fact: {
    ...TYPOGRAPHY.micro,
    color: COLORS.textSecondary,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  model: {...TYPOGRAPHY.micro, color: COLORS.textSecondary, marginTop: 2},
});
