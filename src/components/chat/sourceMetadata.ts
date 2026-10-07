// Turns document metadata into the lines the source drawer shows: who
// published the record, where it is, when the snapshot was checked, and
// whether its review date has passed. Pure function, so it is unit tested
// without rendering.

export interface SourceView {
  publisher: string;
  url?: string;
  checkedLabel?: string;
  reviewOverdue: boolean;
}

const DAY_MS = 86_400_000;

function dateOnly(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function describeSourceMetadata(
  metadata: Record<string, unknown> | undefined,
  now: Date = new Date(),
): SourceView | null {
  if (!metadata) return null;
  const url = text(metadata.source);
  const publisher = text(metadata.publisher) ?? (url ? hostOf(url) ?? url : undefined);
  const checked = dateOnly(metadata.asOf);
  if (!publisher && !checked) return null;

  let checkedLabel: string | undefined;
  if (checked) {
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const days = Math.max(0, Math.round((today - checked.getTime()) / DAY_MS));
    const age = days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`;
    checkedLabel = `Checked ${String(metadata.asOf)}, ${age}`;
  }

  const reviewBy = dateOnly(metadata.reviewBy);
  return {
    publisher: publisher ?? 'Unknown publisher',
    url,
    checkedLabel,
    reviewOverdue: reviewBy !== null && reviewBy.getTime() < now.getTime(),
  };
}
