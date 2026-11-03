// Data/render smoke checks without a browser. Does not test Android UI.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '../app/src/main/assets/index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const storage = new Map(), nodes = new Map();
const node = selector => {
  if (!nodes.has(selector)) nodes.set(selector, {innerHTML:'', textContent:'', hidden:false, dataset:{}, querySelectorAll(){return []}, toggleAttribute(){}, addEventListener(){}, classList:{add(){},remove(){}}, focus(){}});
  return nodes.get(selector);
};
const exportCalls = [];
const context = vm.createContext({
  console, Date, Math, JSON, Set, Map, Number, String, Array, Object, Intl, Blob, FormData:class extends Map{constructor(){super();}},
  document:{querySelector:node,querySelectorAll(){return []},addEventListener(){},title:''},
  window:{AndroidFiles:{exportFile(...args){exportCalls.push(args)}}},
  localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},
  setInterval(){},setTimeout(){},clearTimeout(){},confirm:()=>true,
});
const run = code => vm.runInContext(code, context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../app/src/main/assets/exercise-catalog.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../app/src/main/assets/planner-core.js'),'utf8'),context);
vm.runInContext(script, context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../app/src/main/assets/app-v2.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../app/src/main/assets/planner-ui.js'),'utf8'),context);
assert.equal(run('db.demo'), false);
assert.equal(run('db.sessions.length'), 0);
assert.equal(run('db.profile.name'), 'Roman');
for (const page of ['home','calendar','add','stats','profile','assistant','tournaments','weight','history','report']) {
  run(`route=${JSON.stringify(page)};render()`);
  assert.ok(nodes.get('#app').innerHTML.length > 100, page);
}
run("db=validate(seed());save()");
assert.ok(run('db.sessions.length') > 0);
const original = run('JSON.stringify(db)');
run('db=validate(JSON.parse(localStorage.getItem(KEY)))');
assert.equal(run('JSON.stringify(db)'), original, 'JSON roundtrip preserves data');
run("download('backup.json',JSON.stringify(db),'application/json')");
assert.equal(exportCalls.length,1);
assert.equal(exportCalls[0][1],original,'Android export preserves all backup bytes');
assert.throws(()=>run("validate({version:999})"));
run('db=emptyDiary();save()');
assert.equal(run('db.weights.length'),0);
assert.equal(run('db.tournaments.length'),0);
console.log('PASS: blank start, 10 page renders, legacy JSON roundtrip, Android export payload, invalid backup rejection.');

// A mixed workout must survive collection, storage, planning and export without
// interpreting seconds or metres as repetitions or tonnage.
function input(value) {
  return {value:String(value), firstChild:{textContent:''},
    closest(){return this;}, setAttribute(name,value){this[name]=value;}};
}
function exerciseBlock(id, name, unit, values, weight) {
  const fields = {'[name=setExercise]':input(name), '[name=setExerciseNotes]':input('Poznámka ke cviku'),
    '[name=setUnit]':input(unit), '[name=setQuickReps]':input(values[0]),
    '[name=setQuickCount]':input(values.length), '[name=setQuickWeight]':input(weight),
    '[name=setQuickMode]':input('RPE'), '[name=setQuickEffort]':input(7),
    '.variedhint':{hidden:false}, '.exercise-unit .tag':{textContent:''}};
  const rows=values.map((v,i)=>{
    const fields={'[name=setReps]':input(v),'[name=setWeight]':input(weight),
      '[name=setMode]':input('RPE'),'[name=setEffort]':input(7),
      '[name=setNote]':input('Série '+(i+1))};
    return {querySelector:selector=>fields[selector]};
  });
  const block={dataset:{group:id},querySelector:selector=>fields[selector],
    querySelectorAll:()=>rows};
  fields['[name=setUnit]'].closest=()=>block;
  return block;
}
const blocks=[exerciseBlock('sled','Sáně','meters',[15,15,15],80),
  exerciseBlock('plank','Plank','seconds',[30,30,30],0),
  exerciseBlock('squat','Dřep','reps',[5,5,5],100)];
nodes.set('#entryform',{querySelectorAll:()=>blocks});
context.blocks=blocks;
run('globalThis.collected=collectSets()');
assert.deepEqual(JSON.parse(run('JSON.stringify(collected.map(x=>[x.exercise,x.unit,x.reps]))')),
  [['Sáně','meters',15],['Sáně','meters',15],['Sáně','meters',15],
   ['Plank','seconds',30],['Plank','seconds',30],['Plank','seconds',30],
   ['Dřep','reps',5],['Dřep','reps',5],['Dřep','reps',5]]);
run("db.sessions=[{id:'mixed',date:today(),start:'10:00',end:'11:00',duration:60,rpe:7,type:'Silový trénink',title:'Smíšený trénink',status:'done',sets:collected}];validate(db);save()");
const mixed=run('JSON.stringify(db)');
run('db=validate(JSON.parse(localStorage.getItem(KEY)))');
assert.equal(run('JSON.stringify(db)'),mixed);
assert.equal(run('strengthAmounts(db.sessions[0].sets)'),'1\u00a0500 kg objem · 90 s · 45 m');
for(const text of ['Sáně · 3 × 15 m','Plank · 3 × 30 s','Dřep · 3 × 5 opak.']) {
  assert.ok(run('exerciseSummary(db.sessions[0].sets)').includes(text),text);
  assert.ok(run('historyRows(\'\')').includes(text),'History displays '+text);
}
const editor=run('setsHtml(db.sessions[0].sets)');
assert.ok(editor.includes('value="meters" selected'));
assert.ok(editor.includes('value="seconds" selected'));
assert.ok(editor.includes('Vzdálenost (m)<input name="setReps"'));
assert.ok(editor.includes('Čas (s)<input name="setReps"'));
assert.ok(run("previousExercise('Sáně')").includes('15 m'));
assert.ok(run("previousExercise('Plank')").includes('30 s'));
run("globalThis.copies=makeCopies(db.sessions[0],[add(today(),1),add(today(),2)])");
assert.equal(run('copies.length'),2);
assert.equal(run("copies[1].sets[0].unit"),'meters');
assert.equal(run("copies[1].sets[3].unit"),'seconds');
assert.equal(run("copies[1].status"),'planned');
run('trainingCsv()');
const csv=exportCalls.at(-1)[1].split('\r\n').map(line=>line.split(';'));
assert.ok(csv.every(row=>row.length===21),'CSV has consistent column count');
assert.equal(csv[0][15],'"Jednotka série"');
assert.equal(csv[1][8],'"15"');
assert.equal(csv[1][15],'"m"');
assert.equal(csv[4][8],'"30"');
assert.equal(csv[4][15],'"s"');
for (const [unit,value,valid] of [['reps',2.5,false],['seconds',30.5,true],['meters',15.5,true],
  ['meters',-1,false],['seconds',86401,false],['yards',15,false],[null,5,false]]) {
  context.sampleUnit=unit;context.sampleValue=value;
  assert.equal(run('validSetQuantity({unit:sampleUnit,reps:sampleValue})'),valid);
}
assert.equal(run('setUnit({reps:5})'),'reps','Old entries stay repetitions');
assert.equal(run('validSetQuantity({reps:5})'),true);
// Changing a populated exercise's unit leaves unequal series values and notes intact.
blocks[0].querySelectorAll()[1].querySelector('[name=setReps]').value='20';
blocks[0].querySelector('[name=setUnit]').value='seconds';
run("changeExerciseUnit(blocks[0].querySelector('[name=setUnit]'))");
assert.equal(run('collectSets()[1].reps'),20);
assert.equal(run('collectSets()[1].unit'),'seconds');
assert.equal(run('collectSets()[1].notes'),'Série 2');
assert.equal(blocks[0].querySelector('.variedhint').hidden,false);
console.log('PASS: mixed-unit collection, JSON roundtrip, history, editor, copy, CSV, tonnage exclusion, unit validation, non-destructive unit switch.');

// Restore must validate before replacing anything and preserve the current diary
// if content is empty/truncated, confirmation is declined, or disk storage fails.
const beforeImport=run('JSON.stringify(db)');
for (const bad of ['', '  \n ', '\uFEFF ', '{"version":1,', '{"version":999}', '<html>download failed</html>']) {
  context.backupText=bad;
  assert.throws(()=>run('restoreBackupText(backupText)'));
  assert.equal(run('JSON.stringify(db)'),beforeImport);
}
context.backupText='\uFEFF'+mixed;
assert.equal(run('JSON.stringify(parseBackupText(backupText))'),mixed,'UTF-8 BOM backup is supported');
context.confirm=()=>false;
assert.equal(run('restoreBackupText(backupText)'),false);
assert.equal(run('JSON.stringify(db)'),beforeImport);
context.confirm=()=>true;
const originalSet=context.localStorage.setItem;
context.localStorage.setItem=()=>{throw Error('Storage full');};
assert.throws(()=>run('restoreBackupText(backupText)'),/trvale uložit/);
assert.equal(run('JSON.stringify(db)'),beforeImport);
context.localStorage.setItem=originalSet;
assert.equal(run('restoreBackupText(backupText)'),true);
assert.equal(run('JSON.stringify(db)'),mixed);
assert.equal(storage.get('bjj-performance-html-beta-v1'),mixed);

const nativeBackups=[];
context.window.AndroidFiles.exportBackup=(name,content)=>nativeBackups.push({name,content});
run("delete db.lastBackup;save();exportDiaryBackup()");
assert.equal(nativeBackups.length,1);
assert.equal(run('db.lastBackup'),undefined,'Opening picker is not a completed backup');
assert.equal(JSON.parse(nativeBackups[0].content).sessions[0].sets[0].unit,'meters');
assert.equal(run("window.onAndroidBackupSaved('2026-11-01')"),true);
assert.equal(run('db.lastBackup'),'2026-11-01');
assert.equal(run("window.onAndroidBackupSaved('bad-date')"),false);
let importFinished=0;
const importAlerts=[];
context.alert=message=>importAlerts.push(message);
context.window.AndroidFiles.readImportedBackup=()=>'';
context.window.AndroidFiles.finishImport=()=>{importFinished++;};
assert.equal(run('window.receiveAndroidBackup()'),false);
assert.equal(importFinished,1);
assert.ok(importAlerts[0].includes('prázdný'));
context.window.AndroidFiles.readImportedBackup=()=>mixed;
assert.equal(run('window.receiveAndroidBackup()'),true);
assert.equal(importFinished,2);
assert.equal(run('JSON.stringify(db)'),mixed);
console.log('PASS: empty/truncated/invalid backup rejection, BOM import, cancelled restore, storage-failure rollback, native import handoff, export success acknowledgement.');

assert.equal(run('BUILTIN_EXERCISES.length'),280);
assert.equal(run('new Set(BUILTIN_EXERCISES.map(x=>x.id)).size'),280);
assert.equal(run("filteredExercises({tab:'all',query:'zadni drep'}).some(x=>x.name==='Back Squat')"),true);
assert.equal(run("filteredExercises({tab:'all',query:'tlačení saní'})[0].name"),'Sled Push');
assert.equal(run("filteredExercises({tab:'all',query:'',category:'core',equipment:'barbell'}).length"),0);
assert.equal(run("makeCatalogSets(matchExercise('plank'))[0].unit"),'seconds');
assert.equal(run("makeCatalogSets(matchExercise('sáně'))[0].unit"),'meters');
context.customValues=new Map([['exerciseName','My QA Carry'],['category','carry'],['equipment','dumbbell'],['unit','meters'],['aliases','moje chůze'],['exerciseNotes','Moje varianta']]);
run('globalThis.custom=customExerciseFromValues(customValues);globalThis.nextDiary=clone(db);nextDiary.customExercises=[custom];nextDiary.exerciseFavorites=[custom.id];persistDiary(nextDiary)');
assert.equal(run("filteredExercises({tab:'custom',query:'moje chuze'}).length"),1);
const richBackup=run('JSON.stringify(db)');
run('db=parseBackupText(JSON.stringify(db))');
assert.equal(run('JSON.stringify(db)'),richBackup);
assert.equal(run('db.customExercises[0].unit'),'meters');
context.customValues.set('exerciseName','Back Squat');
assert.throws(()=>run('customExerciseFromValues(customValues)'),/existuje/);
assert.throws(()=>run("validate({...clone(db),customExercises:[{...custom,unit:'yards'}]})"));
assert.throws(()=>run("validate({...clone(db),profile:{...db.profile,heightCm:400}})"));
assert.throws(()=>run("validate({...clone(db),profile:{...db.profile,birthDate:'2026-02-31'}})"));
assert.throws(()=>run("validate({...clone(db),sessions:[{...db.sessions[0],sets:[{...db.sessions[0].sets[0],done:'yes'}]}]})"));
run("globalThis.assisted=[{exercise:'Assisted Pull-Up',reps:10,weight:30,loadMode:'assistance'}]");
assert.ok(run('strengthAmounts(assisted)').includes('0 kg'),'Assistance is not added to lifted tonnage');
console.log('PASS: 280 unique exercises, Czech aliases, filters, unit defaults, custom exercise validation and backup, profile validation, assistance exclusion.');

// Cold boot is different from calling validate after the script has initialized.
// Verify stored mixed-unit data can be read before the first render.
const coldNodes=new Map();
const coldNode=selector=>{if(!coldNodes.has(selector))coldNodes.set(selector,{innerHTML:'',textContent:'',hidden:false,dataset:{},addEventListener(){},querySelectorAll(){return []},toggleAttribute(){}});return coldNodes.get(selector);};
const coldStorage=new Map([['bjj-performance-html-beta-v1',richBackup]]);
const cold=vm.createContext({console,Date,Math,JSON,Set,Map,Number,String,Array,Object,Intl,Blob,
 FormData:class extends Map{constructor(){super();}},
 document:{querySelector:coldNode,querySelectorAll(){return []},addEventListener(){},title:''},
 window:{},localStorage:{getItem:k=>coldStorage.get(k)??null,setItem:(k,v)=>coldStorage.set(k,v)},
 setInterval(){},setTimeout(){},clearTimeout(){},confirm:()=>true});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../app/src/main/assets/exercise-catalog.js'),'utf8'),cold);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../app/src/main/assets/planner-core.js'),'utf8'),cold);
