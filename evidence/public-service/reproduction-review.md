# A separate checkout reproduced all five features

An independent reviewer ran the complete demo command against source commit
`f8c2411da69a0b64bb43a02384a6836e592b6393` on 9 October 2026.
The detached checkout reused the installed dependencies and CPU binding.
This checks a fresh source checkout. It does not check a fresh dependency installation.

The reviewer supplied the existing Gemma 3 1B Q4_K_M model to this command:

```bash
npm run public:demo -- --model /path/to/local-gemma-3.gguf
```

The actual supplied file has 806,058,496 bytes and SHA-256
`12bf0fff8815d5f73a3c9b586bd8fee8e7b248c935de70dec367679873d0f29d`.
No API key, provider substitute, response interception or invented source fact was used.

## The full command exited successfully

The kept process capture reports exit 0, no timeout or cancellation, and complete
stdout and stderr. Its archive SHA-256 is
`e85c4ebad4c44e51b51ce65573aa8c5dc1733634e269106fd0b64c6c223c65d7`.
The reviewer decoded both streams and checked their hashes.

| Stream |  Bytes | SHA-256                                                            |
| ------ | -----: | ------------------------------------------------------------------ |
| stdout | 19,547 | `46e43c5669d845798f828b2d22231bdbdd0cb58ba453a26955ac8d91eee753a3` |
| stderr | 24,554 | `1de6f2743d034c47889efa258e78ac656314432d28a23d0f9566983eb146da28` |

The command ran the 21-case replay, 36 real model generations, complete site build,
browser QA, five browser recordings, ten exports and final browser QA after export.
The process capture reports peak RSS of 1733.6 MB. Stderr keeps the tokenizer warnings.

## The separate model run kept the same measured outcome

Run `2026-10-09T07-21-50.710Z-38fea926-8483-4a52-9453-d4e0017e4f70`
used node-llama-cpp 3.18.1 on an Apple M5 CPU, Darwin 25.5.0 arm64.
It produced 54 rows, 36 nonempty raw model outputs, zero provider errors and 12 token-limit stops.

| Variant              | Passed authored checks | Model calls | Fallbacks |
| -------------------- | ---------------------: | ----------: | --------: |
| Record-only          |                  18/18 |           0 |         0 |
| Retrieved model      |                  13/18 |          18 |         0 |
| Application controls |                  18/18 |          18 |        18 |

These are narrow string checks on six questions. The separate reproduction did not
replace the released experiment report. Its [independent output review](experiment-review.md)
describes the criteria's false negatives, truncation and unsupported-wording risk.

## The final browser pass checked the new media

Final QA ran from 07:25:16.445492 to 07:25:32.508444 UTC on 9 October 2026.
Chromium 145.0.7632.6 and Playwright 1.58.0 ran at 1280×900 and 390×844.
Each viewport completed 21 sequential cases, two replays, source apply and rollback,
downloads, and a real missing-file recovery with statuses 404, 404 and 200.
Both had zero page errors and zero horizontal overflow.

After capture, every viewport fetched all ten new public-service exports and all nine
existing site GIFs. All returned HTTP 200 and matched their source hashes.
Every loaded image had positive natural width. The full log has only the eight
expected missing-pack 404 responses from two browser passes at two viewport sizes.

The final manifest binds 62 current files and 60 committed files. Independent hashes
match every binding and all five raw WebMs, GIFs and MP4s. Each raw video is
1280×900, 25 fps VP8 WebM. The separate outputs stayed unreviewed and outside the
released media set. [The visual review](visual-review.md) approves the released hashes.

## The earlier reproduction caught two packaging defects

The first separate checkout lacked the homepage and industry GIF copies. Its in-command
QA ran before capture and so checked the old media hashes. The final source
builds the complete site and repeats browser QA after capture. The separate run above
confirms both fixes. Its checkout, exact process capture and raw footage stay local for
audit. No deployment, external publication or native-device run happened.
