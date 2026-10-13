import {actions} from '../config/loader';

// Build keyword-to-action map from config actions that require online connectivity
const KEYWORD_ACTION_MAP: Array<{
  keywords: string[];
  action: string;
}> = actions.filter(a => a.requiresOnline).map(a => ({keywords: a.keywords, action: a.id}));

// Build flat keyword list for the quick requiresOnline check
const ONLINE_KEYWORDS: string[] = actions.filter(a => a.requiresOnline).flatMap(a => a.keywords);

// Queries that ask HOW to do something are informational (offline-answerable),
// not account-specific. "How do I check my balance?" = offline FAQ.
// "What is my balance?" = needs API call. Openers like "what is the" and
// "can i" also start account questions, so they stay off this list.
const INFORMATIONAL_PHRASES = [
  'how do i',
  'how to',
  'how can i',
  'where do i',
  'where can i',
  'tell me how',
  'steps to',
  'way to',
  'also check',
  'also do',
];

export function requiresOnline(query: string): boolean {
  const lower = query.toLowerCase();

  // Skip if this is an informational/how-to query
  if (INFORMATIONAL_PHRASES.some(phrase => lower.includes(phrase))) {
    return false;
  }

  return ONLINE_KEYWORDS.some(keyword => lower.includes(keyword));
}

export function getOnlineActionType(query: string): string | null {
  const lower = query.toLowerCase();

  for (const entry of KEYWORD_ACTION_MAP) {
    for (const keyword of entry.keywords) {
      if (lower.includes(keyword)) {
        return entry.action;
      }
    }
  }

  return null;
}
