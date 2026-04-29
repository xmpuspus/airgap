'use strict';

// Shared KB helpers, extracted so kb-validate.js, kb-import.js, and the
// new kb-studio.js share one implementation. Pure functions (no
// side effects beyond the explicit exportToDir / summarizeKB I/O
// helpers) so unit tests can exercise them without setting up files.

const fs = require('fs');
const path = require('path');

const REQUIRED_FIELDS = ['id', 'category', 'title', 'content', 'keywords', 'tags'];

const EXPECTED_CSV_COLUMNS = REQUIRED_FIELDS;

function parseCSVRow(row) {
  const fields = [];
  let i = 0;
  while (i < row.length) {
    if (row[i] === '"') {
      let field = '';
      i++;
      while (i < row.length) {
        if (row[i] === '"' && row[i + 1] === '"') {
          field += '"';
          i += 2;
        } else if (row[i] === '"') {
          i++;
          break;
        } else {
          field += row[i++];
        }
      }
      fields.push(field);
      if (row[i] === ',') i++;
    } else {
      let field = '';
      while (i < row.length && row[i] !== ',') {
        field += row[i++];
      }
      fields.push(field.trim());
      if (row[i] === ',') i++;
    }
  }
  return fields;
}

function parseCSV(rawText) {
  const rows = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < rawText.length; i++) {
    const ch = rawText[i];
    if (ch === '"') {
      if (inQuotes && rawText[i + 1] === '"') {
        current += '""';
        i++;
      } else {
        inQuotes = !inQuotes;
        current += ch;
      }
    } else if ((ch === '\r' && rawText[i + 1] === '\n') || ch === '\n') {
      if (inQuotes) {
        current += ch === '\r' ? '\r\n' : '\n';
        if (ch === '\r') i++;
      } else {
        if (ch === '\r') i++;
        if (current.trim() !== '') rows.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current.trim() !== '') rows.push(current);
  return rows;
}

function csvToDocs(rawText) {
  const rows = parseCSV(rawText);
  if (rows.length < 2) {
    throw new Error('CSV has no data rows (need header + at least one data row)');
  }
  const header = parseCSVRow(rows[0]).map(h => h.toLowerCase().trim());
  const colIdx = {};
  for (const col of EXPECTED_CSV_COLUMNS) {
    const idx = header.indexOf(col);
    if (idx === -1) throw new Error(`Missing column in CSV header: '${col}'`);
    colIdx[col] = idx;
  }
  const docs = [];
  const skipped = [];
  for (let r = 1; r < rows.length; r++) {
    const fields = parseCSVRow(rows[r]);
    const get = col => (fields[colIdx[col]] || '').trim();
    const id = get('id');
    const category = get('category');
    const title = get('title');
    const content = get('content');
    if (!id || !category || !title || !content) {
      skipped.push({row: r, reason: 'missing required field (id/category/title/content)'});
      continue;
    }
    const keywords = get('keywords') ? get('keywords').split(';').map(s => s.trim()).filter(Boolean) : [];
    const tags = get('tags') ? get('tags').split(';').map(s => s.trim()).filter(Boolean) : [];
    docs.push({id, category, title, content, keywords, tags});
  }
  return {docs, skipped};
}

function validateDoc(doc, index, filename, seenIds) {
  const errors = [];
  const label = `${filename}[${index}]`;
  for (const field of REQUIRED_FIELDS) {
    if (!(field in doc)) {
      errors.push(`${label}: missing required field '${field}'`);
      continue;
    }
    const val = doc[field];
    if (field === 'keywords') {
      if (!Array.isArray(val) || val.length === 0) {
        errors.push(`${label}: '${field}' must be a non-empty array`);
      }
    } else if (field === 'tags') {
      if (!Array.isArray(val)) {
        errors.push(`${label}: '${field}' must be an array`);
      }
    } else {
      if (typeof val !== 'string' || val.length === 0) {
        errors.push(`${label}: '${field}' must be a non-empty string`);
      }
    }
  }
  if (doc.id && typeof doc.id === 'string') {
    if (seenIds.has(doc.id)) {
      errors.push(`${label}: duplicate id '${doc.id}' (first seen in ${seenIds.get(doc.id)})`);
    } else {
      seenIds.set(doc.id, filename);
    }
  }
  return errors;
}

function validateDocs(docs, filename = '<inline>') {
  const errors = [];
  const seenIds = new Map();
  for (let i = 0; i < docs.length; i++) {
    errors.push(...validateDoc(docs[i], i, filename, seenIds));
  }
  return errors;
}

function splitByCategory(docs) {
  const out = new Map();
  for (const doc of docs) {
    if (!out.has(doc.category)) out.set(doc.category, []);
    out.get(doc.category).push(doc);
  }
  return out;
}

function safeFilename(category) {
  return category.replace(/[^a-z0-9-]/gi, '_').toLowerCase();
}

function exportToDir(byCategory, outDir) {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, {recursive: true});
  const files = [];
  for (const [category, docs] of byCategory) {
    const file = path.join(outDir, `${safeFilename(category)}.json`);
    fs.writeFileSync(file, JSON.stringify(docs, null, 2) + '\n', 'utf8');
    files.push(file);
  }
  return files;
}

function summarizeKB(kbDir) {
  const out = {totalDocs: 0, categories: {}, files: 0, bytes: 0};
  if (!fs.existsSync(kbDir)) return out;
  const files = fs.readdirSync(kbDir).filter(f => f.endsWith('.json'));
  out.files = files.length;
  for (const f of files) {
    const stat = fs.statSync(path.join(kbDir, f));
    out.bytes += stat.size;
    const docs = JSON.parse(fs.readFileSync(path.join(kbDir, f), 'utf8'));
    if (!Array.isArray(docs)) continue;
    out.totalDocs += docs.length;
    for (const d of docs) {
      const c = d.category || 'unknown';
      out.categories[c] = (out.categories[c] || 0) + 1;
    }
  }
  return out;
}

module.exports = {
  REQUIRED_FIELDS,
  EXPECTED_CSV_COLUMNS,
  parseCSVRow,
  parseCSV,
  csvToDocs,
  validateDoc,
  validateDocs,
  splitByCategory,
  exportToDir,
  summarizeKB,
  safeFilename,
};
