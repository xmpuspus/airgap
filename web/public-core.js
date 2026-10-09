// Generated from src/core/publicService.ts by public:build.
// The native safety layer and public adapters use this same input preflight.
const PROMPT_PROBE_PATTERNS = [
  /\b(system|hidden|secret|initial|developer)\s+(prompt|instructions?|message)\b/i,
  /\b(your|the bot'?s|the assistant'?s)\s+(prompt|instructions|rules|guidelines)\b/i,
  /\b(ignore|disregard|forget|override|bypass)\b.{0,40}\b(instructions?|rules|prompt|guidelines)\b/i,
  /\b(repeat|print|output|write|paste)\b.{0,30}\b(words|text|lines|everything|all)\b.{0,20}\babove\b/i,
  /\b(developer|debug|god|admin)\s+mode\b/i,
  /\b(your|the bot'?s|the assistant'?s)\s+(config(uration)?|settings|source code|code|model file|tools?)\b/i,
  /\bjailbreak\b/i,
];
export function checkInputPolicy(query, policy = {}) {
  if (policy.enabled === false) return undefined;
  if (PROMPT_PROBE_PATTERNS.some(pattern => pattern.test(query))) return 'prompt_probe';
  for (const entry of policy.topicBlocklist ?? []) {
    const [reason, raw] = entry.includes(':') ? entry.split(':', 2) : ['blocked_topic', entry];
    const phrase = raw.trim().toLowerCase();
    if (!phrase) continue;
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(^|\\W)${escaped}(\\W|$)`, 'i').test(query)) return reason || 'blocked_topic';
  }
  return undefined;
}
export function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
const STOP = new Set(
  'who what when was is are the a an of for to how do i my me in on this that current ang ng sa mga ano sino paano kasalukuyang ba ka dyan please po about could can you tell give number'.split(
    ' ',
  ),
);
function terms(text) {
  return normalize(text)
    .split(' ')
    .filter(t => t && !STOP.has(t));
}
export function isPublicDoubt(text) {
  return /^(are you sure|you sure|really|talaga|sigurado (ka|ba)|sure ba|is that (right|correct))\b/i.test(
    text.trim(),
  );
}
export function isPublicClockQuestion(text) {
  return /^(?:(?:what|which) (?:time|date|day)(?: and time)?(?: is it)?(?: (?:now|today|right now))?|(?:time|date)(?: and time)?(?: (?:now|today|right now))?|(?:anong|ano ang|ano'ng) (?:oras|petsa|araw)(?: na)?(?: ngayon)?)[?.!]*$/i.test(
    text.trim(),
  );
}
function provenance(record) {
  if (!hasPublicEvidence(record)) return [];
  const m = record.metadata ?? {};
  if (typeof m.source !== 'string') return [];
  return [
    {
      path: String(m.sourcePath ?? ''),
      sha256: String(m.sourceSha256 ?? ''),
      recordId: record.id,
      url: m.source,
      excerpt: String(m.excerpt ?? record.content),
      asOf: String(m.asOf ?? ''),
    },
  ];
}
function hasPublicEvidence(record) {
  const m = record.metadata ?? {};
  const dated = value =>
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  return (
    (m.publicEvidence === true || m.historical === true) &&
    typeof m.sourcePath === 'string' &&
    m.sourcePath.length > 0 &&
    !m.sourcePath.startsWith('/') &&
    !m.sourcePath.includes('\\') &&
    !m.sourcePath.split('/').some(part => part === '..' || part === '.') &&
    typeof m.sourceSha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(m.sourceSha256) &&
    typeof m.source === 'string' &&
    /^https:\/\/[^\s/]+\//.test(m.source) &&
    typeof m.excerpt === 'string' &&
    m.excerpt.trim().length > 0 &&
    dated(m.asOf) &&
    (m.historical === true || dated(m.reviewBy))
  );
}
// A keyword hit alone cannot justify an unrelated question. Require the query's
// subject terms in the record and distinguish requested properties before ranking.
export function rankPublicRecords(query, records) {
  const q = normalize(query);
  const wanted = /\b(fee|fees|magkano|price|bayad|cost|validity)\b/.test(q)
    ? 'fees'
    : /\b(requirements|requirement|kailangan|dadalhin|documents|ids)\b/.test(q)
    ? 'requirements'
    : /\b(hotline|phone|tawag|contact)\b/.test(q)
    ? 'hotlines'
    : /\b(apply|application|kumuha|steps|appointment|renew|book)\b/.test(q)
    ? 'services'
    : /\b(holiday|holidays)\b/.test(q)
    ? 'holidays'
    : null;
  const tokens = terms(query).filter(t => !['sigurado', 'sure', 'dyan'].includes(t));
  const properties = new Set(
    'fee fees magkano price bayad cost requirements requirement kailangan dadalhin documents ids hotline phone tawag contact apply application kumuha steps appointment renew book holiday holidays year regular'.split(
      ' ',
    ),
  );
  const subjects = tokens.filter(token => !properties.has(token));
  return records
    .map(record => {
      const vocabulary = new Set(
        terms(
          [record.title, ...record.keywords, String(record.metadata?.searchTerms ?? '')].join(' '),
        ),
      );
      const hits = tokens.filter(t => vocabulary.has(t)).length;
      const phrase = record.keywords.reduce((best, keyword) => {
        const k = normalize(keyword);
        return k && ` ${q} `.includes(` ${k} `) ? Math.max(best, terms(k).length) : best;
      }, 0);
      const coverage = hits / Math.max(tokens.length, 1);
      const subjectSupported =
        subjects.length > 0
          ? subjects.every(token => vocabulary.has(token))
          : wanted === 'holidays' && record.category === 'holidays';
      const propertySupported = !wanted || wanted === record.category;
      const score =
        subjectSupported && propertySupported && coverage >= 0.5 && hits > 0
          ? hits + phrase * 2 + (wanted === record.category ? 8 : 0)
          : 0;
      return {record, score};
    })
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(row => row.record);
}
export function assessAnswerability(query, candidates, now = new Date()) {
  const ranked = rankPublicRecords(query, candidates);
  if (!ranked.length) return {allowed: false, reason: 'no_supported_record', records: []};
  let first = ranked[0];
  const claimKey = first.metadata?.claimKey;
  if (claimKey) {
    const claims = candidates.filter(r => r.metadata?.claimKey === claimKey);
    const active = claims.filter(r => !claims.some(other => other.metadata?.supersedes === r.id));
    if (active.length !== 1) {
      return {allowed: false, reason: 'conflicting_sources', records: active};
    }
    first = active[0];
  }
  const m = first.metadata ?? {};
  if (!hasPublicEvidence(first)) {
    return {allowed: false, reason: 'missing_source_evidence', records: []};
  }
  const historicalQuery = /\b(19|20)\d{2}\b/.test(query);
  if (m.historical && !historicalQuery) {
    return {
      allowed: false,
      reason: 'historical_only',
      records: [first],
    };
  }
  if (!m.historical) {
    const today = now.toISOString().slice(0, 10);
    if (
      (typeof m.reviewBy === 'string' && today > m.reviewBy) ||
      (typeof m.validTo === 'string' && today > m.validTo) ||
      (typeof m.validFrom === 'string' && today < m.validFrom)
    ) {
      return {allowed: false, reason: 'needs_verification', records: [first]};
    }
    if (
      m.year &&
      Number(m.year) !== now.getUTCFullYear() &&
      /this year|today|bukas|ngayon/i.test(query)
    ) {
      return {allowed: false, reason: 'needs_verification', records: [first]};
    }
  }
  return {allowed: true, reason: 'supported_record', records: [first]};
}
export function answerPublicService(query, records, session = {}, policy = {}) {
  records = records.filter(
    record => record.metadata?.publicEvidence === true || record.metadata?.historical === true,
  );
  const text = query.trim();
  const previous = session.previous;
  const result = (answer, answerPath, reason, selected = [], effectiveQuery = text) => {
    const row = {
      query: text,
      answer,
      answerPath,
      reason,
      modelCalled: false,
      recordIds: selected.map(r => r.id),
      sources: selected.flatMap(provenance),
      effectiveQuery,
    };
    session.previous = row;
    return row;
  };
  if (!text)
    return result(
      'Enter a question about a Philippine public service.',
      'clarification',
      'empty_question',
    );
  if (/^(magkano|how much|requirements|fees|ano kailangan)[?.!]*$/i.test(text))
    return result(
      'Which service do you mean? Name the service and the detail you need.',
      'clarification',
      'missing_service',
    );
  if (text.length > 2000)
    return result(
      'Please shorten the question to 2,000 characters.',
      'clarification',
      'question_too_long',
    );
  const blocked = checkInputPolicy(text, policy);
  if (blocked) {
    return result(
      policy.refusalTemplates?.[blocked] ??
        (blocked === 'prompt_probe'
          ? "I can't share internal instructions or settings. Ask about a public service record."
          : "I can't answer that request under the configured public-service policy."),
      'refusal',
      blocked,
    );
  }
  const bookingAction =
    /\b(book|schedule|reserve)\b.*\b(appointment|passport)\b/i.test(text) &&
    !/\b(how (do|can|to|should)|paano|where (can|do))\b/i.test(text);
  if (
    bookingAction ||
    /report a concern|file a complaint|magreklamo|report an issue|status of my|track my|application status|status ng application|submit my/i.test(
      text,
    )
  ) {
    return result(
      'Unavailable: this public example has no agency integration. No request was sent or queued, and no receipt was created. Use the agency’s official channel.',
      'unavailable',
      'no_agency_integration',
    );
  }
  if (/united states|\busa\b|\bus (president|driver)|another country/i.test(text))
    return result(
      'These records cover Philippine national government only. I have no source for that jurisdiction.',
      'refusal',
      'outside_jurisdiction',
    );
  if (/^(sino ka|who are you|what is your name)[?.!]*$/i.test(text))
    return result(
      'I am Kuya B, an unofficial Airgap public-service example. No government agency operates this lab.',
      'deterministic',
      'identity',
    );
  if (isPublicClockQuestion(text))
    return result(
      `The device clock reads ${new Date().toISOString()} (UTC).`,
      'deterministic',
      'device_clock',
    );
  const doubt = isPublicDoubt(text);
  const correction =
    /https:\/\/\S+/.test(text) && /according|source|ayon|proclamation|correction/i.test(text);
  if (doubt && !previous?.recordIds.length)
    return result(
      'Ask a sourced question first so I can check its record again.',
      'clarification',
      'no_previous_record',
    );
  const effectiveQuery =
    (doubt || correction) && previous?.recordIds.length ? previous.effectiveQuery : text;
  const assessed = assessAnswerability(effectiveQuery, records);
  if (!assessed.allowed) {
    const messages = {
      missing_source_evidence:
        'This record has incomplete source evidence. Review its source, date and file hash before using it.',
      no_supported_record:
        "I don't have an official record that answers that question. Name the service and the detail you need.",
      historical_only:
        'These records concern a past year. They cannot answer a current-service question.',
      needs_verification:
        'This record needs verification before I can present it as current. Check the dated source.',
      conflicting_sources:
        'The loaded sources disagree. Review their authority and dates before using either value.',
    };
    return result(
      messages[assessed.reason],
      'refusal',
      assessed.reason,
      assessed.records,
      effectiveQuery,
    );
  }
  const selected = assessed.records;
  const correctionUrls = (text.match(/https:\/\/[^\s<>]+/g) ?? []).map(url =>
    url.replace(/[),.!?]+$/, ''),
  );
  if (correction && !selected.some(r => correctionUrls.includes(String(r.metadata?.source)))) {
    return result(
      'That link is not among the loaded authoritative sources. Review and load it before I can use it as a correction.',
      'clarification',
      'unverified_correction',
      selected,
      effectiveQuery,
    );
  }
  const changed = previous && selected.map(r => r.id).join() !== previous.recordIds.join();
  const prefix =
    doubt || correction
      ? changed
        ? 'The loaded source has changed. Here is the checked record:\n\n'
        : 'I checked the loaded source again:\n\n'
      : '';
  const historical = selected[0].metadata?.historical
    ? 'Historical record, only for the stated year and loaded version.\n\n'
    : '';
  return result(
    prefix + historical + selected.map(r => r.content).join('\n\n'),
    'record',
    doubt ? 'source_rechecked' : correction ? 'sourced_correction' : 'supported_record',
    selected,
    effectiveQuery,
  );
}
// Strict extractive application control: output must retain the complete
// approved record. This deliberately rejects valid paraphrases too. The
// experiment reports that cost and every replacement instead of claiming a
// general semantic grounding test.
export function controlPublicModelOutput(generated, planned, records) {
  const body = generated.trim();
  const exactText = value => value.normalize('NFC').replace(/\s+/g, ' ').trim();
  const accepted =
    body.length >= 20 &&
    records.some(r => planned.recordIds.includes(r.id) && exactText(r.content) === exactText(body));
  return {
    ...planned,
    answer: accepted ? body : planned.answer,
    modelCalled: true,
    fallback: !accepted,
    reason: accepted ? 'extractive_model_answer' : 'non_extractive_model_fallback',
  };
}
