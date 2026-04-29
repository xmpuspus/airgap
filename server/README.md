# Airgap Reference BFF

A tiny reference implementation of the Airgap sync + telemetry backend. Use
this to prove out the sync pipeline during development, then replace with
your own production implementation (FastAPI, Spring, Rails, whatever you
already run) while keeping the same endpoints.

## Responsibilities

The device talks to a single backend for four concerns:

1. **`GET /api/v1/sync/kb`** — knowledge base manifest (current version,
   download URL, sha256, ed25519 signature)
2. **`GET /api/v1/sync/kb/download`** — signed KB bundle (zipped JSON)
3. **`GET /api/v1/sync/model`** — LLM model manifest (version, sha256, size)
4. **`POST /api/v1/telemetry`** — audit log ingestion (query hashes, doc
   IDs, tool calls, confidence, refusal reasons)

The device never learns the signing private key. The signing key lives on
the BFF (or on a separate signing service — the BFF should be able to fetch
signatures, not forge them).

## Dependencies

Intentionally zero runtime dependencies beyond Node's standard library and
the shipped Node crypto module. No Express, no Fastify. The server is a
single `index.mjs` file that anyone can read in five minutes.

## Running it

```bash
cd server
node index.mjs --port 3000 --kb-root ../src/knowledge --keypair .keys/ed25519.json
```

Options:

| Flag | Purpose | Default |
|---|---|---|
| `--port <n>` | HTTP port | 3000 |
| `--kb-root <path>` | Directory of KB JSON files to publish | `../src/knowledge` |
| `--kb-version <v>` | Override auto-computed version string | ISO timestamp of last mtime |
| `--keypair <path>` | Path to ed25519 keypair JSON | `./.keys/ed25519.json` |
| `--model-manifest <path>` | Path to a JSON file with model metadata | `./model.json` |
| `--telemetry-log <path>` | Append telemetry events here | `./telemetry.jsonl` |

Generate a keypair before first run:

```bash
node scripts/keygen.mjs > .keys/ed25519.json
```

Then copy the `publicKey` field into every airgap.config.json that should
talk to this BFF as `backend.syncPublicKey`.

## Security model

- Every KB bundle is ed25519 signed by the BFF. The device has the public
  key pinned in its config and refuses bundles with invalid signatures.
- The device does NOT trust the `url` field in the manifest for validation:
  it verifies the sha256 of the downloaded file against the manifest sha256.
- Telemetry is append-only. The reference BFF writes JSONL, production
  would forward to a real log sink (Cloud Logging, Splunk, etc).
- CORS is locked down — the device does not use browser clients, so the
  server rejects all `Origin` headers.
- The endpoints are intentionally stateless. Horizontal scaling is a
  load-balancer-and-signature-key-rotation problem, not a code problem.

## Docker

```bash
docker build -t airgap-bff .
docker run -p 3000:3000 -v $(pwd)/.keys:/app/.keys airgap-bff
```

## What this BFF is NOT

- Not a production service. It does not persist anything but telemetry
  JSONL. It does not authenticate callers. Use behind an IAP or add your
  own auth layer in front.
- Not an LLM proxy. The hybrid cloud-LLM path in Phase 6 is a separate
  concern that lives in a different endpoint.
- Not a subscription manager. Billing, entitlements, and rate-limiting
  live in your existing infra.
