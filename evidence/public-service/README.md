# Fetched sources and actual executions

The original eight JSON archives under `sources/` contain text returned by public web fetches on 2026-10-09.
Each archive records its URL, retrieval time and extraction method. Hashes in the records
identify the exact archive bytes. The archives disclose that they are extracted text,
not original response bytes. No government backend or citizen transaction was simulated.

| Saved text                                            | Authority and use                                    |
| ----------------------------------------------------- | ---------------------------------------------------- |
| [NBI](sources/nbi.json)                               | NBI clearance visit requirements                     |
| [SSS](sources/sss.json)                               | SSS website hotline                                  |
| [PCO SONA](sources/president.json)                    | President named in the 2026-07-27 transcript         |
| [DFA portal](sources/passport-application.json)       | Free passport appointments at the official portal    |
| [DFA charter](sources/passport-fee.json)              | Dated 2022 fee table; current payable fee unverified |
| [Proclamation 1006](sources/holidays.json)            | Ten regular holidays listed for 2026                 |
| [PCO announcement of 368](sources/historical368.json) | Original 2024 Ninoy Aquino Day date                  |
| [Proclamation 665](sources/historical665.json)        | Full legal amendment moving that observance          |

The workbench now uses the actual [Customs PDF](sources/boc-ocom-memo-01-2024.pdf)
with Proclamation 368 attached on pages 2–4, and the one-page
[BIR Circular 102-2024](sources/bir-rmc-102-2024.pdf). The latter reports Proclamation
665's amendment; it does not include that proclamation as an attachment. The original
proclamation was signed on 11 October 2023. The circular is dated 16 August 2024.
The old search-extracted archives above are retained as research evidence.

PDF hashes identify exact bytes downloaded from the government URLs. Separate `.ocr.json`
files contain unedited OCR, page numbers, PDF hashes and tool identity. An independent
agent read all three proclamation pages and the circular image. OCR has transcription
errors elsewhere on the pages, so only the visually checked Ninoy Aquino Day excerpts
enter the workbench. `python3 scripts/public-source-ocr.py` repeats extraction with Poppler
and Tesseract; changed extraction bytes require a new hash and review before packaging.

The [2025 calendar PDF](sources/boc-cmc-185-2024.pdf) contains Proclamation 727,
signed 30 October 2024, attached to Customs Circular 185-2024 dated 14 November.
All four pages were read from the original scan. Its separate
[unedited OCR](sources/boc-cmc-185-2024.ocr.json) records Tesseract 5.5.1 and the PDF hash.
The [expiry regression](../../validation/public-service-expiry.json) uses its explicit
2025 scope to set application validity through 31 December 2025. This is an application
policy, not a claim that the proclamation was legally repealed. With the real 2026 clock,
that record alone refuses a current-year question. Adding the checked 2026 record with
an authored catalogue rollover relation returns the current record in either input order.
This regression record stays outside the six-record model corpus.

[The current experiment](experiment.json) publishes all 54 measured rows. Its embedded
criteria identify the fact checks used for that run. Model, core, corpus, runner and criteria
hashes let the verifier reject stale results. These are host CPU measurements, not a fresh
native application run.

The [independent output review](experiment-review.md) separates fact checks, valid short
answers rejected by those checks, truncation and deterministic fallbacks. It includes the
exact reviewed report hash and measured host timings.

[The Metal failure](experiment-metal-unavailable.json) retains the actual initialization
errors. `experiment-cpu-interrupted.jsonl` retains actual rows from a CPU run that stopped
during repeated context disposal. [The pre-review run](experiment-pre-review.json) used
earlier matching and fact criteria; its scores are not the current result. The final runner
uses one context with chat history reset, checks all ten holiday dates and preserves
punctuation when testing a verbatim record. Earlier results have not been relabeled.

[The source-review run](experiment-pre-source-review.json) precedes removal of an unsupported
passport instruction. [The next run](experiment-before-stop-metadata.json) uses the corrected
record but predates collection of actual generation stop reasons. Both are retained; only
`experiment.json` is the current comparison. Its token-limit counts are separate from fact
checks because a truncated response can contain all the required words.

Browser screenshots and raw videos stay under ignored `tmp/` paths. Each capture uses
committed source, measured browser output and uncut video. The
[visual review](visual-review.md) records screenshot and full-loop inspection. The
[check record](verification.md) lists the commands and their observed results.

The model emitted tokenizer warnings about `</s>` and special end-of-generation IDs, plus
a swap-information warning. Those warnings stay in the local run log.

After narrow overrides for shell-quote, simple-git and its argument parser, the
2026-10-09 dependency audit reports 63 entries: 0 critical, 56 high and 7 moderate.
Excluding development dependencies leaves 41 entries: 0 critical, 34 high and 7 moderate.
The counts do not establish exploitability. The lab uses static local JavaScript and data.
The wider React Native and development dependency tree still has unresolved advisories.
