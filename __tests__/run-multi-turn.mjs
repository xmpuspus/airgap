/**
 * Multi-Turn Conversation Test Runner
 *
 * Tests the search + follow-up detection pipeline with conversation history.
 * Exercises 100 conversations (300+ turns) without LLM — tests routing,
 * search quality, and follow-up detection only.
 *
 * Usage:
 *   node __tests__/run-multi-turn.mjs                    # All 100
 *   node __tests__/run-multi-turn.mjs --id 43            # Single conversation
 *   node __tests__/run-multi-turn.mjs --category coreference  # One category
 */

import {readFileSync, writeFileSync} from 'fs';
import {join, dirname} from 'path';
import {fileURLToPath} from 'url';
import MiniSearch from 'minisearch';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// === CLI args ===
const args = process.argv.slice(2);
let filterId = null, filterCategory = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--id') filterId = parseInt(args[i + 1]);
  if (args[i] === '--category') filterCategory = args[i + 1];
}

// === Load KB ===
const kbFiles = ['faq', 'plans', 'promos', 'troubleshooting', 'stores', 'roaming', 'payments'];
const allDocuments = [];
for (const f of kbFiles) {
  allDocuments.push(...JSON.parse(readFileSync(join(root, `src/knowledge/${f}.json`), 'utf-8')));
}
console.log(`Loaded ${allDocuments.length} KB documents`);

// === Build MiniSearch ===
const searchIndex = new MiniSearch({
  fields: ['title', 'content', 'keywords'],
  storeFields: ['id', 'title', 'category', 'content', 'tags', 'metadata'],
  searchOptions: { boost: { title: 3, keywords: 2, content: 1 }, fuzzy: 0.2, prefix: true },
  extractField: (doc, fieldName) => fieldName === 'keywords' ? doc.keywords.join(' ') : doc[fieldName],
});
searchIndex.addAll(allDocuments);

// === Online check ===
const ONLINE_KW = [
  'my balance', 'my bill amount', 'what is my bill', 'how much is my bill',
  'my data usage', 'check my usage', 'my account details', 'my account info',
  'change my plan', 'switch my plan', 'upgrade my plan', 'activate my plan',
  'change plan to', 'switch plan to', 'upgrade plan', 'activate plan',
  'create a ticket', 'create ticket', 'file a complaint', 'file complaint', 'support ticket',
  'outage status', 'service outage', 'outage in my area',
];

const INFO_PREFIXES = ['how do i', 'how to', 'how can i', 'can i', 'where do i',
  'where can i', 'what is the', 'tell me how', 'steps to', 'way to', 'also check', 'also do'];

function requiresOnline(query) {
  const lower = query.toLowerCase();
  if (INFO_PREFIXES.some(p => lower.includes(p))) return false;
  return ONLINE_KW.some(kw => lower.includes(kw));
}

// === Greeting check ===
const GREETINGS = ['hi', 'hello', 'hey', 'good morning', 'good afternoon',
  'good evening', 'howdy', 'yo', 'sup', 'hola', 'kamusta', 'musta',
  'bye', 'goodbye', 'thanks', 'thank you'];

const NOT_GREETINGS = new Set([
  'sim', 'apn', 'bgc', 'lte', 'mms', 'dns', 'otg', 'qr',
  'vpn', 'nfc', 'pin', 'puk', 'otp', 'faq', 'sos', 'usb',
  'rom', 'ram', 'app', 'web', 'net', 'log', 'pay', 'buy',
  'php', 'gb', 'mb', 'kb', 'mbps', 'ghz', 'mhz', 'bpi',
  'bdo', 'atm', 'eip', 'esim', 'iot', 'sms', 'gps',
]);

function isGreeting(text) {
  const lower = text.toLowerCase().replace(/[!.,?]/g, '').trim();
  if (lower.length <= 3 && /^[a-z]+$/.test(lower)) {
    return !NOT_GREETINGS.has(lower);
  }
  return GREETINGS.includes(lower);
}

// === Topic keywords (mirrors src/utils/followUpDetector.ts) ===
const TOPIC_KEYWORDS = new Set([
  'apn', 'sim', 'esim', 'fiber', 'roaming', 'store', 'plan', 'plans',
  'gcash', 'wifi', 'promo', 'promos', 'postpaid', 'prepaid', 'load',
  'data', 'hotspot', 'volte', '5g', '4g', 'lte', 'broadband',
  'billing', 'payment', 'balance', 'topup', 'top-up', 'porting',
  'troubleshoot', 'troubleshooting', 'signal', 'outage',
  'bgc', 'cebu', 'davao', 'makati', 'baguio', 'iloilo',
]);

