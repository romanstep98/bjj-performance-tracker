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
