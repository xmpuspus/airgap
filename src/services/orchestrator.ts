import {matchesKnowledgeKeyword, searchKB} from './searchService';
import {routeGeneration, generationAvailable, getMode} from './llmRouter';
import {ensureSourceLine} from '../utils/sourceLine';
import {InferenceProviderError} from './inference/providerResolver';
import type {MessageAudit} from '../types/chat';
import {offlineQueue} from './offlineQueue';
import {connectivityService} from './connectivityService';
import {requiresOnline, getOnlineActionType} from '../utils/onlineCheck';
import {
  getSystemPrompt,
  buildUserMessage,
  formatSearchResults,
  ConversationTurn,
  MODEL_CONTEXT_CHARS,
} from '../utils/promptBuilder';
import {isFollowUp, expandQuery} from '../utils/followUpDetector';
import {formatDeviceClock, isClockQuestion} from '../utils/deviceClock';
import {isDoubtCheck} from '../utils/doubtCheck';
import {
  config,
  brand,
  modelConfig,
  prompts,
  quickReplies,
  actions,
  interpolate,
} from '../config/loader';
import {getBackendConnector} from './backendConnector';
import {logger} from './logger';
import type {QueuedAction} from '../types/chat';
import type {QuickReply} from '../types/chat';
import type {InferenceProviderId} from './inference/types';
import {conversationStore} from './conversationStore';
import {
  checkBlocklist,
  checkConfidence,
  createGroundedTokenGate,
  validateAnswer,
  refusalFor,
} from './safetyLayer';
import {findToolForQuery, executeTool, formatToolResultForLLM} from './tools';
import {getDegradedModePrefix, getStalenessInfo} from './syncService';
import {recordTurn} from './telemetry';
import {
  recordTurn as metricsRecordTurn,
  recordZeroHit,
  recordLowConfidence,
  recordToolCallResult,
  recordLlmLatency,
  recordToolLatency,
} from './metrics';

export interface OrchestratorResponse {
  text: string;
  source: 'llm' | 'search' | 'system' | 'queue' | 'tool' | 'refusal';
  suggestedReplies?: QuickReply[];
  queuedActionId?: string;
  /** Audit metadata — consumed by the observability dev panel and the BFF telemetry endpoint. */
  audit?: {
    kbDocIds: string[];
    confidence: number;
    toolName?: string;
    refusalReason?: string;
    groundingIssues?: string[];
    providerId?: InferenceProviderId;
    modelIdentity?: string;
    providerFailure?: MessageAudit['providerFailure'];
  };
}

// Conversation history is loaded after secure storage opens.
let conversationHistory: ConversationTurn[] = [];
let historyLoaded = false;

function loadHistory(): ConversationTurn[] {
  try {
    return conversationStore.load().turns;
  } catch {
    logger.warn('orchestrator', 'Failed to load conversation history from MMKV');
  }
  return [];
}

function ensureHistoryLoaded(): void {
  if (historyLoaded) return;
  conversationHistory = loadHistory();
  historyLoaded = true;
}

function saveHistory() {
  try {
    conversationStore.saveTurns(conversationHistory);
  } catch {
    logger.warn('orchestrator', 'Failed to save conversation history to MMKV');
  }
}

export function getConversationHistory(): ConversationTurn[] {
  ensureHistoryLoaded();
  return conversationHistory;
}

// The last answer that came from records, so a doubt check can repeat it.
let lastRecordAnswer: {text: string; docIds: string[]} | null = null;

export function clearConversationHistory(): void {
  ensureHistoryLoaded();
  conversationHistory = [];
  lastRecordAnswer = null;
  conversationStore.clear();
}

export interface ProcessMessageHooks {
  onToken?: (token: string) => void;
  onToolStart?: (toolName: string) => void;
  onToolEnd?: (toolName: string, ok: boolean) => void;
}

export async function processMessage(
  userText: string,
  onTokenOrHooks?: ((token: string) => void) | ProcessMessageHooks,
): Promise<OrchestratorResponse> {
  ensureHistoryLoaded();
  const hooks: ProcessMessageHooks =
    typeof onTokenOrHooks === 'function' ? {onToken: onTokenOrHooks} : onTokenOrHooks ?? {};
  const response = await processMessageInner(userText, hooks);
  return finalizeResponse(userText, response);
}

