#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = path.join(root, 'public/assets/character-cutouts');
const manifestPath = path.join(outDir, 'manifest.json');
const batchPath = process.argv[2];
if (!batchPath) {
  console.error('Usage: node tools/scenes/import-cutout-batch.mjs <path-to-batch-manifest.json>');
  process.exit(2);
}

const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const batchFile = path.resolve(batchPath);
const batchDir = path.dirname(batchFile);
const rawBatch = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const promptDocPath = path.join(batchDir, 'PROMPTS.md');
const promptDoc = fs.existsSync(promptDocPath) ? fs.readFileSync(promptDocPath, 'utf8') : '';
const onlyArg = process.argv.slice(3).find(arg => arg.startsWith('--only='));
const onlyIds = onlyArg ? new Set(onlyArg.slice('--only='.length).split(',').filter(Boolean)) : null;
const reviewerArg = process.argv.slice(3).find(arg => arg.startsWith('--reviewer='));
const reviewer = reviewerArg?.slice('--reviewer='.length).trim();
const reviewEvidenceArg = process.argv.slice(3).find(arg => arg.startsWith('--review-evidence='));
const reviewEvidencePath = reviewEvidenceArg ? path.resolve(batchDir, reviewEvidenceArg.slice('--review-evidence='.length)) : null;
const reviewEvidence = reviewEvidencePath && fs.existsSync(reviewEvidencePath)
  ? fs.readFileSync(reviewEvidencePath, 'utf8')
  : '';
const requiredRefs = [
  '/Users/pliu0036/Documents/CodingProject/assets-scenes/refs/ref-ark.jpg',
  '/Users/pliu0036/Documents/CodingProject/assets-scenes/refs/ref-a.jpg',
  '/Users/pliu0036/Documents/CodingProject/assets-scenes/refs/ref-b.jpg'
];

// Accept both the original import schema and newer agent batch manifests. The
// newer schema is imported only when the caller explicitly names reviewed IDs.
const sourceRows = Array.isArray(rawBatch.sources)
  ? rawBatch.sources
  : Array.isArray(rawBatch.perSourceInventoryAndStatus)
    ? rawBatch.perSourceInventoryAndStatus.map(source => ({
      eventId: source.id,
      sourcePath: source.source?.path,
      sourceSha256: source.source?.sha256,
      status: source.status,
      visibleInventory: source.inventory,
      unresolvedVisibleSubjects: source.unresolvedVisibleSubjects
    }))
    : Array.isArray(rawBatch.events)
      ? rawBatch.events
      : Object.entries(rawBatch.sources ?? {}).map(([eventId, source]) => ({ eventId, ...source }));
