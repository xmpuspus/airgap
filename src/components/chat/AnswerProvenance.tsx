import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import type {BotMessage} from '../../types/chat';
import {SPACING, RADIUS, TYPOGRAPHY} from '../../constants/theme';
import type {InferenceProviderId} from '../../services/inference/types';

export interface ProvenanceInput {
  source?: BotMessage['source'];
  kbVersion?: string | null;
  docIds?: string[];
  providerId?: InferenceProviderId;
  /** Publisher and checked date of the first cited record with a dated public source. */
  recordSource?: {publisher: string; checkedLabel?: string};
}

export interface ProvenanceView {
  sourceLabel: string;
  factLabel?: string;
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

// The card says where the answer came from and nothing about how the app chose
// it. Why a model reply was not used stays in the message audit.
export function getProvenanceView(input: ProvenanceInput): ProvenanceView {
  const count = input.docIds?.filter(id => !id.startsWith('tool:')).length ?? 0;
  const source = input.source ?? 'system';
  let factLabel: string | undefined;
  if (input.recordSource) {
    factLabel = [input.recordSource.publisher, input.recordSource.checkedLabel]
      .filter(Boolean)
      .join(' · ');
  } else if (count > 0) {
    factLabel = `${count} local ${count === 1 ? 'record' : 'records'}${
      input.kbVersion ? ` · v${input.kbVersion}` : ''
    }`;
  }
  return {
    sourceLabel:
      (source === 'llm' && input.providerId
        ? PROVIDER_LABELS[input.providerId]
        : SOURCE_LABELS[source]) ?? 'App guidance',
    ...(factLabel ? {factLabel} : {}),
  };
}

export function AnswerProvenance(props: ProvenanceInput) {
  const view = getProvenanceView(props);
  return (
    <View style={styles.rail} accessibilityLabel="Answer source">
      <View style={styles.marker} />
      <View style={styles.content}>
        <Text style={styles.source}>{view.sourceLabel}</Text>
        {view.factLabel && <Text style={styles.fact}>{view.factLabel}</Text>}
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
  content: {flexShrink: 1, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm},
  source: {...TYPOGRAPHY.caption, color: '#0B1F33', fontWeight: '700'},
  fact: {...TYPOGRAPHY.micro, color: '#0B1F33', marginTop: 2},
});
