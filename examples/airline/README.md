# SkyPeak Airlines fixture

SkyPeak Airlines and SkyBot are fictional. This template tests offline answers for baggage,
check-in, routes, services, lounges, loyalty, and common booking problems.

## Run the fixture

```bash
npx create-airgap-bot skypeak-help --template airline
cd skypeak-help
npm install
npm run android
```

The app starts in deterministic `demo` mode. It does not download a model or contact an airline.

## Included data and actions

- 54 local documents across FAQ, services, troubleshooting, routes, and lounges
- 6 online action definitions for flight status, booking changes, lost baggage, upgrades, refunds,
  and complaints
- 2 deterministic tools for flight-status lookup and callback requests
- 8 blocked-topic fixtures and airline-specific refusal copy

[View the checked emulator recording](../../demo/industry-airline.gif).

## Operator work before a pilot

- Replace every route, fare, policy, airport service, and lounge record.
- Connect live flight status, booking, refund, and baggage systems behind authenticated APIs.
- Add account and booking authorization for every customer-specific action.
- Add disruption, accessibility, dangerous-goods, child-travel, and escalation procedures.
- Test offline behavior when a schedule or disruption notice becomes stale.

The sample can explain fictional policy. It cannot read a live flight, change a booking, or
approve a refund without an operator integration.
