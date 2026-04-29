# Insurance Template - ShieldGuard Insurance

An Airgap configuration for an insurance company customer support chatbot.

## Brand

- **Company:** ShieldGuard Insurance
- **Bot name:** ShieldBot
- **Hotline:** 1-800-SHIELD
- **Theme:** Navy/gold (#1E3A5F / #D4A843) for trust and security
- **Locale:** USD / US English

## Actions (online-required)

| Action | Description |
|--------|-------------|
| `claim_filing` | File an insurance claim |
| `policy_change` | Request policy change |
| `premium_inquiry` | Check premium or billing |
| `roadside_assistance` | Request roadside assistance |
| `agent_connect` | Connect with an agent |

## Knowledge Base Files

| File | Entries | Content |
|------|---------|---------|
| `faq.json` | 27 | Claims process, accident procedures, documentation, renewals, payments, cancellation, adding drivers, coverage types (liability, collision, comprehensive, UM/UIM), deductibles, rental coverage, SR-22, discounts (multi-policy, good driver, student), home inventory, flood insurance, umbrella policies, life insurance types, beneficiaries, policy transfers, proof of insurance, gap insurance, diminished value |
| `products.json` | 10 | Auto (basic, standard, premium), homeowners, renters, term life, supplemental health, umbrella, motorcycle, commercial auto |
| `troubleshooting.json` | 4 | Claim denied, premium increased, ID card not showing, documents not loading |
| `agents.json` | 6 | Agent offices in Hartford CT, Chicago IL, Dallas TX, Atlanta GA, Scottsdale AZ, Bellevue WA with addresses, specialties, hours, and agents |

## Setup

1. Copy `airgap.config.json` and the `knowledge/` directory to your project root
2. Adjust brand details, theme colors, and hotline as needed
3. Build the app

## Notes

- The system prompt includes a directive to never guarantee coverage or claim outcomes and always refer to specific policy terms
- Currency is set to USD; change `locale.currency` for other currencies
- All KB entries use the `kbdoc-v1` schema
- Mock responses use sample data; update for production
