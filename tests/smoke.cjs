// Data/render smoke checks without a browser. Does not test Android UI.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '../app/src/main/assets/index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const storage = new Map(), nodes = new Map();
const node = selector => {
  if (!nodes.has(selector)) nodes.set(selector, {innerHTML:'', textContent:'', hidden:false, addEventListener(){}, classList:{add(){},remove(){}}, focus(){}});
  return nodes.get(selector);
};
const exportCalls = [];
const context = vm.createContext({
  console, Date, Math, JSON, Set, Map, Number, String, Array, Object, Intl,
  document:{querySelector:node,addEventListener(){},title:''},
  window:{AndroidFiles:{exportFile(...args){exportCalls.push(args)}}},
  localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},
  setInterval(){},setTimeout(){},clearTimeout(){},confirm:()=>true,
});
const run = code => vm.runInContext(code, context);
vm.runInContext(script, context);
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
assert.ok(csv.every(row=>row.length===16),'CSV has consistent column count');
assert.equal(csv[0].at(-1),'"Jednotka série"');
assert.equal(csv[1][8],'"15"');
assert.equal(csv[1].at(-1),'"m"');
assert.equal(csv[4][8],'"30"');
assert.equal(csv[4].at(-1),'"s"');
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
