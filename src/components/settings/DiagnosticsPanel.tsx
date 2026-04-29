/**
 * DiagnosticsPanel — shown in Settings when features.diagnosticsPanel is
 * enabled in airgap.config.json. Displays the in-process metrics rollup
 * plus safety policy snapshot and sync staleness info.
 *
 * Intentionally minimal — this is a dev/ops aid, not a user-facing feature.
 */

import React, {useEffect, useState} from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {COLORS, SPACING, RADIUS, TYPOGRAPHY} from '../../constants/theme';
import {
  getMetricsReport,
  resetMetrics,
  type MetricsReport,
} from '../../services/metrics';
import {getSafetyPolicy} from '../../services/safetyLayer';
import {getStalenessInfo} from '../../services/syncService';
import {listRegisteredTools} from '../../services/tools';

function fmt(v: number | null, unit = ''): string {
  if (v === null) return '—';
  if (unit === 'ms') return `${Math.round(v)} ms`;
  if (unit === '%') return `${(v * 100).toFixed(1)} %`;
  return String(v);
}

export function DiagnosticsPanel() {
  const [report, setReport] = useState<MetricsReport>(getMetricsReport());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 2000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setReport(getMetricsReport());
  }, [tick]);

  const policy = getSafetyPolicy();
  const staleness = getStalenessInfo();
  const tools = listRegisteredTools();

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Turns</Text>
      <Row label="Total turns" value={String(report.turns)} />
      <Row label="LLM generations" value={String(report.llmGenerations)} />
      <Row label="Tool calls" value={String(report.tools)} />
      <Row label="Refusals" value={String(report.refusals)} />
      <Row label="Search fallbacks" value={String(report.searchFallbacks)} />

      <Text style={styles.sectionTitle}>Quality</Text>
      <Row label="Zero-hit rate" value={fmt(report.zeroHitRate, '%')} />
      <Row label="Low-confidence rate" value={fmt(report.lowConfidenceRate, '%')} />
      <Row label="Tool success rate" value={fmt(report.toolCallSuccessRate, '%')} />

      <Text style={styles.sectionTitle}>Latency</Text>
      <Row label="LLM p50" value={fmt(report.llmLatencyP50Ms, 'ms')} />
      <Row label="LLM p95" value={fmt(report.llmLatencyP95Ms, 'ms')} />
      <Row label="Tool p50" value={fmt(report.toolLatencyP50Ms, 'ms')} />
      <Row label="Tool p95" value={fmt(report.toolLatencyP95Ms, 'ms')} />

      <Text style={styles.sectionTitle}>Safety</Text>
      <Row label="Enabled" value={policy.enabled ? 'yes' : 'no'} />
      <Row label="Blocklist size" value={String(policy.blocklistSize)} />
      <Row
        label="Confidence threshold"
        value={String(policy.confidenceThreshold)}
      />

      <Text style={styles.sectionTitle}>Sync</Text>
      <Row label="KB version" value={staleness.kbVersion ?? '—'} />
      <Row label="Staleness" value={staleness.band} />
      <Row
        label="Last sync"
        value={
          staleness.lastSyncAt
            ? new Date(staleness.lastSyncAt).toLocaleString()
            : 'never'
        }
      />
      {staleness.lastError ? (
        <Row label="Last error" value={staleness.lastError} />
      ) : null}

      <Text style={styles.sectionTitle}>Tools registered ({tools.length})</Text>
      {tools.map(t => (
        <Row
          key={t.name}
          label={t.name}
          value={t.vertical ?? 'generic'}
        />
      ))}

      <TouchableOpacity style={styles.resetButton} onPress={() => resetMetrics()}>
        <Text style={styles.resetText}>Reset metrics</Text>
      </TouchableOpacity>
    </View>
  );
}

function Row({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: SPACING.sm,
  },
  sectionTitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  label: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.text,
  },
  value: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  resetButton: {
    marginTop: SPACING.md,
    alignSelf: 'flex-end',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border ?? '#E5E7EB',
  },
  resetText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
  },
});
