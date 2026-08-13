# Fictional industry templates

Each template has a complete `airgap.config.json`, local knowledge documents, mock actions,
and safety fixtures for one support domain. The brands, policies, prices, locations, and account
responses use fictional data for tests and demonstrations.

Use these templates as starting points. No customer, integration owner, lawyer, or regulator
approved the sample content.

## Included templates

| Industry         | Template                                 | Documents | Recorded fixture                                             |
| ---------------- | ---------------------------------------- | --------- | ------------------------------------------------------------ |
| Airline          | [`airline/`](airline/)                   | 54        | [`industry-airline.gif`](../demo/industry-airline.gif)       |
| Banking          | [`banking/`](banking/)                   | 62        | [`industry-banking.gif`](../demo/industry-banking.gif)       |
| Electric utility | [`electric-utility/`](electric-utility/) | 53        | [`industry-electric.gif`](../demo/industry-electric.gif)     |
| Healthcare       | [`healthcare/`](healthcare/)             | 50        | [`industry-healthcare.gif`](../demo/industry-healthcare.gif) |
| Insurance        | [`insurance/`](insurance/)               | 47        | [`industry-insurance.gif`](../demo/industry-insurance.gif)   |
| Telecom          | [`telco/`](telco/)                       | 105       | [`industry-telco.gif`](../demo/industry-telco.gif)           |
| Water utility    | [`water-utility/`](water-utility/)       | 36        | [`industry-water.gif`](../demo/industry-water.gif)           |

The recordings use the deterministic `demo` provider on an Android emulator. They record fixture
loading and local answer behavior. Public GIF playback is four times faster than the kept source
video. The recordings do not record physical-device AI or customer-system integration.

## Create an app from a template

```bash
npx create-airgap-bot support-app --template banking
cd support-app
npm install
npm run android
```

The new app starts in `demo` mode, makes no model request, and uses the included documents.
To copy a fixture into this checkout, use these commands.

```bash
cp examples/banking/airgap.config.json airgap.config.json
cp examples/banking/knowledge/*.json src/knowledge/
node scripts/generate-manifest.js
npm run kb:validate
npm run journeys
```

## What works without operator systems

- local document search and citations
- deterministic document answers
- fictional quick replies and mock backend results
- set refusal copy and literal blocked-topic rules
- offline outbox interface and retry states.

## What needs operator systems and review

- real customer identity and account authorization
- current policies, prices, locations, eligibility, and emergency instructions
- action APIs with idempotency, audit, monitoring, and escalation
- privacy, retention, accessibility, language, security, and legal review
- physical-device checks for any enabled system or downloaded model.

For Android ML Kit Prompt API, Google bars clients directed to people under 18 and restricts
medical, legal, financial, and other professional advice. Review the current terms before enabling
that provider. The deterministic demo provider does not call ML Kit.

## Add another template

Create a directory with this shape.

```text
examples/your-industry/
├── README.md
├── airgap.config.json
└── knowledge/
    ├── faq.json
    ├── services.json
    └── troubleshooting.json
```

Then complete these steps.

1. Use only fictional data that a contributor can publish.
2. Keep every knowledge record on the `kbdoc-v1` schema.
3. Add local-information quick replies and separate online actions.
4. Add domain refusal and adversarial fixtures without claiming compliance.
5. Add the template slug to `create-airgap-bot`.
6. Run knowledge, journey, package, and recording checks.
7. record and inspect the new fixture.

See [`CUSTOMIZATION.md`](../CUSTOMIZATION.md) for the config contract and
[`docs/recordings.md`](../docs/recordings.md) for media evidence.
