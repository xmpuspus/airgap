# Industry Templates

Ready-to-deploy configurations and knowledge bases for different industries. Each template includes a complete `airgap.config.json` and a `knowledge/` directory with realistic KB entries.

## Available Templates

| Industry | Template | KB Entries | Brand | Key Features |
|----------|----------|-----------|-------|-------------|
| **Telecom** | [`telco/`](telco/) | 105 | ACME Telecom | Plans, promos, roaming, SIM/eSIM, stores, troubleshooting |
| **Electric Utility** | [`electric-utility/`](electric-utility/) | 50+ | PowerGrid Electric | Outages, billing, rate plans, solar, energy efficiency |
| **Water Utility** | [`water-utility/`](water-utility/) | 35+ | AquaFlow Water | Leaks, water quality, conservation, billing |
| **Airline** | [`airline/`](airline/) | 50+ | SkyPeak Airlines | Baggage, check-in, flights, loyalty, lounges |
| **Banking** | [`banking/`](banking/) | 55+ | PrimaBank | Accounts, loans, cards, ATMs, security |
| **Insurance** | [`insurance/`](insurance/) | 45+ | ShieldGuard Insurance | Claims, coverage, premiums, agents |
| **Healthcare** | [`healthcare/`](healthcare/) | 50+ | CareFirst Medical | Appointments, prescriptions, insurance, clinics |

## How to Use

### 1. Pick a template

```bash
cp examples/banking/airgap.config.json airgap.config.json
cp examples/banking/knowledge/*.json src/knowledge/
```

### 2. Update the manifest

Edit `src/knowledge/manifest.ts` to list your KB files:

```typescript
import faq from './faq.json';
import products from './products.json';
import locations from './atm-locations.json';

export const knowledgeFiles = { faq, products, locations };
```

### 3. Customize the brand

Edit `airgap.config.json` — change the brand name, colors, hotline, prompts. No code changes needed.

### 4. Build and deploy

```bash
npx react-native run-android
```

## Creating Your Own Template

Every template needs:

```
your-industry/
├── airgap.config.json        # Brand, theme, model, prompts, actions
├── knowledge/
│   ├── faq.json              # General FAQ (20+ entries recommended)
│   ├── products.json         # Products/services catalog
│   ├── troubleshooting.json  # Common issue guides
│   ├── locations.json        # Branch/store/office locations
│   └── ...                   # Additional category files
└── README.md
```

### KB Document Schema (kbdoc-v1)

Every entry follows the same schema regardless of industry:

```json
{
  "id": "unique-identifier",
  "category": "faq",
  "title": "Short title (indexed, boosted 3x in search)",
  "content": "Detailed answer. 2-4 sentences minimum.",
  "keywords": ["search", "terms", "boosted 2x"],
  "tags": ["for", "filtering"],
  "metadata": {}
}
```

## Industry-Specific Compliance

| Industry | Requirements | System Prompt Must Include |
|----------|-------------|---------------------------|
| Healthcare | HIPAA | "Never diagnose or recommend treatment" |
| Banking | PCI-DSS, SOC 2 | "Never provide financial advice" |
| Insurance | State regulations | "Never guarantee coverage or claim outcomes" |
| Airline | DOT regulations | "Never confirm booking changes without verification" |
| Utilities | PUC regulations | "Always prioritize safety messaging for outages" |
