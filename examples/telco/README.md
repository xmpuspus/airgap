# ACME Telecom fixture

ACME Telecom and Alice are fictional. This is the default template and tests offline answers for
plans, promotions, roaming, SIM setup, stores, payments, and network troubleshooting.

## Run the fixture

```bash
npx create-airgap-bot acme-help --template telco
cd acme-help
npm install
npm run android
```

The app starts in deterministic `demo` mode. It does not access an account or download a model.

## Included data and actions

- 105 local documents across FAQ, plans, promotions, roaming, stores, payments, and troubleshooting
- 5 online action definitions for balance, plan changes, tickets, outages, and account changes
- 5 deterministic tools for balance, outage, ticket, add-on, and callback routes
- 7 blocked-topic fixtures and account-action refusal copy

[View the checked emulator recording](../../demo/industry-telco.gif).

## Operator work before a pilot

- Replace every plan, price, promotion, address, roaming rate, and support instruction.
- Connect account, billing, network, order, and ticket systems behind an operator service.
- Add identity and authorization for balance, plan, SIM, and account work.
- Define stale-data rules for promotions, outages, roaming, eligibility, and store hours.
- Add fraud, child-safety, accessibility, privacy, complaint, and human escalation review.

The sample cannot read a real balance, change a plan, activate service, or report a live outage.