async function processMessageInner(
  userText: string,
  hooks: ProcessMessageHooks,
): Promise<OrchestratorResponse> {
  const onToken = hooks.onToken;
  const text = userText.trim();

  // 1. Pre-flight safety: topic blocklist. Fail-closed BEFORE search or LLM.
  const block = checkBlocklist(text);
  if (block.blocked && block.reason) {
    const refusalText = refusalFor(block.reason);
    addToHistory('user', text);
    addToHistory('bot', refusalText);
    return {
      text: refusalText,
      source: 'refusal',
      audit: {
        kbDocIds: [],
        confidence: 0,
        refusalReason: block.reason,
      },
    };
  }

  // 2. Handle greetings
  if (isGreeting(text) && conversationHistory.length === 0) {
    const response = `Hi there! I'm your ${brand.name} support assistant. How can I help you today?`;
    addToHistory('user', text);
    addToHistory('bot', response);
    return {
      text: response,
      source: 'system',
      suggestedReplies: quickReplies as QuickReply[],
    };
  }

  // 2a. A doubt check repeats the last record-backed answer from the record
  // store. The model is not asked again, so the answer cannot move. Any other
  // kind of answer clears the memory, so a doubt after a refusal gets no replay.
  const previousRecordAnswer = lastRecordAnswer;
  lastRecordAnswer = null;
  if (isDoubtCheck(text) && previousRecordAnswer) {
    const response = `Yes. The record has not changed:\n\n${previousRecordAnswer.text}`;
    addToHistory('user', text);
    addToHistory('bot', response);
    lastRecordAnswer = previousRecordAnswer;
    return {
      text: response,
      source: 'search',
      audit: {kbDocIds: previousRecordAnswer.docIds, confidence: 1},
    };
  }

  // 2b. Date and time come from the device clock, never from a model or a record.
  if (isClockQuestion(text)) {
    const clock = formatDeviceClock(new Date(), config.locale?.language ?? 'en');
    const response = `It is ${clock} on this device's clock. I have no clock of my own, and each record shows the date it was checked.`;
    addToHistory('user', text);
    addToHistory('bot', response);
    return {text: response, source: 'system'};
  }

  // 3. Tool router — config-driven keyword match. Replaces the old hardcoded
  // switch on actionType. Tools execute against the backend, then their
  // structured result is fed into the LLM as grounding (if LLM is loaded)
  // or returned directly as a summary (if LLM is not loaded).
  const tool = findToolForQuery(text);
  if (tool) {
    hooks.onToolStart?.(tool.name);
    const toolStart = Date.now();
    const result = await executeTool(tool, text);
    recordToolLatency(Date.now() - toolStart);
    recordToolCallResult(result.ok);
    hooks.onToolEnd?.(tool.name, result.ok);

    if (result.queuedActionId) {
      const actionLabel = tool.description;
      const response =
        (interpolate(prompts.queued ?? '', config) || '').replace('{{actionLabel}}', actionLabel) ||
        result.summary ||
        '';
      addToHistory('user', text);
      addToHistory('bot', response);
      return {
        text: response,
        source: 'queue',
        queuedActionId: result.queuedActionId,
        audit: {kbDocIds: [], confidence: 1, toolName: tool.name},
      };
    }

    if (!result.ok) {
      const response = result.summary ?? refusalFor('ungrounded_answer');
      addToHistory('user', text);
      addToHistory('bot', response);
      return {
        text: response,
        source: 'refusal',
        audit: {
          kbDocIds: [],
          confidence: 0,
          toolName: tool.name,
          refusalReason: 'ungrounded_answer',
        },
      };
    }

    // Success path — run the LLM over the structured tool result as
    // grounding. The router picks local, cloud, or demo formatter based
    // on config.llm.mode. If no path is available, fall through to the
    // raw summary.
    if (await generationAvailable()) {
      try {
        const systemPrompt = getSystemPrompt();
        const groundingBlock = formatToolResultForLLM(result);
        const userMessage = buildUserMessage(
          text,
          // Synthesize a pseudo-KBDocument so the existing builder can inline it.
          [
            {
              id: `tool:${tool.name}`,
              category: 'faq',
              title: `Tool result: ${tool.description}`,
              content: groundingBlock,
              keywords: [],
              tags: [],
              metadata: {},
            } as any,
          ],
          conversationHistory,
          {contextChars: recordContextChars()},
        );
        const toolDocs = [
          {
            id: `tool:${tool.name}`,
            category: 'faq',
            title: 'tool',
            content: groundingBlock,
            keywords: [],
            tags: [],
            metadata: {},
          } as any,
        ];
        // Stream only text that the grounding check has already passed.
        const gate = createGroundedTokenGate(toolDocs, onToken, {question: text});
        const llmStart = Date.now();
        const {
          text: generated,
          providerId,
          modelIdentity,
        } = await routeGeneration(systemPrompt, userMessage, gate.onToken);
        recordLlmLatency(Date.now() - llmStart);

        // Safety: validate the generated answer against the tool grounding.
        // Use the pseudo-doc so unsourced-amount checks see the backend data.
        const verdict = validateAnswer(generated, toolDocs, {question: text});
        if (!verdict.allow || gate.halted) {
          const refusalText = verdict.refusalText ?? refusalFor('ungrounded_answer');
          addToHistory('user', text);
          addToHistory('bot', refusalText);
          return {
            text: refusalText,
            source: 'refusal',
            audit: {
              kbDocIds: [`tool:${tool.name}`],
              confidence: verdict.confidence,
              toolName: tool.name,
              refusalReason: verdict.reason,
              groundingIssues: verdict.issues,
              providerId,
              modelIdentity,
            },
          };
        }

        addToHistory('user', text);
        addToHistory('bot', generated);
        return {
          text: generated,
          source: 'tool',
          audit: {
            kbDocIds: [`tool:${tool.name}`],
            confidence: verdict.confidence,
            toolName: tool.name,
            providerId,
            modelIdentity,
          },
        };
      } catch (err) {
        logger.warn('orchestrator', 'Tool+LLM synthesis failed, returning raw summary', {
          err: String(err),
        });
      }
    }

    // LLM unavailable — return the tool's pre-formatted summary directly.
    const response = result.summary ?? 'Done.';
    addToHistory('user', text);
    addToHistory('bot', response);
    return {
      text: response,
      source: 'tool',
      audit: {kbDocIds: [], confidence: 1, toolName: tool.name},
    };
  }

  // 4. Back-compat: older configs still use the requiresOnline + actions
  // switch. If a config defines no tools but does define actions, this path
  // keeps working so existing example configs remain functional.
  if (requiresOnline(text)) {
    const isOnline = connectivityService.isOnline();
    const actionType = getOnlineActionType(text);

    if (!isOnline && actionType) {
      const action = offlineQueue.enqueue(actionType as QueuedAction['type'], text, '');
      const actionLabel = actions.find(a => a.id === actionType)?.label ?? actionType;
      const response = interpolate(prompts.queued ?? '', config).replace(
        '{{actionLabel}}',
        actionLabel,
      );
      addToHistory('user', text);
      addToHistory('bot', response);
      return {text: response, source: 'queue', queuedActionId: action.id};
    }

    if (isOnline && actionType) {
      const backend = getBackendConnector();
      let response: string;

      try {
        switch (actionType) {
          case 'balance_check': {
            const result = await backend.checkBalance('current');
            response = `Your current balance is ${result.balance}. Data remaining: ${result.data}. Active promo: ${result.promos}.`;
            break;
          }
          case 'plan_change': {
            const result = await backend.changePlan('current', '');
            response = result.message;
            break;
          }
          case 'ticket_create': {
            const result = await backend.createTicket(text);
            response = result.message;
            break;
          }
          case 'outage_check': {
            const result = await backend.checkOutage();
            response = result.message;
            break;
          }
          case 'account_action':
            response =
              'Account changes like cancellation, disconnection, or deactivation require verification. ' +
              'Please call 211 (free from ACME mobile) or visit an ACME store with a valid ID to proceed.';
            break;
          default:
            response = 'Let me look into that for you.';
        }
      } catch {
        response = 'Let me look into that for you.';
      }

      addToHistory('user', text);
      addToHistory('bot', response);
      return {text: response, source: 'system'};
    }
  }

  // 5. Determine search query — expand if this is a follow-up.
  // A question that equals a record keyword is a new topic even when short,
  // so "sino ka" after another topic still gets the identity record.
  let searchQuery = text;
  const followUp = !matchesKnowledgeKeyword(text) && isFollowUp(text, conversationHistory);
  if (followUp) {
    searchQuery = expandQuery(text, conversationHistory);
  }

  // 6. Search knowledge base
  // The depth comes from knowledge.search.topK, so a template can keep each answer to one record.
  const searchResults = searchKB(searchQuery);

  // If follow-up search returns nothing, try the original query
  const finalResults = searchResults.length === 0 && followUp ? searchKB(text) : searchResults;

  // 7. If a local LLM, cloud LLM, or demo formatter is available, route
  // the generation. Demo mode bypasses the model load and produces a
  // deterministic streamed reply built from finalResults.
  let generationFailure: MessageAudit['providerFailure'];
  // A record marked verbatim answers as written. An identity statement or a
  // legal notice must not change between runs, so no model phrases it.
  const verbatim = finalResults[0]?.metadata?.verbatim === true;
  if (!verbatim && (await generationAvailable()) && finalResults.length > 0) {
    // Safety: a weak retrieval refuses before any text streams to the screen.
    const retrieval = checkConfidence(finalResults);
    if (!retrieval.confident) {
      const refusalText = refusalFor('low_confidence');
      addToHistory('user', text);
      addToHistory('bot', refusalText);
      return {
        text: refusalText,
        source: 'refusal',
        audit: {
          kbDocIds: finalResults.map(d => d.id),
          confidence: retrieval.confidence,
          refusalReason: 'low_confidence',
        },
      };
    }
    try {
      const systemPrompt = getSystemPrompt();
      const userMessage = buildUserMessage(text, finalResults, conversationHistory, {
        contextChars: recordContextChars(),
      });
      // Stream only text that the grounding check has already passed.
      const gate = createGroundedTokenGate(finalResults, onToken, {question: text});
      const llmStart = Date.now();
      const {
        text: response,
        providerId,
        modelIdentity,
      } = await routeGeneration(systemPrompt, userMessage, gate.onToken);
      recordLlmLatency(Date.now() - llmStart);

      // Safety: validate the generated answer against the retrieved KB
      const verdict = validateAnswer(response, finalResults, {question: text});
      if (verdict.allow && !gate.halted) {
        const cited = ensureSourceLine(response, finalResults[0]);
        addToHistory('user', text);
        addToHistory('bot', cited);
        lastRecordAnswer = {text: cited, docIds: finalResults.map(d => d.id)};
        return {
          text: cited,
          source: 'llm',
          audit: {
            kbDocIds: finalResults.map(d => d.id),
            confidence: verdict.confidence,
            providerId,
            modelIdentity,
          },
        };
      }
      // The records answer instead, and the chip says why the model did not.
      generationFailure = {
        providerId,
        reason: 'ungrounded',
        message: verdict.issues[0] ?? 'Streamed text failed the grounding check',
      };
    } catch (err) {
      logger.warn('orchestrator', 'LLM generation failed, falling back to search', {
        err: String(err),
      });
      // The answer chip tells the user why records answered instead of the model.
      generationFailure =
        err instanceof InferenceProviderError
          ? {providerId: err.providerId, reason: err.reason, message: err.message}
          : {reason: 'generation_failed', message: String(err)};
    }
  }

  // 8. Fallback: format search results directly
  if (finalResults.length > 0) {
    const formatted = formatSearchResults(finalResults);
    const response = formatted;
    addToHistory('user', text);
    addToHistory('bot', response);
    lastRecordAnswer = {text: response, docIds: finalResults.map(d => d.id)};
    return {
      text: response,
      source: 'search',
      audit: {
        kbDocIds: finalResults.map(d => d.id),
        confidence: 1,
        ...(generationFailure ? {providerFailure: generationFailure} : {}),
      },
    };
  }

  // 9. Nothing found — offer helpful suggestions
  const response = interpolate(prompts.fallback, config);
  addToHistory('user', text);
  addToHistory('bot', response);
  return {
    text: response,
    source: 'system',
    suggestedReplies: quickReplies as QuickReply[],
    audit: {kbDocIds: [], confidence: 0},
  };
}

