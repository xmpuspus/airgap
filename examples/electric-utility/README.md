# PowerGrid Electric fixture

PowerGrid Electric and PowerBot are fictional. This template tests offline answers for outages,
billing, rates, meters, electrical safety, solar, electric vehicles, and payment options.

## Run the fixture

```bash
npx create-airgap-bot powergrid-help --template electric-utility
cd powergrid-help
npm install
npm run android
```

The app starts in deterministic `demo` mode. It does not report a real outage or download a model.

## Included data and actions

- 53 local documents across FAQ, services, troubleshooting, locations, and payments
- 5 online action definitions for balances, outages, service requests, payments, and connections
- 3 deterministic tools for outage reports, bill status, and meter-read scheduling
- 6 blocked-topic fixtures and emergency refusal copy

[View the checked emulator recording](../../demo/industry-electric.gif).

## Operator work before a pilot

- Replace every tariff, service area, address, assistance rule, and restoration estimate.
- Put outage and work-order routes behind location, account, priority, and duplicate checks.
- Keep emergency copy visible without a model and review it with safety operations.
- Add stale-data rules for outages, restoration times, planned work, and severe weather.
- Test screen readers, poor connectivity, battery limits, and field-device conditions.

The sample does not dispatch crews, read a live outage, calculate a real bill, or replace emergency
services.
