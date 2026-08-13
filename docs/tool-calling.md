# Deterministic tools and customer actions

Airgap chooses backend tools with set keyword rules. A model does not emit a tool name,
tool input, or authorization decision. This keeps account actions separate from answer wording and
makes the action path testable without a model.

## Tool choice happens before generation

`processMessage()` follows this order.

1. Check the safety blocklist.
2. Match the first listed whole-word tool keyword.
3. Run the known backend method, queue it if policy permits, or fail closed.
4. Pass a successful structured result to the active answer provider for wording.
5. Check sourced amounts and dates before display.

If no answer provider is ready, Airgap displays the tool's prepared summary. It does not lose the
backend result because a model is absent.

## Tool definition

```json
{
  "name": "checkBalance",
  "description": "Check the current account balance",
  "keywords": ["my balance", "bill amount", "data usage"],
  "offlineQueueEligible": false,
  "stateChanging": false,
  "vertical": "telco",
  "backendMethod": "checkBalance"
}
```

| Field                  | Meaning                                                         |
| ---------------------- | --------------------------------------------------------------- |
| `name`                 | Stable audit and outbox identifier                              |
| `description`          | Human label for status and receipts                             |
| `keywords`             | Whole-word phrases. The first listed match wins                 |
| `offlineQueueEligible` | Allows a state-changing call into the outbox when offline       |
| `stateChanging`        | Marks a call that can change remote state                       |
| `vertical`             | Optional fixture or diagnostics group                           |
| `backendMethod`        | Method on `BackendConnector`. The default is `name`             |
| `refusalReason`        | Optional safe refusal category                                  |
| `parameters`           | Documentation schema. The current router does not model-fill it |

Place specific keywords before broad ones. Add tests for similar phrases and words that must not
match. The router uses whole-word, case-insensitive regular expressions.

## Backend methods

The shipped connectors expose these typed methods.

| Method                                   | Purpose                    |
| ---------------------------------------- | -------------------------- |
| `checkBalance(accountId)`                | Read an account summary    |
| `changePlan(accountId, planId, options)` | Request a plan change      |
| `createTicket(description, options)`     | Create a support ticket    |
| `checkOutage(location, options)`         | Read service status        |
| `executeAction(type, params, options)`   | Operator-defined extension |

The mock connector returns fictional development data. The REST connector sends requests to an
operator service and adds an idempotency key when the outbox supplies one.

## Offline behavior

| State                                   | Result                                             |
| --------------------------------------- | -------------------------------------------------- |
| Read-only tool while online             | Call backend and display the result                |
| State-changing, queue eligible, offline | Store in encrypted outbox and show a receipt       |
| Tool marked not queue eligible, offline | Show a network-needed failure                      |
| Backend call fails                      | Show a retry or hotline response without fake data |

Queue eligibility is an operator safety decision. Do not queue work whose price, consent,
identity, or urgency can change while the device is offline.

## Add a tool

1. Add the definition under `tools` in `airgap.config.json`.
2. Add or map the method in `BackendConnector`, `MockBackendConnector`, and the production adapter.
3. Add keyword, near-match, offline, and backend-failure tests.
4. Add an industry journey with the expected `expectTool` value.
5. Check the receipt, outbox, retry, removal, and answer provenance in the app.
6. Document the server authorization and idempotency rule.

Run these checks.

```bash
npm test -- --runInBand __tests__/tool-router.test.ts __tests__/offline-queue.test.ts
npm run journeys
```

See [`enterprise-integration.md`](enterprise-integration.md) for the server boundary and
[`safety-layer.md`](safety-layer.md) for the answer checks.
