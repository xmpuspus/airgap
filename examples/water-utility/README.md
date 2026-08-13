# AquaFlow Water fixture

AquaFlow Water and AquaBot are fictional. This template tests offline answers for water quality,
leaks, billing, meters, conservation, drought rules, service status, and payment options.

## Run the fixture

```bash
npx create-airgap-bot aquaflow-help --template water-utility
cd aquaflow-help
npm install
npm run android
```

The app starts in deterministic `demo` mode. It does not report a real leak or download a model.

## Included data and actions

- 36 local documents across FAQ, services, troubleshooting, and payments
- 5 online action definitions for balances, leaks, service requests, quality tests, and connections
- 3 deterministic tools for outage reports, bill status, and meter-read scheduling
- 6 blocked-topic fixtures and water-safety refusal copy

[View the checked emulator recording](../../demo/industry-water.gif).

## Operator work before a pilot

- Replace every rate, service rule, water-quality instruction, payment method, and drought stage.
- Put leak, service, and meter routes behind account, location, priority, and duplicate checks.
- Keep boil-water and emergency copy available without a model and review it with water operations.
- Add stale-data rules for advisories, outages, restrictions, and restoration estimates.
- Review public-health, accessibility, privacy, retention, and local utility rules.

The sample does not issue a public-health advisory, dispatch a crew, calculate a real bill, or show
regulatory compliance.
