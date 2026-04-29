# Deployment Guide

Deploy your own branded offline AI support app in under an hour.

## Prerequisites

- Node.js 22+ and npm
- Android Studio (for Android builds) with JDK 17
- Xcode 15+ (for iOS builds, macOS only)
- Physical device with 4GB+ RAM recommended for LLM testing

## Quick Start

### 1. Fork and Clone

```bash
git clone https://github.com/xmpuspus/airgap.git my-support-app
cd my-support-app
```

### 2. Run Setup Script

```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

The script prompts for your company name, bot name, industry template, brand colors, hotline, and website. It configures everything automatically.

**Or configure manually:**
- Edit `airgap.config.json` (see CUSTOMIZATION.md for all fields)
- Copy an industry template: `cp examples/banking/airgap.config.json .`
- Replace knowledge base: `cp examples/banking/knowledge/* src/knowledge/`
- Regenerate manifest: `node scripts/generate-manifest.js`

### 3. Install Dependencies

```bash
npm install
cd ios && pod install && cd ..  # iOS only
```

### 4. Validate Knowledge Base

```bash
npm run kb:validate
```

### 5. Build

**Android Debug:**
```bash
JAVA_HOME="/opt/homebrew/opt/openjdk@17" npx react-native run-android
```

**Android Release APK:**
```bash
cd android
JAVA_HOME="/opt/homebrew/opt/openjdk@17" ./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
```

**iOS:**
```bash
npx react-native run-ios --scheme YourAppName
```

**iOS Release (App Store):**
1. Open `ios/YourApp.xcworkspace` in Xcode
2. Select your Team in Signing & Capabilities
3. Set Bundle Identifier to `com.yourcompany.yourapp`
4. Product > Archive > Distribute to App Store

## Android Signing

For release builds, generate a signing keystore:

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore android/app/release.keystore \
  -alias release -keyalg RSA -keysize 2048 -validity 10000
```

Add to `android/gradle.properties`:
```
AIRGAP_RELEASE_STORE_FILE=release.keystore
AIRGAP_RELEASE_KEY_ALIAS=release
AIRGAP_RELEASE_STORE_PASSWORD=your-password
AIRGAP_RELEASE_KEY_PASSWORD=your-password
```

## Model Hosting

The default config downloads from HuggingFace. For enterprise deployments:

**Option 1: HuggingFace (default)**
- No setup needed. The default URL works globally.

**Option 2: AWS S3 / CloudFront**
```json
"model": {
  "url": "https://your-cdn.cloudfront.net/models/gemma-4-e2b-it-q3ks.gguf"
}
```

**Option 3: Google Cloud Storage**
```json
"model": {
  "url": "https://storage.googleapis.com/your-bucket/models/gemma-4-e2b-it-q3ks.gguf"
}
```

**Option 4: Internal Enterprise CDN**
- Host the GGUF file on any HTTP server that supports Range requests (for resume)
- Set the `sha256` field for integrity verification

## Model Size vs Device RAM

The shipped target is Gemma 4 E2B Q3_K_S. The table below reflects the
exact file size and the minimum practical RAM for smooth streaming on
llama.rn.

| Model | File size | Min device RAM | Notes |
|---|---|---|---|
| Gemma 4 E2B Q3_K_S | ~2.4 GB | 4 GB | Default. Honest τ2-bench (Retail) score: 24.5. Mitigated by KB grounding + tool router + optional hybrid cloud (see README). |

If you ship a different quantization or a different model, update
`model.url`, `model.filename`, `model.sizeBytes`, `model.sizeMB`, and
`model.sha256` in config. The device verifies the SHA before loading
and refuses mismatched downloads.

## Play Store Deployment

1. Build release APK or AAB: `./gradlew bundleRelease`
2. Create a Google Play Developer account ($25 one-time)
3. Create app listing in Play Console
4. Upload the AAB from `android/app/build/outputs/bundle/release/`
5. Fill in store listing, screenshots, privacy policy
6. Submit for review

## TestFlight / App Store Deployment

1. Archive in Xcode (Product > Archive)
2. Upload to App Store Connect via Xcode Organizer
3. Add TestFlight testers or submit for App Store review
4. Required: Privacy nutrition labels (declare "Data Not Collected" for offline-only mode)

## Updating Knowledge Base

1. Edit or add JSON files in `src/knowledge/`
2. Run `node scripts/generate-manifest.js` to update imports
3. Run `npm run kb:validate` to check for errors
4. Rebuild the app

For bulk import from spreadsheets:
```bash
node scripts/kb-import.js your-data.csv
```

## BFF (backend for frontend)

Airgap ships a reference BFF in `server/` — a single-file Node HTTP
server with zero runtime dependencies. Use it to prove out the sync
pipeline during development, then replace with your own production
implementation while keeping the same endpoints.

Endpoints:

- `GET /api/v1/sync/kb` — signed KB manifest
- `GET /api/v1/sync/kb/download` — bundled KB JSON files
- `GET /api/v1/sync/model` — current sanctioned model metadata
- `POST /api/v1/telemetry` — audit log ingestion
- `GET /healthz` — liveness

Run locally:

```bash
node server/index.mjs --port 3000 --kb-root src/knowledge
```

On first run the server auto-generates an ed25519 keypair and prints
the public key. Paste that value into `airgap.config.json`:

```json
{
  "backend": {
    "type": "rest",
    "baseUrl": "https://your-bff.example.com",
    "syncPublicKey": "MCowBQYDK2VwAyEA...=="
  }
}
```

Docker:

```bash
docker build -t airgap-bff server/
docker run -p 3000:3000 -v $(pwd)/server/.keys:/app/.keys airgap-bff
```

Production deployments should put the BFF behind an IAP or your
existing auth layer — the reference server does not authenticate
callers, it rejects any request with an `Origin` header to prevent
browser misuse.

See [docs/sync-architecture.md](docs/sync-architecture.md) for the
sync flow, signing model, and rollback protocol.

## Troubleshooting

**Build fails on Android:**
- Ensure JAVA_HOME points to JDK 17
- Run `cd android && ./gradlew clean` and retry

**iOS pod install fails:**
- Delete `ios/Pods` and `ios/Podfile.lock`
- Run `cd ios && pod install --repo-update`

**Model download stalls:**
- Check device storage (need 3-5 GB free)
- Downloads resume automatically on retry
- WiFi recommended for initial download

**LLM responses are slow:**
- Ensure GPU layers > 0 in config (`model.gpuLayers: 99`)
- Reduce `model.maxTokens` for shorter responses
- Use a smaller quantized model (Q3 instead of Q4)
