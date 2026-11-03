'use strict';

const plannerLabels={day:'Denní směna',night:'Noční směna',custom:'Vlastní směna',sleep:'Rezervovaný spánek',slot:'Termín posilovny'};
const workoutBlocks={warmup:'Rozcvičení',power:'Výbušnost',strength:'Síla',accessory:'Doplňky',conditioning:'Kondice'};
let scheduleMonth=today().slice(0,7),scheduleDays=new Set(),scheduleEditId=null,scheduleValues={kind:'day',start:'07:00',end:'19:00',nextDay:false,home:false,label:'',minutes:60,available:true};
let coachDraft=null,coachFormValues={start:today(),end:add(today(),83),goal:'mixed',avoidBjj:true};
const plannerPreviousRender=render,plannerPreviousHome=home,plannerPreviousNav=navhtml,plannerPreviousOpenEditor=openEditor,plannerPreviousCollect=collectSets,plannerPreviousSetsHtml=setsHtml,plannerPreviousBack=window.handleAppBack;
const plannerPreviousNavigate=navigate;
const plannerPreviousSaveEntry=saveEntry;
saveEntry=function(form){const previous=db,previousSave=save;try{save=function(){persistDiary(db);return true;};return plannerPreviousSaveEntry(form);}catch(e){db=previous;throw e;}finally{save=previousSave;}};

function scheduleBadges(d){
 const blocks=(db.workShifts||[]).filter(x=>x.date===d||x.nextDay&&add(x.date,1)===d);
 const slots=(db.trainingSlots||[]).filter(x=>x.date===d);
 return blocks.map(x=>`<button type="button" class="schedule-event ${x.kind==='sleep'?'sleep-event':'shift-event'}" data-planner="edit" data-id="${esc(x.id)}"><strong>${x.home?'⌂ ':''}${esc(x.label||plannerLabels[x.kind])}</strong><span>${x.date===d?x.start+'–'+x.end+(x.nextDay?' (+1 den)':''):'Pokračování do '+x.end}</span></button>`).join('')+slots.map(x=>`<button type="button" class="schedule-event slot-event" data-planner="edit" data-id="${esc(x.id)}"><strong>${x.available?'Posilovna možná':'Posilovna nemohu'}</strong><span>${x.start}–${x.end} · ${x.minutes} min</span>${x.available&&slotConflicts(db,x).length?'<span>Obsazený termín: '+slotConflicts(db,x).map(esc).join(' · ')+'</span>':''}</button>`).join('');
}
function scheduleText(d){
 const shifts=(db.workShifts||[]).filter(x=>x.date===d||x.nextDay&&add(x.date,1)===d);
 const slots=(db.trainingSlots||[]).filter(x=>x.date===d);
 return shifts.map(x=>`<small class="${x.kind==='sleep'?'sleep-dot':'shift-dot'}">${esc(x.label||plannerLabels[x.kind])}${x.date!==d?' do '+x.end:''}</small>`).join('')+slots.map(x=>`<small class="slot-dot">${x.available?'Posilovna ✓':'Posilovna ×'}</small>`).join('');
}
calendar=function(){
 const start=calMode==='Den'?calDate:calMode==='Týden'?week(calDate):calDate.slice(0,8)+'01';
 const end=calMode==='Den'?start:calMode==='Týden'?add(start,6):iso(new Date(Number(start.slice(0,4)),Number(start.slice(5,7)),0));
 const days=Array.from({length:diff(start,end)+1},(_,i)=>add(start,i));
 return head('Kalendář a směny','Práce, spánek, BJJ a prostor pro posilovnu.')+`<div class="v2-toolbar"><button class="btn primary" data-planner="schedule">Směny a dostupnost</button><button class="btn" data-nav="coach">Sestavit plán</button>${btn('+ Aktivita','new-selected')}</div><section class="card"><div class="cardhead planner-cal-head"><div class="flex">${btn('‹','cal-prev','small ghost')}<strong>${fmt(start,{day:'numeric',month:'short'})}${start!==end?' – '+fmt(end,{day:'numeric',month:'short',year:'numeric'}):''}</strong>${btn('›','cal-next','small ghost')}${btn('Dnes','cal-today','small ghost')}</div><div class="segmented">${['Den','Týden','Měsíc'].map(x=>`<button data-calmode="${x}" class="${calMode===x?'active':''}">${x}</button>`).join('')}</div></div>${calMode==='Měsíc'?`<div class="monthgrid planner-month">${['Po','Út','St','Čt','Pá','So','Ne'].map(x=>`<span class="tag">${x}</span>`).join('')}${Array.from({length:(new Date(start+'T12:00:00').getDay()+6)%7},()=>'<span></span>').join('')}${days.map(d=>`<button class="monthcell ${d===today()?'today':''}" data-day="${d}" aria-label="${d}"><span>${Number(d.slice(-2))}</span>${scheduleText(d)}${db.sessions.filter(x=>x.date===d).map(x=>`<small>${esc(x.title)}</small>`).join('')}${db.tournaments.filter(x=>x.date===d).map(x=>`<small>${esc(x.name)}</small>`).join('')}</button>`).join('')}</div>`:days.map(d=>`<section class="planner-day ${d===today()?'istoday':''}"><div class="flex spread"><strong>${fmt(d,{weekday:'long',day:'numeric',month:'long'})}</strong><button class="btn small ghost" data-newday="${d}">+ Trénink</button></div><div class="schedule-events">${scheduleBadges(d)}</div>${db.sessions.filter(x=>x.date===d).sort((a,b)=>a.start.localeCompare(b.start)).map(session).join('')}${db.tournaments.filter(x=>x.date===d).map(x=>`<button class="btn" data-edit="tournaments:${esc(x.id)}">${esc(x.name)}</button>`).join('')}<p class="daystatus">${dayStatus(d)}</p><button class="textbutton" data-planner="schedule-day" data-date="${d}">+ Směna / spánek / dostupnost</button></section>`).join('')}</section><p class="formhint">Modrá: práce · fialová: rezervovaný spánek · zelená: dostupnost. Rezervace spánku není záznam skutečně naspaných hodin.</p><div class="v2-toolbar">${btn('Kopírovat tréninkový týden','copy-week')}${btn('Historie','nav-history')}</div>`;
};

