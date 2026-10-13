import {requiresOnline} from '../src/utils/onlineCheck';

describe('requiresOnline', () => {
  it('sends an account question to the API', () => {
    expect(requiresOnline('What is my balance?')).toBe(true);
    expect(requiresOnline('What is the outage status in my area?')).toBe(true);
    expect(requiresOnline('Can I check my usage?')).toBe(true);
  });

  it('answers a how-to question from the local records', () => {
    expect(requiresOnline('How do I check my balance?')).toBe(false);
    expect(requiresOnline('Steps to upgrade my plan')).toBe(false);
  });
});
