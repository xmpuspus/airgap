import {describeSourceMetadata} from '../../src/components/chat/sourceMetadata';

const now = new Date('2026-10-19T08:00:00Z');

test('reads publisher, URL, and checked date from document metadata', () => {
  expect(
    describeSourceMetadata(
      {
        source: 'https://www.officialgazette.gov.ph/about/gov/exec/',
        publisher: 'Official Gazette',
        asOf: '2026-10-07',
      },
      now,
    ),
  ).toEqual({
    publisher: 'Official Gazette',
    url: 'https://www.officialgazette.gov.ph/about/gov/exec/',
    checkedLabel: 'Checked 2026-10-07, 12 days ago',
    reviewOverdue: false,
  });
});

test('falls back to the host name when no publisher is given', () => {
  expect(
    describeSourceMetadata({source: 'https://dfa.gov.ph/passport', asOf: '2026-10-19'}, now),
  ).toEqual({
    publisher: 'dfa.gov.ph',
    url: 'https://dfa.gov.ph/passport',
    checkedLabel: 'Checked 2026-10-19, today',
    reviewOverdue: false,
  });
});

test('counts days on the device calendar, not the UTC one', () => {
  // 17:35 UTC on 12 October is 01:35 on 13 October in Manila (UTC+8).
  const lateUtc = new Date('2026-10-12T17:35:00Z');
  const manila = 8 * 60;
  expect(
    describeSourceMetadata({source: 'https://pco.gov.ph/a', asOf: '2026-10-12'}, lateUtc, manila)
      ?.checkedLabel,
  ).toBe('Checked 2026-10-12, 1 day ago');
  expect(
    describeSourceMetadata({source: 'https://pco.gov.ph/a', asOf: '2026-10-09'}, lateUtc, manila)
      ?.checkedLabel,
  ).toBe('Checked 2026-10-09, 4 days ago');
  expect(
    describeSourceMetadata({source: 'https://pco.gov.ph/a', asOf: '2026-10-12'}, lateUtc, 0)
      ?.checkedLabel,
  ).toBe('Checked 2026-10-12, today');
});

test('flags a snapshot whose review date has passed', () => {
  expect(
    describeSourceMetadata(
      {source: 'https://psa.gov.ph', asOf: '2026-01-05', reviewBy: '2026-07-05'},
      now,
    ),
  ).toMatchObject({reviewOverdue: true, checkedLabel: 'Checked 2026-01-05, 287 days ago'});
});

test('returns null when the document has no source metadata', () => {
  expect(describeSourceMetadata({}, now)).toBeNull();
  expect(describeSourceMetadata(undefined, now)).toBeNull();
  expect(describeSourceMetadata({score: 3.2}, now)).toBeNull();
});
