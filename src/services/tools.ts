/**
 * Tool calling — deterministic keyword router with LLM-assisted synthesis.
 *
 * Design: the model provider never chooses or authorizes backend work.
 * Airgap routes with configured keywords, runs the known backend method,
 * then gives the structured result to the selected provider for wording.
 *
 * This keeps tool calling:
 *   - Fast (keyword match, no extra LLM pass to decide)
 *   - Reliable (no reliance on Gemma 4 E2B emitting well-formed JSON)
 *   - Grounded (the LLM sees a verified tool result, not a guess)
 *   - Offline-aware (state-changing tools queue when offline)
 *
 * See docs/tool-calling.md for the full boundary.
 */

import {config} from '../config/loader';
import {logger} from './logger';
import {getBackendConnector} from './backendConnector';
import {connectivityService} from './connectivityService';
import {offlineQueue} from './offlineQueue';
import type {QueuedAction} from '../types/chat';

export interface ToolDefinition {
  /** Unique identifier. Matches the backend method name by convention. */
  name: string;
  /** Human-readable description shown in docs and the dev panel. */
  description: string;
  /** Keyword list — any match (case-insensitive, whole-word) selects this tool. */
  keywords: string[];
  /** JSON schema for the arguments the tool expects. */
  parameters?: {
    type: 'object';
    properties?: Record<string, {type: string; description?: string}>;
    required?: string[];
  };
  /** Can this tool be safely queued when offline? */
  offlineQueueEligible?: boolean;
  /** Does this tool mutate remote state? */
  stateChanging?: boolean;
  /** Which vertical owns this tool (telco/banking/healthcare/etc.). */
  vertical?: string;
  /** Override the default refusal if execution fails. */
  refusalReason?:
    | 'not_medical_advice'
    | 'not_financial_advice'
    | 'not_legal_advice'
    | 'state_changing_offline';
  /** The backend method to invoke. Mapped by name. */
  backendMethod?: string;
}

export interface ToolResult {
  toolName: string;
  ok: boolean;
  /** Structured output used for LLM grounding. */
  data?: Record<string, unknown>;
  /**
   * Pre-formatted human-readable summary. The LLM is asked to paraphrase
   * this rather than regenerate it from scratch, which keeps numbers exact.
   */
  summary?: string;
  /** Populated when the tool was queued instead of executed. */
  queuedActionId?: string;
  error?: string;
}

function getTools(): ToolDefinition[] {
  return (config as unknown as {tools?: ToolDefinition[]}).tools ?? [];
}

/**
 * Keyword-based tool selection. Returns the first matching tool or null.
 * Whole-word matching avoids "bill" matching "billion".
 */
export function findToolForQuery(query: string): ToolDefinition | null {
  const lower = query.toLowerCase();
  const tools = getTools();
  for (const tool of tools) {
    for (const kw of tool.keywords) {
      const needle = kw.toLowerCase();
      if (!needle) continue;
      const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(^|\\W)${escaped}(\\W|$)`, 'i');
      if (re.test(lower)) {
        return tool;
      }
    }
  }
  return null;
}

/**
 * Execute a tool against the currently-registered backend connector.
 * If the tool is state-changing and the device is offline, queue the action
 * instead and return a queuedActionId.
 */
export async function executeTool(tool: ToolDefinition, query: string): Promise<ToolResult> {
  const online = connectivityService.isOnline();

  if (!online && tool.offlineQueueEligible !== false && tool.stateChanging) {
    const action = offlineQueue.enqueue('tool_call' as QueuedAction['type'], query, '', tool.name);
    logger.info('tools', 'Queued offline tool call', {
      tool: tool.name,
      id: action.id,
    });
    return {
      toolName: tool.name,
      ok: true,
      queuedActionId: action.id,
      summary: `Queued "${tool.description}" — will execute on reconnect.`,
    };
  }

  if (!online && !tool.offlineQueueEligible) {
    return {
      toolName: tool.name,
      ok: false,
      error: 'offline_not_eligible',
      summary:
        'This action requires an internet connection. Please try again when you are back online.',
    };
  }

  const backend = getBackendConnector();
  const method = tool.backendMethod ?? tool.name;

  try {
    let data: Record<string, unknown> = {};
    let summary = '';

    switch (method) {
      case 'checkBalance':
      case 'lookupBalance': {
        const r = await backend.checkBalance('current');
        data = {...r};
        summary = `Balance: ${r.balance}. Data: ${r.data}. Active promo: ${r.promos}.`;
        break;
      }
      case 'changePlan':
      case 'activateAddon': {
        const r = await backend.changePlan('current', '');
        data = {...r};
        summary = r.message;
        break;
      }
      case 'createTicket':
      case 'fileClaim':
      case 'disputeTransaction': {
        const r = await backend.createTicket(query);
        data = {...r};
        summary = r.message;
        break;
      }
      case 'reportOutage':
      case 'checkOutage':
      case 'lookupFlightStatus':
      case 'checkPolicyStatus':
      case 'checkBillStatus':
      case 'bookAppointment':
      case 'scheduleCallback':
      case 'scheduleMeterRead':
      case 'requestCallback': {
        const r = await backend.checkOutage();
        data = {...r};
        summary = r.message;
        break;
      }
      case 'lookupMedication':
      case 'listRecentTransactions': {
        const r = await backend.executeAction(method, {query});
        data = {...r};
        summary = r.message;
        break;
      }
      default: {
        const r = await backend.executeAction(method, {query});
        data = {...r};
        summary = r.message;
      }
    }

    logger.info('tools', 'Tool executed', {tool: tool.name, online});
    return {toolName: tool.name, ok: true, data, summary};
  } catch (err: any) {
    logger.error('tools', 'Tool execution failed', {
      tool: tool.name,
      error: err?.message,
    });
    return {
      toolName: tool.name,
      ok: false,
      error: err?.message ?? 'unknown_error',
      summary: "I couldn't complete that request right now. Please try again or call the hotline.",
    };
  }
}

/**
 * Build a context block that can be appended to the LLM prompt. The block
 * includes the tool result as structured grounding so the model paraphrases
 * instead of inventing values.
 */
export function formatToolResultForLLM(result: ToolResult): string {
  if (!result.ok) {
    return `TOOL ERROR (${result.toolName}): ${result.summary ?? result.error ?? 'failed'}`;
  }
  if (result.queuedActionId) {
    return `TOOL QUEUED (${result.toolName}): ${result.summary}`;
  }
  const dataLines = Object.entries(result.data ?? {})
    .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
    .join('\n');
  return [`TOOL RESULT (${result.toolName}):`, dataLines, `Summary: ${result.summary ?? ''}`]
    .filter(Boolean)
    .join('\n');
}

/**
 * Diagnostic view for the dev panel.
 */
export function listRegisteredTools(): ToolDefinition[] {
  return getTools();
}
