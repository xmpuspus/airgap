import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import type {BotMessage} from '../../types/chat';
import {COLORS, SPACING, RADIUS, TYPOGRAPHY} from '../../constants/theme';

export interface ProvenanceInput {
  source?: BotMessage['source'];
  kbVersion?: string | null;
  docIds?: string[];
}

const SOURCE_LABELS: Record<string, string> = {
  llm: 'On-device model',
  search: 'Local knowledge',
  system: 'App guidance',
  queue: 'Outbox',
  tool: 'Set-up service',
  refusal: 'Safety rule',
};

export function getProvenanceView(input: ProvenanceInput) {
  const count = input.docIds?.filter(id => !id.startsWith('tool:')).length ?? 0;
  return {
    sourceLabel: SOURCE_LABELS[input.source ?? 'system'] ?? 'App guidance',
    versionLabel: input.kbVersion ? `v${input.kbVersion}` : 'Built-in release',
    sourceCountLabel: `${count} ${count === 1 ? 'source' : 'sources'}`,
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
});
