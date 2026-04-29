# Electric Utility Template

Pre-built Airgap configuration for an electric utility company (PowerGrid Electric).

## What's Included

- `airgap.config.json` — Full bot configuration with yellow/amber theme, 5 actions, safety-focused prompts
- `knowledge/faq.json` — 26 FAQ entries covering meter reading, billing, rates, outages, solar, EV, safety, and more
- `knowledge/services.json` — 9 service/plan entries: Standard, Time-of-Use, Green Energy, Commercial, Solar Buyback, EV Charging, Senior Discount, LIHEAP/Care Rate, Budget Billing
- `knowledge/troubleshooting.json` — 6 troubleshooting guides: complete outage, partial outage, flickering lights, breaker tripping, high bill, electrical fire
- `knowledge/locations.json` — 6 service center locations
- `knowledge/payments.json` — 6 payment methods: online, AutoPay, phone, mail, in-person, third-party

## Quick Start

1. Copy this directory to the project root:
   ```bash
   cp -r examples/electric-utility/airgap.config.json ./airgap.config.json
   cp -r examples/electric-utility/knowledge/ ./knowledge/
   ```
2. Edit `airgap.config.json` to replace brand name, hotline, and theme colors with your own
3. Update knowledge base JSON files with your actual rates, service areas, and policies
4. Build the app

## Customization Notes

- **Safety prompts**: The system prompt includes instructions to direct customers to call 911 for electrical emergencies (downed lines, sparking panels). Adjust based on your emergency procedures.
- **Rate plans**: All rates use example values. Replace with your actual tariff schedules.
- **Locations**: Replace mock service center addresses with real ones.
- **Actions**: The `outage_report` action is particularly important for utilities. Connect it to your outage management system when switching from `mock` to `rest` backend.
