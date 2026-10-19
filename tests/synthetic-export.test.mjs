import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareSyntheticExport} from '../app/lib/synthetic-export.ts';
import {syntheticExportFixture} from '../scripts/exports/synthetic-fixture.mjs';
const blocked = (f,issue) => {const out=prepareSyntheticExport(f);assert.equal(out.status,'unavailable');assert.deepEqual(out.rows,[]);assert.deepEqual(out.issues,[issue]);assert.equal(out.canPublish,false);assert.equal(out.canAcceptDistrict,false);};
test('synthetic export recomputes pooled 5 percent and recorded numeric zero with exact provenance',()=>{
  const f=syntheticExportFixture(), before=structuredClone(f), out=prepareSyntheticExport(f);
  assert.equal(out.status,'readyPrototypeOnly');assert.equal(out.rows[0].value,5);assert.equal(out.rows[0].numerator,1);assert.equal(out.rows[0].denominator,20);
  assert.equal(out.rows[1].value,0);assert.equal(out.rows[1].denominator,null);
  assert.equal(out.rows[0].provenance.packetVersion,1);assert.equal(out.rows[1].provenance.contractId,f[1].contract.id);
  assert.match(out.warning,/Synthetic prototype/);assert.equal(out.canPublish,false);assert.equal(out.canAcceptDistrict,false);
  assert.deepEqual(f,before);assert.deepEqual(prepareSyntheticExport([...f].reverse()),out);
  out.rows[0].provenance.packetVersion=999;assert.deepEqual(f,before);assert.equal(prepareSyntheticExport(f).rows[0].provenance.packetVersion,1);
});
test('one missing or unavailable measure withholds every export row',()=>{
  for (const mutate of [f=>f[1].evidence.pop(), f=>f[0].packet.locked_at=null, f=>f[1].evidence[0].evidence.entries.pop(), f=>f[0].contract.partition.contributions[1].populationKeys[0]=f[0].contract.partition.contributions[0].populationKeys[0]]) {
    const f=syntheticExportFixture();mutate(f);blocked(f,'unavailableResult');
  }
});
test('synthetic bindings reject absent, duplicate, unknown, revised and remapped contracts',()=>{
  for (const f of [null,{},[],[...syntheticExportFixture(),{}],Array(2)]) blocked(f,'invalidBindings');
  for (const mutate of [f=>f[1].binding=f[0].binding,f=>f[0].binding='official',f=>f[0].contract.revision++,f=>f[0].contract.decimals=3,f=>f[1].contract.numeratorDefinition.id=f[1].contract.denominatorDefinition?.id,f=>f[0].contract.partition.revision++]) {
    const f=syntheticExportFixture();mutate(f);blocked(f,'invalidBindings');
  }
});
test('separately valid packet versions, IDs and scopes cannot be combined',()=>{
  for (const mutate of [f=>f[1].packet.version++,f=>f[1].packet.id='00000000-0000-4000-8000-000000000099']) {const f=syntheticExportFixture();mutate(f);blocked(f,'mixedPacket');}
  const f=syntheticExportFixture();f[1].contract.schoolId=f[1].packet.school_id='00000000-0000-4000-8000-000000000099';blocked(f,'mixedScope');
  const g=syntheticExportFixture();g[1].contract.partition.contributions[0].populationKeys[0]='00000000-0000-4000-8000-000000009999';blocked(g,'mixedScope');
});
test('only controlled labels and aggregate projection escape; source formulas and notes cannot inject output',()=>{
  const f=syntheticExportFixture();
  for(const s of f) {s.value=999;s.title='=WEBSERVICE("https://invalid")';s.evidence.forEach(e=>{e.reason='@PRIVATE';e.evidence.entries.forEach(x=>x.sourceTitle='=PRIVATE');});}
  const out=prepareSyntheticExport(f), text=JSON.stringify(out);
  assert.equal(out.rows[0].value,5);assert.doesNotMatch(text,/PRIVATE|WEBSERVICE|populationKeys|submission|author|entries|sourceTitle/);
  assert.deepEqual(out.rows.map(r=>r.label),['Synthetic participation','Synthetic recorded count']);
});
test('matching packet IDs cannot join different supplied snapshot bodies',()=>{
  const f=syntheticExportFixture();f[1].evidence[0].evidence.entries[0].value=0;blocked(f,'mixedSnapshot');
  const g=syntheticExportFixture();g[1].packet.manifest[0].requirementsRevision=2;blocked(g,'mixedSnapshot');
});
