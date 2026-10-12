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
  responseReason?: string;
  /** Publisher and checked date of the first cited record with a dated public source. */
  recordSource?: {publisher: string; checkedLabel?: string};
}

export interface ProvenanceView {
  sourceLabel: string;
  factLabel?: string;
  modelLabel?: string;
  failureLabel?: string;
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

// App answers carry no record. The card says where the text came from instead
// of "0 sources".
const SYSTEM_FACTS: Record<string, string> = {
  device_clock: "Date and time from this phone's clock",
  identity: 'Set in the app, not taken from a record',
};

// The user sees why the model text did not show, in words a citizen reads.
function failureText(failure: NonNullable<ProvenanceInput['providerFailure']>, count: number) {
  const model = failure.providerId ? PROVIDER_LABELS[failure.providerId] : 'The model';
  const shown =
    count === 1 ? 'The record is shown as written.' : 'The records are shown as written.';
  if (failure.reason === 'not_exact_copy') {
    return `${model} ran, but its reply was not an exact copy of the record. ${shown}`;
  }
  if (failure.reason === 'ungrounded') {
    return `${model} ran, but its reply had a detail that is not in the records. ${shown}`;
  }
  if (/timed out/i.test(failure.message)) return `${model} did not finish in time. ${shown}`;
  const detail = failure.message.replace(/^Error:\s*/, '').replace(/[.\s]+$/, '');
  return `${model} did not answer: ${detail}. ${shown}`;
}

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
  } else if (source === 'system' && input.responseReason) {
    factLabel = SYSTEM_FACTS[input.responseReason];
  }
  return {
    sourceLabel:
      (source === 'llm' && input.providerId
        ? PROVIDER_LABELS[input.providerId]
        : SOURCE_LABELS[source]) ?? 'App guidance',
    ...(factLabel ? {factLabel} : {}),
    ...(input.modelIdentity ? {modelLabel: `Model: ${input.modelIdentity}`} : {}),
    ...(input.providerFailure
      ? {failureLabel: failureText(input.providerFailure, Math.max(count, 1))}
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
        {view.factLabel && <Text style={styles.fact}>{view.factLabel}</Text>}
        {view.failureLabel && <Text style={styles.model}>{view.failureLabel}</Text>}
        {view.modelLabel && <Text style={styles.model}>{view.modelLabel}</Text>}
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
  model: {...TYPOGRAPHY.micro, color: COLORS.textSecondary, marginTop: 2},
});
