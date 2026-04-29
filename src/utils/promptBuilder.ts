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
export function buildUserMessage(
  userQuery: string,
  kbResults: KBDocument[],
  conversationHistory?: ConversationTurn[],
): string {
  const parts: string[] = [];

  // 1. KB context at top
  if (kbResults.length > 0) {
    const contextBlock = kbResults
      .map(
        doc =>
          `[${doc.category.toUpperCase()}] ${doc.title}\n${doc.content.substring(0, 400)}`,
      )
      .join('\n\n');
    parts.push(`REFERENCE INFORMATION:\n\n${contextBlock}`);
  } else {
    parts.push(
      'REFERENCE INFORMATION:\nNo relevant information found in the knowledge base.',
    );
  }

  // 2. Conversation history (last 3 turns max, trimmed)
  if (conversationHistory && conversationHistory.length > 0) {
    const recentTurns = conversationHistory.slice(-6); // last 3 exchanges (6 messages)
    const historyBlock = recentTurns
      .map(t => {
        const label = t.role === 'user' ? 'Customer' : brand.botName;
        // Trim long bot responses to save context space
        const text =
          t.role === 'bot' && t.text.length > 200
            ? t.text.substring(0, 200) + '...'
            : t.text;
        return `${label}: ${text}`;
      })
      .join('\n');
    parts.push(`CONVERSATION SO FAR:\n${historyBlock}`);
  }

  // 3. Current question at bottom (closest to generation point)
  parts.push(
    `Based ONLY on the reference information above, answer this customer question: ${userQuery}`,
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
    const content =
      doc.content.length > 200
        ? doc.content.substring(0, 200) + '...'
        : doc.content;
    return `**${doc.title}**\n${content}`;
  });

  const header = results.length < kbResults.length
    ? `Here's what I found (${kbResults.length} results):\n\n`
    : '';

  return header + sections.join('\n\n');
}