const normalizedSources = sourceRows.map(source => {
  const sourcePath = source.sourcePath || source.source || source.path;
  const subjects = source.reviewedVisibleSubjects ?? source.visibleDistinctSubjects ?? source.visibleSubjects ?? source.visibleInventory ?? source.visibleReusableTypes ?? source.subjects ?? source.review ?? source.inventory ?? [];
  const resolved = source.resolvedByThisBatch ?? source.resolvedByGenerated ?? source.resolved ?? source.resolvedByReuse ?? source.coveredByReuse ?? source.reuseOptions ?? source.reusableAcceptedCutoutIds ?? source.exactSourceAssetIds ?? source.reconciled ?? [];
  const unresolved = source.unresolved ?? source.remaining ?? source.unresolvedSubjects ?? source.notYetExtracted ?? (source.status === 'partial' || source.reviewStatus === 'partial' ? source.review : []);
  const asLines = value => Array.isArray(value)
    ? value.map(item => typeof item === 'string' ? item : `${item.subject ?? 'Subject'}: ${item.resolution ?? item.note ?? ''}`)
    : [String(value)].filter(Boolean);
  return {
    ...source,
    sourcePath,
    sourceSha256: source.sourceSha256 || source.sha256 || source.sha256_verified || source.sha256_expected,
    reviewedVisibleSubjects: asLines(subjects),
    resolvedByThisBatch: asLines(resolved),
    reuseExistingType: asLines(source.reuseExistingType ?? source.reuseExisting ?? []),
    unresolved: asLines(unresolved),
    status: String(source.status || source.reviewStatus || 'partial').toLowerCase() === 'complete' ? 'complete' : 'partial'
  };
});
function promptFromReference(reference) {
  if (!reference || !promptDoc) return '';
  const rawRef = String(reference);
  const key = rawRef.includes('#')
    ? rawRef.split('#').at(-1).trim()
    : rawRef.replace(/^PROMPTS\.md\s*[—–-]\s*/i, '').split(/[—–]/).at(-1).trim().replace(/\s*\([^)]*\)\s*$/, '');
  const slug = value => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const lines = promptDoc.split(/\r?\n/);
  const heading = lines.findIndex(line => /^#{1,4}\s+/.test(line) && slug(line.replace(/^#{1,4}\s+/, '')).includes(slug(key)));
  if (heading < 0) return '';
  const nextHeading = lines.findIndex((line, i) => i > heading && /^#{1,4}\s+/.test(line));
  const section = lines.slice(heading + 1, nextHeading < 0 ? lines.length : nextHeading).join('\n');
  return section.match(/```(?:text)?\s*\n([\s\S]*?)\n```/i)?.[1]?.trim() ?? section.trim();
}
function kindFor(asset) {
  if (asset.kind) return asset.kind === 'person+prop' ? 'person' : asset.kind;
  return /quail|sheep|goat|camel|donkey|locust|bird|eagle|lion|ox|fish|crab|pig/i.test(asset.id ?? '') ? 'animal' : 'person';
}
let normalizedGenerations = rawBatch.generations;
let stagedCandidates = rawBatch.assets ?? rawBatch.candidates;
if (Array.isArray(normalizedGenerations)) {
  normalizedGenerations = normalizedGenerations.map(asset => ({
    ...asset,
    fullPrompt: asset.fullPrompt
      || (asset.prompt?.startsWith('PROMPTS.md#') ? promptFromReference(asset.prompt) : asset.prompt)
      || promptFromReference(asset.promptRef)
  }));
}
if (!Array.isArray(stagedCandidates) && Array.isArray(rawBatch.sources)) {
  const sourceByPath = new Map(rawBatch.sources.map(source => [source.path || source.sourcePath || source.source, source]));
  const promptRefs = {
    '1-samuel-6-oxen-attempt-2': '1 Samuel 6 — flat-key ox pair retry (attempt 2)',
    '1-samuel-7-samuel-praying': '1 Samuel 7 — Samuel praying at Mizpah',
    '1-samuel-8-samuel-listening': '1 Samuel 8 — Samuel listening/addressing the elders',
    '1-samuel-9-saul': '1 Samuel 9 — Saul meeting Samuel',
    '1-samuel-9-samuel': '1 Samuel 9 — Samuel meeting Saul'
  };
  stagedCandidates = rawBatch.sources.flatMap(source => (source.attempts ?? [])
    .filter(attempt => attempt.verdict === 'accepted-in-staging')
    .map(attempt => ({
      id: attempt.id,
      file: attempt.output,
      sourcePath: source.path || source.sourcePath || source.source,
      sourceSha256: source.sha256,
      outputSha256: attempt.alphaSha256 || attempt.sha256,
      kind: /oxen|cattle|sheep|donkey|camel|goat|bird|lion|fish|pig|crab/i.test(attempt.id) ? 'animal' : 'person',
      name: attempt.id.replace(/^1-samuel-\d+-/, '').replaceAll('-', ' '),
      promptRef: promptRefs[attempt.id],
      review: attempt.reason
    })));
}
if (!Array.isArray(stagedCandidates) && Array.isArray(rawBatch.attempts)) {
  stagedCandidates = rawBatch.attempts.flatMap(attempt => {
    if (!onlyIds?.has(attempt.id) || attempt.disposition !== 'pending independent refuter') return [];
    const alpha = (attempt.alphaOutputs ?? []).find(output => output.path.includes(`${path.sep}candidates${path.sep}`));
    if (!alpha || !reviewer || !reviewEvidencePath || !reviewEvidence.includes(`ACCEPT ${attempt.id}`)) return [];
    const attached = new Set(attempt.physicallyAttachedInputs ?? []);
    if (!attached.has(attempt.source?.path) || requiredRefs.some(ref => !attached.has(ref))) {
      throw new Error(`Source or one of the three style-reference images was not attached for ${attempt.id}`);
    }
    const kind = /\bdonkey\b/i.test(attempt.subject ?? '') ? 'animal' : 'person';
    return [{
      id: attempt.id,
      name: attempt.subject,
      kind,
      file: path.relative(batchDir, alpha.path),
      sourcePath: attempt.source.path,
      sourceSha256: attempt.source.sha256,
      outputSha256: alpha.sha256,
      fullPrompt: attempt.exactPrompt,
      visualQA: `${alpha.qa?.visualNotes ?? ''} Independent reviewer ACCEPT ${attempt.id} (${reviewer}); evidence: ${path.relative(batchDir, reviewEvidencePath)}. Alpha output: RGBA PNG with transparent corners.`,
      reviewEvidencePath,
      reviewer
    }];
  });
}
if (!Array.isArray(normalizedGenerations) && Array.isArray(stagedCandidates)) {
  normalizedGenerations = stagedCandidates.map(asset => ({
    ...asset,
    output: asset.output || asset.outputPath || asset.file || asset.path,
    sourcePath: asset.sourcePath || asset.source,
    sha256: asset.sha256 || asset.fileSha256 || asset.outputSha256,
    kind: kindFor(asset),
    name: asset.name || asset.id?.replace(/^numbers-\d+-\d+-/, '').replaceAll('-', ' '),
    fullPrompt: asset.fullPrompt
      || rawBatch.attempts?.find(attempt => attempt.candidate_id === asset.id && attempt.candidate_path)?.exact_prompt
      || (asset.prompt?.startsWith('PROMPTS.md#') ? promptFromReference(asset.prompt) : asset.prompt)
      || promptFromReference(asset.promptRef),
    visualQA: [asset.visualQA, asset.notes, asset.review, asset.reviewNotes, asset.reviewStatus, asset.qa ? JSON.stringify(asset.qa) : '']
      .filter(Boolean)
      .join('\n'),
    reviewEvidencePath: asset.reviewEvidencePath ? path.resolve(batchDir, asset.reviewEvidencePath) : undefined,
    status: onlyIds?.has(asset.id) ? 'accepted-candidate' : 'not-selected'
  }));
}
const batch = { ...rawBatch, sources: normalizedSources, generations: normalizedGenerations || [] };
if (onlyIds) {
  const selectedEvents = new Set(batch.generations
    .filter(item => onlyIds.has(item.id))
    .flatMap(item => [item.sourceEvent, item.eventId].filter(Boolean)));
  const selectedPaths = new Set(batch.generations
    .filter(item => onlyIds.has(item.id))
    .map(item => item.sourcePath)
    .filter(Boolean));
  if (selectedEvents.size || selectedPaths.size) {
    batch.sources = batch.sources.filter(source => selectedEvents.has(source.eventId || source.id) || selectedPaths.has(source.sourcePath));
  }
}
for (const source of batch.sources) {
  if (!source.sourcePath || !source.sourceSha256 || !fs.existsSync(source.sourcePath) || hash(source.sourcePath) !== source.sourceSha256) {
    throw new Error(`Source missing or hash mismatch: ${source.sourcePath ?? '(no path)'}`);
  }
}
const sourceByPath = new Map(batch.sources.map(source => [source.sourcePath, source]));
const sourceByEvent = new Map(batch.sources.map(source => [path.basename(source.sourcePath, path.extname(source.sourcePath)), source]));
const staged = batch.generations.filter(item => item.status === 'accepted-candidate' && (!onlyIds || onlyIds.has(item.id)));
const imports = staged.map(item => {
  const source = sourceByPath.get(item.sourcePath) || sourceByEvent.get(item.sourceEvent || item.eventId);
  const input = path.resolve(batchDir, item.output);
  if (!source || !item.name || !item.kind || !item.fullPrompt) {
    throw new Error(`Missing source or asset metadata/prompt: ${item.output}`);
  }
  if (!['person', 'animal'].includes(item.kind)) throw new Error(`Invalid kind: ${item.kind}`);
  const declaredStyleRefs = new Set(rawBatch.styleReferencePaths ?? []);
  const exactReferenceHashes = [
    'fb8be08d090ca81c3f5f38e87b8276150160b1fd9c3571ee72281325616f167b',
    '6c724f96afdf4e812053184f487f0b7c23f580df06ab767107180529fa2e6912',
    'a57357511d8f73008882501dd10557715688442a865d4a91b1ae7540c92ee802'
  ];
  const attachedHashes = new Set((item.actualAttachedInputs ?? [])
    .filter(file => fs.existsSync(file)).map(hash));
  const hasExactReferences = exactReferenceHashes.every(value => attachedHashes.has(value));
  for (const ref of requiredRefs) {
    if (!hasExactReferences && !item.fullPrompt.includes(ref) && !declaredStyleRefs.has(ref)) {
      throw new Error(`Prompt and physically attached style-reference manifest both omit ${ref}: ${item.output}`);
    }
  }
  if (!fs.existsSync(source.sourcePath) || hash(source.sourcePath) !== source.sourceSha256) throw new Error(`Source changed since review: ${source.sourcePath}`);
  if (!fs.existsSync(input) || hash(input) !== item.sha256) throw new Error(`Candidate hash mismatch: ${input}`);
  const qaContacts = ['qa/contact-sheet.png', 'evidence/checkerboard-contact.png', 'qa/final-accepted-checkerboard.png', 'QA/contact-sheet-final.png'];
  const sheetPath = batch.contactSheet || batch.checkerboardContactSheet;
  const hasContactSheet = (sheetPath && fs.existsSync(path.isAbsolute(sheetPath) ? sheetPath : path.join(batchDir, sheetPath))) || (batch.qaPreview && fs.existsSync(batch.qaPreview)) || qaContacts.some(file => fs.existsSync(path.join(batchDir, file)));
  const hasExplicitReview = reviewer && item.reviewEvidencePath && fs.existsSync(item.reviewEvidencePath)
    && reviewEvidence.includes(`ACCEPT ${item.id}`);
  if (!/alpha|transparent|checkerboard/i.test(item.visualQA ?? '') || (!hasContactSheet && !hasExplicitReview)) throw new Error(`Missing alpha QA or independent review evidence: ${item.output}`);
  // Prefer a semantic, stable asset ID when supplied; otherwise preserve the
  // existing filename-derived behavior for older batches.
  const id = item.id || path.basename(item.output, path.extname(item.output));
  if (manifest.assets.some(asset => asset.id === id)) throw new Error(`Asset ID already exists: ${id}`);
  const outputName = `${id}.png`;
  const destination = path.join(outDir, outputName);
  if (fs.existsSync(destination) && hash(destination) !== item.sha256) throw new Error(`Destination exists with different bytes; refusing overwrite: ${destination}`);
  return { item, source, input, id, outputName, destination, destinationExists: fs.existsSync(destination) };
});

for (const record of imports) {
  if (!record.destinationExists) fs.copyFileSync(record.input, record.destination);
  manifest.assets.push({
    id: record.id,
    file: record.outputName,
    kind: record.item.kind,
    name: record.item.name,
    ...(record.item.nameZh ? { nameZh: record.item.nameZh } : {}),
    sourceEvent: path.basename(record.source.sourcePath, path.extname(record.source.sourcePath)),
    source: record.source.sourcePath,
    sourceSha256: record.source.sourceSha256,
    prompt: record.item.fullPrompt,
    reviewStatus: 'accepted',
    reviewedAt: new Date().toISOString(),
    ...(record.item.reviewEvidencePath ? { reviewEvidence: {
      path: record.item.reviewEvidencePath,
      sha256: hash(record.item.reviewEvidencePath),
      reviewer: record.item.reviewer || reviewer
    } } : {}),
    ...(Array.isArray(record.item.actualAttachedInputs) ? { actualAttachedInputs: record.item.actualAttachedInputs } : {}),
    ...(record.item.promptHistory ? { promptHistory: record.item.promptHistory } : {}),
    notes: `ImageGen-assisted extraction. ${record.item.visualQA} ${record.item.reviewEvidencePath ? `Independently reviewed by ${record.item.reviewer || reviewer} using ${path.relative(batchDir, record.item.reviewEvidencePath)}.` : 'Independently reviewed from the batch contact sheet.'} Source-specific pose retained.`,
    fileSha256: hash(record.destination)
  });
}

for (const source of batch.sources) {
  const eventId = path.basename(source.sourcePath, path.extname(source.sourcePath));
  const existing = manifest.processedSources.findIndex(record => record.eventId === eventId && record.sha256 === source.sourceSha256);
  const directNote = [source.note, source.notes, source.reviewNotes].find(value => typeof value === 'string' && value.trim());
  const inventory = source.visibleInventory ?? source.inventory ?? source.visibleSubjects ?? source.visibleDistinctSubjects ?? source.review ?? 'see batch review';
  const structuredNote = `Visible inventory: ${Array.isArray(inventory) ? inventory.join('; ') : inventory}. Reviewed visible subjects: ${(source.reviewedVisibleSubjects ?? []).join('; ')}. Resolution: ${source.resolution ?? ''}. Resolved by this batch: ${(source.resolvedByThisBatch ?? []).join('; ')}. Reuse existing: ${(source.reuseExistingType ?? []).join('; ') || 'none noted'}. Unresolved: ${(source.unresolved ?? []).join('; ') || 'none; confirmed no additional clear reusable subjects'}.`;
  const hasStructuredInventory = Boolean(source.visibleInventory || source.inventory || source.visibleSubjects || source.visibleDistinctSubjects || source.reviewedVisibleSubjects?.length || source.reuseExistingType?.length || source.resolvedByThisBatch?.length || source.unresolved?.length);
  const note = directNote?.trim() && !hasStructuredInventory ? directNote.trim() : [structuredNote, directNote?.trim() ? `Review notes: ${directNote.trim()}` : ''].filter(Boolean).join(' ');
  const record = {
    ...(existing >= 0 ? manifest.processedSources[existing] : {}),
    eventId,
    source: source.sourcePath,
    sha256: source.sourceSha256,
    status: source.status,
    reviewedAt: source.reviewedAt || batch.createdAt || batch.created || batch.reviewedAt || new Date().toISOString().slice(0, 10),
    note
  };
  if (Array.isArray(source.candidateReviews) && source.candidateReviews.length) {
    const prior = record.candidateReviews ?? [];
    const priorCandidates = new Set(prior.map(review => review.candidate));
    record.candidateReviews = [
      ...prior,
      ...source.candidateReviews.filter(review => !priorCandidates.has(review.candidate))
    ];
  }
  if (existing < 0) manifest.processedSources.push(record);
  else manifest.processedSources[existing] = record;
}

manifest.updated = batch.createdAt || batch.created || batch.reviewedAt || new Date().toISOString().slice(0, 10);
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Imported ${imports.length} assets and reviewed ${batch.sources.length} source illustrations.`);