// Demo mode renders the record as the answer, so it gets the whole record. Model
// modes keep the cap that small on-device contexts need.
export function recordContextChars(): number | null {
  return getMode() === 'demo' ? null : modelConfig.recordChars ?? MODEL_CONTEXT_CHARS;
}

function addToHistory(role: 'user' | 'bot', text: string) {
  ensureHistoryLoaded();
  conversationHistory.push({role, text});
  // Keep only last 6 turns (3 exchanges) to stay within context budget
  if (conversationHistory.length > 6) {
    conversationHistory = conversationHistory.slice(-6);
  }
  saveHistory();
}

/**
 * Final polish on every orchestrator response:
 *   - Prepend the degraded-mode staleness banner if the KB has not been
 *     synced in >24h and the answer source is not a tool call (tool calls
 *     are always live via the backend)
 *   - Record telemetry for the turn (PII-safe)
 * Returns a new response object with the possibly-augmented text.
 */
function finalizeResponse(userText: string, response: OrchestratorResponse): OrchestratorResponse {
  let text = response.text;
  if (response.source !== 'tool' && response.source !== 'refusal' && response.source !== 'queue') {
    const prefix = getDegradedModePrefix();
    if (prefix) text = prefix + text;
  }

  // In-process metrics rollup for the dev panel.
  metricsRecordTurn(response.source);
  if ((response.audit?.kbDocIds ?? []).length === 0) recordZeroHit();
  if ((response.audit?.confidence ?? 0) < 0.5) recordLowConfidence();

  const {kbVersion} = getStalenessInfo();
  try {
    recordTurn({
      query: userText,
      answer: text,
      kbVersion: kbVersion ?? undefined,
      retrievedDocIds: response.audit?.kbDocIds ?? [],
      confidence: response.audit?.confidence ?? 0,
      toolCalls: response.audit?.toolName ? [response.audit.toolName] : undefined,
      refusalReason: response.audit?.refusalReason,
    });
  } catch {
    // telemetry never breaks the user-facing flow
  }

  return {...response, text};
}

