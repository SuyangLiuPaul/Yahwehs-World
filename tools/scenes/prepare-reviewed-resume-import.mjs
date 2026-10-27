#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const root = '/Volumes/T7/yahwehs-globe-scenes/priority-cutouts-resumed-20261014';
const candidateId = 'genesis-9-1-middle-right-left-facing-donkey-resumed-v01';
const requestPath = path.join(root, 'ark-worker/batch02/request.json');
const request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));
const reviewPath = path.join(root, 'independent-reviewer-resume-A/review.json');
const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
const outputDirectory = path.join(root, 'ark-worker/batch02');
const nativePath = path.join(outputDirectory, `${candidateId}.png`);
const generatedPath = review.native.originalPath;
fs.copyFileSync(generatedPath, nativePath);
if (sha256(nativePath) !== review.native.sha256) throw new Error('Native copy changed bytes');
if (review.candidateId !== candidateId || review.status !== 'PASS') throw new Error('Independent review is not a matching PASS');
if (request.exactCompleteSubmittedPrompt !== fs.readFileSync(path.join(outputDirectory, 'submitted-prompt.txt'), 'utf8').trimEnd()) {
  throw new Error('Submitted prompt text does not match exact request prompt');
}
for (const input of request.attachedImages) {
  if (sha256(input.path) !== input.sha256) throw new Error(`Input hash mismatch: ${input.path}`);
}
const prompt = request.exactCompleteSubmittedPrompt;
const actualAttachedInputs = request.attachedImages.map(input => input.path);
const generation = {
  id: candidateId,
  name: 'Gray donkey, left-facing · 灰驴（左向）',
  kind: 'animal',
  status: 'accepted-candidate',
  sourceEvent: 'genesis-9-1',
  sourcePath: request.attachedImages[0].path,
  output: nativePath,
  sha256: review.native.sha256,
  fullPrompt: prompt,
  actualAttachedInputs,
  promptHistory: [{
    stage: 'original-v01',
    originalCalls: 1,
    repairCalls: 0,
    fullPrompt: prompt,
    actualAttachedInputs: request.attachedImages,
    actualToolArguments: {
      prompt,
      referenced_image_paths: actualAttachedInputs,
      transparent_background: true
    },
    sessionRecordPath: review.promptAndExecution.sessionRecordPath,
    sessionEvidenceLines: review.promptAndExecution.sessionEvidenceLines,
    nativeSavePath: generatedPath,
    nativeSaveSha256: review.native.sha256,
    nativePreservedCopy: nativePath,
    nativeSha256: sha256(nativePath),
    independentReview: reviewPath,
    independentReviewSha256: sha256(reviewPath),
    reviewVerdict: 'PASS',
    producerSelection: path.join(root, 'ark-worker/batch02/selection.json'),
    producerProvenance: requestPath
  }],
  visualQA: 'Actual main-thread and independent visual review of full source, exact native source crop, all three fixed style references, unchanged native RGBA and white/navy composites. Four source-owned legs each connect to a separate hoof; source orientation, coat, mane, ears and tail retained; no tack or scenery. Transparent alpha is genuine; native was not modified. Source remains partial.',
  reviewEvidencePath: reviewPath
};
const batch = {
  createdAt: new Date().toISOString(),
  styleReferencePaths: request.attachedImages.slice(1, 4).map(input => input.path),
  sources: [{
    eventId: 'genesis-9-1',
    sourcePath: request.attachedImages[0].path,
    sourceSha256: request.attachedImages[0].sha256,
    status: 'partial',
    resolvedByThisBatch: [candidateId],
    unresolved: ['Other visible subjects in this illustration remain unreconciled; this donkey does not close the source.'],
    notes: 'The recovered generation call is proven by the original session record; source remains partial.'
  }],
  generations: [generation]
};
const batchPath = path.join(root, 'main-acceptance-03/accepted-batch.json');
fs.mkdirSync(path.dirname(batchPath), { recursive: true });
fs.writeFileSync(batchPath, `${JSON.stringify(batch, null, 2)}\n`);
fs.writeFileSync(path.join(path.dirname(batchPath), 'main-signed-review.txt'), [
  `ACCEPT ${candidateId}`,
  `Native SHA256 ${generation.sha256}`,
  `Source SHA256 ${request.attachedImages[0].sha256}`,
  `Independent PASS ${reviewPath}`,
  'Main actually viewed FULL source, native source crop, native RGBA, white/navy QA, and all three exact fixed references; four source-owned legs/hooves verified; exact tool-session prompt and five actual input paths/hashes reconciled; native bytes unchanged.'
].join('\n') + '\n');
console.log(batchPath);
