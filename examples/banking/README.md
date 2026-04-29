# Banking Template - PrimaBank

An Airgap configuration for a retail banking customer support chatbot.

## Brand

- **Company:** PrimaBank
- **Bot name:** PrimaAssist
- **Hotline:** 1-800-PRIMA
- **Locale:** USD / US English

## Actions (online-required)

| Action | Description |
|--------|-------------|
| `balance_check` | Check account balance |
| `card_block` | Block lost/stolen card |
| `transaction_dispute` | Dispute a transaction |
| `loan_application` | Apply for a loan |
| `account_transfer` | Transfer funds |
| `statement_request` | Request account statement |

## Knowledge Base Files

| File | Entries | Content |
|------|---------|---------|
| `faq.json` | 26 | Account opening, account types, interest rates, direct deposit, wire transfers, mobile deposit, cards, online banking, 2FA, statements, tax forms, beneficiaries, joint accounts, POA, dormant accounts, safe deposit boxes, notary services |
| `products.json` | 12 | Savings (basic, premium), checking (standard, student, business), personal loan, mortgage, auto loan, credit cards (standard, rewards, platinum), CD rates |
| `atm-locations.json` | 8 | Branch and ATM locations with addresses, hours, services, and coordinates |
| `security.json` | 5 | Phishing, stolen cards, fraud alerts, password security, mobile banking security |
| `troubleshooting.json` | 5 | Card declined, online banking locked, app issues, transfer failures, suspicious transactions |
| `fees.json` | 6 | Monthly maintenance, ATM fees, wire transfer fees, overdraft/NSF, returned checks, foreign transaction fees |

## Setup

1. Copy `airgap.config.json` and the `knowledge/` directory to your project root
2. Adjust brand details, theme colors, and hotline as needed
3. Build the app

## Notes

- The system prompt includes a directive to never provide financial advice or investment recommendations
- Currency is set to USD; change `locale.currency` for other currencies
- All KB entries use the `kbdoc-v1` schema
- Mock responses use USD amounts; update if changing locale
