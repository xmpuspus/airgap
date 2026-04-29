/**
 * LLM Journey Test Runner
 *
 * Runs the user journey suite through an on-device GGUF model using
 * node-llama-cpp on a laptop. Tests the full pipeline:
 * MiniSearch retrieval -> prompt construction -> LLM generation -> response quality.
 *
 * Model selection: pass --model to pin a specific GGUF, otherwise picks the
 * first .gguf in models/. The shipped target is Gemma 4 E2B Q3_K_S
 * (unsloth/gemma-4-E2B-it-GGUF); run `scripts/pull-dev-model.sh` to fetch it.
 *
 * KNOWN LIMITATION (2026-04-09): node-llama-cpp 3.18.1 ships an upstream
 * llama.cpp build that does NOT yet support the gemma4 architecture, so
 * the laptop runner cannot load Gemma 4 E2B GGUF files yet. The on-device
 * runtime (llama.rn) bundles a newer llama.cpp that does load Gemma 4.
 * Until node-llama-cpp catches up, this runner uses the dev fixture
 * (Gemma 3 1B Q4_K_M from .dev-fixtures/) for laptop coverage and the
 * real Gemma 4 E2B verification has to happen on a real device. The
 * isPreferred flag in the JSON output makes this explicit.
 *
 * Usage:
 *   node __tests__/run-llm-journeys.mjs                              # Run all journeys
 *   node __tests__/run-llm-journeys.mjs --first 10                   # Run first 10
 *   node __tests__/run-llm-journeys.mjs --category roaming           # Run one category
 *   node __tests__/run-llm-journeys.mjs --id 74                      # Run single journey
 *   node __tests__/run-llm-journeys.mjs --model models/gemma-4-e2b-it-q3ks.gguf
 */

import {fileURLToPath} from 'url';
import path from 'path';
import {readFileSync, writeFileSync, existsSync} from 'fs';
import {getLlama, LlamaChatSession} from 'node-llama-cpp';
import MiniSearch from 'minisearch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

// === Parse CLI args ===
const args = process.argv.slice(2);
let filterFirst = null;
let filterCategory = null;
let filterId = null;
let modelOverride = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--first') filterFirst = parseInt(args[i + 1]);
  if (args[i] === '--category') filterCategory = args[i + 1];
  if (args[i] === '--id') filterId = parseInt(args[i + 1]);
  if (args[i] === '--model') modelOverride = args[i + 1];
}

// === Load KB ===
const kbFiles = ['faq', 'plans', 'promos', 'troubleshooting', 'stores', 'roaming', 'payments'];
const allDocuments = [];
for (const f of kbFiles) {
  const data = JSON.parse(readFileSync(path.join(root, `src/knowledge/${f}.json`), 'utf-8'));
  allDocuments.push(...data);
}
console.log(`Loaded ${allDocuments.length} KB documents`);

// === Build MiniSearch ===
const searchIndex = new MiniSearch({
  fields: ['title', 'content', 'keywords'],
  storeFields: ['id', 'title', 'category', 'content', 'tags', 'metadata'],
  searchOptions: {
    boost: {title: 3, keywords: 2, content: 1},
    fuzzy: 0.2,
    prefix: true,
  },
  extractField: (doc, fieldName) => {
    if (fieldName === 'keywords') return doc.keywords.join(' ');
    return doc[fieldName];
  },
});
searchIndex.addAll(allDocuments);

function searchKB(query, topK = 3) {
  return searchIndex.search(query).slice(0, topK);
}

// === Build system prompt ===
function buildSystemPrompt(kbResults) {
  const contextBlock = kbResults
    .map(doc => `[${doc.category.toUpperCase()}] ${doc.title}\n${doc.content}`)
    .join('\n---\n');

  return `You are Aya, the customer support assistant for Airgap Telco, a telecommunications company in the Philippines.

INSTRUCTIONS:
- Answer ONLY based on the provided context below.
- If the context does not contain the answer, say: "I don't have that information. Please call our hotline at 211 for assistance."
- Be concise: 2-4 sentences for simple questions, short paragraph for complex.
- Use a friendly, professional tone.
- Always include PHP for prices.
- Use numbered steps for how-to instructions.
- Never make up information not in the context.

CONTEXT:
${contextBlock}`;
}