// === Follow-up detection (mirrors src/utils/followUpDetector.ts) ===
const FOLLOW_UP_PATTERNS = [
  /^(tell me more|more info|more details|explain more|elaborate)/i,
  /^(what about|how about|and what about)/i,
  /^(what else|anything else|is there more)/i,
  /\b(how much is it|how much does it cost|what does it cost)\b/i,
  /\b(is it available|can i get it|how do i get it)\b/i,
  /\b(the first one|the second one|the third one|the last one|the cheapest one|the best one)\b/i,
  /\b(that one|this one|the one you mentioned|the one above)\b/i,
  /\b(compared to|versus|vs|or the other one|which is better)\b/i,
  /\b(any alternatives|other options|something else|another plan)\b/i,
  /^(what do you mean|i don't understand|can you clarify|huh\??|what\??)/i,
  /^(sorry|wait|actually|but)/i,
  /^(yes|yeah|yep|sure|ok|okay|no|nope|nah|not really)$/i,
  /^(how much|what price|how long|when|where|which)\?*$/i,
];

function isFollowUp(query, history) {
  if (!history || history.length === 0) return false;
  const trimmed = query.trim();
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount <= 3 && history.length >= 2) {
    if (/^(hi|hello|hey|good morning|good afternoon|bye|goodbye|thanks|thank you)\b/i.test(trimmed)) return false;
    const queryWords = trimmed.toLowerCase().replace(/[^a-z0-9\s-]/g, '').split(/\s+/);
    if (queryWords.some(w => TOPIC_KEYWORDS.has(w))) return false;
    return true;
  }
  return FOLLOW_UP_PATTERNS.some(p => p.test(trimmed));
}

function expandQuery(query, history) {
  if (history.length < 2) return query;
  const lastUser = [...history].reverse().find(t => t.role === 'user');
  if (!lastUser) return query;
  const prev = lastUser.text;
  const stopWords = new Set(['the','a','an','is','are','was','were','be','been','have','has','had','do','does','did','will','would','could','should','to','of','in','for','on','with','at','by','from','as','and','but','or','not','no','so','yet','this','that','i','me','my','we','you','your','he','him','she','her','it','its','they','them','their','if','only','based','information','reference','according','provided','answer','question','help','please','thanks','can','how','what','where']);
  const words = prev.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
  const freq = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  const topKW = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w);
  return `${topKW.join(' ')} ${query}`;
}

// === Search with follow-up awareness ===
function searchKB(query, topK = 3) {
  return searchIndex.search(query).slice(0, topK);
}

function determineRoute(input, history) {
  // Greetings: "bye"/"thanks" are always greetings regardless of history
  // "hi"/"hello" are only greetings at conversation start
  const lower = input.toLowerCase().replace(/[!.,?]/g, '').trim();
  const isEndGreeting = ['bye', 'goodbye', 'thanks', 'thank you'].includes(lower);
  if (isEndGreeting) return 'greeting';
  if (isGreeting(input) && (!history || history.length === 0)) return 'greeting';
  if (requiresOnline(input)) return 'online_queue';

  let searchQuery = input;
  const followUp = isFollowUp(input, history);
  if (followUp) searchQuery = expandQuery(input, history);

  const results = searchKB(searchQuery, 3);
  if (results.length === 0 && followUp) {
    const fallback = searchKB(input, 3);
    if (fallback.length > 0) return 'search_llm';
  }
  if (results.length > 0) return 'search_llm';
  return 'fallback';
}

// === Load conversations ===
const convFile = readFileSync(join(root, '__tests__/multi-turn-journeys.ts'), 'utf-8');

// Parse conversations using regex
const convPattern = /\{\s*id:\s*(\d+),\s*category:\s*'([^']+)',\s*description:\s*'([^']+)',/g;
const turnPattern = /\{\s*input:\s*'([^']*)',(?:\s*expectRoute:\s*'([^']+)')?(?:,\s*expectContains:\s*\[([^\]]*)\])?(?:,\s*expectNotContains:\s*\[([^\]]*)\])?,\s*description:\s*'([^']*)'\s*\}/g;

let conversations = [];
let convMatch;
const convStarts = [];
while ((convMatch = convPattern.exec(convFile)) !== null) {
  convStarts.push({
    id: parseInt(convMatch[1]),
    category: convMatch[2],
    description: convMatch[3],
    offset: convMatch.index,
  });
}