function scheduleRead(form){const v=new FormData(form);return {kind:String(v.get('kind')),start:String(v.get('start')),end:String(v.get('end')),nextDay:v.has('nextDay'),home:v.has('home'),label:String(v.get('label')||'').trim(),minutes:Number(v.get('minutes')||60),available:v.has('available')};}
function schedulePage(){
 const v=scheduleValues,start=scheduleMonth+'-01',last=iso(new Date(Number(start.slice(0,4)),Number(start.slice(5,7)),0)),days=Array.from({length:diff(start,last)+1},(_,i)=>add(start,i));
 return head(scheduleEditId?'Upravit záznam':'Směny a dostupnost','Vyber více dnů a přiřaď jim stejný záznam.')+`<div class="v2-toolbar"><button class="btn ghost" data-nav="calendar">← Kalendář</button><button class="btn ghost" data-planner="schedule-new">Nový záznam</button></div><form id="scheduleform" class="forms card"><div class="flex spread"><button type="button" class="btn small" data-planner="month-prev" aria-label="Předchozí měsíc">‹</button><label>Měsíc<input type="month" id="schedulemonth" value="${scheduleMonth}" required></label><button type="button" class="btn small" data-planner="month-next" aria-label="Následující měsíc">›</button></div><div class="schedule-picker">${['Po','Út','St','Čt','Pá','So','Ne'].map(x=>`<span class="tag">${x}</span>`).join('')}${Array.from({length:(new Date(start+'T12:00:00').getDay()+6)%7},()=>'<span></span>').join('')}${days.map(d=>`<label class="schedule-pick"><input type="checkbox" data-schedule-date="${d}" aria-label="Vybrat ${d}" ${scheduleDays.has(d)?'checked':''} ${scheduleEditId&&!scheduleDays.has(d)?'disabled':''}><span>${Number(d.slice(-2))}</span>${(db.workShifts||[]).some(x=>x.date===d)?'<i class="shift-mark"></i>':''}${(db.trainingSlots||[]).some(x=>x.date===d)?'<i class="slot-mark"></i>':''}</label>`).join('')}</div><p id="schedulecount" class="formhint">Vybráno dnů: ${scheduleDays.size}${scheduleDays.size?' · '+[...scheduleDays].sort().map(d=>fmt(d,{day:'numeric',month:'numeric'})).join(', '):''}</p><button type="button" class="textbutton" data-planner="days-clear">Zrušit výběr dnů</button><label>Co chceš zadat?<select name="kind">${Object.entries(plannerLabels).map(([k,l])=>`<option value="${k}" ${v.kind===k?'selected':''}>${l}</option>`).join('')}</select></label><div class="v2-formrow"><label>Začátek<input type="time" name="start" value="${esc(v.start)}" required></label><label>Konec / konec okna<input type="time" name="end" value="${esc(v.end)}" required></label></div><div data-schedule-work ${v.kind==='slot'?'hidden':''}><label class="checklabel"><input type="checkbox" name="nextDay" ${v.nextDay?'checked':''}>Konec následující den</label><label class="checklabel"><input type="checkbox" name="home" ${v.home?'checked':''}>Práce z domova</label><label>Vlastní název · volitelné<input name="label" maxlength="120" value="${esc(v.label)}" placeholder="Např. denní + dojíždění"></label><p class="formhint">Zadej celý blok, kdy nejsi dostupný, případně včetně dojíždění. Noční patří ke dni jejího začátku. Práce z domova také blokuje souběžný trénink.</p></div><div data-schedule-slot ${v.kind==='slot'?'':'hidden'}><label>Délka tréninku v okně (min)<input type="number" name="minutes" value="${v.minutes}" min="20" max="120" step="1"></label><label class="checklabel"><input type="checkbox" name="available" ${v.available?'checked':''}>V tomto termínu mohu do posilovny</label><p class="formhint">Návrh začne na začátku okna. Jeden termín na den; nové zadání nabídne nahrazení starého. Kolidující termín lze uložit, plánovač jej ale vynechá.</p></div><p id="scheduleerror" class="v2-error" role="alert"></p><button class="btn primary" type="submit">${scheduleEditId?'Uložit změnu':'Uložit do vybraných dnů'}</button>${scheduleEditId?'<button class="btn danger" type="button" data-planner="schedule-delete">Odstranit tento záznam</button>':''}</form>`;
}
function saveSchedule(form){
 const v=scheduleRead(form);if(!scheduleDays.size)throw Error('Vyber alespoň jeden den v kalendáři.');if(scheduleDays.size>366)throw Error('Najednou vyber nejvýše 366 dní.');
 const next=clone(db),key=v.kind==='slot'?'trainingSlots':'workShifts';next[key]??=[];
 const replacement=v.kind==='slot'?next[key].filter(x=>scheduleDays.has(x.date)&&x.id!==scheduleEditId):[];
 if(replacement.length&&!confirm(`Nahradit dostupnost v ${replacement.length} dnech?`))return;
 if(scheduleEditId){for(const k of ['workShifts','trainingSlots'])next[k]=(next[k]||[]).filter(x=>x.id!==scheduleEditId);}
 if(v.kind==='slot')next[key]=next[key].filter(x=>!scheduleDays.has(x.date));
 for(const date of scheduleDays){const e=v.kind==='slot'?{id:scheduleEditId||uid(),date,start:v.start,end:v.end,minutes:v.minutes,available:v.available}:{id:scheduleEditId||uid(),date,kind:v.kind,start:v.start,end:v.end,nextDay:v.nextDay,home:v.home,label:v.label};
  if(v.kind!=='slot'&&next[key].some(x=>x.kind===e.kind&&JSON.stringify(scheduleRange(x))===JSON.stringify(scheduleRange(e))))continue;
  next[key].push(e);
 }
 validate(next);persistDiary(next);scheduleValues=v;scheduleDays.clear();scheduleEditId=null;coachDraft=null;render();toast('Kalendář uložen.');
}

