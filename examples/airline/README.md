# SkyPeak Airlines — Airgap Template

Offline-first customer support chatbot for a full-service airline.

## Quick Start

1. Copy this directory into your Airgap project
2. Point your app config to `airgap.config.json`
3. The model (Gemma 4 E2B Q3_K_S, ~2.4 GB) downloads on first launch

## What's Included

- `airgap.config.json` — Bot configuration, branding, prompts, and actions
- `knowledge/faq.json` — 27 entries covering baggage, check-in, cancellations, loyalty, and more
- `knowledge/services.json` — 8 entries for cabin classes, loyalty tiers, lounge access, and insurance
- `knowledge/troubleshooting.json` — 5 entries for common app and booking issues
- `knowledge/routes.json` — 8 popular routes with flight times and fares
- `knowledge/lounges.json` — 6 airport lounge locations with amenities

## Actions (require online)

| Action | Description |
|--------|-------------|
| `flight_status` | Check real-time flight status |
| `booking_change` | Modify an existing booking |
| `lost_baggage` | Report lost or delayed baggage |
| `upgrade_request` | Request a cabin upgrade |
| `refund_request` | Submit a refund request |
| `complaint` | File a service complaint |

## Customization

- Edit `airgap.config.json` to change branding, colors, and prompts
- Add or modify JSON files in `knowledge/` to update the knowledge base
- All KB entries follow the `kbdoc-v1` schema
