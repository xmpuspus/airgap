import {refusalLabelFor} from '../../src/components/chat/messagePresentation';
import {stripSourceSentences} from '../../src/utils/sourceLine';

const PRESIDENT_URL =
  'https://pco.gov.ph/presidential-speech/fifth-state-of-the-nation-address-sona-of-his-excellency-ferdinand-r-marcos-jr-president-of-the-philippines-to-the-congress-of-the-philippines/';

describe('stripSourceSentences', () => {
  test('moves a cited source sentence out of the bubble text', () => {
    const text = `The PCO transcript dated 27 July 2026 identifies Ferdinand R. Marcos Jr. as President of the Philippines. Source: ${PRESIDENT_URL} (checked 2026-10-09).`;
    expect(stripSourceSentences(text, [PRESIDENT_URL])).toBe(
      'The PCO transcript dated 27 July 2026 identifies Ferdinand R. Marcos Jr. as President of the Philippines.',
    );
  });

  test('keeps the paragraphs around a record inside a longer reply', () => {
    const url = 'https://pco.gov.ph/news_releases/president-marcos-confirms-changes-in-cabinet/';
    const text = `I don't explain reasons.\n\nThe official record I have:\n\nThe release gives no reason. Source: ${url} (checked 2026-10-12).`;
    expect(stripSourceSentences(text, [url])).toBe(
      "I don't explain reasons.\n\nThe official record I have:\n\nThe release gives no reason.",
    );
  });

  test('keeps a link that no cited record carries', () => {
    const text = 'Book only at the site. Source: https://example.org/other (checked 2026-10-09).';
    expect(stripSourceSentences(text, [PRESIDENT_URL])).toBe(text);
  });
});

describe('refusalLabelFor', () => {
  test.each([
    ['no_commentary', 'Record only'],
    ['no_supported_record', 'No record'],
    ['low_confidence', 'No record'],
    ['needs_verification', 'Needs a check'],
    ['conflicting_sources', 'Sources disagree'],
    ['historical_only', 'Past record'],
    ['prompt_probe', 'Not answered'],
    ['blocked_topic', 'Not answered'],
    ['not_legal_advice', 'Not answered'],
    [undefined, 'Not answered'],
  ])('labels %s as %s', (reason, label) => {
    expect(refusalLabelFor(reason)).toBe(label);
  });

  test('never calls a refusal a disclaimer', () => {
    for (const reason of ['no_commentary', 'prompt_probe', 'no_supported_record', 'other']) {
      expect(refusalLabelFor(reason).toLowerCase()).not.toContain('disclaimer');
    }
  });
});
