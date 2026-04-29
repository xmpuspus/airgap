# CareFirst Medical — Airgap Template

Offline-first patient services chatbot for a healthcare provider.

## Quick Start

1. Copy this directory into your Airgap project
2. Point your app config to `airgap.config.json`
3. The model (Gemma 4 E2B Q3_K_S, ~2.4 GB) downloads on first launch

## What's Included

- `airgap.config.json` — Bot configuration, branding, prompts, and actions
- `knowledge/faq.json` — 26 entries covering appointments, portal, billing, privacy, and more
- `knowledge/services.json` — 8 departments: primary care, urgent care, pediatrics, OB/GYN, dental, vision, mental health, pharmacy
- `knowledge/locations.json` — 6 clinic locations with hours, specialties, and contact info
- `knowledge/insurance.json` — 6 entries covering accepted plans, Medicare, Medicaid, copays, and prior authorization
- `knowledge/troubleshooting.json` — 4 entries for common patient issues

## Actions (require online)

| Action | Description |
|--------|-------------|
| `appointment_booking` | Schedule an appointment |
| `prescription_refill` | Request a prescription refill |
| `test_results` | Check lab/test results |
| `billing_inquiry` | Ask about bills and payments |
| `referral_request` | Request a specialist referral |

## Safety

The system prompt includes a mandatory medical advice disclaimer. CareBot will never provide diagnoses or treatment recommendations and always directs patients to consult a healthcare professional.

## Customization

- Edit `airgap.config.json` to change branding, colors, and prompts
- Add or modify JSON files in `knowledge/` to update the knowledge base
- All KB entries follow the `kbdoc-v1` schema
