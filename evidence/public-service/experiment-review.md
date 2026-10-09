# The controlled lane displayed records for every answer

An independent read-only agent inspected all 54 displayed rows, all 36 raw model outputs
and the saved primary-source extracts. The reviewed report is
[experiment.json](experiment.json), SHA-256
`f7ef2b355b088ae9d785549b7337966fa4828a4628d16b73ed45c92bfd1be86c`.
Its embedded core, runner, criteria, policy and source hashes match the checked files.
This CPU execution finished on 2026-10-09 at 05:28:37.410 UTC, after source commit
`ce12f1e19ec042b8a3f48c042fe661c4780bfe16`. The report embeds file hashes. The commit
is a separate repository observation.

Earlier reports stay in Git history and the
archived experiment files. None were relabeled as this execution.

| Variant              | Authored fact checks | Model calls | Fallbacks | Raw token-limit stops | False refusals |
| -------------------- | -------------------- | ----------- | --------- | --------------------- | -------------- |
| Record-only          | 18/18                | 0/18        | 0/18      | 0/18                  | 0/18           |
| Retrieved model      | 13/18                | 18/18       | 0/18      | 6/18                  | 0/18           |
| Application controls | 18/18                | 18/18       | 18/18     | 6/18                  | 0/18           |

All 18 controlled answers came from deterministic fallback. The model contributed no
accepted final wording. The baseline already supplied the complete records without inference.

Twelve fallbacks replaced acceptable model answers. Six repaired incomplete answers.
Across all 36 raw generations, independent reading found 24 acceptable and 12 incomplete.
The two model lanes made separate generations. Their timing differences do not isolate the
effect of controls.

## Fact checks rejected correct names and accepted incomplete NBI text

The retrieved president answers in repetitions 2 and 3 say only “Ferdinand R. Marcos Jr.”.
That correctly answers the “Who” question. The authored affirmative-claim expression rejects
those two valid short answers. All three controlled raw president outputs have the same
conservative false negative. The original scores stay published rather than changing
the criteria after seeing the outputs.

Every NBI and holiday generation hit the 160-token limit in both model lanes. NBI outputs
keep the needed facts but stop at “Photocopies or duplicates” or an unfinished disclaimer.
The holiday outputs stop during the Bonifacio date and omit Christmas and Rizal Day. Their
real stop reason is `maxTokens`. The other 12 generations per model lane end with `eogToken`.

The 160-token limit is part of this test configuration. These results do not predict
behavior with a larger output budget.

| Question             | Retrieved output, three repetitions                       | Controlled display, three repetitions   |
| -------------------- | --------------------------------------------------------- | --------------------------------------- |
| President            | Three correct names; two rejected by the narrow criterion | Three complete records; three fallbacks |
| Passport appointment | Three correct portal/free-appointment answers             | Three records; three fallbacks          |
| Dated passport fee   | Three correct PHP 950 references to the stored charter    | Three dated records; three fallbacks    |
| NBI requirements     | Required facts present in all three; all truncated        | Three complete records; three fallbacks |
| 2026 holidays        | All three omit final dates and truncate                   | Three complete records; three fallbacks |
| SSS hotline          | Three correct 1455 answers                                | Three records; three fallbacks          |

Independent reading finds the requested facts in 15/18 retrieved outputs and complete,
untruncated text in 12/18. These are separate observations from the automated 13/18 score.
The reviewer found no false refusal or unsupported factual statement in the inspected
outputs. This small, sourced question set does not measure open-domain answer quality.

## CPU timings include inference and the final control decision

| Variant              | p50 elapsed ms | p95 elapsed ms |
| -------------------- | -------------- | -------------- |
| Record-only          | 0.169          | 2.079          |
| Retrieved model      | 638.509        | 2,733.886      |
| Application controls | 703.740        | 2,663.885      |

With 18 observations per variant, the nearest-rank p95 is the maximum observation.

The measurements use an Apple M5 host, Darwin arm64, CPU execution and
`hf_bartowski_google_gemma-3-1b-it-Q4_K_M.gguf`, 806,058,496 bytes, SHA-256
`12bf0fff8815d5f73a3c9b586bd8fee8e7b248c935de70dec367679873d0f29d`.
The model is hashed before use. A shared context resets chat history between generations.
Warm prompt caching may still affect timings. Neither these numbers nor this review prove
a phone run, Gemma 4 performance or browser rendering.
