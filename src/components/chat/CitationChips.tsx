import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {COLORS, RADIUS, SPACING, TYPOGRAPHY} from '../../constants/theme';
import {getDocById} from '../../services/searchService';
import {useSourceDrawer} from '../../hooks/useSourceDrawer';

interface Props {
  /** kbDocIds carried by OrchestratorResponse.audit. Empty / undefined hides the row. */
  docIds: string[] | undefined;
}

const MAX_VISIBLE = 3;

export interface ResolvedCitation {
  id: string;
  category: string;
  title: string;
}

// Pure resolver. Filters out tool-synthesis pseudo-docs (`tool:` prefix)
// and ids the lookup misses. Exported for unit tests.
export function resolveCitations(
  docIds: string[] | undefined,
  lookup: (id: string) => {category: unknown; title: string} | undefined,
): ResolvedCitation[] {
  if (!docIds || docIds.length === 0) return [];
  const out: ResolvedCitation[] = [];
  for (const id of docIds) {
    if (id.startsWith('tool:')) continue;
    const doc = lookup(id);
    if (!doc) continue;
    out.push({id, category: String(doc.category), title: doc.title});
  }
  return out;
}

export interface CitationLayout {
  visible: ResolvedCitation[];
  overflowCount: number;
  firstOverflowId: string | null;
}

export function layoutCitations(
  citations: ResolvedCitation[],
  maxVisible: number = MAX_VISIBLE,
): CitationLayout {
  const visible = citations.slice(0, maxVisible);
  const overflowCount = Math.max(0, citations.length - maxVisible);
  const firstOverflowId =
    overflowCount > 0 && citations[maxVisible] ? citations[maxVisible].id : null;
  return {visible, overflowCount, firstOverflowId};
}

export function CitationChips({docIds}: Props) {
  const {open} = useSourceDrawer();
  const layout = useMemo(
    () => layoutCitations(resolveCitations(docIds, getDocById)),
    [docIds],
  );
  const {visible, overflowCount, firstOverflowId} = layout;
  if (visible.length === 0) return null;

  return (
    <View style={styles.row}>
      {visible.map(d => (
        <CitationChip
          key={d.id}
          docId={d.id}
          category={d.category}
          title={d.title}
          onPress={open}
        />
      ))}
      {overflowCount > 0 && firstOverflowId && (
        <OverflowChip count={overflowCount} firstOverflowId={firstOverflowId} onPress={open} />
      )}
    </View>
  );
}

interface ChipProps {
  docId: string;
  category: string;
  title: string;
  onPress: (docId: string) => void;
}

function CitationChip({docId, category, title, onPress}: ChipProps) {
  return (
    <Pressable
      onPress={() => onPress(docId)}
      hitSlop={{top: 8, bottom: 8, left: 4, right: 4}}
      accessibilityRole="button"
      accessibilityLabel={`${category}: ${title}`}
      accessibilityHint="Opens the source content">
      {({pressed}) => (
        <View style={[styles.chip, pressed && styles.chipPressed]}>
          <Text numberOfLines={1} style={styles.chipCategory}>
            {category}
          </Text>
          <Text style={styles.chipSeparator}>{' › '}</Text>
          <Text numberOfLines={1} style={styles.chipTitle}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

interface OverflowProps {
  count: number;
  firstOverflowId: string;
  onPress: (docId: string) => void;
}

function OverflowChip({count, firstOverflowId, onPress}: OverflowProps) {
  return (
    <Pressable
      onPress={() => onPress(firstOverflowId)}
      hitSlop={{top: 8, bottom: 8, left: 4, right: 4}}
      accessibilityRole="button"
      accessibilityLabel={`${count} more sources`}
      accessibilityHint="Opens the source list">
      {({pressed}) => (
        <View style={[styles.chip, styles.overflowChip, pressed && styles.chipPressed]}>
          <Text numberOfLines={1} style={styles.overflowText}>
            +{count} more
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  chip: {
    height: 28,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 220,
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipCategory: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontWeight: '500',
    textTransform: 'capitalize',
    maxWidth: 80,
  },
  chipSeparator: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  chipTitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text,
    fontWeight: '600',
    flexShrink: 1,
  },
  overflowChip: {
    backgroundColor: COLORS.botBubble,
  },
  overflowText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
});
