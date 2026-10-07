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
