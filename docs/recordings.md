# Record release GIFs

Airgap keeps ten GIFs as product evidence. The set has one Android flow, one iOS flow, one joint README
flow, and seven industry flows. Each GIF must come from a named target and a committed application
state.

## Needed tools

- Node.js 22.11 or newer
- FFmpeg and FFprobe
- Maestro with JDK 17
- Android SDK platform tools for Android capture
- Xcode and an installed iOS Simulator runtime for iOS capture

Set `ANDROID_HOME` or `ANDROID_SDK_ROOT` so the recording script can find `adb`. Set `JAVA_HOME` to
a JDK 17 installation before running Maestro.

## Commit code before capture

Commit interface, provider, flow, and fixture changes before recording. The source commit in
`demo/recordings.json` names the application behavior shown in the media. The later media
commit can contain the GIF and manifest update.

Check the capture targets.

```bash
adb devices -l
xcrun simctl list devices booted
xcrun xctrace list devices
```

Use `emulator`, `simulator`, or `physical-device` only when it matches the named target. A native
bridge compile or simulator run is not physical-device provider evidence.

## Record the platform flows

```bash
git rev-parse HEAD
node scripts/record-demo.mjs \
  --platform android \
  --device emulator-5554 \
  --commit <40-character-commit> \
  --provider demo \
  --model-identity document-formatter-v1 \
  --evidence-class emulator

node scripts/record-demo.mjs \
  --platform ios \
  --device <simulator-udid> \
  --commit <40-character-commit> \
  --provider demo \
  --model-identity document-formatter-v1 \
  --evidence-class simulator
```

The release flows start from cleared app state, show the active answer path, ask a local support
question, wait for `Document answer`, and capture source evidence. Android records the outbox
and privacy states. iOS records settings and privacy in a separate evidence flow.

Build the joint README asset only after both platform recordings use the same source commit.

```bash
node scripts/build-readme-gif.mjs --commit <40-character-commit>
```

## Record industry fixtures

```bash
node scripts/record-industries.mjs \
  --device emulator-5554 \
  --commit <40-character-commit>
```

The industry runner copies each fixture's configuration and knowledge into a temporary application
state, chooses a local-information quick reply, and restores tracked source files after capture.
Never use real customer data, accounts, tokens, locations, or support systems in release media.

## Inspect every output

Each run writes raw video, screenshots, and a first-middle-final contact sheet under
`tmp/recordings/<commit>/`. The `tmp` directory stays out of Git.

Check each GIF as follows.

1. Inspect the first, middle, and final frames.
2. Play the full loop and check pacing, touch results, scrolling, text wrapping, and the loop seam.
3. Check that the visible provider and source match `providerId` and `modelIdentity`.
4. Check that no notification, account value, machine path, or private data appears.
5. Set `loopReviewed` to `true` only after the full check.

The README GIF must stay under 5 MiB. Platform GIFs must stay under 8 MiB. Industry GIFs must stay
under 3 MiB. The validator checks dimensions, frame rate, duration, file header, and exact byte
count.

```bash
npm test -- --runInBand __tests__/scripts/validate-recordings.test.js
npm run recordings:validate
```

## Publish only reviewed media

Update the README description when its GIF, provider, model, device class, or unchecked behavior
changes. Stage only the GIFs that the current recording run produced, plus their manifest, flow,
script, test, and documentation changes. Do not stage raw videos or local helper scripts.

Use `git diff --cached --stat` and `git diff --cached` before the commit. After the push, check that
the remote README points to the expected GIF and commit.