function coachPage(){
 const v=coachFormValues;
 return head('Tréninkový plán','Návrh podle tvých termínů, BJJ a vybavení.')+`<div class="v2-toolbar"><button class="btn" data-nav="calendar">Kalendář</button><button class="btn" data-planner="schedule">Zadat termíny</button><button class="btn ghost" data-nav="profile">Profil a vybavení</button></div><form id="coachform" class="forms card"><div class="v2-formrow"><label>Začátek<input type="date" name="start" required min="${today()}" value="${v.start}"></label><label>Konec bloku / datum turnaje<input type="date" name="end" required min="${today()}" value="${v.end}"></label></div><label>Hlavní zaměření<select name="goal">${[['strength','Síla'],['power','Výbušnost'],['conditioning','Kondice'],['mixed','Kombinace']].map(([k,l])=>`<option value="${k}" ${v.goal===k?'selected':''}>${l}</option>`).join('')}</select></label>${db.tournaments.filter(t=>t.date>=today()).map(t=>`<button type="button" class="textbutton" data-planner="use-tournament" data-date="${t.date}">Do turnaje: ${esc(t.name)} · ${fmt(t.date)}</button>`).join('')}<label class="checklabel"><input type="checkbox" name="avoidBjj" ${v.avoidBjj?'checked':''}>Vynechat posilovnu ve dnech s BJJ</label><details><summary>Jak návrh rozhoduje</summary><p class="formhint">Používá pouze označené dostupné termíny. Vynechá překryv s prací, spánkem a tréninky, dny volna a turnaje. Mezi silovými jednotkami ponechá celý den. Po noční vyžaduje rezervaci alespoň 6 h spánku; jde o nastavovací pravidlo návrhu, nikoli potvrzení zotavení. Blízké BJJ, únava, turnajový týden a každý čtvrtý týden snižují objem. Zátěže automaticky nezvyšuje.</p><p class="formhint">Jde o základní šablony s pravidly, nikoli individuální trenérský posudek. Pohybová omezení vyžadují ruční plán. Návrh nečte význam volného textu v cílech a preferencích; používá zde vybraný cíl, vybavení, zkušenosti a seznam vynechaných cviků. Vynechané cviky odděl čárkou nebo novým řádkem.</p></details><p id="coacherror" class="v2-error" role="alert"></p><button class="btn primary" type="submit">Zobrazit návrh bez uložení</button></form><div id="coachpreview">${coachPreview()}</div>`;
}
function coachPreview(){if(!coachDraft)return '<p class="formhint">Nejdřív vyplň směny, BJJ a dostupnost. Existující tréninky návrh nepřepisuje.</p>';return `<section class="card coach-preview"><h2>Návrh: ${coachDraft.items.length} jednotek</h2><p class="formhint">${coachDraft.skipped.length} termínů vynecháno. Před uložením zkontroluj cviky a důvody; vše pak upravíš v deníku.</p>${coachDraft.items.map(x=>`<details class="coach-item"><summary>${fmt(x.session.date)} · ${x.session.start} · ${esc(x.session.title)} · ${x.session.duration} min</summary><ul>${x.reasons.map(r=>`<li>${esc(r)}</li>`).join('')}</ul>${groupSets(x.session.sets).map(g=>`<p><strong>${esc(workoutBlocks[g.sets[0].block])}</strong> · ${esc(g.name)} · ${g.sets.length} × ${setQuantity(g.sets[0])}</p>`).join('')}</details>`).join('')}${coachDraft.skipped.map(x=>`<div class="coach-skipped"><strong>${fmt(x.slot.date)} · ${x.slot.start} · vynecháno</strong><p>${x.reasons.map(esc).join(' · ')}</p></div>`).join('')}<p id="coachcommiterror" class="v2-error" role="alert"></p><button class="btn primary wide" data-planner="commit" ${coachDraft.items.length?'':'disabled'}>Uložit ${coachDraft.items.length} jednotek do kalendáře</button></section>`;}
function commitCoachDraft(){
 if(!coachDraft?.items.length)throw Error('Není co uložit.');
 if(coachDraft.fingerprint!==JSON.stringify(db))throw Error('Deník se od vytvoření návrhu změnil. Vytvoř nový návrh.');
 const next=clone(db);next.coachPlans??=[];next.coachPlans.push(coachDraft.plan);next.sessions.push(...coachDraft.items.map(x=>x.session));persistDiary(next);coachDraft=null;route='calendar';calDate=coachFormValues.start;calMode='Týden';render();toast('Plán uložen. Každý trénink můžeš upravit.');
}

