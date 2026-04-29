/**
 * Journey test runner — exercises the search + routing pipeline
 * against 100 user journeys without needing React Native runtime.
 *
 * Run: node --experimental-vm-modules __tests__/run-journeys.mjs
 *
 * We can't import the full orchestrator (it depends on RN native modules),
 * so we replicate the core logic: online check → search → format results.
 */

import MiniSearch from 'minisearch';
import {readFileSync} from 'fs';
import {join, dirname} from 'path';
import {fileURLToPath} from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// === Load knowledge base ===
const kbFiles = ['faq', 'plans', 'promos', 'troubleshooting', 'stores', 'roaming', 'payments'];
const allDocuments = [];
for (const f of kbFiles) {
  const data = JSON.parse(readFileSync(join(root, `src/knowledge/${f}.json`), 'utf-8'));
  allDocuments.push(...data);
}

console.log(`Loaded ${allDocuments.length} KB documents\n`);

// === Build MiniSearch index (mirrors src/knowledge/index.ts) ===
const searchIndex = new MiniSearch({
  fields: ['title', 'content', 'keywords'],
  storeFields: ['id', 'title', 'category', 'content', 'tags', 'metadata'],
  searchOptions: {
    boost: {title: 3, keywords: 2, content: 1},
    fuzzy: 0.2,
    prefix: true,
  },
  extractField: (document, fieldName) => {
    if (fieldName === 'keywords') return document.keywords.join(' ');
    return document[fieldName];
  },
});
searchIndex.addAll(allDocuments);

// === Online check (mirrors src/utils/onlineCheck.ts) ===
const ONLINE_KEYWORDS = [
  'my balance', 'my bill amount', 'what is my bill', 'how much is my bill',
  'my data usage', 'check my usage', 'my account details', 'my account info',
  'change my plan', 'switch my plan', 'upgrade my plan', 'activate my plan',
  'change plan to', 'switch plan to', 'upgrade plan', 'activate plan',
  'create a ticket', 'create ticket', 'file a complaint', 'file complaint', 'support ticket',
  'outage status', 'service outage', 'outage in my area',
];

const INFO_PREFIXES_ST = ["how do i","how to","how can i","can i","where do i","where can i","what is the","tell me how","steps to","way to","also check","also do"];
function requiresOnline(query) {
  const lowerQ = query.toLowerCase();
  if (INFO_PREFIXES_ST.some(p => lowerQ.includes(p))) return false;
  const lower = query.toLowerCase();
  return ONLINE_KEYWORDS.some(kw => lower.includes(kw));
}

// === Greeting check (mirrors orchestrator) ===
const GREETINGS = [
  'hi', 'hello', 'hey', 'good morning', 'good afternoon',
  'good evening', 'howdy', 'yo', 'sup', 'hola', 'kamusta', 'musta',
];

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

// === Search function (mirrors src/services/searchService.ts) ===
function searchKB(query, topK = 5) {
  const results = searchIndex.search(query);
  return results.slice(0, topK);
}

// === Route determination ===
function determineRoute(input) {
  if (isGreeting(input)) return 'greeting';
  if (requiresOnline(input)) return 'online_queue'; // assume offline for testing
  const results = searchKB(input, 3);
  if (results.length > 0) return 'search_llm';
  return 'fallback';
}

// === Load journeys ===
// Parse the TypeScript file manually (extract the array)
const journeysRaw = readFileSync(join(root, '__tests__/journeys.ts'), 'utf-8');
// Extract journey objects using regex
const journeyPattern = /\{id:\s*(\d+),\s*category:\s*'([^']+)',\s*input:\s*'([^']*)',\s*expectRoute:\s*'([^']+)'(?:,\s*expectContains:\s*\[([^\]]*)\])?(?:,\s*expectNotContains:\s*\[([^\]]*)\])?,\s*description:\s*'([^']*)'\}/g;

const journeys = [];
let match;
while ((match = journeyPattern.exec(journeysRaw)) !== null) {
  const expectContains = match[5]
    ? match[5].split(',').map(s => s.trim().replace(/'/g, ''))
    : [];
  journeys.push({
    id: parseInt(match[1]),
    category: match[2],
    input: match[3],
    expectRoute: match[4],
    expectContains,
    description: match[7],
  });
}

console.log(`Loaded ${journeys.length} journeys\n`);

// === Run all journeys ===
let passed = 0;
let failed = 0;
const failures = [];

for (const j of journeys) {
  const actualRoute = determineRoute(j.input);
  const searchResults = searchKB(j.input, 3);

  let routeOk = actualRoute === j.expectRoute;
  let containsOk = true;
  const missingTerms = [];

  // For search_llm routes, check that search results contain expected terms
  if (j.expectContains.length > 0 && (actualRoute === 'search_llm' || actualRoute === j.expectRoute)) {
    const allText = searchResults.map(r =>
      `${r.title} ${r.content} ${JSON.stringify(r.metadata || {})}`
    ).join(' ');

    for (const term of j.expectContains) {
      if (!allText.toLowerCase().includes(term.toLowerCase())) {
        containsOk = false;
        missingTerms.push(term);
      }
    }
  }

  if (routeOk && containsOk) {
    passed++;
  } else {
    failed++;
    const reasons = [];
    if (!routeOk) reasons.push(`route: expected '${j.expectRoute}', got '${actualRoute}'`);
    if (!containsOk) reasons.push(`missing terms in results: [${missingTerms.join(', ')}]`);

    failures.push({
      id: j.id,
      input: j.input,
      description: j.description,
      reasons,
      topResults: searchResults.slice(0, 3).map(r => `${r.id}: ${r.title} (score: ${r.score?.toFixed(2)})`),
    });
  }
}

// === Report ===
console.log('='.repeat(70));
console.log(`RESULTS: ${passed} PASSED / ${failed} FAILED out of ${journeys.length}`);
console.log('='.repeat(70));

if (failures.length > 0) {
  console.log('\nFAILURES:\n');
  for (const f of failures) {
    console.log(`  [${f.id}] "${f.input}" (${f.description})`);
    for (const r of f.reasons) {
      console.log(`    - ${r}`);
    }
    if (f.topResults.length > 0) {
      console.log(`    Top results: ${f.topResults.join(' | ')}`);
    } else {
      console.log('    Top results: (none)');
    }
    console.log('');
  }
}

// === Category breakdown ===
const categories = {};
for (const j of journeys) {
  if (!categories[j.category]) categories[j.category] = {total: 0, passed: 0};
  categories[j.category].total++;
  const actualRoute = determineRoute(j.input);
  const searchResults = searchKB(j.input, 3);
  let ok = actualRoute === j.expectRoute;
  if (ok && j.expectContains?.length > 0 && actualRoute === 'search_llm') {
    const allText = searchResults.map(r => `${r.title} ${r.content} ${JSON.stringify(r.metadata || {})}`).join(' ');
    for (const term of j.expectContains) {
      if (!allText.toLowerCase().includes(term.toLowerCase())) { ok = false; break; }
    }
  }
  if (ok) categories[j.category].passed++;
}

console.log('\nCATEGORY BREAKDOWN:');
for (const [cat, stats] of Object.entries(categories)) {
  const pct = ((stats.passed / stats.total) * 100).toFixed(0);
  const status = stats.passed === stats.total ? '[PASS]' : '[FAIL]';
  console.log(`  ${status} ${cat}: ${stats.passed}/${stats.total} (${pct}%)`);
}
