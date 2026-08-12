# Signed knowledge sync rejects altered support content

Airgap can update local support content through one operator-controlled server.
The app keeps the compiled knowledge base and the last valid downloaded bundle
when a network, authentication, file, hash, signature, key, or schema check
fails.

## The app checks two authenticated responses

```text
Airgap app                                  Reference server
----------                                  ----------------
token provider -> short-lived token
GET /api/v1/sync/kb ----------------------> bearer check
                  <------------------------- signed manifest
token provider -> fresh short-lived token
GET manifest.url --------------------------> bearer check
                  <------------------------- exact JSON bytes
length, SHA-256, key ID, Ed25519, schema
partial file -> current file
current file -> MiniSearch index
```

The app gets a fresh access token for each request. It sends a token only to the
set server origin. The app rejects a manifest download URL on another
origin.

## The manifest finds the exact signed bytes

`GET /api/v1/sync/kb` returns the fields below.

| Field               | Required value                                                     |
| ------------------- | ------------------------------------------------------------------ |
| `algorithm`         | `Ed25519`                                                          |
| `signatureEncoding` | `base64`                                                           |
| `byteLength`        | Exact download length                                              |
| `sha256`            | Lowercase SHA-256 of the download bytes                            |
| `version`           | Operator release ID                                                |
| `keyId`             | First 16 hexadecimal characters of SHA-256 over the raw public key |
| `url`               | HTTPS URL on the configured server origin                          |
| `publishedAt`       | Valid ISO date and time                                            |
| `signature`         | Base64 Ed25519 signature over the exact download bytes             |

The server signs the same bytes that the download route returns. JSON parsing or
serialization must not happen between signing and download.

## The app pins raw Ed25519 public keys

The reference server prints a key ID and a raw 32-byte public key in base64 on
startup. Add the pair to the REST backend configuration shown below.

```json
{
  "backend": {
    "type": "rest",
    "baseUrl": "https://support-api.example.com",
    "auth": {
      "type": "provider",
      "audience": "airgap-bff"
    },
    "sync": {
      "publicKeys": {
        "0123456789abcdef": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
      }
    }
  }
}
```

The sample value is not a usable key. Replace both strings with output from the
server or the organization's signing service.

The `publicKeys` map supports the controlled key-rotation steps below.

1. Ship an app release that pins the old and new public keys.
2. Sign new knowledge releases with the new private key.
3. Test that supported app versions install the new release.
4. Remove the old public key in a later app release.

Never send a signing private key to the app or store it in this repository.

## Checks finish before the file swap

The app uses the order below for a new knowledge version.

1. Remove any old partial file for that version.
2. Download exact bytes with a fresh access token.
3. Write those bytes to a partial file.
4. Check file length and SHA-256 against the manifest.
5. Check the key ID and Ed25519 signature with TweetNaCl.
6. Decode strict UTF-8 and check the bundle and document fields.
7. Move the current file to the earlier-file slot.
8. Move the checked partial file to the current-file slot.
9. Rebuild the in-memory search index.
10. Save the new version and sync time in encrypted local storage.

If a check fails before step 7, the app deletes only the partial file. If the
file swap or index rebuild fails, the app restores the earlier file. Compiled
knowledge remains the last fallback.

## Each bundle has valid support documents

The download is a UTF-8 JSON object with a valid `generatedAt` value and a
nonempty `files` object. Each filename ends in `.json`. Each value is a JSON
string that parses to an array of support documents.

Every support document has string values for `id`, `category`, `title`, and
`content`, plus a string array named `keywords`. The verifier rejects an empty
bundle or a document with missing needed fields.

## Sync time controls the freshness state

The app tries to sync after startup, after network reconnection, and every six
hours while the scheduler runs. A successful same-version check updates the sync
time without changing files.

`getStalenessInfo()` reports the states below.

| State        | Time since last successful sync         |
| ------------ | --------------------------------------- |
| `fresh`      | Less than 24 hours                      |
| `stale`      | 24 hours through 7 days                 |
| `very_stale` | 7 days or more                          |
| `never`      | No successful sync on this installation |

The chat flow adds a warning to policy and price answers when local knowledge is
not fresh.

## Authentication and signing control different risks

Bearer authentication controls access to server routes. The signature, pinned
key, hash, length, and schema checks control installation on the device. TLS and
authentication do not replace signed-file checks.

The reference server uses a shared development bearer token and in-process rate
buckets. A production service needs its normal identity issuer, audience checks,
shared rate limiting, managed signing keys, durable logs, and monitoring.
