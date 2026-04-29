# Telecom Template

Customer support bot for a mobile telecommunications company.

## What's Included

- **105 KB entries** across 7 files
- Plans: prepaid, postpaid, fiber broadband (15 plans with PHP pricing)
- Promos: data bundles, combo packs, student offers
- Troubleshooting: no signal, slow data, WiFi, APN settings, SIM registration
- Stores: 10 service center locations
- Roaming: 3 zones (ASEAN, Asia-Pacific, Rest of World) with packages
- Payments: GCash, Maya, 7-Eleven, bank transfer, auto-debit, in-store

## Actions (require online)

| Action | Keywords | What it does |
|--------|----------|-------------|
| balance_check | "my balance", "my bill" | Check prepaid/postpaid balance |
| plan_change | "change my plan", "upgrade plan" | Submit plan change request |
| ticket_create | "create ticket", "file complaint" | Create support ticket |
| outage_check | "outage status", "service outage" | Check network outage status |
| account_action | "cancel my plan", "disconnect" | Account modifications |

## Deploy

```bash
cp examples/telco/airgap.config.json airgap.config.json
cp examples/telco/knowledge/*.json src/knowledge/
npm run build
```
