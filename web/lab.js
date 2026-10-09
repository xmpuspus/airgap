import {answerPublicService} from './public-core.js';

const $ = id => document.getElementById(id);
let pack;
let session = {};
let history = [];
let latest;
let lastReplay;
let historicalIndex = null;
let historicalSession = {};
const node = (tag, text, className) => {
  const el = document.createElement(tag);
  el.textContent = text;
  if (className) el.className = className;
  return el;
};
function download(name, value) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2) + '\n'], {type: 'application/json'}),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function sourceCard(source) {
  const details = node('details', '');
  details.append(node('summary', `${source.recordId} · checked ${source.asOf}`));
  details.append(node('blockquote', source.excerpt));
  const link = node('a', 'Open the public source ↗');
  link.href = source.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  details.append(link, node('p', `SHA-256 ${source.sha256}\n${source.path}`, 'hash'));
  return details;
}
function render(answer) {
  $('answer').textContent = answer.answer;
  $('route').textContent = `Route: ${answer.answerPath} · Model called: ${
    answer.modelCalled ? 'yes' : 'no'
  }`;
  $('reason').textContent = answer.reason.replaceAll('_', ' ');
  $('sources').replaceChildren(...answer.sources.map(sourceCard));
  if (!answer.sources.length)
    $('sources').append(
      node('p', 'No factual source was used for this policy response.', 'subtle'),
    );
  $('export-case').disabled = false;
}
function ask(query) {
  const before = window.structuredClone(session);
  const start = window.performance.now();
  const answer = answerPublicService(query, pack.records, session, pack.safety);
  history.push({query, answer, elapsedMs: window.performance.now() - start});
  latest = {
    schemaVersion: 1,
    kind: 'airgap-public-case',
    createdAt: new Date().toISOString(),
    coreSha256: pack.coreSha256,
    corpusSha256: pack.corpusSha256,
    before,
    history: window.structuredClone(history),
    ...answer,
    records: pack.records.filter(r => answer.recordIds.includes(r.id)),
  };
  render(answer);
  return answer;
}
function judge(test, answer) {
  const expected =
    test.expectPath ??
    (test.expectRefusal ? 'refusal' : test.expectTool ? 'unavailable' : 'record');
  return (
    answer.answerPath === expected &&
    !answer.modelCalled &&
    (test.mustInclude ?? []).every(x => answer.answer.toLowerCase().includes(x.toLowerCase())) &&
    (test.mustExclude ?? []).every(x => !answer.answer.toLowerCase().includes(x.toLowerCase())) &&
    (!test.expectRefusal || answer.reason === test.expectRefusal) &&
    (!test.recordId || answer.recordIds.includes(test.recordId))
  );
}
document.querySelectorAll('[data-view]').forEach(button =>
  button.addEventListener('click', () => {
    document.querySelectorAll('.view').forEach(view => {
      view.hidden = view.id !== `view-${button.dataset.view}`;
    });
    document.querySelectorAll('[data-view]').forEach(other => {
      if (other === button) other.setAttribute('aria-current', 'page');
      else other.removeAttribute('aria-current');
    });
  }),
);
$('case').addEventListener('change', () => {
  const test = pack.cases.find(row => row.id === $('case').value);
  if (test) $('question').value = test.query;
});
$('ask-form').addEventListener('submit', event => {
  event.preventDefault();
  const test = pack.cases.find(
    row => row.id === $('case').value && row.query === $('question').value,
  );
  if (test?.before) ask(test.before);
  ask($('question').value);
});
$('doubt').addEventListener('click', () => {
  $('question').value = 'sigurado ka dyan?';
  ask($('question').value);
});
$('clear').addEventListener('click', () => {
  session = {};
  history = [];
  latest = null;
  $('question').value = '';
  $('case').value = '';
  $('answer').textContent = 'Conversation cleared. Enter another question.';
  $('route').textContent = 'No question yet';
  $('reason').textContent = '';
  $('sources').replaceChildren();
  $('export-case').disabled = true;
});
$('export-case').addEventListener('click', () => download('airgap-case.json', latest));
$('export-replay').addEventListener('click', () => download('airgap-replay.json', lastReplay));
$('replay').addEventListener('click', async () => {
  $('replay').disabled = true;
  $('export-replay').disabled = true;
  session = {};
  history = [];
  $('replay-results').replaceChildren();
  const rows = [];
  for (const test of pack.cases) {
    if (test.before) ask(test.before);
    const answer = ask(test.query);
    const passed = judge(test, answer);
    rows.push({id: test.id, ...answer, passed});
    $('replay-results').append(
      node('li', `${test.id} · ${passed ? 'PASS' : 'FAIL'} · ${answer.answerPath} · ${test.query}`),
    );
    $('replay-status').textContent = `${rows.length}/${pack.cases.length} cases executed`;
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
  lastReplay = {
    schemaVersion: 1,
    coreSha256: pack.coreSha256,
    corpusSha256: pack.corpusSha256,
    concurrency: 1,
    cases: rows,
  };
  $('replay-status').textContent = `${rows.filter(row => row.passed).length}/${
    rows.length
  } passed · concurrency 1`;
  $('replay').disabled = false;
  $('export-replay').disabled = false;
});
function loadRevision(index) {
  historicalIndex = index;
  $('revision-status').textContent = `Loaded Proclamation ${
    index === 0 ? '368 (superseded historical version)' : '665 (amended historical version)'
  }. Local tab only.`;
  $('rollback').disabled = index !== 1;
  $('reviewed').checked = false;
  $('apply').disabled = true;
  $('historical-answer').textContent =
    'Version changed. Ask the loaded version to check its answer.';
}
$('load-original').addEventListener('click', () => loadRevision(0));
$('check-impact').addEventListener('click', () => {
  const checkSession = {};
  const old = answerPublicService(
    'When was Ninoy Aquino Day in 2024?',
    [pack.historical[0]],
    checkSession,
  );
  const updated = answerPublicService('sigurado ka dyan?', [pack.historical[1]], checkSession);
  const current = answerPublicService('When is Ninoy Aquino Day this year?', pack.historical);
  const checks = [
    ['Original query', old.answer.includes('2024-08-21'), old.answerPath],
    ['Doubt after amendment', updated.answer.includes('2024-08-23'), updated.reason],
    ['Current-year question', current.answerPath === 'refusal', current.reason],
  ];
  $('impact-results').replaceChildren(
    ...checks.map(([label, passed, reason]) =>
      node('li', `${label}: ${passed ? 'PASS' : 'FAIL'} · ${reason}`),
    ),
  );
});
$('reviewed').addEventListener('change', () => {
  $('apply').disabled = !$('reviewed').checked || historicalIndex === null;
});
$('apply').addEventListener('click', () => {
  if ($('reviewed').checked && historicalIndex !== null) loadRevision(1);
});
$('rollback').addEventListener('click', () => loadRevision(0));
$('historical-form').addEventListener('submit', event => {
  event.preventDefault();
  if (historicalIndex === null) {
    $('historical-answer').textContent = 'Load a version first.';
    return;
  }
  const answer = answerPublicService(
    $('historical-question').value,
    [pack.historical[historicalIndex]],
    historicalSession,
  );
  $('historical-answer').textContent = answer.answer;
  $(
    'historical-route',
  ).textContent = `Route: ${answer.answerPath} · Model called: no · ${answer.reason}`;
});
$('export-pack').addEventListener('click', () => download('airgap-public-pack.json', pack));
$('export-experiment').addEventListener('click', () =>
  download('airgap-model-outputs.json', pack.experiment),
);
function renderExperiment(report) {
  if (!report) {
    $('experiment-status').textContent =
      'NOT RUN: no local-model experiment is packaged. Live questions still use deterministic code.';
    return;
  }
  $('experiment-status').textContent = `${report.model.filename} · ${report.host.platform}/${
    report.host.arch
  } · ${report.compute ?? 'GPU initialization attempted'} · ${report.rows.length} recorded rows · ${
    report.finishedAt
  }`;
  const metrics = node('div', '', 'experiment-metrics');
  for (const [variant, row] of Object.entries(report.summary)) {
    const card = node('section', '', 'metric-card');
    card.append(node('h3', variant));
    const list = node('dl', '');
    [
      ['Fact checks', `${row.passed}/${row.denominator}`],
      ['Fallbacks', row.fallbacks],
      ['False refusals', row.falseRefusals],
      ['Model calls', row.modelCalls],
      ['Token limit stops', row.tokenLimitStops ?? 'not recorded'],
      ['p95 ms', Math.round(row.p95Ms)],
    ].forEach(([label, value]) => {
      const item = node('div', '');
      item.append(node('dt', label), node('dd', String(value)));
      list.append(item);
    });
    card.append(list);
    metrics.append(card);
  }
  $('experiment-summary').replaceChildren(metrics);
  const controlled = report.rows.filter(row => row.variant === 'application-controls');
  $('experiment-summary').append(
    node(
      'p',
      `${controlled.filter(row => row.fallback).length}/${
        controlled.length
      } controlled answers used the source record instead of the model response. A replacement can also discard a correct paraphrase.`,
      'fallback-cost',
    ),
  );
  $('experiment-outputs').replaceChildren(
    ...report.rows.map(row => {
      const details = node('details', '');
      details.dataset.question = row.questionId;
      details.dataset.variant = row.variant;
      details.dataset.repetition = row.repetition;
      details.append(
        node(
          'summary',
          `${row.questionId} / ${row.variant} / run ${row.repetition} · ${
            row.judgment.passed ? 'fact checks pass' : 'fact checks fail'
          }`,
        ),
      );
      details.append(node('p', row.query));
      details.append(
        node(
          'p',
          `Recorded result · model called: ${row.modelCalled ? 'yes' : 'no'} · fallback: ${
            row.fallback ? 'yes' : 'no'
          } · stop: ${row.stopReason ?? 'no generation'}`,
          'result-status',
        ),
      );
      if (row.rawOutput !== null) {
        details.append(
          node('h3', 'Recorded raw model response'),
          node('pre', row.rawOutput, 'raw-output'),
        );
      }
      details.append(node('h3', 'Displayed answer'), node('pre', row.answer, 'displayed-answer'));
      if (row.tokenLimitReached)
        details.append(
          node(
            'p',
            'The raw model response hit its token limit. Fact checks do not establish completion.',
            'subtle',
          ),
        );
      const metadata = node('details', '', 'result-metadata');
      metadata.append(
        node('summary', 'Prompt, sources, timing and checks'),
        node('pre', JSON.stringify(row, null, 2)),
      );
      details.append(metadata);
      return details;
    }),
  );
  $('export-experiment').disabled = false;
}
async function load() {
  $('retry').hidden = true;
  try {
    const response = await fetch('data/public-service.json', {cache: 'no-store'});
    if (!response.ok) throw new Error(`Source pack HTTP ${response.status}`);
    pack = await response.json();
    if (pack.schemaVersion !== 1 || !pack.records?.length || pack.historical?.length !== 2)
      throw new Error('Source pack is incomplete.');
    pack.cases.forEach(test => {
      const option = node('option', `${test.id} · ${test.query}`);
      option.value = test.id;
      $('case').append(option);
    });
    $('revision-comparison').replaceChildren(
      ...pack.historical.map(record => {
        const div = node('div', '');
        const dates = [`Source document dated ${record.metadata.documentDatedAt}`];
        if (record.metadata.proclamationSignedAt)
          dates.push(`Proclamation signed ${record.metadata.proclamationSignedAt}`);
        if (record.metadata.proclamationIssuedAt)
          dates.push(`Proclamation issued ${record.metadata.proclamationIssuedAt}`);
        div.append(
          node('h3', record.title),
          node('p', `${dates.join(' · ')} · observance ${record.metadata.value}`),
          node('blockquote', record.metadata.excerpt),
          node(
            'p',
            `PDF page ${record.metadata.page} · ${record.metadata.sourceClass}. Unedited OCR excerpt checked against the scanned page.`,
            'subtle',
          ),
          node('p', record.metadata.sourceSha256, 'hash'),
        );
        const link = node('a', 'Read primary source ↗');
        link.href = record.metadata.source;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        div.append(link);
        return div;
      }),
    );
    renderExperiment(pack.experiment);
    $(
      'identity',
    ).textContent = `Core SHA-256: ${pack.coreSha256}\nKnowledge SHA-256: ${pack.corpusSha256}`;
    $(
      'load-status',
    ).textContent = `${pack.records.length} sourced service records · ${pack.cases.length} authored cases · model not called for live questions`;
    $('workspace').hidden = false;
  } catch (error) {
    $(
      'load-status',
    ).textContent = `Unable to load the lab: ${error.message}. Run npm run public:build and retry.`;
    $('retry').hidden = false;
  }
}
$('retry').addEventListener('click', load);
load();
