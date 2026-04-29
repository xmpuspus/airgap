# Water Utility Template

Pre-built Airgap configuration for a water utility company (AquaFlow Water).

## What's Included

- `airgap.config.json` — Full bot configuration with blue/teal theme, 5 actions, water safety prompts
- `knowledge/faq.json` — 21 FAQ entries covering water quality, billing, meters, pressure, conservation, drought, lead, sewer, and more
- `knowledge/services.json` — 6 service entries: Residential (tiered rates), Commercial, Irrigation, Fire Line, Conservation Rebates, Low-Income Assistance
- `knowledge/troubleshooting.json` — 4 troubleshooting guides: no water, low pressure, discolored water, high bill / leak detection
- `knowledge/payments.json` — 5 payment methods: online, AutoPay, phone, mail, in-person

## Quick Start

1. Copy this directory to the project root:
   ```bash
   cp -r examples/water-utility/airgap.config.json ./airgap.config.json
   cp -r examples/water-utility/knowledge/ ./knowledge/
   ```
2. Edit `airgap.config.json` to replace brand name, hotline, and theme colors with your own
3. Update knowledge base JSON files with your actual rates, service areas, and policies
4. Build the app

## Customization Notes

- **Boil water advisories**: The system prompt includes instructions to always stress boiling water for 1 minute during advisories. Keep this safety guidance.
- **Tiered rates**: Residential water uses a 3-tier conservation rate structure. Replace with your actual tariff.
- **Sewer charges**: The FAQ explains sewer charges as 90% of water usage. Adjust to match your municipality's formula.
- **Drought stages**: The FAQ includes a 4-stage drought restriction framework. Customize stages and penalties to match your local regulations.
- **Actions**: The `leak_report` action is critical for water utilities. Connect it to your work order management system when switching from `mock` to `rest` backend.
