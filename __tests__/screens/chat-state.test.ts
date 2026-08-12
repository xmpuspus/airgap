import {shouldShowSuggestedReplies} from '../../src/screens/chatState';

describe('chat presentation state', () => {
  const replies = [{title: 'Check plans', value: 'What plans are available?'}];

  it('does not duplicate replies already rendered by the empty state', () => {
    expect(
      shouldShowSuggestedReplies({
        hasUserMessage: false,
        isTyping: false,
        suggestedReplies: replies,
      }),
    ).toBe(false);
  });

  it('shows follow-up replies after the user has sent a message', () => {
    expect(
      shouldShowSuggestedReplies({
        hasUserMessage: true,
        isTyping: false,
        suggestedReplies: replies,
      }),
    ).toBe(true);
  });

  it('hides replies while a response is being generated', () => {
    expect(
      shouldShowSuggestedReplies({
        hasUserMessage: true,
        isTyping: true,
        suggestedReplies: replies,
      }),
    ).toBe(false);
  });
});
