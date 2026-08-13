# PrimaBank fixture

PrimaBank and PrimaAssist are fictional. This template tests offline answers for retail accounts,
cards, fees, ATMs, security, loans, and common banking problems.

## Run the fixture

```bash
npx create-airgap-bot prima-help --template banking
cd prima-help
npm install
npm run android
```

The app starts in deterministic `demo` mode. It does not access an account or download a model.

## Included data and actions

- 62 local documents across FAQ, products, ATM locations, security, troubleshooting, and fees
- 6 online action definitions for balance, card block, disputes, loans, transfers, and statements
- 3 deterministic tools for balance, recent transactions, and disputes
- 8 blocked-topic fixtures and financial-advice refusal copy

[View the checked emulator recording](../../demo/industry-banking.gif).

## Operator work before a pilot

- Replace every product, rate, fee, address, eligibility rule, and security instruction.
- Put account reads and transfers behind strong identity, authorization, fraud, and audit controls.
- Never queue transfers or other time-sensitive financial instructions for later execution.
- Review PCI, privacy, consumer-protection, recordkeeping, accessibility, and local banking rules.
- Add human escalation for fraud, stolen cards, disputes, hardship, and complaints.

The sample does not give financial advice, move money, block a real card, or show compliance.
