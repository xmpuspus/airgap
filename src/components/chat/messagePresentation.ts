// The label on a refusal card says what happened to the question. A refusal
// that still shows a record says so, so the reader knows the record is real.
const REFUSAL_LABELS: Record<string, string> = {
  no_commentary: 'Record only',
  no_supported_record: 'No record',
  low_confidence: 'No record',
  needs_verification: 'Needs a check',
  conflicting_sources: 'Sources disagree',
  historical_only: 'Past record',
  missing_source_evidence: 'Source incomplete',
  ungrounded_answer: 'Not confirmed',
};

export function refusalLabelFor(reason: string | undefined): string {
  return (reason && REFUSAL_LABELS[reason]) ?? 'Not answered';
}

// Refusals that still put a record in front of the reader. A weak-retrieval
// "No record" card or a tool check must not show a record source card.
const RECORD_REFUSALS = new Set([
  'no_commentary',
  'needs_verification',
  'conflicting_sources',
  'historical_only',
]);

export function showsRecordCard(
  source: string | undefined,
  refusalReason: string | undefined,
  docIds: string[] | undefined,
): boolean {
  if (source !== 'refusal') return true;
  const records = (docIds ?? []).filter(id => !id.startsWith('tool:'));
  return records.length > 0 && RECORD_REFUSALS.has(refusalReason ?? '');
}