home=function(){const content=plannerPreviousHome();return content.replace('<div class="grid metrics">',`<section class="card planner-home"><div><h2>Tvůj další plán</h2><p class="muted">Směny → BJJ → dostupnost → návrh tréninků</p></div><div class="v2-toolbar"><button class="btn primary" data-nav="coach">Sestavit plán</button><button class="btn" data-planner="schedule">Zadat směny</button></div><div class="schedule-events">${scheduleBadges(today())}</div></section><div class="grid metrics">`);};
navhtml=function(bottom=false){return plannerPreviousNav(bottom)+(bottom?'':'<button data-nav="coach">'+icon('strength')+'Tréninkový plán</button>');};
render=function(){plannerPreviousRender();if(route==='schedule')$('#app').innerHTML=schedulePage();if(route==='coach')$('#app').innerHTML=coachPage();if(['schedule','coach'].includes(route))document.title='BUILT TO ROLL — '+(route==='schedule'?'Směny':'Plán');const f=$('#scheduleform');if(f&&route==='schedule')f.dataset.initial=JSON.stringify(scheduleRead(f));};
navigate=function(next){if(route==='schedule'&&next!==route&&scheduleDays.size&&!confirm('Opustit neuložený výběr směn nebo dostupnosti?'))return;plannerPreviousNavigate(next);};

