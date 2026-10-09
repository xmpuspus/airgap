# The controlled lane displayed records for every answer

An independent read-only agent inspected all 54 displayed rows, all 36 raw model outputs
and the saved primary-source extracts. The reviewed report is
[experiment.json](experiment.json), SHA-256
`b493a8ee43f039d01f9265c17e114d6c9c8bb4dc463692eafbcea92e952999ab`.
Its embedded hashes matched the files inspected for that run. Subsequent evidence-validation
and clock-routing fixes changed the core. This review remains tied to the report hash above;
a new execution and independent review are required for the changed core.
This is a new CPU execution, finished 2026-10-09T04:46:25.602Z. The previous report is
preserved as [experiment-before-policy-review.json](experiment-before-policy-review.json).

| Variant              | Authored fact checks | Model calls | Fallbacks | Raw token-limit stops | False refusals |
| -------------------- | -------------------- | ----------- | --------- | --------------------- | -------------- |
| Record-only          | 18/18                | 0/18        | 0/18      | 0/18                  | 0/18           |
| Retrieved model      | 13/18                | 18/18       | 0/18      | 6/18                  | 0/18           |
| Application controls | 18/18                | 18/18       | 18/18     | 6/18                  | 0/18           |

All 18 controlled answers came from deterministic fallback. The model contributed no
accepted final wording. The baseline already supplied the complete records without inference.
The two model lanes made separate generations; their timing differences do not isolate the
effect of controls.

## The fact score misses both valid short answers and incomplete prose

The retrieved president answers in repetitions 2 and 3 say only “Ferdinand R. Marcos Jr.”.
That correctly answers the “Who” question. The authored affirmative-claim expression rejects
those two valid short answers. All three controlled raw president outputs have the same
conservative false negative. The original scores remain published rather than changing
the criteria after seeing the outputs.

Every NBI and holiday generation hit the 160-token limit in both model lanes. NBI outputs
retain the required facts but stop at “Photocopies or duplicates” or an unfinished disclaimer.
The holiday outputs stop during the Bonifacio date and omit Christmas and Rizal Day. Their
real stop reason is `maxTokens`; the other 12 generations per model lane end with `eogToken`.

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
| Record-only          | 0.258          | 12.513         |
| Retrieved model      | 750.698        | 3,847.697      |
| Application controls | 1,248.735      | 4,416.884      |

The measurements use an Apple M5 host, Darwin arm64, CPU execution and
`hf_bartowski_google_gemma-3-1b-it-Q4_K_M.gguf`, 806,058,496 bytes, SHA-256
`12bf0fff8815d5f73a3c9b586bd8fee8e7b248c935de70dec367679873d0f29d`.
The model is hashed before use. A shared context resets chat history between generations;
warm prompt caching may still affect timings. Neither these numbers nor this review prove
a phone run, Gemma 4 performance or browser rendering.
