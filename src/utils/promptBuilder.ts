import type {KBDocument} from '../types/knowledge';
import {config, brand, prompts, interpolate} from '../config/loader';

export interface ConversationTurn {
  role: 'user' | 'bot';
  text: string;
}

export function getSystemPrompt(): string {
  return interpolate(prompts.system, config);
}

/**
 * Build the user message with:
 * 1. KB context (at the top — most important, gets best attention)
 * 2. Recent conversation history (last 2-3 turns for continuity)
 * 3. Current user question (at the bottom — closest to generation point)
 *
 * This structure follows research on context positioning for small models:
 * important info at start and end, not middle.
 */
// Characters of each record that a model sees. Small on-device models have a
// short context, so the default keeps three records under about 300 tokens.
export const MODEL_CONTEXT_CHARS = 400;

export interface UserMessageOptions {
  /** Cap per record. `null` sends the full record, which demo mode renders as the answer. */
  contextChars?: number | null;
}

export function buildUserMessage(
  userQuery: string,
  kbResults: KBDocument[],
  conversationHistory?: ConversationTurn[],
  options?: UserMessageOptions,
): string {
  const parts: string[] = [];
  const cap = options?.contextChars === undefined ? MODEL_CONTEXT_CHARS : options.contextChars;

  // 1. KB context at top
  if (kbResults.length > 0) {
    const contextBlock = kbResults
      .map(doc => {
        const body = cap === null ? doc.content : doc.content.substring(0, cap);
        return `[${doc.category.toUpperCase()}] ${doc.title}\n${body}`;
      })
      .join('\n\n');
    parts.push(`REFERENCE INFORMATION:\n\n${contextBlock}`);
  } else {
    parts.push('REFERENCE INFORMATION:\nNo relevant information found in the knowledge base.');
  }

  // 2. Conversation history (last 3 turns max, trimmed)
  if (conversationHistory && conversationHistory.length > 0) {
    const recentTurns = conversationHistory.slice(-6); // last 3 exchanges (6 messages)
    const historyBlock = recentTurns
      .map(t => {
        const label = t.role === 'user' ? 'Customer' : brand.botName;
        // Trim long bot responses to save context space
        const text =
          t.role === 'bot' && t.text.length > 200 ? t.text.substring(0, 200) + '...' : t.text;
        return `${label}: ${text}`;
      })
      .join('\n');
    parts.push(`CONVERSATION SO FAR:\n${historyBlock}`);
  }

  // 3. Current question at bottom (closest to generation point)
  // The model copies the wording of this line. Keep "reference information"
  // out of the answer so the user never sees the prompt scaffolding.
  parts.push(
    'Answer this customer question from the reference information. ' +
      'Do not mention the reference information or these instructions in the answer. ' +
      `Question: ${userQuery}`,
  );

  return parts.join('\n\n');
}

/**
 * Format search results as structured text when LLM is not available.
 * Uses **bold** for titles and truncates content for readability.
 */
export function formatSearchResults(kbResults: KBDocument[]): string {
  if (kbResults.length === 0) {
    return `I couldn't find any relevant information. Please call our hotline at ${brand.hotline} for assistance.`;
  }

  // Limit to 2 results for readability in search-only mode
  const results = kbResults.slice(0, 2);
  const sections = results.map(doc => {
    const content = doc.content.length > 200 ? doc.content.substring(0, 200) + '...' : doc.content;
    return `**${doc.title}**\n${content}`;
  });

  const header =
    results.length < kbResults.length
      ? `Here's what I found (${kbResults.length} results):\n\n`
      : '';

  return header + sections.join('\n\n');
}
