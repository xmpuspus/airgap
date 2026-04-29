import MiniSearch from 'minisearch';
import type {KBDocument} from '../types/knowledge';
import {config} from '../config/loader';
import {knowledgeFiles} from './manifest';

// Pull search settings from config (with defaults already applied by loader)
const searchConfig = config.knowledge.search!;

function buildIndex(docs: KBDocument[]): MiniSearch<KBDocument> {
  const index = new MiniSearch<KBDocument>({
    fields: ['title', 'content', 'keywords'],
    storeFields: ['id', 'title', 'category', 'content', 'tags', 'metadata'],
    searchOptions: {
      boost: {
        title: searchConfig.boostTitle!,
        keywords: searchConfig.boostKeywords!,
        content: searchConfig.boostContent!,
      },
      fuzzy: searchConfig.fuzzy!,
      prefix: true,
    },
    extractField: (document, fieldName) => {
      if (fieldName === 'keywords') {
        return (document as KBDocument).keywords.join(' ');
      }
      return (document as unknown as Record<string, string>)[fieldName];
    },
  });
  index.addAll(docs);
  return index;
}

interface KnowledgeState {
  index: MiniSearch<KBDocument>;
  documents: KBDocument[];
  byId: Map<string, KBDocument>;
  source: 'compiled' | 'bundle';
  bundleVersion: string | null;
}

// Baseline: compiled-in KB files. Used as the initial state and as the
// fall-back target if a downloaded bundle fails to load.
const compiledDocuments: KBDocument[] = Object.values(knowledgeFiles).flatMap(
  file => file as KBDocument[],
);

function makeState(
  docs: KBDocument[],
  source: 'compiled' | 'bundle',
  bundleVersion: string | null = null,
): KnowledgeState {
  return {
    index: buildIndex(docs),
    documents: docs,
    byId: new Map(docs.map(d => [d.id, d])),
    source,
    bundleVersion,
  };
}

let state: KnowledgeState = makeState(compiledDocuments, 'compiled');

export function getSearchIndex(): MiniSearch<KBDocument> {
  return state.index;
}

export function getAllDocuments(): KBDocument[] {
  return state.documents;
}

export function getDocumentById(id: string): KBDocument | undefined {
  return state.byId.get(id);
}

export function getKnowledgeSource(): 'compiled' | 'bundle' {
  return state.source;
}

export function getLoadedBundleVersion(): string | null {
  return state.bundleVersion;
}

/**
 * Parse a bundle payload and rebuild the in-memory KB + MiniSearch index.
 * The bundle format matches what the reference BFF serves:
 *
 *   { files: { "faq.json": "<stringified JSON array>", ... }, generatedAt }
 *
 * Throws synchronously on ANY malformed bundle so callers can roll back
 * and revert to the previous (or compiled-in) KB.
 */
export function replaceKnowledgeFromBundle(
  bundleJson: string,
  bundleVersion: string | null = null,
): void {
  const outer = JSON.parse(bundleJson) as unknown;
  if (
    !outer ||
    typeof outer !== 'object' ||
    !(outer as {files?: unknown}).files ||
    typeof (outer as {files: unknown}).files !== 'object'
  ) {
    throw new Error('bundle.files is missing or not an object');
  }
  const filesRecord = (outer as {files: Record<string, unknown>}).files;

  const docs: KBDocument[] = [];
  for (const [name, payload] of Object.entries(filesRecord)) {
    if (typeof payload !== 'string') {
      throw new Error(`bundle.files["${name}"] is not a string`);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch (err) {
      throw new Error(
        `bundle.files["${name}"] failed to parse as JSON: ${(err as Error).message}`,
      );
    }
    if (!Array.isArray(parsed)) {
      throw new Error(`bundle.files["${name}"] did not parse to an array`);
    }
    docs.push(...(parsed as KBDocument[]));
  }
  if (docs.length === 0) {
    throw new Error('bundle contained zero documents');
  }

  state = makeState(docs, 'bundle', bundleVersion);
}

/**
 * Revert to the compiled-in KB. Called on bundle load failure or when the
 * sync pipeline wants to clear a downloaded bundle entirely.
 */
export function revertToCompiledKnowledge(): void {
  if (state.source === 'compiled') return;
  state = makeState(compiledDocuments, 'compiled');
}

export {compiledDocuments as _compiledDocumentsForTests};
