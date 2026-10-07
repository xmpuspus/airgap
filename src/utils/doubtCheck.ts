// A doubt check is a short reply that questions the last answer. The
// orchestrator answers it from the record store, so the answer cannot move.

const DOUBT_PATTERNS = [
  /^\s*(are you|you|u)\s+sure\b/i,
  /^\s*sure(\s+ba)?\s*\?/i,
  /^\s*(really|seriously|talaga|totoo ba|totoo)\s*\?*\s*$/i,
  /\bsigurado\s+(ka|ba)\b/i,
  /\bis that (right|correct|true)\b/i,
];

export function isDoubtCheck(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length <= 40 && DOUBT_PATTERNS.some(pattern => pattern.test(trimmed));
}
