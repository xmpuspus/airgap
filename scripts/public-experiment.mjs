#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createReadStream} from 'node:fs';
import {createHash, randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import prettier from 'prettier';
import {answerPublicService, controlPublicModelOutput} from '../src/core/publicService.ts';
import {loadPublicRecords, loadPublicPolicy, readJson, root, sha256} from './public-service.mjs';

export function judgeOutput(question, output) {
  const text = output.toLowerCase();
  const missing = question.required.filter(word => !text.includes(word.toLowerCase()));
  if (question.anyOf && !question.anyOf.some(word => text.includes(word.toLowerCase())))
    missing.push(question.anyOf.join(' or '));
  const forbidden = question.forbidden.filter(word => text.includes(word.toLowerCase()));
  const refused =
    /don['’]t (have|know)|do not (have|know)|cannot (answer|provide|confirm)|can['’]t (answer|provide|confirm)|unable to|refuse to|does not (provide|contain)|not (enough|available|known)|may be (incorrect|wrong)|not (the|a) (president|hotline|fee)|is not (free|1455|950)/i.test(
      output,
    );
  const claimMissing = question.affirmative && !new RegExp(question.affirmative, 'i').test(output);
  if (claimMissing) missing.push('affirmative sourced claim');
  return {
    passed: missing.length === 0 && forbidden.length === 0 && !refused,
    missing,
    forbidden,
    falseRefusal: refused,
    scope:
      'Authored required/forbidden fact checks only; unlisted errors require independent review',
  };
}

export async function modelHash(file) {
  const hash = createHash('sha256');
  for await (const bytes of createReadStream(file)) hash.update(bytes);
  return hash.digest('hex');
}

export async function runExperiment(modelPath) {
  if (!modelPath || !fs.existsSync(modelPath))
    throw new Error(
      'Supply an existing Gemma 3 GGUF with --model or PUBLIC_MODEL_PATH. No download or API fallback.',
    );
  const hash = await modelHash(modelPath);
  if (hash === '80d155f647d3a896669b1d1605b494b97ee9dbd1dcafd27957394134c280d270')
    throw new Error(
      'Pinned node-llama-cpp cannot read this Gemma 4 model. Use the labeled host Gemma 3 run.',
    );
  const records = loadPublicRecords();
  const policy = loadPublicPolicy();
  const runId = `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`;
  const rawDir = path.join(root, 'tmp/public-showcase/model-runs', runId);
  fs.mkdirSync(rawDir, {recursive: true});
  const log = path.join(rawDir, 'outputs.jsonl');
  fs.writeFileSync(log, '', {flag: 'wx'});
  const statusFile = path.join(rawDir, 'status.json');
  const status = (state, rows, extra = {}) =>
    fs.writeFileSync(
      statusFile,
      JSON.stringify(
        {runId, state, completedRows: rows, updatedAt: new Date().toISOString(), ...extra},
        null,
        2,
      ) + '\n',
    );
  status('initializing_not_complete', 0);
  process.stderr.write(`Experiment run ${runId}\n`);
  const spec = readJson('validation/public-service-experiment.json');
  for (const question of spec.questions) {
    const source = readJson(question.sourcePath);
    if (
      ![question.sourceFact, ...(question.sourceFacts ?? [])].every(fact =>
        source.text.includes(fact),
      )
    )
      throw new Error(`Expected fact missing from source: ${question.id}`);
  }
  const {getLlama, LlamaChatSession} = await import('node-llama-cpp');
  const loadedAt = performance.now();
  const llama = await getLlama({gpu: false});
  const model = await llama.loadModel({modelPath});
  const settings = {contextSize: 2048, maxTokens: 160, temperature: 0, seed: 42};
  const modelContext = await model.createContext({contextSize: settings.contextSize});
  const systemPrompt =
    'Return the complete supplied public record, verbatim, to answer the question. Do not add facts.';
  const chat = new LlamaChatSession({contextSequence: modelContext.getSequence(), systemPrompt});
  const report = {
    schemaVersion: 1,
    runId,
    startedAt: new Date().toISOString(),
    provider: 'node-llama-cpp',
    providerVersion: '3.18.1',
    evidenceClass: 'host-native-model',
    model: {
      filename: path.basename(modelPath),
      sha256: hash,
      sizeBytes: fs.statSync(modelPath).size,
    },
    host: {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      cpu: os.cpus()[0]?.model,
    },
    settings,
    compute: 'CPU',
    runOrder:
      'Record baseline first; model lane order alternates by question index plus repetition, 9 pairs in each order',
    contextPolicy:
      'One context, chat history reset before every generation; warm prompt cache may affect timing',
    modelLoadMs: performance.now() - loadedAt,
    corpusSha256: sha256(JSON.stringify(records)),
    coreSha256: sha256(fs.readFileSync(path.join(root, 'src/core/publicService.ts'))),
    runnerSha256: sha256(fs.readFileSync(path.join(root, 'scripts/public-experiment.mjs'))),
    criteriaSha256: sha256(
      fs.readFileSync(path.join(root, 'validation/public-service-experiment.json')),
    ),
    policySha256: sha256(JSON.stringify(policy)),
    repetitions: 3,
    rows: [],
    criteria: spec,
    systemPrompt,
    limitations: [
      'Host Gemma 3 measurements; no phone or Gemma 4 inference claim.',
      'Fact checks are narrow string criteria. All raw outputs need independent review.',
      'Extractive controls can replace correct paraphrases. Every replacement is reported.',
      'Unpaired end-to-end comparison: lanes make separate generations, so differences are not a causal estimate of control benefit.',
    ],
  };
  const output = path.join(root, 'evidence/public-service/experiment.json');
  // Preserve the previous reviewed run before replacing the public report.
  if (fs.existsSync(output)) fs.copyFileSync(output, path.join(rawDir, 'previous-report.json'));
  fs.writeFileSync(path.join(rawDir, 'identity.json'), JSON.stringify(report, null, 2) + '\n', {
    flag: 'wx',
  });
  status('running_not_complete', 0);
  try {
    for (let repetition = 1; repetition <= 3; repetition++) {
      for (const [questionIndex, question] of spec.questions.entries()) {
        const modelOrder =
          (questionIndex + repetition) % 2 === 0
            ? ['retrieved-model', 'application-controls']
            : ['application-controls', 'retrieved-model'];
        for (const variant of ['record-only', ...modelOrder]) {
          const start = performance.now();
          const plan = answerPublicService(question.query, records, {}, policy);
          const context = records.filter(record => plan.recordIds.includes(record.id));
          const prompt = `PUBLIC RECORD:\n${context
            .map(record => record.content)
            .join('\n\n')}\n\nQUESTION: ${question.query}`;
          let rawOutput = null;
          let stopReason = null;
          let result = {...plan, fallback: false};
          let firstTokenMs = null;
          let error = null;
          let modelCalled = false;
          if (
            variant !== 'record-only' &&
            (variant === 'retrieved-model' || plan.answerPath === 'record')
          ) {
            try {
              chat.resetChatHistory();
              modelCalled = true;
              const generation = await chat.promptWithMeta(prompt, {
                maxTokens: settings.maxTokens,
                temperature: settings.temperature,
                seed: settings.seed,
                onTextChunk: () => {
                  if (firstTokenMs === null) firstTokenMs = performance.now() - start;
                },
              });
              rawOutput = generation.responseText;
              stopReason = generation.stopReason;
              result =
                variant === 'application-controls'
                  ? controlPublicModelOutput(rawOutput, plan, context)
                  : {
                      ...plan,
                      answer: rawOutput,
                      modelCalled: true,
                      fallback: false,
                      reason: 'retrieved_model_uncontrolled',
                    };
            } catch (err) {
              error = String(err);
              result = {
                ...plan,
                fallback: variant === 'application-controls',
                answer: variant === 'application-controls' ? plan.answer : '',
                reason: 'provider_error',
              };
            }
          }
          const row = {
            questionId: question.id,
            query: question.query,
            repetition,
            variant,
            prompt,
            rawOutput,
            stopReason,
            tokenLimitReached: stopReason === 'maxTokens',
            answer: result.answer,
            recordIds: plan.recordIds,
            sources: plan.sources,
            modelCalled,
            fallback: result.fallback,
            reason: result.reason,
            error,
            firstTokenMs,
            elapsedMs: performance.now() - start,
            judgment: judgeOutput(question, result.answer),
            rawJudgment: rawOutput === null ? null : judgeOutput(question, rawOutput),
          };
          report.rows.push(row);
          fs.appendFileSync(log, JSON.stringify(row) + '\n');
          status('running_not_complete', report.rows.length);
          process.stderr.write(
            `${variant} ${question.id} ${repetition}/3: ${
              row.judgment.passed ? 'fact checks pass' : 'fact checks fail'
            } (${Math.round(row.elapsedMs)} ms)\n`,
          );
        }
      }
    }
  } catch (error) {
    status('failed', report.rows.length, {error: String(error)});
    throw error;
  } finally {
    chat.dispose();
    await modelContext.dispose();
    await model.dispose();
  }
  report.finishedAt = new Date().toISOString();
  report.summary = Object.fromEntries(
    ['record-only', 'retrieved-model', 'application-controls'].map(variant => {
      const rows = report.rows.filter(row => row.variant === variant);
      const timings = rows.map(row => row.elapsedMs).sort((a, b) => a - b);
      return [
        variant,
        {
          denominator: rows.length,
          passed: rows.filter(row => row.judgment.passed).length,
          fallbacks: rows.filter(row => row.fallback).length,
          falseRefusals: rows.filter(row => row.judgment.falseRefusal).length,
          providerErrors: rows.filter(row => row.error).length,
          modelCalls: rows.filter(row => row.modelCalled).length,
          tokenLimitStops: rows.filter(row => row.tokenLimitReached).length,
          p50Ms: timings[Math.ceil(timings.length * 0.5) - 1],
          p95Ms: timings[Math.ceil(timings.length * 0.95) - 1],
        },
      ];
    }),
  );
  const bytes = prettier.format(JSON.stringify(report), {
    ...prettier.resolveConfig.sync(output),
    parser: 'json',
  });
  fs.writeFileSync(path.join(rawDir, 'report.json'), bytes, {flag: 'wx'});
  const failed = report.rows.some(row => row.error);
  status(failed ? 'failed' : 'complete', report.rows.length, {reportSha256: sha256(bytes)});
  if (!failed) fs.writeFileSync(output, bytes);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const flag = process.argv.indexOf('--model');
  const report = await runExperiment(
    flag >= 0 ? process.argv[flag + 1] : process.env.PUBLIC_MODEL_PATH,
  );
  process.stdout.write(JSON.stringify(report.summary, null, 2) + '\n');
  if (report.rows.some(row => row.error)) process.exitCode = 1;
}
