/**
 * Per-Industry Behavioral Tests
 *
 * Runs search + routing tests for EACH industry template's knowledge base.
 * Verifies that the KB content is searchable and returns relevant results.
 *
 * Usage:
 *   node __tests__/run-industry-tests.mjs                    # All industries
 *   node __tests__/run-industry-tests.mjs --industry banking # One industry
 */

import {readFileSync, readdirSync, existsSync} from 'fs';
import {join, dirname} from 'path';
import {fileURLToPath} from 'url';
import MiniSearch from 'minisearch';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const args = process.argv.slice(2);
let filterIndustry = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--industry') filterIndustry = args[i + 1];
}

// Industry test definitions
const INDUSTRY_TESTS = {
  telco: {
    dir: 'examples/telco/knowledge',
    queries: [
      {q: 'What prepaid plans do you have?', expectContains: ['Super Surf', 'PHP']},
      {q: 'How do I check my balance?', expectContains: ['*123#']},
      {q: 'Roaming in Japan', expectContains: ['Zone']},
      {q: 'No signal on my phone', expectContains: ['signal', 'Airplane']},
      {q: 'Store in Cebu', expectContains: ['Cebu', 'Ayala']},
      {q: 'Pay via GCash', expectContains: ['GCash']},
      {q: 'eSIM activation', expectContains: ['eSIM']},
      {q: 'Fiber broadband plans', expectContains: ['Fiber', 'Mbps']},
      {q: 'How to register SIM', expectContains: ['SIM', 'registration']},
      {q: 'ACMEPay setup', expectContains: ['ACMEPay']},
    ],
  },
  'electric-utility': {
    dir: 'examples/electric-utility/knowledge',
    queries: [
      {q: 'Power outage in my area', expectContains: ['outage']},
      {q: 'How to read my electric meter', expectContains: ['meter']},
      {q: 'Time of use rate plan', expectContains: ['rate', 'peak']},
      {q: 'Solar panel connection', expectContains: ['solar']},
      {q: 'My bill is too high', expectContains: ['bill']},
      {q: 'Energy saving tips', expectContains: ['energy', 'save']},
      {q: 'EV charging rates', expectContains: ['EV', 'charging']},
      {q: 'Circuit breaker keeps tripping', expectContains: ['breaker', 'circuit']},
      {q: 'Service center locations', expectContains: ['center']},
      {q: 'Auto-pay setup', expectContains: ['pay']},
    ],
  },
  'water-utility': {
    dir: 'examples/water-utility/knowledge',
    queries: [
      {q: 'Water is discolored brown', expectContains: ['discolor']},
      {q: 'Boil water advisory', expectContains: ['boil']},
      {q: 'How to conserve water', expectContains: ['conserv']},
      {q: 'My water bill is high', expectContains: ['bill']},
      {q: 'Low water pressure', expectContains: ['pressure']},
      {q: 'Report a water leak', expectContains: ['leak']},
      {q: 'Winter pipe protection', expectContains: ['winter', 'pipe']},
      {q: 'New water connection', expectContains: ['connect']},
    ],
  },
  airline: {
    dir: 'examples/airline/knowledge',
    queries: [
      {q: 'What is the baggage allowance?', expectContains: ['baggage', 'kg']},
      {q: 'How to check in online', expectContains: ['check-in', 'online']},
      {q: 'Flight to Tokyo', expectContains: ['Tokyo']},
      {q: 'SkyPeak Rewards loyalty program', expectContains: ['Rewards', 'loyalty']},
      {q: 'Airport lounge access', expectContains: ['lounge']},
      {q: 'Checked bag weight limit', expectContains: ['baggage', 'kg']},
      {q: 'Traveling with pets', expectContains: ['pet']},
      {q: 'Business class features', expectContains: ['Business']},
      {q: 'Boarding pass not loading', expectContains: ['boarding']},
      {q: 'Flight change fee', expectContains: ['change', 'fee']},
    ],
  },
  banking: {
    dir: 'examples/banking/knowledge',
    queries: [
      {q: 'How to open a savings account', expectContains: ['savings', 'account']},
      {q: 'Personal loan rates', expectContains: ['loan', 'rate']},
      {q: 'ATM near downtown', expectContains: ['ATM']},
      {q: 'Debit card PIN reset', expectContains: ['PIN']},
      {q: 'Wire transfer fees', expectContains: ['wire', 'fee']},
      {q: 'Mobile banking app', expectContains: ['mobile', 'app']},
      {q: 'Phishing scam protection', expectContains: ['phishing']},
      {q: 'CD interest rates', expectContains: ['CD', 'rate']},
      {q: 'Overdraft protection', expectContains: ['overdraft']},
      {q: 'Credit card rewards', expectContains: ['credit', 'reward']},
    ],
  },
  insurance: {
    dir: 'examples/insurance/knowledge',
    queries: [
      {q: 'How to file a claim', expectContains: ['claim']},
      {q: 'What does my policy cover', expectContains: ['coverage']},
      {q: 'Auto insurance options', expectContains: ['auto']},
      {q: 'Find an agent near me', expectContains: ['agent']},
      {q: 'Homeowners insurance', expectContains: ['home']},
      {q: 'Life insurance types', expectContains: ['life']},
      {q: 'Premium payment options', expectContains: ['premium', 'payment']},
      {q: 'Deductible explanation', expectContains: ['deductible']},
    ],
  },
  healthcare: {
    dir: 'examples/healthcare/knowledge',
    queries: [
      {q: 'How to book an appointment', expectContains: ['appointment']},
      {q: 'Prescription refill process', expectContains: ['prescription']},
      {q: 'Clinic locations and hours', expectContains: ['clinic']},
      {q: 'What insurance do you accept', expectContains: ['insurance']},
      {q: 'Telehealth appointment', expectContains: ['telehealth']},
      {q: 'Patient portal login', expectContains: ['portal']},
      {q: 'Lab results timeline', expectContains: ['lab', 'result']},
      {q: 'Copay information', expectContains: ['copay']},
      {q: 'Mental health counseling', expectContains: ['mental']},
      {q: 'After hours emergency care', expectContains: ['after', 'hours']},
    ],
  },
};

