# All controlled answers used the source-record fallback

## The review covers all 54 displayed answers and 36 raw outputs

The actual model runner produced `evidence/public-service/experiment.json` against source commit `a8f688f99148e00123a708ba0940638214511f3d`. That revision predates the report. An independent reviewer read all 54 displayed answers, all 36 raw outputs and the six exact source archives.

- Run ID: `2026-10-09T07-08-56.968Z-1d5687aa-e12e-4974-bd97-8ea7e9aa2389`
- Started: `2026-10-09T07:08:57.817Z`
- Finished: `2026-10-09T07:09:46.362Z`
- Artifact SHA-256: `f158fd1e6cf3942f3635435b654da54c7055a28d46114560b42ef74424235e53`
- Evidence class: host-native-model
- Provider: node-llama-cpp 3.18.1 on CPU
- Host: Apple M5, arm64, Darwin 25.5.0
- Model: `hf_bartowski_google_gemma-3-1b-it-Q4_K_M.gguf`, SHA-256 `12bf0fff8815d5f73a3c9b586bd8fee8e7b248c935de70dec367679873d0f29d`, 806,058,496 bytes
- Settings: context 2048, maximum 160 tokens, temperature 0, seed 42
- Model load time: 579.393 ms

The artifact has 54 displayed rows: 18 record-only rows, 18 retrieved-model rows, and 18 application-control rows. The 36 model rows keep a raw output. Every row links to one of six source archives.

| Source archive              | Record    | SHA-256 checked against local bytes                                |
| --------------------------- | --------- | ------------------------------------------------------------------ |
| `president.json`            | `off-001` | `354a787606b9a3aeb95ded92369b46a63791336ffc6b31776eccba68d4c92651` |
| `passport-application.json` | `svc-011` | `aba34f2a978ec9c0bf0e8d49ee662c1192b1f5a01dec750bbbd6caededa43eef` |
| `passport-fee.json`         | `fee-011` | `df8a1418c87796e89581ec80b801ba16e051a49e70d025ef0539c270ea772752` |
| `nbi.json`                  | `req-002` | `1d10d4d4e4c6b9fa7879f3ef34e7be117fd2bc272495b52fc2b024bba118279a` |
| `holidays.json`             | `hol-001` | `47191eba3c93309a4d17aceeb826d31961c62008816f902d813dc3d406ef95a8` |
| `sss.json`                  | `hot-005` | `6b6e5768caffaa35a0ff0ec6343b834ea1524535ad0f683c073fbc79c778085d` |

The run metadata matches the reviewed local files: core `c9a825df630040722a8417d26b32e2a7acf938a5f4416ac08b7d39c527f41550`, corpus `f66af3ac1393ecedcdd6bb83853c8fbd165a2764eaba9033f2698985f8bed285`, runner `9a028f9654b1186277b696d6098e480a4680378ab142cefbbaa2d01ba302e3b1`, criteria `39440b5d96dd14c1124a0f85e928ae82534311153451ea7297f5e5456569ea17`, and policy `07991aec1b2da138beef282440a5d581ec848afeb2d1cffb6f956dd256755cc0`.

## The recorded controls replaced all 18 model answers

| Variant              | Rows | Final pass | Model calls | Fallbacks | Token-limit stops | p50 elapsed | p95 elapsed |
| -------------------- | ---: | ---------: | ----------: | --------: | ----------------: | ----------: | ----------: |
| Record-only          |   18 |      18/18 |           0 |      0/18 |              0/18 |    0.230 ms |    2.422 ms |
| Retrieved model      |   18 |      13/18 |          18 |      0/18 |              6/18 |  840.068 ms | 3188.587 ms |
| Application controls |   18 |      18/18 |          18 |     18/18 |              6/18 |  940.370 ms | 3523.874 ms |

The 18 control fallbacks are the full denominator. All have reason `non_extractive_model_fallback`. The application returns the source record after a model generation. The median control path is 100.302 ms slower than the retrieved-model median in this unpaired run. This timing difference is descriptive because the lanes use separate generations and prompt-cache warmth can affect timing.

## Narrow fact checks miss truncation and reject correct short replies

All 18 record-only rows return the source-backed record and pass their narrow criteria. They have no model output and no token stop.

The 18 retrieved-model raw outputs break down as follows:

- President: one source-supported sentence passes. Two bare `Ferdinand R. Marcos Jr.` outputs fail only the needed affirmative pattern. The bare answer gives the person asked for, so these are two narrow-criteria false negatives.
- Passport appointment: all three raw outputs keep `passport.gov.ph` and the free-appointment fact. They pass the criteria.
- Passport fee: all three raw outputs keep the PHP 950 regular-fee fact. They pass the criteria.
- NBI: all three raw outputs include two valid government-issued IDs and pass the criteria, but each reaches the 160-token limit. Each says that NBI gives the reference number or QR code and calls payment an NBI clearance fee. Those words are absent from the supplied record prompt. These are narrow-criteria false-positive risks under the stated extractive task.
- Holidays: all three raw outputs stop at the token limit after `Bonifacio Day` and omit the needed Christmas and Rizal entries. The criteria correctly fail all three.
- SSS: all three raw outputs keep hotline 1455 and pass the criteria.

The 18 application-control raw outputs have the same question pattern: three president bare-name criterion failures, three holiday truncation failures, and 12 narrow-criteria passes. Controls replace all 18 raw outputs with the source-backed record. This includes the six token-limited NBI and holiday generations. The resulting displayed control rows pass 18/18.

No raw row triggered a forbidden-string result or a scored false refusal. This only describes the six authored fact checks. These checks cannot prove complete factual correctness, source freshness, refusal quality for broader prompts, or model behavior outside these six questions.

## Model review and capture review have separate evidence

At the time of this model review, `node scripts/verify-public-service.mjs` passed the shared-core, source-byte, 54-row experiment, timing, and control-decision checks. Its capture gate correctly failed because the new full loops were still unreviewed. Final capture decisions and exact media hashes belong to the separate [visual review](visual-review.md). The [verification record](verification.md) lists the final checked source and commands.

The experiment is host Gemma 3 evidence. It does not show phone inference or Gemma 4 behavior.