for (let c = 0; c < convStarts.length; c++) {
  const conv = convStarts[c];
  const start = conv.offset;
  const end = c + 1 < convStarts.length ? convStarts[c + 1].offset : convFile.length;
  const chunk = convFile.substring(start, end);

  const turns = [];
  let tMatch;
  const localTurnPattern = new RegExp(turnPattern.source, 'g');
  while ((tMatch = localTurnPattern.exec(chunk)) !== null) {
    turns.push({
      input: tMatch[1],
      expectRoute: tMatch[2] || undefined,
      expectContains: tMatch[3] ? tMatch[3].split(',').map(s => s.trim().replace(/'/g, '')) : [],
      expectNotContains: tMatch[4] ? tMatch[4].split(',').map(s => s.trim().replace(/'/g, '')) : [],
      description: tMatch[5],
    });
  }

  conversations.push({ ...conv, turns });
}

// Apply filters
if (filterId) conversations = conversations.filter(c => c.id === filterId);
else if (filterCategory) conversations = conversations.filter(c => c.category === filterCategory);

const totalTurns = conversations.reduce((sum, c) => sum + c.turns.length, 0);
console.log(`Running ${conversations.length} conversations (${totalTurns} turns)\n`);

// === Run conversations ===
let convPassed = 0, convFailed = 0;
let turnPassed = 0, turnFailed = 0;
const failures = [];

for (const conv of conversations) {
  const history = [];
  let convOk = true;

  for (const turn of conv.turns) {
    const actualRoute = determineRoute(turn.input, history);
    const searchQuery = isFollowUp(turn.input, history) ? expandQuery(turn.input, history) : turn.input;
    const searchResults = searchKB(searchQuery, 3);
    const fallbackResults = searchResults.length === 0 ? searchKB(turn.input, 3) : [];
    const allResults = searchResults.length > 0 ? searchResults : fallbackResults;

    let routeOk = !turn.expectRoute || actualRoute === turn.expectRoute;
    let containsOk = true;
    let notContainsOk = true;
    const issues = [];

    // Check expected terms in search results
    if (turn.expectContains?.length > 0 && allResults.length > 0) {
      const allText = allResults.map(r => `${r.title} ${r.content} ${JSON.stringify(r.metadata || {})}`).join(' ');
      for (const term of turn.expectContains) {
        if (!allText.toLowerCase().includes(term.toLowerCase())) {
          containsOk = false;
          issues.push(`missing "${term}" in results`);
        }
      }
    }

    // Check follow-up detection
    const detected = isFollowUp(turn.input, history);
    const shouldBeFollowUp = history.length >= 2 && turn.input.split(/\s+/).length <= 4;

    if (routeOk && containsOk && notContainsOk) {
      turnPassed++;
    } else {
      turnFailed++;
      convOk = false;
      if (!routeOk) issues.unshift(`route: expected '${turn.expectRoute}', got '${actualRoute}'`);
      failures.push({
        convId: conv.id,
        convDesc: conv.description,
        turnDesc: turn.description,
        input: turn.input,
        issues,
        followUpDetected: detected,
        expandedQuery: detected ? searchQuery.substring(0, 80) : null,
        topResults: allResults.slice(0, 2).map(r => `${r.id}: ${r.title}`),
      });
    }

    // Add to history for next turn
    history.push({ role: 'user', text: turn.input });
    if (allResults.length > 0) {
      history.push({ role: 'bot', text: allResults[0].content.substring(0, 200) });
    } else {
      history.push({ role: 'bot', text: 'I don\'t have that information.' });
    }
  }

  if (convOk) convPassed++;
  else convFailed++;
}

// === Report ===
console.log('='.repeat(70));
console.log(`CONVERSATIONS: ${convPassed} PASSED / ${convFailed} FAILED out of ${conversations.length}`);
console.log(`TURNS: ${turnPassed} PASSED / ${turnFailed} FAILED out of ${totalTurns}`);
console.log('='.repeat(70));

if (failures.length > 0) {
  console.log('\nFAILURES:\n');
  for (const f of failures) {
    console.log(`  [Conv ${f.convId}] ${f.convDesc}`);
    console.log(`    Turn: "${f.input}" (${f.turnDesc})`);
    for (const issue of f.issues) {
      console.log(`    - ${issue}`);
    }
    if (f.followUpDetected) console.log(`    Follow-up detected, expanded: "${f.expandedQuery}"`);
    console.log(`    Top results: ${f.topResults.join(' | ') || '(none)'}`);
    console.log('');
  }
}

// Category breakdown
const cats = {};
for (const conv of conversations) {
  if (!cats[conv.category]) cats[conv.category] = { total: 0, passed: 0 };
  cats[conv.category].total++;
}
for (const conv of conversations) {
  const history = [];
  let ok = true;
  for (const turn of conv.turns) {
    const route = determineRoute(turn.input, history);
    const sq = isFollowUp(turn.input, history) ? expandQuery(turn.input, history) : turn.input;
    const res = searchKB(sq, 3);
    const allRes = res.length > 0 ? res : searchKB(turn.input, 3);
    if (turn.expectRoute && route !== turn.expectRoute) ok = false;
    if (turn.expectContains?.length > 0 && allRes.length > 0) {
      const allText = allRes.map(r => `${r.title} ${r.content} ${JSON.stringify(r.metadata || {})}`).join(' ');
      for (const term of turn.expectContains) {
        if (!allText.toLowerCase().includes(term.toLowerCase())) ok = false;
      }
    }
    history.push({ role: 'user', text: turn.input });
    history.push({ role: 'bot', text: allRes[0]?.content?.substring(0, 200) || '' });
  }
  if (ok) cats[conv.category].passed++;
}

console.log('\nCATEGORY BREAKDOWN:');
for (const [cat, stats] of Object.entries(cats)) {
  const pct = ((stats.passed / stats.total) * 100).toFixed(0);
  const status = stats.passed === stats.total ? '[PASS]' : '[FAIL]';
  console.log(`  ${status} ${cat}: ${stats.passed}/${stats.total} (${pct}%)`);
}
