# The Airgap reference server protects sync routes

This Node server gives the Airgap mobile app its network boundary.
It serves knowledge and model metadata, returns signed knowledge bytes, and
accepts bounded telemetry batches. Use it for local evaluation and as a small
contract reference for a production service.

## Four routes need a bearer token

| Method | Route                      | Purpose                            |
| ------ | -------------------------- | ---------------------------------- |
| `GET`  | `/healthz`                 | Public process and knowledge check |
| `GET`  | `/api/v1/sync/kb`          | Current knowledge manifest         |
| `GET`  | `/api/v1/sync/kb/download` | Exact signed knowledge bytes       |
| `GET`  | `/api/v1/sync/model`       | Current local-model metadata       |
| `POST` | `/api/v1/telemetry`        | Bounded telemetry ingestion        |

Every `/api/v1` request needs the bearer token set in
`BFF_AUTH_TOKEN`. The health route stays public for container and load-balancer
checks.

## A local process uses an environment token

Use a random token with at least 24 characters. Do not commit it.

```bash
export BFF_AUTH_TOKEN="replace-with-a-random-development-token"
node server/index.mjs \
  --port 3000 \
  --kb-root src/knowledge \
  --keypair tmp/airgap-bff/ed25519.json \
  --telemetry-log tmp/airgap-bff/telemetry.jsonl
```

The server prints the new public key on first start. Keep the private key
file outside source control and restrict it to the service account that signs
knowledge releases.

### Configuration

| Setting                                | Purpose                                       | Default                |
| -------------------------------------- | --------------------------------------------- | ---------------------- |
| `BFF_AUTH_TOKEN`                       | Required bearer token, at least 24 characters | none                   |
| `BFF_RATE_LIMIT`                       | Authorized requests allowed per client window | `60`                   |
| `BFF_RATE_WINDOW_MS`                   | Fixed rate window in milliseconds             | `60000`                |
| `PORT` or `--port`                     | HTTP port                                     | `3000`                 |
| `KB_ROOT` or `--kb-root`               | Directory containing knowledge JSON           | `../src/knowledge`     |
| `KB_VERSION` or `--kb-version`         | Published knowledge version override          | latest file time       |
| `KEYPAIR` or `--keypair`               | Ed25519 keypair JSON path                     | `./.keys/ed25519.json` |
| `MODEL_MANIFEST` or `--model-manifest` | Model metadata JSON path                      | `./model.json`         |
| `TELEMETRY_LOG` or `--telemetry-log`   | Telemetry JSONL path                          | `./telemetry.jsonl`    |

## Curl can read the signed manifest

```bash
curl \
  -H "Authorization: Bearer $BFF_AUTH_TOKEN" \
  http://127.0.0.1:3000/api/v1/sync/kb
```

Authorized responses include `RateLimit-Limit`, `RateLimit-Remaining`, and
`RateLimit-Reset`. A client over the limit receives `429` and `Retry-After`.
The server accepts request bodies up to 256 KB. It rejects requests with an
`Origin` header because this service is not a browser API.

## Production needs external identity and storage services

This reference server is not a production identity system or durable telemetry
service. Its bearer token is a single shared development credential. Its rate
buckets live in one process, and its telemetry sink is a local JSONL file.

A production deployment should replace these parts with the services below.

- the organization's access-token issuer and audience checks.
- a shared rate limiter at the gateway or service layer.
- managed signing keys or a separate signing service.
- durable logs with retention and access controls.
- TLS termination, monitoring, backup, and key-rotation procedures.

The mobile app pins the signing public key. It never receives the signing
private key. Authentication controls who may request a bundle. Signature and
hash checks control whether the app may install it.

## A container runs the same process

```bash
docker build -t airgap-bff server
docker run --rm -p 3000:3000 \
  -e BFF_AUTH_TOKEN="$BFF_AUTH_TOKEN" \
  -v "$PWD/tmp/airgap-bff:/app/.keys" \
  airgap-bff
```
