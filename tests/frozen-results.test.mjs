import test from 'node:test';
import assert from 'node:assert/strict';
import { projectFrozenResult } from '../app/lib/frozen-results.ts';
const id = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const privateText = 'PRIVATE_SYNTHETIC_SOURCE';
function fixture({method = 'populationPercentage', counts = [1, 9], sizes = [2, 18], decimals = 2} = {}) {
  const definition = (n) => ({ id: id(n), label: 'Synthetic measure ' + n, unit: 'count', sourceTitle: 'Synthetic dictionary', sourceLocator: 'fixture:dictionary', sourceId: 'synthetic-source', schoolYear: 'Fixture', period: 'Synthetic period', formula: 'synthetic-explicit-count', numerator: 'synthetic count', denominator: 'synthetic population', rounding: 'synthetic-count' });
  const defs = [definition(10), definition(11)];
  const contract = { schema: 'tanaw-frozen-result-contract-v1', purpose: 'synthetic', id: id(1), revision: 1, schoolId: id(2), cycleId: id(3), schoolYear: 'Fixture', period: 'Synthetic period', method, decimals: method === 'countSum' ? 0 : decimals, rounding: 'halfUp', numeratorDefinition: defs[0], denominatorDefinition: method === 'countSum' ? null : defs[1], partition: {id: id(4), revision: 1, contributions: sizes.map((size, i) => ({ slot: id(20 + i), populationKeys: Array.from({length:size}, (_, n) => id(1000 + 1000*i + n)) })) } };
  const packet = { id: id(5), school_id: contract.schoolId, cycle_id: contract.cycleId, version: 1, locked_at: '2026-01-01T00:00:00Z', completeness: 'complete', missing: [], manifest: sizes.map((_, i) => ({slot:id(20+i), submission:id(30+i), version:1, requiredIndicators:defs.map(d=>d.id), requirementsRevision:1, coverageComplete:true, definitions:structuredClone(defs)})) };
  const evidence = sizes.map((size, i) => ({submission_id:id(30+i), version:1, reason:privateText, author_id:privateText, evidence:{kind:'manualIndicators', entries:[{definitionId:defs[0].id, value:counts[i], sourceTitle:privateText, sourceLocator:privateText}, {definitionId:defs[1].id, value:size, sourceTitle:privateText, sourceLocator:privateText}]}}));
  return {contract, packet, evidence};
}
const run = (f) => projectFrozenResult(f.contract, f.packet, f.evidence);
const blocked = (f, issue) => {const result=run(f); assert.equal(result.status,'unavailable');assert.equal(result.result,null);assert.ok(result.issues.includes(issue), JSON.stringify(result));assert.equal(result.canPublish,false);assert.equal(result.canAcceptDistrict,false);return result;};
test('pool counts instead of averaging class percentages; exact coverage and private output', () => {
  const f=fixture({counts:[1,0], sizes:[2,18]});const original=structuredClone(f);const out=run(f);
  assert.equal(out.status,'readyDiagnosticOnly');assert.deepEqual(out.result,{method:'populationPercentage',unit:'percent',value:5,numerator:1,denominator:20});
  assert.deepEqual(out.coverage,{expected:2,included:2});assert.equal(out.canPublish,false);assert.equal(out.canAcceptDistrict,false);
  assert.doesNotMatch(JSON.stringify(out), /PRIVATE|populationKeys|sourceLocator|entries|submission_id|learner/);
  assert.deepEqual(f,original,'No mutation or input references escape');assert.deepEqual(run(f),out,'Repeated projection is deterministic');
});
test('recorded zero remains a number; missing evidence withholds the entire result', () => {
  const f=fixture({method:'countSum',counts:[0,0]});assert.equal(run(f).result.value,0);
  f.evidence.pop();const out=blocked(f,'missingFrozenVersion');assert.deepEqual(out.coverage,{expected:2,included:1});
});
test('percentage rounds half-up once after pooling, including exact ties', () => {
  for (const [num,den,places,expected] of [[1,8,0,13],[1,32,2,3.13],[1,6,2,16.67],[2,3,6,66.666667],[0,4,2,0],[4,4,0,100]]) {
    const f=fixture({counts:[num],sizes:[den],decimals:places});assert.equal(run(f).result.value,expected);
  }
  const f=fixture({counts:[1,1],sizes:[3,3]});assert.equal(run(f).result.value,33.33,'Do not sum independently rounded percentages');
});
test('missing, duplicate and unexpected scope contributions fail closed', () => {
  for (const mutate of [f=>f.contract.partition.contributions.pop(), f=>f.packet.manifest.pop(), f=>f.packet.manifest.push(structuredClone(f.packet.manifest[0]))]) {
    const f=fixture();mutate(f);blocked(f,'coverageMismatch');
  }
  const f=fixture();f.contract.partition.contributions[1].slot=f.contract.partition.contributions[0].slot;blocked(f,'invalidContract');
});
test('overlap within or across supplied populations cannot be counted twice', () => {
  for (const mutate of [f=>f.contract.partition.contributions[0].populationKeys.push(f.contract.partition.contributions[0].populationKeys[0]), f=>f.contract.partition.contributions[1].populationKeys[0]=f.contract.partition.contributions[0].populationKeys[0]]) {
    const f=fixture();mutate(f);blocked(f,'overlappingPopulation');
  }
});
test('unlocked, incomplete and contradictory packet states withhold all values', () => {
  for (const patch of [{locked_at:null},{locked_at:'invented'},{completeness:'incomplete'},{missing:[{reason:privateText}]}]) {const f=fixture();Object.assign(f.packet,patch);blocked(f,'packetNotLockedComplete');}
  const f=fixture();f.packet.manifest[0].coverageComplete=false;blocked(f,'invalidManifest');
});
test('school, cycle, year, period and frozen semantics must match', () => {
  for (const field of ['school_id','cycle_id']) {const f=fixture();f.packet[field]=id(99);blocked(f,'scopeMismatch');}
  for (const field of ['label','unit','sourceLocator','formula','numerator','denominator','rounding','schoolYear','period']) {const f=fixture();f.packet.manifest[0].definitions[0][field]='changed';blocked(f,'definitionMismatch');}
  const f=fixture();f.contract.numeratorDefinition.period='other period';blocked(f,'invalidContract');
});
test('exact frozen versions only: current replacements, duplicate versions and extra history fail', () => {
  for (const mutate of [f=>f.evidence[0].version=2, f=>f.evidence.push(structuredClone(f.evidence[0])), f=>f.evidence.push({...structuredClone(f.evidence[0]),version:2})]) {const f=fixture();mutate(f);blocked(f,'invalidEvidence');}
  const f=fixture();f.packet.manifest[1].submission=f.packet.manifest[0].submission;blocked(f,'invalidManifest');
});
test('amendments produce distinct provenance without rewriting an earlier snapshot', () => {
  const old=fixture();const prior=run(old);const amendment=structuredClone(old);
  amendment.packet.id=id(90);amendment.packet.version=2;amendment.packet.manifest[0].version=2;amendment.evidence[0].version=2;amendment.evidence[0].evidence.entries[0].value=0;
  const next=run(amendment);assert.equal(prior.result.value,50);assert.equal(next.result.value,45);assert.notDeepEqual(prior.provenance,next.provenance);assert.deepEqual(run(old),prior);
});
test('counts must be finite safe nonnegative integers and agree with explicit membership', () => {
  for (const value of [null,'0',-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]) {const f=fixture();f.evidence[0].evidence.entries[0].value=value;blocked(f,'invalidCount');}
  for (const [entry,value] of [[0,3],[1,1],[1,3]]) {const f=fixture();f.evidence[0].evidence.entries[entry].value=value;blocked(f,'populationMismatch');}
  const f=fixture({counts:[0],sizes:[0]});blocked(f,'zeroDenominator');
  assert.equal(run(fixture({method:'countSum',counts:[0],sizes:[0]})).result.value,0);
});
test('measure provenance, requirements and duplicate definitions/evidence are checked', () => {
  for (const mutate of [f=>f.evidence[0].evidence.entries.pop(), f=>f.evidence[0].evidence.entries[0].sourceLocator='', f=>f.evidence[0].evidence.entries[0].sourceTitle='']) {const f=fixture();mutate(f);blocked(f,'missingMeasure');}
  for (const mutate of [f=>f.evidence[0].evidence.entries.push(structuredClone(f.evidence[0].evidence.entries[0])), f=>f.evidence[0].evidence.kind='other']) {const f=fixture();mutate(f);blocked(f,'invalidEvidence');}
  const missingRequirement=fixture();missingRequirement.packet.manifest[0].requiredIndicators.pop();blocked(missingRequirement,'definitionMismatch');
  const duplicate=fixture();duplicate.packet.manifest[0].definitions.push(duplicate.packet.manifest[0].definitions[0]);blocked(duplicate,'invalidManifest');
  const legacy=fixture();delete legacy.packet.manifest[0].definitions;blocked(legacy,'invalidManifest');
});
test('unsupported semantics, malformed inputs, legacy snapshots and oversized contracts fail statically', () => {
  for (const patch of [{purpose:'approved'},{method:['countSum']},{method:'average'},{decimals:7},{rounding:'bankers'},{denominatorDefinition:null}]) {const f=fixture();Object.assign(f.contract,patch);blocked(f,'invalidContract');}
  for (const value of [null,[],{},'PRIVATE']) assert.equal(projectFrozenResult(value,null,null).result,null);
  const f=fixture();f.contract.partition.contributions=Array(1001).fill(f.contract.partition.contributions[0]);blocked(f,'invalidContract');
  const largePopulation=fixture({counts:[0],sizes:[1001]});blocked(largePopulation,'invalidContract');
  const totalPopulation=fixture({counts:Array(11).fill(0),sizes:Array(11).fill(1000)});blocked(totalPopulation,'invalidContract');
  const bad=fixture();bad.packet.id=privateText;assert.doesNotMatch(JSON.stringify(blocked(bad,'invalidPacket')),/PRIVATE/);
  const invalidEvidence=fixture();invalidEvidence.evidence=null;blocked(invalidEvidence,'invalidEvidence');
});
