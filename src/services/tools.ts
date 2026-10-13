/**
 * Tool calling: deterministic keyword router with LLM-assisted synthesis.
 *
 * Design: the model provider never chooses or authorizes backend work.
 * Airgap routes with configured keywords, runs the known backend method,
 * then gives the structured result to the selected provider for wording.
 *
 * This keeps tool calling:
 *   - Fast (keyword match, no extra LLM pass to decide)
 *   - Reliable (no reliance on the model emitting well-formed JSON)
 *   - Grounded (the LLM sees a verified tool result, not a guess)
 *   - Offline-aware (state-changing tools queue when offline)
 *
 * See docs/tool-calling.md for the full boundary.
 */

import {config} from '../config/loader';
import {logger} from './logger';
import {connectivityService} from './connectivityService';
import {offlineQueue, runBackendAction, unfinishedRequestReply} from './offlineQueue';
import {isGovernmentDomain} from './actionQueueTypes';

export interface ToolDefinition {
  /** Unique identifier. Matches the backend method name by convention. */
  name: string;
  /** Human-readable description shown in docs and the dev panel. */
  description: string;
  /** Keyword list. Any match (case-insensitive, whole-word) selects this tool. */
  keywords: string[];
  /** Can this tool be safely queued when offline? */
  offlineQueueEligible?: boolean;
  /** Does this tool mutate remote state? */
  stateChanging?: boolean;
  /** Which vertical owns this tool (telco/banking/healthcare/etc.). */
  vertical?: string;
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
  if (isGovernmentDomain()) return [];
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
  if (isGovernmentDomain()) {
    return {
      toolName: tool.name,
      ok: false,
      error: 'no_agency_integration',
      summary: 'Unavailable: no agency integration exists. No request was sent or queued.',
    };
  }
  const online = connectivityService.isOnline();
  // The config schema makes a tool queue eligible unless it opts out.
  const queueEligible = tool.offlineQueueEligible !== false;

  if (!online && !queueEligible) {
    return {
      toolName: tool.name,
      ok: false,
      error: 'offline_not_eligible',
      summary:
        'This action requires an internet connection. Please try again when you are back online.',
    };
  }

  if (!online && tool.stateChanging) {
    const action = offlineQueue.enqueue('tool_call', query, '', tool.name);
    logger.info('tools', 'Queued offline tool call', {
      tool: tool.name,
      id: action.id,
    });
    return {toolName: tool.name, ok: true, queuedActionId: action.id};
  }

  try {
    const {data, summary} = await runBackendAction(tool.backendMethod ?? tool.name, query);
    logger.info('tools', 'Tool executed', {tool: tool.name, online});
    return {toolName: tool.name, ok: true, data, summary};
  } catch (err) {
    const message = err instanceof Error ? err.message : undefined;
    logger.error('tools', 'Tool execution failed', {
      tool: tool.name,
      error: message,
    });
    return {
      toolName: tool.name,
      ok: false,
      error: message ?? 'unknown_error',
      summary: unfinishedRequestReply(),
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
    return `TOOL QUEUED (${result.toolName})`;
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
