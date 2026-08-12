# Build and release a branded Airgap app

Deploy your own branded offline AI support app in under an hour.

## Prerequisites

- Node.js 22+ and npm
- Android Studio (for Android builds) with JDK 17
- Xcode 15+ (for iOS builds, macOS only)
- Physical device with 4GB+ RAM recommended for LLM testing

## Build a local app in five steps

### 1. Fork and Clone

```bash
git clone https://github.com/xmpuspus/airgap.git my-support-app
cd my-support-app
```

### 2. Run the setup command

```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

The script asks for your company name, bot name, industry template, brand colors, hotline, and website. It sets up those values automatically.

You can set up the files yourself.

- Edit `airgap.config.json` (see CUSTOMIZATION.md for all fields)
- Copy an industry template with `cp examples/banking/airgap.config.json .`
- Replace the knowledge base with `cp examples/banking/knowledge/* src/knowledge/`
- Rebuild the manifest with `node scripts/generate-manifest.js`

### 3. Install Dependencies

```bash
npm install
cd ios && pod install && cd ..  # iOS only
```

### 4. Check the knowledge base

```bash
npm run kb:validate
```

### 5. Build

### Run an Android debug build

```bash
JAVA_HOME="/opt/homebrew/opt/openjdk@17" npx react-native run-android
```

### Build an Android release APK

```bash
cd android
JAVA_HOME="/opt/homebrew/opt/openjdk@17" ./gradlew assembleRelease
# Output file android/app/build/outputs/apk/release/app-release.apk
```

### Run an iOS debug build

```bash
npx react-native run-ios --scheme YourAppName
```

### Build an iOS App Store archive

1. Open `ios/YourApp.xcworkspace` in Xcode
2. Choose your Team in Signing & Capabilities
3. Set Bundle Identifier to `com.yourcompany.yourapp`
4. Product > Archive > Distribute to App Store

## Environment variables protect Android signing keys

Make a signing keystore for release builds.

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore android/app/release.keystore \
  -alias release -keyalg RSA -keysize 2048 -validity 10000
```

Set the release-signing values in the build environment. Do not add them to a
tracked Gradle properties file.

```bash
export AIRGAP_RELEASE_STORE_FILE=release.keystore
export AIRGAP_RELEASE_KEY_ALIAS=release
export AIRGAP_RELEASE_STORE_PASSWORD='your-password'
export AIRGAP_RELEASE_KEY_PASSWORD='your-password'
```

Airgap leaves a release build unsigned when the environment has none of these
variables. The build stops when the environment has only some of them.

## Model files can come from four hosts

The default config downloads from HuggingFace. Enterprise deployments can use
one of four hosts.

### HuggingFace is the default

- No setup needed. The default URL works globally.

### AWS S3 and CloudFront

```json
"model": {
  "url": "https://your-cdn.cloudfront.net/models/gemma-4-e2b-it-q3ks.gguf"
}
```

### Google Cloud Storage

```json
"model": {
  "url": "https://storage.googleapis.com/your-bucket/models/gemma-4-e2b-it-q3ks.gguf"
}
```

### An internal enterprise CDN

- Host the GGUF file on any HTTP server that supports Range requests (for resume)
- Set the `sha256` field for integrity verification

## The default model needs about 4 GB of device RAM

The shipped target is Gemma 4 E2B Q3_K_S. The table below reflects the
exact file size and the least practical RAM for smooth streaming on
llama.rn.

| Model              | File size | Min device RAM | Notes                                                                                                                                   |
| ------------------ | --------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Gemma 4 E2B Q3_K_S | ~2.4 GB   | 4 GB           | Default. The recorded τ2-bench Retail score is 24.5. KB grounding, the tool router, and optional cloud mode address known model limits. |

If you ship a different quantization or a different model, update
`model.url`, `model.filename`, `model.sizeBytes`, `model.sizeMB`, and
`model.sha256` in config. The device checks the SHA before loading
and refuses mismatched downloads.

## Google Play accepts a signed app bundle

1. Build the release AAB with `./gradlew bundleRelease`
2. Create a Google Play Developer account ($25 one-time)
3. Create app listing in Play Console
4. Upload the AAB from `android/app/build/outputs/bundle/release/`
5. Fill in store listing, screenshots, privacy policy
6. Send the app for review

## App Store Connect accepts the Xcode archive

1. Archive in Xcode (Product > Archive)
2. Upload to App Store Connect via Xcode Organizer
3. Add TestFlight testers or send the app for App Store review
4. Add the needed privacy nutrition labels (declare "Data Not Collected" for offline-only mode)

## Rebuild after each knowledge-base change

1. Edit or add JSON files in `src/knowledge/`
2. Run `node scripts/generate-manifest.js` to update imports
3. Run `npm run kb:validate` to check for errors
4. Rebuild the app

Use this command for bulk import from spreadsheets.

```bash
node scripts/kb-import.js your-data.csv
```

## The reference server supplies the mobile API

Airgap ships a reference backend for frontend in `server/`. It is a single-file
Node HTTP server with zero runtime dependencies. Use it to test the sync
pipeline during development. You can replace it with your own production
server while keeping the same endpoints.

The server exposes five endpoints.

- `GET /api/v1/sync/kb` returns the signed KB manifest
- `GET /api/v1/sync/kb/download` returns bundled KB JSON files
- `GET /api/v1/sync/model` returns current sanctioned model metadata
- `POST /api/v1/telemetry` accepts audit logs
- `GET /healthz` reports liveness

Start the server with this command.

```bash
node server/index.mjs --port 3000 --kb-root src/knowledge
```

On first run the server automatically makes an Ed25519 key pair and prints
the public key. Paste that value into `airgap.config.json`.

```json
{
  "backend": {
    "type": "rest",
    "baseUrl": "https://your-bff.example.com",
    "syncPublicKey": "MCowBQYDK2VwAyEA...=="
  }
}
```

Run the server in Docker with these commands.

```bash
docker build -t airgap-bff server/
docker run -p 3000:3000 -v $(pwd)/server/.keys:/app/.keys airgap-bff
```

Production deployments should put the server behind an identity-aware proxy
or another authentication layer. The reference server does not authenticate
callers. It rejects requests with an `Origin` header to prevent browser misuse.

See [docs/sync-architecture.md](docs/sync-architecture.md) for the
sync flow, signing model, and rollback protocol.

## Common build and runtime problems

### An Android build fails

- Make sure JAVA_HOME points to JDK 17
- Run `cd android && ./gradlew clean` and retry

### CocoaPods installation fails

- Remove `ios/Pods` and `ios/Podfile.lock`
- Run `cd ios && pod install --repo-update`

### A model download stalls

- Check device storage (need 3-5 GB free)
- Downloads resume automatically on retry
- WiFi recommended for the first download

### Model responses are slow

- Make sure GPU layers > 0 in config (`model.gpuLayers: 99`)
- Decrease `model.maxTokens` for shorter responses
- Use a smaller quantized model (Q3 instead of Q4)