vm.runInContext(script,cold);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../app/src/main/assets/app-v2.js'),'utf8'),cold);
assert.equal(vm.runInContext('storageLocked',cold),false);
assert.equal(vm.runInContext('db.demo',cold),false);
assert.equal(vm.runInContext('db.customExercises[0].unit',cold),'meters');
assert.equal(vm.runInContext('db.sessions[0].sets[0].unit',cold),'meters');
assert.equal(vm.runInContext('JSON.stringify(db)',cold),richBackup);
console.log('PASS: cold boot from persisted mixed-unit workouts and custom library without demo fallback or data changes.');

run("db.sessions[0].sets[0].done=true;globalThis.futureCopy=makeCopies(db.sessions[0],[add(today(),1)])[0]");
assert.equal(run('futureCopy.sets[0].done'),false);
assert.equal(run('db.sessions[0].sets[0].done'),true);
console.log('PASS: planned copies reset series completion without changing the source workout.');

// Calendar and coach contracts: real conflicts, untouched originals, bounded
// templates, stale previews, and backwards-compatible persisted backups.
run("db=emptyDiary();db.profile.availableEquipment=['bodyweight','barbell','dumbbell','kettlebell','cardio'];db.profile.strengthExperience='Pokročilý';globalThis.baseDate=add(today(),2)");
run("globalThis.shift={id:'shift-test',date:baseDate,kind:'night',start:'19:00',end:'07:00',nextDay:true,home:true,label:''};db.workShifts=[shift]");
run("globalThis.slot={id:'slot-test',date:add(baseDate,1),start:'06:30',end:'17:00',minutes:60,available:true};db.trainingSlots=[slot];validate(db)");
assert.ok(run('slotConflicts(db,slot).length')>0,'Night continues into the next day');
run("slot.start='07:00'");
assert.equal(run('slotConflicts(db,slot).length'),0,'Touching endpoints do not overlap');
run("globalThis.opts={start:baseDate,end:add(baseDate,20),goal:'mixed',avoidBjj:true};globalThis.draft=buildCoachDraft(db,opts)");
assert.equal(run('draft.items.length'),0,'Post-night slot without reserved sleep skipped');
assert.ok(run("draft.skipped[0].reasons.join(' ').includes('6 h')"));
run("db.workShifts.push({id:'sleep-test',kind:'sleep',date:add(baseDate,1),start:'07:00',end:'13:00',nextDay:false,home:false,label:''});slot.start='14:00';globalThis.draft=buildCoachDraft(db,opts)");
assert.equal(run('draft.items.length'),1);
assert.ok(run('draft.items[0].session.sets.every(s=>s.done===false&&s.prescription)'));
run('validate({...clone(db),sessions:draft.items.map(x=>x.session)})');
const scheduleBackup=run('JSON.stringify(db)');
assert.equal(run('JSON.stringify(parseBackupText(JSON.stringify(db)))'),scheduleBackup);
assert.throws(()=>run("validate({...clone(db),workShifts:[{...shift,nextDay:false}]})"));
assert.throws(()=>run("validate({...clone(db),trainingSlots:[{...slot,minutes:130}]})"));
assert.throws(()=>run("validate({...clone(db),trainingSlots:[slot,{...slot}]})"));
run("db.sessions=[{id:'bjj-test',date:slot.date,start:'18:00',end:'19:30',duration:90,type:'BJJ Gi',title:'BJJ',rpe:7,status:'planned',sets:[]}]");
assert.equal(run('buildCoachDraft(db,opts).items.length'),0,'BJJ-day preference honored');
run('opts.avoidBjj=false');
assert.equal(run('buildCoachDraft(db,opts).items.length'),1,'User may allow nonoverlapping BJJ day');
run("db.sessions[0].start='14:30';db.sessions[0].end='16:00'");
assert.equal(run('buildCoachDraft(db,opts).items.length'),0,'Actual BJJ overlap always rejected');
run("db.sessions=[];db.workShifts=[];db.trainingSlots=Array.from({length:6},(_,i)=>({...slot,id:'slot-'+i,date:add(baseDate,i)}));globalThis.beforePlan=JSON.stringify(db);globalThis.draft=buildCoachDraft(db,opts)");
assert.equal(run('draft.items.length'),3,'Adjacent gym dates filtered');
assert.equal(run('JSON.stringify(db)'),run('beforePlan'),'Preview is nonmutating');
run("db.profile.limitations='Omezení k posouzení'");
assert.throws(()=>run('buildCoachDraft(db,opts)'),/omezení/);
run("db.profile.limitations='';db.profile.excludedExercises='Goblet Squat, Back Squat, Bodyweight Hip Bridge'");
assert.ok(run("buildCoachDraft(db,opts).items.every(x=>x.session.sets.every(s=>!['Goblet Squat','Back Squat','Bodyweight Hip Bridge'].includes(s.exercise)))"));
run("db.profile.excludedExercises='';globalThis.coachFormValuesForTest=clone(opts)");
for(const goal of ['strength','power','conditioning','mixed']){
 run(`opts.goal=${JSON.stringify(goal)};globalThis.draft=buildCoachDraft(db,opts)`);
 assert.ok(run('draft.items.length')>0,goal+' has usable template');
 run('validate({...clone(db),sessions:draft.items.map(x=>x.session)})');
 assert.ok(run('draft.items.every(x=>x.session.sets.every(s=>s.unit!=="seconds"||s.reps<=86400))'));
}
run('coachDraft=buildCoachDraft(db,opts);db.profile.name="Changed"');
assert.throws(()=>run('commitCoachDraft()'),/změnil/);
run('coachDraft=buildCoachDraft(db,opts);coachFormValues=clone(opts);commitCoachDraft()');
assert.equal(run('db.sessions.length'),3);
assert.equal(run('db.coachPlans.length'),1);
assert.equal(run('buildCoachDraft(db,opts).items.length'),0,'Repeated generation cannot duplicate existing sessions');
const fullPlanBackup=run('JSON.stringify(db)');
assert.equal(run('JSON.stringify(parseBackupText(JSON.stringify(db)))'),fullPlanBackup);
run('route="coach";render()');assert.ok(nodes.get('#app').innerHTML.includes('Tréninkový plán'));
run('route="schedule";render()');assert.ok(nodes.get('#app').innerHTML.includes('scheduleform'));
run('storageLocked=true');assert.throws(()=>run('persistDiary(emptyDiary())'),/Původní/);run('storageLocked=false');
console.log('PASS: overnight/endpoint/sleep/BJJ conflicts, all four goals, equipment/exclusions, spacing, immutable previews, stale commits, idempotent scheduling, full JSON roundtrip and locked-storage protection.');
