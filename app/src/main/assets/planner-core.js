'use strict';

// Local wall-clock intervals: a night belongs to its starting date. Half-open
// ranges allow an activity to begin exactly when another one ends.
function clockMinutes(t){return Number(t.slice(0,2))*60+Number(t.slice(3));}
function clockText(n){return String(Math.floor(n/60)%24).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
function dayMinutes(d){return Date.parse(d+'T00:00:00Z')/60000;}
function scheduleRange(e){const start=dayMinutes(e.date)+clockMinutes(e.start),end=dayMinutes(e.date)+clockMinutes(e.end)+(e.nextDay||e.end<e.start?1440:0);return {start,end};}
function rangesOverlap(a,b){return a.start<b.end&&b.start<a.end;}
function validClock(t){return typeof t==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(t);}
function validatePlannerData(b){
 if(!b||typeof b!=='object')return;
 const seen=new Set();
 for(const key of ['workShifts','trainingSlots','coachPlans']){
  if(b[key]===undefined)continue;
  if(!Array.isArray(b[key])||b[key].length>5000)throw Error('Neplatný kalendář směn nebo plánů.');
  for(const e of b[key]){
   if(!e||typeof e.id!=='string'||!e.id||e.id.length>150||seen.has(e.id))throw Error('Neplatné nebo duplicitní ID plánování.');seen.add(e.id);
   if(key==='coachPlans'){
    if(!validDate(e.start)||!validDate(e.end)||e.end<e.start||diff(e.start,e.end)>366||!['strength','power','conditioning','mixed'].includes(e.goal)||typeof e.createdAt!=='string')throw Error('Neplatný tréninkový blok.');
    continue;
   }
   if(!validDate(e.date)||!validClock(e.start)||!validClock(e.end))throw Error('Neplatné datum nebo čas v kalendáři.');
   if(key==='workShifts'){
    if(!['day','night','custom','sleep'].includes(e.kind)||typeof e.nextDay!=='boolean'||typeof e.home!=='boolean'||typeof e.label!=='string'||e.label.length>120)throw Error('Neplatná směna nebo rezervace spánku.');
    const duration=clockMinutes(e.end)-clockMinutes(e.start)+(e.nextDay?1440:0);
    if(duration<=0||duration>1440)throw Error('Konec směny musí následovat po začátku, nejvýše o 24 hodin.');
   }else if(typeof e.available!=='boolean'||!finite(e.minutes,20,120)||!Number.isInteger(e.minutes)||clockMinutes(e.end)-clockMinutes(e.start)<e.minutes)throw Error('Termín musí mít 20–120 minut a vejít se do časového okna.');
  }
 }
 for(const e of b.sessions||[]){
  if(e.coachPlanId!==undefined&&(typeof e.coachPlanId!=='string'||e.coachPlanId.length>150))throw Error('Neplatná vazba na tréninkový blok.');
  for(const s of e.sets||[]){
   if(s.block!==undefined&&!['warmup','power','strength','accessory','conditioning'].includes(s.block))throw Error('Neplatný tréninkový blok cviku.');
   if(s.combo!==undefined&&(typeof s.combo!=='string'||s.combo.length>20))throw Error('Neplatné označení kombinace cviků.');
   if(s.prescription!==undefined){const p=s.prescription;if(!p||!validSetQuantity(p)||!finite(p.weight,0,2000)||!['RPE','RIR'].includes(p.mode)||!finite(p.effort,p.mode==='RIR'?0:1,10))throw Error('Neplatný předpis série.');}
  }
 }
}

function slotConflicts(data,slot){
 const range=scheduleRange({...slot,end:clockText(clockMinutes(slot.start)+slot.minutes)}),out=[];
 for(const e of data.workShifts||[])if(rangesOverlap(range,scheduleRange(e)))out.push((e.kind==='sleep'?'Spánek':'Směna')+' '+e.start+'–'+e.end+(e.nextDay?' (+1 den)':''));
 for(const e of data.sessions||[])if(e.status!=='skipped'&&e.type!=='Volno'&&rangesOverlap(range,scheduleRange(e)))out.push('Trénink: '+e.title);
 for(const e of data.sessions||[])if(e.date===slot.date&&e.type==='Volno'&&e.status!=='skipped')out.push('Naplánované volno');
 if((data.tournaments||[]).some(e=>e.date===slot.date))out.push('Turnaj');
 return out;
}

function plannerOptions(v){
 const o={start:String(v.get('start')||''),end:String(v.get('end')||''),goal:String(v.get('goal')||'mixed'),avoidBjj:v.has('avoidBjj')};
 if(!validDate(o.start)||!validDate(o.end)||o.start<today()||o.end<o.start||diff(o.start,o.end)>366)throw Error('Vyber období ode dneška, dlouhé nejvýše 366 dní.');
 if(!['strength','power','conditioning','mixed'].includes(o.goal))throw Error('Vyber cíl přípravy.');
 return o;
}

function buildCoachDraft(data,options){
 const {start,end,goal,avoidBjj}=options;
 if(!validDate(start)||!validDate(end)||start<today()||end<start||diff(start,end)>366||!['strength','power','conditioning','mixed'].includes(goal))throw Error('Neplatné období nebo cíl přípravy.');
 const equipment=data.profile.availableEquipment||[];
 if(!equipment.length)throw Error('Nejdřív v profilu vyber dostupné vybavení, případně pouze vlastní váhu.');
 if(data.profile.limitations?.trim())throw Error('V profilu máš uvedená pohybová omezení. Automatický návrh je neumí odborně posoudit. Použij ruční plán, nebo po ověření aktuálního stavu uprav profil.');
 const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const excluded=String(data.profile.excludedExercises||'').split(/[,;\n]/).map(normalize).filter(Boolean);
 const catalog=BUILTIN_EXERCISES.concat(data.customExercises||[]);
 const pick=names=>names.map(name=>catalog.find(e=>e.name===name)).find(e=>e&&equipment.includes(e.equipment)&&!excluded.some(x=>[e.name,...e.aliases].some(n=>normalize(n).includes(x))));
 const slots=(data.trainingSlots||[]).filter(s=>s.available&&s.date>=start&&s.date<=end).slice().sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start));
 const items=[],skipped=[],planId=uid(),working=clone(data);
 let lastStrength=null;
 for(const slot of slots){
  const reasons=[],conflicts=slotConflicts(working,slot);
  if(avoidBjj&&(data.sessions||[]).some(e=>e.date===slot.date&&isBjj(e.type)&&e.status!=='skipped'))conflicts.push('BJJ ve stejném dni (zapnuté pravidlo)');
  if(lastStrength&&diff(lastStrength,slot.date)<2)conflicts.push('Mezi navrženými jednotkami není celý den bez posilovny');
  if((data.sessions||[]).some(e=>e.type==='Silový trénink'&&e.status!=='skipped'&&Math.abs(diff(e.date,slot.date))<2))conflicts.push('Silový trénink už je ve stejném nebo sousedním dni');
  const night=(data.workShifts||[]).find(e=>e.kind!=='sleep'&&e.nextDay&&add(e.date,1)===slot.date);
  if(night){
   const wake=dayMinutes(slot.date)+clockMinutes(night.end),begin=dayMinutes(slot.date)+clockMinutes(slot.start);
   const sleeps=(data.workShifts||[]).filter(e=>e.kind==='sleep').map(scheduleRange).filter(r=>r.start>=wake&&r.end<=begin);
   if(!sleeps.some(r=>r.end-r.start>=360))conflicts.push('Po noční chybí před tréninkem rezervace alespoň 6 h spánku');
   else reasons.push('Po noční: rezervace spánku je zadaná, skutečný stav ověř před tréninkem.');
  }
  const check=(data.checks||[]).find(c=>c.date===slot.date);
  if(check?.painLevel>0)conflicts.push('Check-in obsahuje bolest – použij ruční posouzení plánu');
  if(conflicts.length){skipped.push({slot:clone(slot),reasons:[...new Set(conflicts)]});continue;}
  const tournament=(data.tournaments||[]).filter(t=>t.date>=slot.date&&t.date<=end).sort((a,b)=>a.date.localeCompare(b.date))[0];
  const near=tournament&&diff(slot.date,tournament.date)<=7;
  const bjjNear=(data.sessions||[]).some(e=>isBjj(e.type)&&e.status!=='skipped'&&Math.abs(diff(slot.date,e.date))<=1);
  const tired=!!check&&(check.fatigue>=7||check.energy<=3||check.rested<=3);
  const weekIndex=Math.floor(diff(start,slot.date)/7),light=near||bjjNear||tired||night||weekIndex%4===3;
  const novice=data.profile.strengthExperience!=='Pokročilý';
  const count=light||novice?2:3,effort=light?6:7;
  reasons.push('Cíl: '+({strength:'síla',power:'výbušnost',conditioning:'kondice',mixed:'kombinace'}[goal])+'.');
  if(bjjNear)reasons.push('BJJ v sousedním nebo stejném dni: menší počet sérií.');
  if(near)reasons.push('Do turnaje zbývá nejvýše 7 dní: lehčí návrh bez progrese.');
  if(tired)reasons.push('Dnešní check-in ukazuje únavu: menší objem.');
  if(weekIndex%4===3)reasons.push('Každý čtvrtý týden bloku má menší objem.');
  if(novice)reasons.push('Zkušenosti nejsou označené jako pokročilé: základní objem.');
  if(!check)reasons.push('Před začátkem doplň aktuální check-in; budoucí připravenost neznáme.');
  const sets=[],sequence=items.length%2;
  function append(names,block,n,reps,unit='reps',rest=90){
   const ex=pick(names);if(!ex){reasons.push('Vynecháno: '+names[0]+' – vybavení nebo seznam vynechaných cviků.');return;}
   const groupId=uid();
   const candidates=(data.sessions||[]).filter(e=>e.status==='done'&&e.date<slot.date&&e.date<=today()&&diff(e.date,slot.date)<=90).sort((a,b)=>b.date.localeCompare(a.date));
   const previous=candidates.flatMap(e=>e.sets||[]).find(s=>s.exercise===ex.name&&setUnit(s)===unit&&s.reps===reps&&s.mode==='RPE'&&s.effort<=effort&&s.loadMode!=='assistance');
   const weight=ex.equipment==='bodyweight'?0:previous?.weight||0;
   for(let i=0;i<n;i++){const prescription={reps,unit,weight,effort:block==='warmup'?4:effort,mode:'RPE'};sets.push({exercise:ex.name,exerciseId:ex.id,groupId,...prescription,prescription:clone(prescription),block,restSeconds:rest,loadMode:ex.equipment==='bodyweight'?'bodyweight':'weight',done:false,notes:'',exerciseNotes:block==='warmup'?'Lehké rozcvičení.':block==='power'?'Priorita: kvalitní rychlé provedení. RPE je pouze doplňkový údaj.':weight?'Výchozí zátěž převzatá ze stejného počtu opakování; ověř při rozcvičení.':'Zátěž doplň podle aktuálního provedení; 0 kg není doporučená pracovní váha.'});}
  }
  const minutes=slot.minutes;
  append(['Cat-Cow'],'warmup',1,6,'reps',30);
  if(minutes>=35)append(['Bodyweight Hip Bridge','Glute Bridge'],'warmup',1,8,'reps',30);
  if(goal==='conditioning'){
   append(['Stationary Bike','Air Bike','Jump Rope'],'conditioning',1,Math.max(300,(minutes-12)*60),'seconds',60);
   reasons.push('Kondiční šablona: souvislé lehké až střední tempo, délku uprav podle rezervy v časovém okně.');
  }else{
   if((goal==='power'||goal==='mixed')&&minutes>=35)append(['Squat Jump','Broad Jump'],'power',2,3,'reps',90);
   append(sequence?['Romanian Deadlift','Dumbbell Romanian Deadlift','Bodyweight Hip Bridge']:['Goblet Squat','Back Squat','Bodyweight Hip Bridge'],'strength',count,goal==='strength'?5:6,'reps',120);
   append(sequence?['Push-Up','Dumbbell Bench Press']:['One-Arm Dumbbell Row','Seated Cable Row','Band Row','Inverted Row'],'strength',count,8,'reps',90);
   if(minutes>=50)append(sequence?['One-Arm Dumbbell Row','Band Row','Inverted Row']:['Push-Up','Dumbbell Bench Press'],'accessory',2,8,'reps',90);
  }
  if(minutes>=35)append(['Front Plank','Plank','Side Plank'],'accessory',2,20,'seconds',45);
  const main=sets.filter(s=>s.block!=='warmup');
  if(!main.length){skipped.push({slot:clone(slot),reasons:['Pro tento cíl a vybavení chybí vhodná šablona. Vyber jiné vybavení nebo naplánuj ručně.']});continue;}
  const estimated=5+sets.reduce((n,s)=>n+(s.unit==='seconds'?s.reps/60:s.reps*4/60)+(s.restSeconds||0)/60,0);
  if(estimated>minutes){skipped.push({slot:clone(slot),reasons:['Šablona se nevejde do zvolené délky. Zvol delší termín nebo kratší ruční trénink.']});continue;}
  reasons.push('Bez automatického zvyšování kilogramů. Neznámé zátěže doplň ručně.');
  const e={id:uid(),date:slot.date,start:slot.start,end:clockText(clockMinutes(slot.start)+minutes),duration:minutes,type:'Silový trénink',title:({strength:'Síla',power:'Výbušnost',conditioning:'Kondice',mixed:'Kombinace'}[goal])+' · '+(sequence?'B':'A'),rpe:effort,status:'planned',sets,notes:'Pravidlový návrh v1.\n'+reasons.join('\n'),coachPlanId:planId};
  items.push({session:e,reasons});working.sessions.push(e);lastStrength=slot.date;
 }
 return {plan:{id:planId,start,end,goal,createdAt:new Date().toISOString()},items,skipped,fingerprint:JSON.stringify(data),options:clone(options)};
}
