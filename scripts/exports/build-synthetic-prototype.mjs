/** Development-only builder. Run a copy in an OS temporary directory with the
 * bundled Artifact Tool runtime, never as an application/server dependency. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {Workbook, SpreadsheetFile, Presentation, PresentationFile} from '@oai/artifact-tool';

const repo = process.env.TANAW_EXPORT_REPO;
if (!repo || !path.isAbsolute(repo)) throw new Error('Set TANAW_EXPORT_REPO to the absolute repository path.');
const workspaceDir = process.cwd();
const out = path.join(workspaceDir,'output');
const qa = path.join(workspaceDir,'qa');
// Refuse to overwrite a previous export or its review receipts.
await fs.mkdir(out,{recursive:false});await fs.mkdir(qa,{recursive:false});
const {prepareSyntheticExport} = await import(pathToFileURL(path.join(repo,'app/lib/synthetic-export.ts')).href);
const {syntheticExportFixture} = await import(pathToFileURL(path.join(repo,'scripts/exports/synthetic-fixture.mjs')).href);
const model = prepareSyntheticExport(syntheticExportFixture());
assert.equal(model.status,'readyPrototypeOnly');
await fs.writeFile(path.join(out,'tanaw-synthetic-model.json'),JSON.stringify(model,null,2)+'\n');
const font = 'Nimbus Sans';
const p = model.rows[0].provenance;
const refs = [
  ['Packet ID',p.packetId],['Packet version',String(p.packetVersion)],
  ['Participation contract',model.rows[0].provenance.contractId],
  ['Recorded-count contract',model.rows[1].provenance.contractId],
  ['Contract revisions','1 / 1'],['Partition ID',p.partitionId],['Partition revision',String(p.partitionRevision)],
];

const wb = Workbook.create(), sheet = wb.worksheets.add('Synthetic results');
sheet.showGridLines=false;
sheet.getRange('B2').values=[[model.title]];
sheet.getRange('B3').values=[[model.warning]];
sheet.getRange('B4').values=[['Fixture period. Template: '+model.template]];
sheet.getRange('B6:F8').values=[
  ['Measure','Numerator','Denominator','Result','Unit'],
  ...model.rows.map(r=>[r.label,r.numerator,r.denominator===null?'n.a.':r.denominator,null,r.unit]),
];
sheet.getRange('E7').formulas=[['=IF(AND(ISNUMBER(C7),ISNUMBER(D7),D7>0,C7>=0,C7<=D7,INT(C7)=C7,INT(D7)=D7),ROUND(C7/D7*100,2),"unavailable")']];
sheet.getRange('E8').formulas=[['=IF(AND(ISNUMBER(C8),C8>=0,INT(C8)=C8),C8,"unavailable")']];
sheet.getRange('B10').values=[['Amber cells are editable. Edits do not update or approve the frozen packet.']];
sheet.getRange('B12').values=[['Frozen references']];
sheet.getRange('B13:C19').values=refs;
sheet.getRange('B21').values=[['Source: invented fixture. Pool counts before rounding; missing inputs stay unavailable.']];
sheet.getRange('B2:F21').format.font={name:font,size:11,color:'#172B3A'};
sheet.getRange('B2').format.font={name:font,size:16,bold:true};
sheet.getRange('B3').format.font={name:font,size:11,bold:true,color:'#9A3412'};
sheet.getRange('B4').format.font={name:font,size:11,italic:true,color:'#52616B'};
sheet.getRange('B6:F6').format={fill:'#163F50',font:{name:font,size:11,bold:true,color:'#FFFFFF'},horizontalAlignment:'center'};
sheet.getRange('B6:F8').format.rowHeight=30;
sheet.getRange('B13:C19').format.rowHeight=25;
sheet.getRange('B2:F21').format.verticalAlignment='center';
sheet.getRange('B2:F21').format.wrapText=false;
sheet.getRange('B:B').format.columnWidth=33;
sheet.getRange('C:C').format.columnWidth=43;
sheet.getRange('D:F').format.columnWidth=15;
// Wider provenance value column also leaves generous room for the numerator.
sheet.getRange('C7:D7').format.fill='#FFF2CC';sheet.getRange('C8').format.fill='#FFF2CC';
sheet.getRange('C7:E8').format.horizontalAlignment='right';
sheet.getRange('C7:D8').setNumberFormat('0');sheet.getRange('E7').setNumberFormat('0.00"%"');sheet.getRange('E8').setNumberFormat('0');
sheet.getRange('B12:F12').format.borders={bottom:{style:'thin',color:'#9AADB6'}};
sheet.getRange('C7:D7').dataValidation={rule:{type:'whole',operator:'between',formula1:0,formula2:10000}};
sheet.getRange('C8').dataValidation={rule:{type:'whole',operator:'between',formula1:0,formula2:10000}};
const value = address => sheet.getRange(address).values[0][0];
assert.equal(value('E7'),model.rows[0].value);assert.equal(value('E8'),0);
sheet.getRange('C7').values=[[2]];assert.equal(value('E7'),10);
sheet.getRange('C7').values=[[null]];assert.equal(value('E7'),'unavailable');
sheet.getRange('C7').values=[[1]];sheet.getRange('D7').values=[[0]];assert.equal(value('E7'),'unavailable');
sheet.getRange('D7').values=[[20]];sheet.getRange('C8').values=[[null]];assert.equal(value('E8'),'unavailable');
sheet.getRange('C8').values=[[0]];
wb.recalculate();
assert.equal(value('E7'),5);assert.equal(value('E8'),0);
const inspect=await wb.inspect({kind:'region',sheetId:sheet.name,range:'B6:F8',maxChars:2000});
await fs.writeFile(path.join(qa,'workbook-inspect.json'),JSON.stringify(inspect,null,2));
const preview=await wb.render({sheetName:sheet.name,range:'B2:F21',scale:1,format:'png'});
await fs.writeFile(path.join(qa,'workbook.png'),new Uint8Array(await preview.arrayBuffer()));
await (await SpreadsheetFile.exportXlsx(wb)).save(path.join(out,'tanaw-synthetic-results.xlsx'));

const deck=Presentation.create({slideSize:{width:1280,height:720}});
function text(slide,name,content,top,size=24,color='#172B3A',height=65) {
  const shape=slide.shapes.add({name,geometry:'textbox',position:{left:64,top,width:1152,height},fill:'none',line:{style:'solid',fill:'none',width:0}});
  shape.text=content;shape.text.style={fontSize:size,typeface:font,color};return shape;
}
function table(slide,values,top,height,widths) {
  const t=slide.tables.add({rows:values.length,columns:values[0].length,left:64,top,width:1152,height,columnWidths:widths,values});
  for(let row=0;row<values.length;row++)for(let col=0;col<values[row].length;col++) {
    const c=t.getCell(row,col);c.fill=row===0?'#163F50':row%2?'#F0F5F7':'#FFFFFF';
    c.text.style={fontSize:23,typeface:font,color:row===0?'#FFFFFF':'#172B3A',bold:row===0};
  }
  return t;
}
const first=deck.slides.add();first.background.fill='#FFFFFF';
text(first,'title',model.title,44,42);
text(first,'synthetic-warning',model.warning,121,24,'#9A3412');
table(first,[['Measure','Numerator','Denominator','Result'],...model.rows.map(r=>[r.label,String(r.numerator),r.denominator===null?'n.a.':String(r.denominator),r.unit==='percent'?r.value.toFixed(r.decimals)+'%':String(r.value)])],218,205,[470,210,230,242]);
text(first,'method','1/2 and 0/18 pool to 1/20 = 5.00%. The recorded count is a separate measure.',465,25,'#172B3A',100);
text(first,'edit-limit','Editable snapshot. Later edits do not update or approve the frozen packet.',605,21,'#52616B');
first.speakerNotes.text='Source: scripts/exports/synthetic-fixture.mjs and app/lib/synthetic-export.ts. All data are invented. No official indicator or school data. Percentage is rounded half-up once after pooling. See slide 2 for version references. Native tables are editable snapshots; no linked refresh is provided.';
const second=deck.slides.add();second.background.fill='#FFFFFF';
text(second,'title','Frozen references',44,42);
text(second,'synthetic-warning','Synthetic references. Not approved for official reporting.',121,24,'#9A3412');
table(second,[['Reference','Value'],...refs],204,380,[430,722]);
text(second,'template','Template '+model.template+'. Contract and partition bindings are synthetic only.',621,21,'#52616B');
second.speakerNotes.text='Each result carries packet, contract and partition ID/revision in tanaw-synthetic-model.json. Both contracts use the same packet/version and exact synthetic population. Approved dictionary, official template bindings and runtime authorization are pending.';
const candidate=path.join(qa,'candidate.pptx');await (await PresentationFile.exportPptx(deck)).save(candidate);
const {finalizePresentation}=await import(pathToFileURL('/root/.codex/skills/builtins/presentations/container_tools/artifact_tool_utils.mjs').href);
await finalizePresentation({workspaceDir,candidatePath:candidate,finalPath:path.join(out,'tanaw-synthetic-results.pptx'),pythonExecutable:process.env.CODEX_PRIMARY_RUNTIME_PYTHON,integrityValidatorPath:'/root/.codex/skills/builtins/presentations/container_tools/inspect_presentation_package_integrity.py',layoutValidatorPath:'/root/.codex/skills/builtins/presentations/container_tools/inspect_presentation_layout_geometry.py',layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit','--require-native-table-slide','1','--require-native-table-slide','2'],requiredNativeTableOwnerSlides:[1,2],fontPolicy:{basis:'design',families:[font]},verifyArtifactToolImport:true,receiptPath:path.join(qa,'presentation-validation.json')});
for(const [i,slide] of deck.slides.items.entries()) {
  const png=await deck.export({slide,format:'png',scale:1});await fs.writeFile(path.join(qa,`slide-${i+1}.png`),new Uint8Array(await png.arrayBuffer()));
}
await fs.writeFile(path.join(qa,'authoring-checks.json'),JSON.stringify({schema:'tanaw-synthetic-export-authoring-v1',workbookEditRestore:true,missingWithheld:true,zeroNumeric:true,nativeTableSlides:[1,2],targetApplicationEditSaveReopen:'not run'},null,2));
console.log('Created synthetic XLSX, PPTX and aggregate model; renders and validation receipts are in qa.');
