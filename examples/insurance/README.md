# ShieldGuard Insurance fixture

ShieldGuard Insurance and ShieldBot are fictional. This template tests offline answers for claims,
coverage, premiums, agents, products, and common policy problems.

## Run the fixture

```bash
npx create-airgap-bot shieldguard-help --template insurance
cd shieldguard-help
npm install
npm run android
```

The app starts in deterministic `demo` mode. It does not access a policy or download a model.

## Included data and actions

- 47 local documents across FAQ, products, troubleshooting, and agents
- 5 online action definitions for claims, policy changes, premiums, roadside help, and agents
- 2 deterministic tools for policy status and claim filing
- 6 blocked-topic fixtures and coverage refusal copy

[View the checked emulator recording](../../demo/industry-insurance.gif).

## Operator work before a pilot

- Replace every product, premium, coverage example, address, agent, and claim instruction.
- Put policy reads and claim changes behind identity, authorization, consent, and audit rules.
- Do not let model text promise coverage, liability, payment, or claim outcome.
- Add urgent roadside, catastrophe, complaint, fraud, and human escalation paths.
- Review licensing, disclosure, privacy, retention, accessibility, and local insurance rules.

The sample cannot check coverage, bind a policy, settle a claim, or show compliance.
