import type {QuickReply} from '../types/chat';

interface SuggestedReplyState {
  hasUserMessage: boolean;
  isTyping: boolean;
  suggestedReplies?: QuickReply[];
}

export function shouldShowSuggestedReplies({
  hasUserMessage,
  isTyping,
  suggestedReplies,
}: SuggestedReplyState): boolean {
  return hasUserMessage && !isTyping && Boolean(suggestedReplies?.length);
}
