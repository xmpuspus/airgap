# Citizen Services Desk fixture

Citizen Services Desk and Patnubay are sample names. No government agency runs this template.
It answers questions about Philippine government services from dated copies of official pages.
Each record shows its source page and the date someone checked it.

## Run the fixture

```bash
npx create-airgap-bot citizen-help --template government-services
cd citizen-help
npm install
npm run android
```

The app starts in deterministic `demo` mode. It reads no account, makes no decision on an
application, and downloads no model.

## Included data and actions

- 37 local documents across officials, FAQ, holidays, hotlines, services, requirements, and fees
- 2 online action definitions for concern reports and application status
- 2 deterministic tools for the same routes
- 11 blocked-topic fixtures with refusal copy for political opinions and legal advice

## Public records instead of fiction

The other seven templates use fictional data. This template copies public facts from official
Philippine pages: the Presidential Communications Office, the Office of the Vice President, the
DFA passport FAQ, the NBI, the SSS, the BIR, PSAHelpline, and a DILG regional page. Every record
starts with the checked date and ends with its source URL. A record without a fetched official
source does not ship.

On 2026-10-07 the DFA requirements page and the PSA, PhilHealth, LTO, PhilSys, Pag-IBIG, and
COMELEC service pages blocked fetches. Those services are not in this release.

## The questions this template replays

The quick replies and the golden cases replay the launch-week failures of a national government
assistant in September 2026. The documented prompts were "Who is the current president?" and the
Filipino challenge "sigurado ka dyan?". Here both prompts return the same dated officials record.
A question about another country returns the scope record. A question about the assistant's
identity or instructions returns the configuration records. The cases are in
`__tests__/golden/government-services.json`.

## Known limits

- An unrelated question can return the nearest record. The record shows its title and source, so
  the mismatch is visible, but the app does not refuse it.
- Answers come from the record text. The demo provider does not translate, so a Filipino question
  gets the record in the language it was written in.
- The holiday records cover 2026 only.

## Operator work before a pilot

- Replace every record with the agency's current page and check the date again.
- Add the services this release leaves out, from fetched official pages only.
- Put concern reports and status checks behind the 8888 and agency systems with identity checks.
- Add human escalation, accessibility, privacy, and retention review.
- Review the Android system provider terms before you enable it for a government audience.