// Known abbreviations/acronyms that are legitimate queries, not greetings
const NOT_GREETINGS = new Set([
  'sim',
  'apn',
  'bgc',
  'lte',
  'mms',
  'dns',
  'otg',
  'qr',
  'vpn',
  'nfc',
  'pin',
  'puk',
  'otp',
  'faq',
  'sos',
  'usb',
  'rom',
  'ram',
  'app',
  'web',
  'net',
  'log',
  'pay',
  'buy',
  'php',
  'gb',
  'mb',
  'kb',
  'mbps',
  'ghz',
  'mhz',
  'bpi',
  'bdo',
  'atm',
  'eip',
  'esim',
  'iot',
  'sms',
  'gps',
]);

function isGreeting(text: string): boolean {
  const greetings = [
    'hi',
    'hello',
    'hey',
    'good morning',
    'good afternoon',
    'good evening',
    'howdy',
    'yo',
    'sup',
    'hola',
    'kamusta',
    'musta',
    'bye',
    'goodbye',
    'thanks',
    'thank you',
  ];
  const lower = text
    .toLowerCase()
    .replace(/[!.,?]/g, '')
    .trim();
  // Short alphabetic strings could be greetings, but exclude known acronyms
  if (lower.length <= 3 && /^[a-z]+$/.test(lower)) {
    return !NOT_GREETINGS.has(lower);
  }
  return greetings.includes(lower);
}
