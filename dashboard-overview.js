let financeMonth = new Date().getFullYear() === YEAR ? new Date().getMonth() : 11;
const financeDefaults = [
 {name:'Расходы на проект',key:'projectCosts'},
 {name:'Прочие расходы',key:'other'},
 {name:'Зарплата тех специалистов',key:'fot'},
 {name:'Маркетинг',key:'auto.budget'}
];
function financeFields(raw){
 const labels=(raw[0] && raw[0].financeLabels) || {};
 const extras=[...new Set(raw.flatMap(month=>(month && Array.isArray(month.extraExpenses) ? month.extraExpenses : []).map(item=>item.name)))];
 return financeDefaults.map(field=>({...field,name:labels[field.key] || field.name})).concat(extras.map(name=>({name,key:'extra'})));
}
function monthlyFinanceHTML(){
 const raw=months(), m=raw[financeMonth] || {}, result=calc(effMonths()[financeMonth]);
 const fields=financeFields(raw);
 const revenueFields=[
  {name:'Выручка от тест-драйвов',key:'revenueTrials'},
  {name:'Выручка от новых проектов',key:'revenueNew'},
  {name:'Выручка от проектов с базы',key:'revenueExisting'}
 ];
 const revenueRows=revenueFields.map(field=>{
  const value=getp(m,field.key);
  return `<tr><td>${field.name}</td><td class="finance-edit finance-amount" data-finance-field="${field.key}" data-value="${value==null?'':esc(String(value))}" tabindex="0" title="Изменить сумму">${value==null?'—':esc(nf.format(value))}</td></tr>`;
 }).join('');
 const rows=fields.map(field=>{
   const value=field.key==='extra' ? (m.extraExpenses || []).find(item=>item.name===field.name)?.amount : getp(m,field.key);
   return `<tr><td class="finance-edit" data-finance-name="${esc(field.key)}" data-original-name="${esc(field.name)}" tabindex="0" title="Изменить название">${esc(field.name)}</td><td class="finance-edit finance-amount" data-finance-field="${esc(field.key)}" data-extra-name="${esc(field.name)}" data-value="${value==null?'':esc(String(value))}" tabindex="0" title="Изменить сумму">${value==null?'—':esc(nf.format(value))}</td></tr>`;
 }).join('');
 return `<section class="card monthly-finance"><div class="card-h"><h2>Финансы по месяцам</h2><div class="finance-controls"><select data-finance-month aria-label="Месяц">${MON_FULL.map((name,i)=>`<option value="${i}"${i===financeMonth?' selected':''}>${name} ${YEAR}</option>`).join('')}</select><button class="btn" type="button" data-finance-add>Добавить статью</button></div></div><div class="scroll"><table class="dt finance-table"><thead><tr><th>Статья</th><th>Сумма, ₽</th></tr></thead><tbody><tr><td>Налог</td><td>${rub(result.tax)}</td></tr>${rows}<tr class="tot"><td>Итого расходов</td><td>${rub(result.exp)} · ${result.rev ? pct(result.exp/result.rev) : '—'}</td></tr>${revenueRows}<tr><td>Выручка</td><td>${rub(result.rev)}</td></tr><tr class="tot"><td>Чистая прибыль</td><td>${rub(result.net)}</td></tr></tbody></table></div></section>`;
}
function saveFinanceChanges(change){
 const next=JSON.parse(JSON.stringify(months()));
 change(next);
 fin=next;
 write('__fin',()=>db.doc('dash/y'+YEAR).set({year:YEAR,months:next}));
 renderDash();
}
function editFinanceCell(cell){
 if(cell.querySelector('input'))return;
 const isName=cell.hasAttribute('data-finance-name');
 const initial=isName ? cell.dataset.originalName : cell.dataset.value;
 const input=document.createElement('input');
 input.className='finance-cell-input';
 input.type='text';
 input.value=initial || '';
 input.setAttribute('aria-label',isName?'Название статьи':'Сумма расхода');
 if(!isName)input.inputMode='decimal';
 cell.replaceChildren(input);input.focus();input.select();
 let cancelled=false;
 input.addEventListener('keydown',event=>{
  if(event.key==='Enter'){event.preventDefault();input.blur();}
  if(event.key==='Escape'){cancelled=true;input.blur();}
 });
 input.addEventListener('blur',()=>{
  if(cancelled){renderDash();return;}
  if(isName){
   const label=input.value.trim(), old=cell.dataset.originalName, key=cell.dataset.financeName;
   if(!label || label===old){renderDash();return;}
   if(financeFields(months()).some(field=>field.name.toLocaleLowerCase()===label.toLocaleLowerCase())){toast('Такая статья уже есть',true);renderDash();return;}
   saveFinanceChanges(next=>{
    if(key==='extra'){next.forEach(month=>{if(month && Array.isArray(month.extraExpenses))month.extraExpenses.forEach(item=>{if(item.name===old)item.name=label;});});}
    else{next[0]=next[0] || {};next[0].financeLabels=next[0].financeLabels || {};next[0].financeLabels[key]=label;}
   });
  }else{
   const value=parseNum(input.value);
   if(value===undefined || (value!=null && value<0)){toast('Введите неотрицательную сумму',true);renderDash();return;}
   saveFinanceChanges(next=>{
    const month=next[financeMonth]=next[financeMonth] || {}, field=cell.dataset.financeField;
    if(field==='extra'){
     const items=Array.isArray(month.extraExpenses)?month.extraExpenses:[];
     const existing=items.find(item=>item.name===cell.dataset.extraName);
     if(existing)existing.amount=value;else items.push({name:cell.dataset.extraName,amount:value});
     month.extraExpenses=items;
    }else if(field==='auto.budget'){month.auto=month.auto || {};month.auto.budget=value;}
    else month[field]=value;
   });
  }
 },{once:true});
}
document.addEventListener('change',e=>{
 if(e.target.matches('[data-finance-month]')){financeMonth=Number(e.target.value);renderDash();}
});
document.addEventListener('click',e=>{
 const cell=e.target.closest('.finance-edit');
 if(cell && !e.target.closest('input')){editFinanceCell(cell);return;}
 if(!e.target.closest('[data-finance-add]'))return;
 const name=prompt('Название статьи расходов');
 if(!name || !name.trim())return;
 const label=name.trim();
 if(financeFields(months()).some(field=>field.name.toLocaleLowerCase()===label.toLocaleLowerCase())){toast('Такая статья уже есть',true);return;}
 saveFinanceChanges(next=>{const month=next[financeMonth]=next[financeMonth] || {};month.extraExpenses=month.extraExpenses || [];month.extraExpenses.push({name:label,amount:null});});
});
document.addEventListener('keydown',e=>{
 if(e.key==='Enter' && e.target.matches('.finance-edit')){e.preventDefault();editFinanceCell(e.target);}
});
function projectRegister(){
 const projectsList = projList();
 const nowMonth = new Date().getFullYear() === YEAR ? new Date().getMonth() : 11;
 return `<section class="card"><div class="card-h"><h2>Проекты</h2><span class="hint">Нажмите на сумму, чтобы изменить оплату. Статус переключается по клику.</span></div><div class="scroll">${projTable(projectsList, projectsList.map(projStats), nowMonth)}</div></section>`;
}
function renderOverview(){
 const el=document.getElementById('v-dash');
 if(!db||!dashLoaded.fin||!dashLoaded.proj||!leadsLoaded){el.innerHTML='<div class="empty-state">Загружаем обзор…</div>';return;}
 const months=effMonths().map(calc), now=new Date().getMonth(), current=months[now];
 const tasks=[...allTasks(),...crmTasks.map(t=>({...CRM_FREE,t})),...Array.from(leads.values()).flatMap(l=>(l.tasks||[]).map(t=>({pid:l.id,name:l.company||l.name||'CRM',t})))].filter(x=>!x.t.done).sort((a,b)=>(a.t.due||'9999').localeCompare(b.t.due||'9999')||(a.t.time||'').localeCompare(b.t.time||''));
 const todayTasks=tasks.filter(x=>groupOf(x.t)==='today');
 const max=Math.max(1,...months.map(x=>Math.abs(x.net))), total=months.reduce((a,c)=>a+c.net,0);
 const metric=(label,value,sub,cls='')=>`<div class="ov-metric ${cls}"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`;
 el.innerHTML=`<div class="overview"><div class="ov-metrics">${metric('Чистая прибыль за ' + MON_FULL[now].toLowerCase(),current.has?rub(current.net):'—','','ov-profit')}${metric('Проекты в работе',projList().filter(p=>p.status !== 'gone' && p.status !== 'trial').length,'')}${metric('Тест-драйвы в работе',projList().filter(p=>p.status === 'trial').length + all().filter(l=>l.status === 'td' && !projList().some(p=>p.status === 'trial' && p.name && (l.company||l.name||'').trim().toLowerCase() === p.name.trim().toLowerCase())).length,'')}</div><div class="ov-grid"><section class="ov-panel profit-chart"><div class="ov-panel-head"><h3>Чистая прибыль</h3><span>${YEAR}</span></div>${(()=>{const valid=months.map((month,i)=>({month,i})).filter(x=>x.month.has);if(!valid.length)return '<p class="ov-note">Нет данных</p>';const lo=Math.min(0,...valid.map(x=>x.month.net)),hi=Math.max(1,...valid.map(x=>x.month.net)),y=v=>88-(v-lo)/(hi-lo)*70,points=valid.map(x=>[4+x.i*8.35,y(x.month.net)]),path=smoothPath(points);return `<div class="profit-plot"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${path}" fill="none" stroke="#e0e0e0" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>${valid.map(x=>`<button type="button" class="profit-point" style="left:${4+x.i*8.35}%;top:${y(x.month.net)}%" aria-label="${MON_FULL[x.i]}: ${rub(x.month.net)}"><span class="profit-tooltip"><span>${MON_FULL[x.i]}</span><b>${rub(x.month.net)}</b></span></button>`).join('')}</div><div class="profit-month-labels">${MON.map(m=>`<span>${m}</span>`).join('')}</div>`;})()}</section><section class="ov-panel"><div class="ov-panel-head"><h3>Задачи на сегодня · ${todayTasks.length}</h3><button class="btn" data-overview-tasks>Все задачи</button></div><div class="ov-task-list">${todayTasks.map((x,i)=>`<button class="ov-task" data-overview-task="${i}"><span><b>${esc(x.t.text||'Задача')}</b><small>${esc(x.name)}</small></span><time>${esc(x.t.due?dayTitle(x.t.due):'Без срока')}${x.t.time?' · '+esc(x.t.time):''}</time></button>`).join('')||'<p class="ov-note">На сегодня задач нет</p>'}</div></section></div>${payPlanHTML(sources())}${projectRegister()}${monthlyFinanceHTML()}</div>`;
 el.querySelector('[data-overview-tasks]').onclick=()=>document.querySelector('[data-sect="tasks"]').click();
 el.querySelectorAll('[data-overview-task]').forEach(b=>b.onclick=()=>{const x=todayTasks[Number(b.dataset.overviewTask)];openTask(x.pid,x.t.id);});
}
if(typeof view!=='undefined'&&view==='dash')renderOverview();