// Build MiniSearch for an industry
function buildIndex(kbDir) {
  const fullPath = join(root, kbDir);
  if (!existsSync(fullPath)) return {index: null, count: 0};

  const files = readdirSync(fullPath).filter(f => f.endsWith('.json'));
  const docs = [];
  for (const f of files) {
    const data = JSON.parse(readFileSync(join(fullPath, f), 'utf-8'));
    docs.push(...data);
  }

  const index = new MiniSearch({
    fields: ['title', 'content', 'keywords'],
    storeFields: ['id', 'title', 'category', 'content', 'tags', 'metadata'],
    searchOptions: {boost: {title: 3, keywords: 2, content: 1}, fuzzy: 0.2, prefix: true},
    extractField: (doc, fieldName) => fieldName === 'keywords' ? doc.keywords.join(' ') : doc[fieldName],
  });
  index.addAll(docs);
  return {index, count: docs.length};
}

// Run tests
let totalPassed = 0, totalFailed = 0;
const industries = filterIndustry ? {[filterIndustry]: INDUSTRY_TESTS[filterIndustry]} : INDUSTRY_TESTS;

console.log(`Running behavioral tests for ${Object.keys(industries).length} industries\n`);

for (const [name, spec] of Object.entries(industries)) {
  if (!spec) {
    console.log(`[SKIP] ${name}: not found in test definitions`);
    continue;
  }

  const {index, count} = buildIndex(spec.dir);
  if (!index) {
    console.log(`[SKIP] ${name}: KB directory not found (${spec.dir})`);
    continue;
  }

  let passed = 0, failed = 0;
  const failures = [];

  for (const test of spec.queries) {
    const results = index.search(test.q).slice(0, 3);
    const allText = results.map(r => `${r.title} ${r.content} ${JSON.stringify(r.metadata || {})}`).join(' ').toLowerCase();

    let ok = results.length > 0;
    const missing = [];
    for (const term of test.expectContains) {
      if (!allText.includes(term.toLowerCase())) {
        ok = false;
        missing.push(term);
      }
    }

    if (ok) {
      passed++;
    } else {
      failed++;
      failures.push({query: test.q, missing, topResults: results.slice(0, 2).map(r => r.title)});
    }
  }

  totalPassed += passed;
  totalFailed += failed;

  const status = failed === 0 ? '[PASS]' : '[FAIL]';
  console.log(`${status} ${name}: ${passed}/${spec.queries.length} (${count} KB entries)`);

  for (const f of failures) {
    console.log(`  FAIL: "${f.query}" — missing: [${f.missing.join(', ')}]`);
    console.log(`        Top results: ${f.topResults.join(' | ') || '(none)'}`);
  }
}

console.log(`\n${'='.repeat(50)}`);
console.log(`TOTAL: ${totalPassed} passed / ${totalFailed} failed across ${Object.keys(industries).length} industries`);