// === Online check ===
const ONLINE_KW = [
  'my balance', 'my bill amount', 'what is my bill', 'how much is my bill',
  'my data usage', 'check my usage', 'my account details', 'my account info',
  'change my plan', 'switch my plan', 'upgrade my plan', 'activate my plan',
  'change plan to', 'switch plan to', 'upgrade plan', 'activate plan',
  'create a ticket', 'create ticket', 'file a complaint', 'file complaint', 'support ticket',
  'outage status', 'service outage', 'outage in my area',
];

function requiresOnline(query) {
  const lower = query.toLowerCase();
  return ONLINE_KW.some(kw => lower.includes(kw));
}

// === Greeting check ===
const GREETINGS = ['hi', 'hello', 'hey', 'good morning', 'good afternoon',
  'good evening', 'howdy', 'yo', 'sup', 'hola', 'kamusta', 'musta'];

function isGreeting(text) {
  const lower = text.toLowerCase().replace(/[!.,?]/g, '').trim();
  return GREETINGS.includes(lower) || lower.length <= 3;
}

// === Load journeys ===
const journeysRaw = readFileSync(path.join(root, '__tests__/journeys.ts'), 'utf-8');
const journeyPattern = /\{id:\s*(\d+),\s*category:\s*'([^']+)',\s*input:\s*'([^']*)',\s*expectRoute:\s*'([^']+)'(?:,\s*expectContains:\s*\[([^\]]*)\])?(?:,\s*expectNotContains:\s*\[([^\]]*)\])?,\s*description:\s*'([^']*)'\}/g;

let journeys = [];
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

// Apply filters
if (filterId) journeys = journeys.filter(j => j.id === filterId);
else if (filterCategory) journeys = journeys.filter(j => j.category === filterCategory);
else if (filterFirst) journeys = journeys.slice(0, filterFirst);

console.log(`Running ${journeys.length} journeys\n`);

// === Find model ===
// Preference order:
//   1. --model <path>                                       (explicit override)
//   2. AIRGAP_MODEL_PATH env var
//   3. models/gemma-4-e2b-it-q3ks.gguf                      (shipped target)
//   4. models/.dev-fixtures/*.gguf                           (local fixture)
//   5. first *.gguf in models/                               (fallback)
const {readdirSync} = await import('fs');
const modelDir = path.join(root, 'models');
const fixtureDir = path.join(root, '.dev-fixtures');
const PREFERRED_NAME = 'gemma-4-e2b-it-q3ks.gguf';
let modelPath = null;

if (modelOverride) {
  modelPath = path.isAbsolute(modelOverride)
    ? modelOverride
    : path.join(root, modelOverride);
} else if (process.env.AIRGAP_MODEL_PATH) {
  modelPath = process.env.AIRGAP_MODEL_PATH;
} else if (existsSync(path.join(modelDir, PREFERRED_NAME))) {
  modelPath = path.join(modelDir, PREFERRED_NAME);
} else if (existsSync(fixtureDir)) {
  const fixtures = readdirSync(fixtureDir).filter(f => f.endsWith('.gguf'));
  if (fixtures.length > 0) modelPath = path.join(fixtureDir, fixtures[0]);
}

if (!modelPath && existsSync(modelDir)) {
  const ggufFiles = readdirSync(modelDir).filter(f => f.endsWith('.gguf'));
  if (ggufFiles.length > 0) {
    modelPath = path.join(modelDir, ggufFiles[0]);
  }
}

if (!modelPath || !existsSync(modelPath)) {
  console.error('No GGUF model found.');
  console.error('Download the shipped target (Gemma 4 E2B Q3_K_S) with:');
  console.error('  bash scripts/pull-dev-model.sh');
  console.error('Or pass an explicit path:');
  console.error('  node __tests__/run-llm-journeys.mjs --model path/to/model.gguf');
  console.error('Or set AIRGAP_MODEL_PATH in your environment.');
  process.exit(1);
}

const modelFilename = path.basename(modelPath);
const isPreferredModel = modelFilename === PREFERRED_NAME;

console.log(`Model: ${modelFilename}`);
console.log(`       ${modelPath}`);
if (!isPreferredModel) {
  console.log('');
  console.log('=========================================================================');
  console.log('  WARNING: Not using the shipped Gemma 4 E2B Q3_K_S model.');
  console.log('');
  console.log(`  Active file: ${modelFilename}`);
  console.log(`  Expected:    ${PREFERRED_NAME}`);
  console.log('');
  console.log('  Results published from this run MUST NOT be reported as Gemma 4 E2B');
  console.log('  numbers. Run `bash scripts/pull-dev-model.sh` to fetch the real');
  console.log('  shipped model and re-run.');
  console.log('=========================================================================');
  console.log('');
}

// === Initialize LLM ===
console.log('Loading model...');
const llama = await getLlama();
const model = await llama.loadModel({modelPath});
console.log('Model loaded.\n');

const SYSTEM_PROMPT = "You are Aya, customer support for Airgap Telco (Philippines). Answer ONLY using the CONTEXT the user provides. Be concise. Use PHP for prices. Never invent information.";

function buildUserMessage(query, kbResults) {
  const contextBlock = kbResults
    .map(r => `[${r.category.toUpperCase()}] ${r.title}\n${r.content.substring(0, 400)}`)
    .join('\n\n');
  return `Here is the reference information:\n\n${contextBlock}\n\nBased ONLY on the information above, answer this question: ${query}`;
}

// === Quality scoring ===
function scoreResponse(query, response, searchResults, journey) {
  const issues = [];
  const lower = response.toLowerCase();

  // 1. Check for hallucination markers
  if (lower.includes('i apologize') && searchResults.length > 0) {
    issues.push('Unnecessary apology when context was available');
  }

  // 2. Check grounding — response should relate to search results
  if (searchResults.length > 0) {
    const contextTerms = searchResults.flatMap(r =>
      r.title.toLowerCase().split(/\s+/)
    ).filter(t => t.length > 3);
    const matchCount = contextTerms.filter(t => lower.includes(t)).length;
    if (matchCount === 0) {
      issues.push('Response appears ungrounded — no context terms found');
    }
  }

  // 3. Check expected terms in response
  for (const term of journey.expectContains) {
    if (!lower.includes(term.toLowerCase())) {
      issues.push(`Expected term missing from LLM response: "${term}"`);
    }
  }

  // 4. Response length sanity
  if (response.length < 20) {
    issues.push(`Response too short: ${response.length} chars`);
  }
  if (response.length > 2000) {
    issues.push(`Response too long: ${response.length} chars`);
  }

  // 5. Check for hallucination / persona break
  if (lower.includes('large language model') || lower.includes('as an ai'))
    issues.push('Model broke persona — referred to itself as AI/LLM');
  if (lower.includes('mint mobile') || lower.includes('t-mobile') || lower.includes('verizon'))
    issues.push('Model hallucinated a real telco brand instead of the configured brand');

  // 6. Check for obvious fabrication patterns
  const fabricationPatterns = [
    /\$\d+\.\d{2}/,  // USD format (should be PHP)
    /call 1-800/i,    // US phone format
  ];
  for (const pat of fabricationPatterns) {
    if (pat.test(response)) {
      issues.push(`Possible fabrication: matches pattern ${pat}`);
    }
  }

  return {
    pass: issues.length === 0,
    issues,
    score: Math.max(0, 10 - issues.length * 2),
  };
}

// === Run journeys ===
const results = [];
let passed = 0;
let failed = 0;
const startTime = Date.now();

for (let i = 0; i < journeys.length; i++) {
  const j = journeys[i];
  const pct = Math.round(((i + 1) / journeys.length) * 100);
  process.stdout.write(`\r[${pct}%] Journey ${j.id}: ${j.description}...`);

  let response = '';
  let route = '';
  let searchResults = [];

  try {
    // Route determination
    if (isGreeting(j.input)) {
      route = 'greeting';
      response = "Hi! I'm your Airgap support assistant. How can I help you today?";
    } else if (requiresOnline(j.input)) {
      route = 'online_queue';
      response = 'This requires an internet connection. I\'ve saved your request and will process it when you\'re back online.';
    } else {
      searchResults = searchKB(j.input, 3);
      if (searchResults.length > 0) {
        route = 'search_llm';
        // Run LLM inference — fresh context per query, dispose after
        const userMessage = buildUserMessage(j.input, searchResults);
        const ctx = await model.createContext({contextSize: 1024});
        const session = new LlamaChatSession({
          contextSequence: ctx.getSequence(),
          systemPrompt: SYSTEM_PROMPT,
        });
        response = await session.prompt(userMessage, {
          maxTokens: 150,
          temperature: 0.2,
        });
        session.dispose();
        await ctx.dispose();
        // Yield to let GC run
        await new Promise(r => setTimeout(r, 50));
      } else {
        route = 'fallback';
        response = 'I don\'t have information about that. Please call 211.';
      }
    }

    // Score the response
    const quality = scoreResponse(j.input, response, searchResults, j);
    const routeOk = route === j.expectRoute;

    const result = {
      id: j.id,
      category: j.category,
      input: j.input,
      description: j.description,
      expectedRoute: j.expectRoute,
      actualRoute: route,
      routeOk,
      response: response.substring(0, 500),
      quality,
      searchResultIds: searchResults.map(r => r.id),
    };

    results.push(result);

    if (routeOk && quality.pass) {
      passed++;
    } else {
      failed++;
    }
  } catch (err) {
    failed++;
    results.push({
      id: j.id,
      category: j.category,
      input: j.input,
      description: j.description,
      error: err.message,
      routeOk: false,
      quality: {pass: false, issues: [`Error: ${err.message}`], score: 0},
    });
  }

  // Save incrementally every 10 journeys. Use the same envelope shape as
  // the final save so a killed run leaves a parseable file with the model
  // metadata intact (otherwise partial saves can be mistaken for final
  // results from a different run).
  if (results.length % 10 === 0) {
    const reportPath = path.join(root, '__tests__/llm-journey-results.json');
    const partialSummary = {
      model: {
        filename: modelFilename,
        path: modelPath,
        isPreferred: isPreferredModel,
        expected: PREFERRED_NAME,
      },
      ranAt: new Date().toISOString(),
      partial: true,
      totals: {
        journeys: journeys.length,
        completed: results.length,
        passed,
        failed,
      },
      results,
    };
    writeFileSync(reportPath, JSON.stringify(partialSummary, null, 2));
  }
}

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
process.stdout.write('\r' + ' '.repeat(80) + '\r');

// === Report ===
console.log('='.repeat(70));
console.log(`RESULTS: ${passed} PASSED / ${failed} FAILED out of ${journeys.length} (${elapsed}s)`);
console.log('='.repeat(70));

// Show failures
const failures = results.filter(r => !r.routeOk || !r.quality.pass);
if (failures.length > 0) {
  console.log('\nISSUES:\n');
  for (const f of failures) {
    console.log(`  [${f.id}] "${f.input}" (${f.description})`);
    if (!f.routeOk) console.log(`    Route: expected '${f.expectedRoute}', got '${f.actualRoute}'`);
    if (f.error) console.log(`    Error: ${f.error}`);
    for (const issue of (f.quality?.issues || [])) {
      console.log(`    - ${issue}`);
    }
    if (f.response) {
      const preview = f.response.substring(0, 120).replace(/\n/g, ' ');
      console.log(`    Response: "${preview}..."`);
    }
    console.log('');
  }
}

// Category breakdown
const categories = {};
for (const r of results) {
  if (!categories[r.category]) categories[r.category] = {total: 0, passed: 0, avgScore: 0};
  categories[r.category].total++;
  categories[r.category].avgScore += r.quality?.score || 0;
  if (r.routeOk && r.quality?.pass) categories[r.category].passed++;
}

console.log('\nCATEGORY BREAKDOWN:');
for (const [cat, stats] of Object.entries(categories)) {
  const pct = ((stats.passed / stats.total) * 100).toFixed(0);
  const avg = (stats.avgScore / stats.total).toFixed(1);
  const status = stats.passed === stats.total ? '[PASS]' : '[FAIL]';
  console.log(`  ${status} ${cat}: ${stats.passed}/${stats.total} (${pct}%) avg_quality=${avg}/10`);
}

// Save full results to file. Wrap in an envelope so the model filename is
// front-and-centre — this prevents anyone from publishing results from a
// dev fixture as Gemma 4 E2B numbers later.
const summary = {
  model: {
    filename: modelFilename,
    path: modelPath,
    isPreferred: isPreferredModel,
    expected: PREFERRED_NAME,
  },
  ranAt: new Date().toISOString(),
  totals: {
    journeys: journeys.length,
    passed,
    failed,
    elapsedSeconds: parseFloat(elapsed),
  },
  categories,
  results,
};
const reportPath = path.join(root, '__tests__/llm-journey-results.json');
writeFileSync(reportPath, JSON.stringify(summary, null, 2));
console.log(`\nFull results saved to: ${reportPath}`);

// Cleanup
await model.dispose();
await llama.dispose();