function openSchedule(id=null,date=null){
 scheduleEditId=id;scheduleDays=new Set();
 if(id){const shift=(db.workShifts||[]).find(x=>x.id===id),slot=(db.trainingSlots||[]).find(x=>x.id===id),e=shift||slot;if(!e)throw Error('Záznam již neexistuje.');scheduleValues={...scheduleValues,...e,kind:shift?shift.kind:'slot'};scheduleDays.add(e.date);scheduleMonth=e.date.slice(0,7);}
 else if(date){scheduleDays.add(date);scheduleMonth=date.slice(0,7);}
 route='schedule';render();window.scrollTo({top:0,behavior:'instant'});
}

// Keep the planned prescription separate from the actual result when the
// existing editor collects rows, including additions and exercise replacement.
setsHtml=function(sets){
 const groups=groupSets(sets),ordered=groups.flatMap(g=>g.sets);let rowIndex=0;
 return plannerPreviousSetsHtml(sets).replace(/<section class="exerciseblock v2-exercise" data-group="([^"]+)"/g,(tag,id)=>{const g=groups.find(x=>esc(x.id)===id);return tag+` data-block="${esc(g?.sets[0].block||'strength')}" data-combo="${esc(g?.sets[0].combo||'')}" data-prescribed-exercise="${esc(g?.name||'')}"`;}).replace(/<div class="seriesgrid" data-series="(\d+)"/g,tag=>{const s=ordered[rowIndex++];return tag+(s.prescription?` data-prescription="${esc(JSON.stringify(s.prescription))}"`:'');});
};
collectSets=function(){const result=plannerPreviousCollect();let i=0;for(const block of $('#entryform').querySelectorAll('.exerciseblock')){const blockName=block.querySelector('[name=trainingBlock]')?.value||block.dataset.block||'strength',combo=block.querySelector('[name=trainingCombo]')?.value||block.dataset.combo||'';for(const row of block.querySelectorAll('[data-series]')){const s=result[i++];s.block=blockName;s.combo=combo;if(row.dataset?.prescription&&s.exercise===block.dataset.prescribedExercise)s.prescription=JSON.parse(row.dataset.prescription);}}return result;};

function decorateWorkout(){if(!editing||editing.key!=='sessions')return;for(const el of document.querySelectorAll('.v2-exercise')){const group=groupSets(editing.e.sets||[]).find(g=>g.id===el.dataset.group),s=group?.sets[0];if(el.querySelector('.training-block-tools'))continue;const detail=el.querySelector('.exercise-detail'),box=document.createElement('div');box.className='training-block-tools v2-formrow';box.innerHTML=`<label>Část tréninku<select name="trainingBlock">${Object.entries(workoutBlocks).map(([k,l])=>`<option value="${k}" ${(el.dataset.block||s?.block||'strength')===k?'selected':''}>${l}</option>`).join('')}</select></label><label>Kombinace / okruh<input name="trainingCombo" maxlength="20" value="${esc(el.dataset.combo||s?.combo||'')}" placeholder="Např. A · stejné označení"></label>`;detail.prepend(box);if(s?.prescription){const p=document.createElement('p');p.className='formhint planned-prescription';p.textContent='Předpis: '+group.sets.length+' × '+setQuantity(s.prescription)+' · '+s.prescription.weight+' kg · '+s.prescription.mode+' '+s.prescription.effort+'. Pole níže slouží pro skutečnost.';box.after(p);}const small=el.querySelector('.exercise-card-summary');if(small)small.textContent=(workoutBlocks[s?.block||el.dataset.block||'strength'])+(s?.combo?' · kombinace '+s.combo:'')+' · '+small.textContent;}}
openEditor=function(...args){plannerPreviousOpenEditor(...args);decorateWorkout();if(editing)editing.initialFingerprint=formFingerprint();if(editing?.key==='sessions'&&editing.e.coachPlanId){const reasons=document.createElement('details');reasons.className='coach-session-reasons';reasons.innerHTML='<summary>Proč je trénink navržený takto?</summary><p class="formhint">'+esc(editing.e.notes||'').replaceAll('\n','<br>')+'</p>';$('#entryform').prepend(reasons);}if(editing?.key==='checks'&&!db.checks.some(x=>x.id===editing.e.id)){for(const input of $('#entryform').querySelectorAll('input[type=range]')){input.type='number';input.value='';input.required=true;input.placeholder='1–10';const value=$('#value-'+input.name);if(value)value.textContent='Nevyplněno';}editing.initialFingerprint=formFingerprint();}};
const plannerPreviousRedraw=redrawSets;
redrawSets=function(sets){plannerPreviousRedraw(sets);decorateWorkout();};

