# Run the Philippine public-service lab locally

The [Evidence Lab](../web/lab.html), government mobile path, and
[CLI](../scripts/public-service.mjs) use the same answer and policy module.
Browser questions use deterministic code. The model tab shows saved host runs.
It does not produce a free-form answer.

No agency integration is connected. Requests to submit, book, or track an
application return unavailable. They create no receipt or queue entry. The
government configuration has no backend, action stubs, or tools. Native tool
and backend entrypoints refuse agency calls before they queue work or call a provider.

## Start with the replay and browser

Use Node 22.18 or newer and Python 3. Run these commands from the repository root.

```bash
npm ci
node scripts/public-service.mjs replay --json
npm run public:build
python3 -m http.server --bind 127.0.0.1 --directory web 8080
```

Open `http://127.0.0.1:8080/lab.html`. Choose a case or enter a question. Ask a
doubt follow-up, expand the source, then download the case JSON. The download
has the answer, route, model-called flag, conversation history, record hashes,
and source hashes. Questions run locally after static files load. Source links
use the network.

The replay runs 15 original government golden cases and six authored cases in
sequence. It compares each answer and route with its saved expectation. Maintainers wrote these prompts. They
do not record citizen conversations. `gov-6` checks a prompt-probe refusal
without revealing a configuration filename.

## Six service records use saved public source text

The [source archives](../evidence/public-service/README.md) store fetched text from
NBI, SSS, DFA, PCO, and the Supreme Court E-Library. The scripts hash the
exact saved JSON bytes. The fetch tool extracted the text. These files do not
preserve original HTML or PDF bytes. You do not need third-party screenshots to
reuse the cases.

These six current-service archives use extracted JSON text. The historical
amendment below uses two actual government PDFs, with OCR text, page references,
and hashes.

The records cover the president named in the July 2026 SONA transcript, the
passport appointment portal, dated passport fees, NBI clearance requirements,
ten regular holidays in Proclamation 1006, and the SSS hotline. The fee source
is the **2022** DFA Citizen’s Charter. Its PHP 950 reference has an explicit
date. It does not state the fee payable today. Eid dates need separate
proclamations and are outside this pack.

English, Filipino, and Taglish queries choose records. The answer stays in the
source record's English. Matching is conservative and can refuse a valid
paraphrase. Unsupported properties, unrelated entities, political advice, and
missing details cannot use a nearby record. Doubt checks the loaded evidence
again. An unreviewed URL cannot change a fact.

Current records have a maintainer review deadline of 2026-11-09. After that
date, the real clock causes a refusal until a maintainer fetches and reviews
the sources again. The project sets this review date. The 2026 holiday record
expires at year end. Historical records need an explicit year and stay outside
responses about current services.

## Apply the actual 2024 holiday amendment

In Source workbench, compare the two authorities and run the affected-question
checks. Load the original. Ask for the date of Ninoy Aquino Day in 2024.
Review the change, apply it locally, ask again, then roll back and ask a doubt
follow-up.

The original source is full Proclamation 368, attached to the Customs memo on
PDF pages 2–4. Page 3 lists 21 August 2024. The proclamation was signed on 11
October 2023. The covering Customs memo is dated 2 January 2024.

The replacement source is BIR Circular 102-2024, dated 16 August 2024. Its one page reports that Proclamation 665, issued on 15 August, moved
the date to 23 August 2024. The circular has no proclamation attachment.
The workbench labels signing, issue and document dates separately. The archived
documents do not give their web publication dates.

Both government PDFs are archived with separate unedited OCR text, page
references, and hashes. The workbench changes loaded records. It does not
alter a clock or create a source revision. Supersession changes the answer.

Conflicting unresolved claim values cause a refusal. The update lasts only in
that browser tab. The browser has no signing secret or agency connection.

## Reproduce the local-model comparison

```bash
npm run public:experiment -- --model /path/to/local-gemma-3.gguf
npm run public:build
```

The runner hashes the model before it loads the file. It uses
`node-llama-cpp` 3.18.1, CPU execution, a 2,048-token context, a 160-token
output limit, temperature 0, and seed 42. It runs six sourced questions three
times in three variants. The variants are record-only, retrieved-context model,
and application-controls model.

This produces 54 rows, including 36 real model calls. The two model variants
use the same prompt and corpus. Their order alternates. Each generation resets
chat history.

A warm prompt cache can still affect timing. This unpaired comparison cannot
isolate the effect of controls.

The application gate accepts only the complete chosen record, with whitespace
and Unicode normalization. It keeps numeric and URL punctuation. Otherwise it
shows the original record and reports a fallback. It can replace correct model
prose. The gate checks whole-record matches. It cannot check facts semantically.

[Every actual output and measurement](../evidence/public-service/experiment.json) has
the question, prompt, raw model text, displayed answer, source hashes, fallback
flag, first-token time, elapsed time, stop reason, and authored fact judgments.
Token-limit stops are separate from fact checks. The
[criteria](../validation/public-service-experiment.json) cite independent source text.

Each execution writes a unique directory under `tmp/public-showcase/model-runs/`.
It has append-only rows and a status file. A crash leaves its rows and an
incomplete status. A successful run saves its immutable report before it updates
the public report.

Phrase checks can miss errors and reject correct wording. Read each output before
you make a quality claim. Earlier failed and pre-review runs stay in the evidence
directory.

