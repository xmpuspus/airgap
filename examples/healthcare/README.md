# CareFirst Medical fixture

CareFirst Medical and CareBot are fictional. This template tests offline administrative answers
for appointments, departments, locations, insurance, billing, and patient-portal problems.

## Run the fixture

```bash
npx create-airgap-bot carefirst-help --template healthcare
cd carefirst-help
npm install
npm run android
```

The app starts in deterministic `demo` mode. It does not access a patient record, make a diagnosis,
or download a model.

## Included data and actions

- 50 local documents across FAQ, services, locations, insurance, and troubleshooting
- 5 online action definitions for appointments, refills, test results, billing, and referrals
- 2 deterministic tools for appointment requests and medication lookup
- 10 blocked-topic fixtures and medical-advice refusal copy

[View the checked emulator recording](../../demo/industry-healthcare.gif).

## Operator work before a pilot

- Limit the product to reviewed administrative support unless clinical governance approves more.
- Replace every provider, service, location, insurance, billing, and emergency instruction.
- Put patient data and actions behind healthcare identity, consent, authorization, and audit rules.
- Add emergency escalation that works without a model and does not delay urgent care.
- Complete privacy, accessibility, retention, medical-device, and local healthcare review.

Google's ML Kit GenAI terms prohibit clinical practice and medical advice and prohibit clients
directed to people under 18. Do not enable the Android system provider for a conflicting audience
or use. The sample does not claim HIPAA or other compliance.