document.addEventListener('click',ev=>{
 const b=ev.target.closest('[data-planner]');if(!b)return;ev.preventDefault();ev.stopImmediatePropagation();
 try{
  const key=b.dataset.planner;
  if(key==='schedule')return openSchedule();
  if(key==='schedule-day')return openSchedule(null,b.dataset.date);
  if(key==='edit')return openSchedule(b.dataset.id);
  if(key==='schedule-new'){if(scheduleDays.size&&!confirm('Zahodit neuložený výběr?'))return;return openSchedule();}
  if(key==='days-clear'){scheduleDays.clear();document.querySelectorAll('[data-schedule-date]').forEach(x=>x.checked=false);$('#schedulecount').textContent='Vybráno dnů: 0';return;}
  if(key==='month-prev'||key==='month-next'){scheduleValues=scheduleRead($('#scheduleform'));const d=new Date(scheduleMonth+'-01T12:00:00');d.setMonth(d.getMonth()+(key==='month-next'?1:-1));scheduleMonth=iso(d).slice(0,7);return render();}
  if(key==='schedule-delete'){if(!confirm('Odstranit tento záznam?'))return;const next=clone(db);for(const k of ['workShifts','trainingSlots'])next[k]=(next[k]||[]).filter(x=>x.id!==scheduleEditId);persistDiary(next);scheduleDays.clear();scheduleEditId=null;route='calendar';render();return;}
  if(key==='use-tournament'){$('#coachform [name=end]').value=b.dataset.date;coachDraft=null;$('#coachpreview').innerHTML='';return;}
  if(key==='commit')return commitCoachDraft();
 }catch(e){const error=$('#scheduleerror')||$('#coachcommiterror')||$('#coacherror');if(error)error.textContent=e.message;else toast(e.message);}
},true);
document.addEventListener('change',ev=>{
 const el=ev.target;
 if(el.matches('[data-schedule-date]')){el.checked?scheduleDays.add(el.dataset.scheduleDate):scheduleDays.delete(el.dataset.scheduleDate);$('#schedulecount').textContent='Vybráno dnů: '+scheduleDays.size;}
 if(el.id==='schedulemonth'&&/^\d{4}-\d{2}$/.test(el.value)){scheduleValues=scheduleRead($('#scheduleform'));scheduleMonth=el.value;render();}
 if(el.closest('#scheduleform')&&el.name==='kind'){
  const f=$('#scheduleform'),kind=el.value,defaults={day:['07:00','19:00',false],night:['19:00','07:00',true],sleep:['07:00','13:00',false],slot:['15:00','17:00',false],custom:['07:00','19:00',false]}[kind];
  f.elements.start.value=defaults[0];f.elements.end.value=defaults[1];f.elements.nextDay.checked=defaults[2];f.elements.home.checked=false;f.elements.label.value='';f.querySelector('[data-schedule-work]').hidden=kind==='slot';f.querySelector('[data-schedule-slot]').hidden=kind!=='slot';
 }
 if(el.closest('#coachform')){coachDraft=null;$('#coachpreview').innerHTML='<p class="formhint">Nastavení se změnilo. Zobraz nový návrh.</p>';}
},true);
document.addEventListener('submit',ev=>{
 const f=ev.target;if(!['scheduleform','coachform'].includes(f.id))return;ev.preventDefault();ev.stopImmediatePropagation();
 try{if(f.id==='scheduleform')return saveSchedule(f);coachFormValues=plannerOptions(new FormData(f));coachDraft=buildCoachDraft(db,coachFormValues);$('#coacherror').textContent='';$('#coachpreview').innerHTML=coachPreview();$('#coachpreview').scrollIntoView?.({behavior:'smooth',block:'start'});}
 catch(e){$(f.id==='scheduleform'?'#scheduleerror':'#coacherror').textContent=e.message;}
},true);
window.handleAppBack=function(){if(plannerPreviousBack?.())return true;if(!editing&&['schedule','coach'].includes(route)){navigate('calendar');return true;}return false;};
render();
