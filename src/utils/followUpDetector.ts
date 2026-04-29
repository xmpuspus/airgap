import type {ConversationTurn} from './promptBuilder';

// Topic keywords that signal a new standalone query even when short.
// If a 1-3 word query contains one of these, it's a new topic, not a follow-up.
const TOPIC_KEYWORDS = new Set([
  // Products / services
  'apn', 'sim', 'esim', 'fiber', 'roaming', 'store', 'plan', 'plans',
  'gcash', 'wifi', 'promo', 'promos', 'postpaid', 'prepaid', 'load',
  'data', 'hotspot', 'volte', '5g', '4g', 'lte', 'broadband',
  // Actions / categories
  'billing', 'payment', 'balance', 'topup', 'top-up', 'porting',
  'troubleshoot', 'troubleshooting', 'signal', 'outage',
  // Locations
  'bgc', 'cebu', 'davao', 'makati', 'baguio', 'iloilo',
]);

// Patterns that indicate a follow-up to the previous topic
const FOLLOW_UP_PATTERNS = [
  // Direct references
  /^(tell me more|more info|more details|explain more|elaborate)/i,
  /^(what about|how about|and what about)/i,
  /^(what else|anything else|is there more)/i,

  // Pronouns referring to previous topic
  /\b(how much is it|how much does it cost|what does it cost)\b/i,
  /\b(is it available|can i get it|how do i get it)\b/i,
  /\b(what are the details|give me details)\b/i,

  // Ordinal references
  /\b(the first one|the second one|the third one|the last one|the cheapest one|the best one)\b/i,
  /\b(that one|this one|the one you mentioned|the one above)\b/i,

  // Comparison follow-ups
  /\b(compared to|versus|vs|or the other one|which is better)\b/i,
  /\b(any alternatives|other options|something else|another plan)\b/i,

  // Clarification
  /^(what do you mean|i don't understand|can you clarify|huh\??|what\??)/i,
  /^(sorry|wait|actually|but)/i,

  // Yes/no responses (following a question from the bot)
  /^(yes|yeah|yep|sure|ok|okay|no|nope|nah|not really)$/i,

  // Short queries that likely reference previous context
  /^(how much|what price|how long|when|where|which)\?*$/i,
];

// Keywords that indicate the user is starting a NEW topic (not a follow-up)
const NEW_TOPIC_INDICATORS = [
  /\b(i want to|i need to|i'd like to|can you help me with|help me)\b/i,
  /\b(another question|different question|new question|also|by the way)\b/i,
  /\b(what is|what are|how do i|how can i|where is|where can)\b/i,
];

/**
 * Detect if the current query is a follow-up to the previous conversation.
 */
export function isFollowUp(
  currentQuery: string,
  history: ConversationTurn[],
): boolean {
  // No history = can't be a follow-up
  if (!history || history.length === 0) return false;

  const trimmed = currentQuery.trim();

  // Very short queries (1-4 words) are likely follow-ups if there's history
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount <= 3 && history.length >= 2) {
    // Unless it's a clear standalone greeting or topic
    if (/^(hi|hello|hey|good morning|good afternoon|bye|goodbye|thanks|thank you)\b/i.test(trimmed))
      return false;

    // If any word matches a known topic keyword, treat as a new topic
    const queryWords = trimmed.toLowerCase().replace(/[^a-z0-9\s-]/g, '').split(/\s+/);
    if (queryWords.some(w => TOPIC_KEYWORDS.has(w))) return false;

    return true;
  }

  // Check follow-up patterns
  for (const pattern of FOLLOW_UP_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }

  // Check if it's clearly a new topic
  for (const pattern of NEW_TOPIC_INDICATORS) {
    if (pattern.test(trimmed)) return false;
  }

  return false;
}

/**
 * Extract product names and PHP amounts from bot response text.
 * Captures things like "Plan 999", "MegaSurf 299", "PHP 599", "PHP 99/month".
 */
function extractBotEntities(botText: string): string[] {
  const entities: string[] = [];

  // Product names: "Plan 999", "MegaSurf 299", "Super Surf 99", "Fiber 100Mbps"
  const productPattern = /\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*\s+\d+(?:\s*Mbps)?)\b/g;
  let match;
  while ((match = productPattern.exec(botText)) !== null) {
    entities.push(match[1].toLowerCase());
  }

  // PHP amounts: "PHP 299", "PHP 99"
  const pricePattern = /PHP\s*(\d[\d,]*)/gi;
  while ((match = pricePattern.exec(botText)) !== null) {
    entities.push(`php ${match[1].replace(/,/g, '')}`);
  }

  return entities;
}

/**
 * Expand a follow-up query by incorporating context from the previous exchange.
 * This helps MiniSearch find relevant results even when the user's query
 * is vague like "how much is it?" or "tell me more".
 *
 * Strategy: extract key nouns/topics from the last user query,
 * plus product names and prices from the last bot response,
 * and prepend them to the current query for search.
 */
export function expandQuery(
  currentQuery: string,
  history: ConversationTurn[],
): string {
  if (history.length < 2) return currentQuery;

  // Find the last user query (most important for topic)
  const lastUserTurn = [...history]
    .reverse()
    .find(t => t.role === 'user');

  if (!lastUserTurn) return currentQuery;

  // Primarily use the previous USER query for topic context
  const previousContext = lastUserTurn.text;

  // Extract significant words (skip common words)
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'and', 'but', 'or',
    'not', 'no', 'nor', 'so', 'yet', 'both', 'each', 'all', 'any', 'few',
    'more', 'most', 'other', 'some', 'such', 'than', 'too', 'very', 'just',
    'also', 'about', 'up', 'out', 'off', 'over', 'under', 'again',
    'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
    'how', 'what', 'which', 'who', 'whom', 'this', 'that', 'these',
    'those', 'i', 'me', 'my', 'mine', 'we', 'our', 'you', 'your',
    'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them',
    'their', 'if', 'only', 'based', 'information', 'reference', 'according',
    'provided', 'answer', 'question', 'help', 'please', 'thanks', 'thank',
  ]);

  const words = previousContext
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));

  // Count frequency, take top 5 most relevant words
  const freq: Record<string, number> = {};
  for (const w of words) {
    freq[w] = (freq[w] || 0) + 1;
  }

  const topKeywords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w);

  // For ordinal/reference follow-ups, also extract entities from the bot response
  const isOrdinalRef =
    /\b(the (cheapest|first|second|third|last|best|most|fastest) one)\b/i.test(currentQuery) ||
    /\b(that one|this one|the one)\b/i.test(currentQuery);

  if (isOrdinalRef) {
    const lastBotTurn = [...history]
      .reverse()
      .find(t => t.role === 'bot');
    if (lastBotTurn) {
      const botEntities = extractBotEntities(lastBotTurn.text);
      // Add bot entities (deduplicated) to provide product context
      for (const entity of botEntities.slice(0, 3)) {
        if (!topKeywords.includes(entity)) {
          topKeywords.push(entity);
        }
      }
    }
  }

  // Prepend topic keywords to the current query for search
  return `${topKeywords.join(' ')} ${currentQuery}`;
}