The [independent review](../evidence/public-service/experiment-review.md) accounts
for two valid short answers marked wrong and six token-limit stops per model lane.
All 18 controlled answers fell back to records. Its timing table shows the measured
CPU host and model. This experiment makes no phone or Gemma 4 performance claim.
The pinned runner cannot load the supplied Gemma 4 architecture.

## Capture all five features with one command

Commit the reviewed application source and knowledge before capture. The capture
command compares each source file with that commit and refuses uncommitted
source. The command can create the model report and browser data pack after the
source commit. It binds both to exact bytes and checks code, corpus, and runner hashes.

Install FFmpeg, including FFprobe, and supply an existing local GGUF. The
command checks both media tools before inference. It installs repository and
Python dependencies when needed, installs Chromium, runs replay and inference,
builds the site, drives the browser journey, and exports the recordings.

```bash
npm run public:demo -- --model /path/to/local-gemma-3.gguf
```

To reproduce the published model identity, use the publisher's
[pinned Gemma 3 1B Q4_K_M download](https://huggingface.co/bartowski/google_gemma-3-1b-it-GGUF/resolve/fd9cc90e35ad30626265b03534320330c830bd80/google_gemma-3-1b-it-Q4_K_M.gguf).
It is 806,058,496 bytes, from revision `fd9cc90e35ad30626265b03534320330c830bd80`,
under the [Gemma license](https://huggingface.co/google/gemma-3-1b-it/blob/main/LICENSE).
Read that license before you download or distribute the model. Check the local file.

```bash
shasum -a 256 /path/to/google_gemma-3-1b-it-Q4_K_M.gguf
```

Expected SHA-256: `12bf0fff8815d5f73a3c9b586bd8fee8e7b248c935de70dec367679873d0f29d`.
Another compatible GGUF creates a new experiment with its own identity and review.
The kit does not download models or need API credentials.

The browser journey uses 1280×900 and 390×844 viewports. It submits all cases
in order with concurrency 1. It repeats replay, asks a free-form question and
doubt, applies and rolls back the historical source, and reads downloaded bytes.
The scripts do not intercept network responses or replace providers.

Recovery checks serve copies of the actual site with the source-pack file absent.
The static server returns HTTP 404. The browser checks the error and retries
while the file is still missing, then retries after the exact pack bytes are
restored. The recovered page must answer a real question. These are authored
filesystem faults, not government source changes. Temporary site copies are
removed when the check exits.

`npm run public:qa` writes `tmp/public-showcase/browser/qa.json` with the observed
HTTP statuses, recovered pack hash and PNG screenshots encoded as Base64 under each
viewport's `loadingRecovery.screenshots` and `landing.screenshot` fields. Decode
the `base64` bytes as PNG and compare their SHA-256 with `sha256` before visual
inspection. Keeping these images in that report preserves the declared QA output
paths. The six normal lab screenshots and eight downloaded JSON files keep
their existing paths. Automated assertions do not replace visual inspection.

Raw WebM files, screenshots, downloads, and contact sheets stay ignored under
`tmp/recordings/public-service` and `tmp/public-showcase`. The
[capture index](../demo/public-service/README.md) lists derived GIF and MP4 paths.
The manifest has uncut edit ranges, browser identity, source, code, and model
hashes, and recorded steps. It records the committed source, the Python capture
command, the separately hashed model report, and the browser pack.

To capture again using the existing model report, run `npm run public:capture`
after `npm run public:build`. Source must already be committed. All five captures
and ten media exports are staged in the ignored run directory. The scripts check
them before publication.

The earlier release stays in the run's `previous` directory. Failed exports leave
the release unchanged and keep the failed run. A promotion error restores the
earlier set. If the process stops between directory renames, recover the preserved
set with
`python3 -B scripts/public_media.py --recover tmp/recordings/public-service/<run-id>`.
Recovery refuses to replace an existing release.

After capture, inspect every screenshot and each full loop before you set a
recording's `loopReviewed` field. The field records human or reviewer inspection.
The capture command never sets it true. Then run the checks below. Commit only
reviewed derived media and sanitized evidence. Do not commit raw footage, models,
credentials, or native output.

```bash
npm run public:verify
npm run public:qa
npm test -- --runInBand
npx --no-install tsc --noEmit
npm run lint
npm run format:check
npm run kb:validate
npm run docs:check
npm run recordings:validate
```

`public:verify` checks CLI answers, exact source bytes, experiment denominators,
recomputed judgments, fallback decisions, and recording identities. Missing
experiments or unreviewed recordings fail. `public:qa` checks that generated
files are current, starts the site, and writes screenshots and downloaded JSON
under ignored `tmp`. It copies the saved media into the ignored site-assets
directory, but it does not rebuild or replace the reviewed demo recordings.
`public:capture` and `public:demo` replace recordings and need a new review.
Their screenshots still need independent inspection.

## Add a sourced case

Fetch an authoritative public page. Save its text with its retrieval time and
transport description. Hash the saved bytes. Review the claim and choose a
review deadline. Add a narrow record with source path, exact excerpt, SHA-256,
and publisher URL.

Only records marked `publicEvidence` enter this pack. Existing unrelated template
records stay stored but do not support these answers.

Add authored queries and answer and route expectations to
[the authored case file](../validation/public-service-cases.json). Include an
unsupported property and a doubt follow-up. Do not invent an agency reply or a
citizen conversation. Run replay, the browser journey, and affected model and
capture checks. A core, corpus, or runner change invalidates its evidence hashes
and needs a new run.
