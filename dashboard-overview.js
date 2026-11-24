let financeMonth = new Date().getFullYear() === YEAR ? new Date().getMonth() : 11;
const financeRows = [
 {id:'budgetFunnel',label:'Рекламный бюджет',source:'auto.budget'},
 {id:'leads',label:'Лиды',source:'auto.leads'},
 {id:'leadCost',label:'Стоимость лида'},
 {id:'leadTrialRate',label:'Конверсия (лид → тест-драйв)'},
 {id:'trials',label:'Тест-драйвы',source:'auto.td'},
 {id:'trialCost',label:'Стоимость тест-драйва'},
 {id:'trialDealRate',label:'Конверсия (тест-драйв → сделка)'},
 {id:'deals',label:'Сделки',source:'auto.sales'},
 {id:'cac',label:'Стоимость сделки (CAC)'},
 {id:'leadDealRate',label:'Конверсия (лид → сделка)'},
 {id:'cycle',label:'Средний цикл (лид → сделка), дней',source:'auto.cycleDays'},
 {id:'trialRevenue',label:'Выручка от тест-драйвов'},
 {id:'newRevenue',label:'Выручка от новых проектов'},
 {id:'renewals',label:'Продление проектов по базе',group:true},
 {id:'churn',label:'Отток проектов по базе',source:'base.churn'},
 {id:'baseRevenue',label:'Выручка по проектам с базы'},
 {id:'tax',label:'Налог',source:'taxOverride',group:true},
 {id:'autoload',label:'Расходы на автозагрузку',source:'autoloadCosts',expense:true},
 {id:'ai',label:'Расходы на нейросети',source:'aiCosts',expense:true},
 {id:'salary',label:'Зарплата тех специалистов',source:'fot',expense:true},
 {id:'projectCosts',label:'Расходы на проект',source:'projectCosts',legacy:true,expense:true},
 {id:'other',label:'Прочие расходы',source:'other',legacy:true,expense:true},
 {id:'budgetExpense',label:'Рекламный бюджет',source:'auto.budget',expense:true},
 {id:'totalExpenses',label:'Итого расходов',total:true,group:true},
 {id:'totalRevenue',label:'Итого выручка'},
 {id:'netProfit',label:'Чистая прибыль',total:true}
];
function getFinanceRows(raw){
 const labels=(raw[0] && raw[0].financeLabels) || {};
 const rows=financeRows.filter(row=>!row.legacy || labels[row.source] || raw.some(month=>getp(month,row.source)!=null));
 const extraNames=[...new Set(raw.flatMap(month=>(month && Array.isArray(month.extraExpenses)?month.extraExpenses:[]).map(item=>item.name)))];
 const existing=new Set(rows.map(row=>(labels[row.source] || row.label).trim().toLocaleLowerCase()));
 const extraRows=extraNames.filter(name=>!existing.has(name.trim().toLocaleLowerCase()) || raw.some(month=>(month?.extraExpenses || []).some(item=>item.name===name && item.amount!=null))).map(name=>({id:'extra:'+name,label:name,extra:name,expense:true}));
 const at=rows.findIndex(row=>row.id==='budgetExpense');
 rows.splice(at,0,...extraRows);
 return rows;
}
function monthlyFinanceHTML(){
 const raw=months(), month=raw[financeMonth] || {}, meta=raw[0] || {};
 const labels=meta.reportLabels || {}, hidden=meta.reportHidden || [], legacyLabels=meta.financeLabels || {};
 const rows=getFinanceRows(raw).filter(row=>!hidden.includes(row.id)).map(row=>{
  const label=labels[row.id] || (row.source && legacyLabels[row.source]) || row.label;
  let value;
  if(row.extra)value=(month.extraExpenses || []).find(item=>item.name===row.extra)?.amount;
  else if(row.source)value=getp(month,row.source);
  else value=(month.manualFinance || {})[row.id];
  if(row.id==='churn' && value!=null)value=Math.abs(value);
  return `${row.group?'<tr class="finance-divider" aria-hidden="true"><td colspan="2"></td></tr>':''}<tr class="${row.total?'tot':''}"><td><div class="finance-row-label"><span class="finance-edit" data-report-name="${esc(row.id)}" data-value="${esc(label)}" tabindex="0" title="Изменить название">${esc(label)}</span><button type="button" class="finance-remove" data-report-remove="${esc(row.id)}" aria-label="Удалить пункт ${esc(label)}">×</button></div></td><td class="finance-edit finance-amount" data-report-value="${esc(row.id)}" data-value="${value==null?'':esc(String(value))}" tabindex="0" title="Изменить значение">${value==null?'':esc(nf.format(value))}</td></tr>`;
 }).join('');
 return `<section class="card monthly-finance"><div class="card-h"><h2>Показатели за ${MON_FULL[financeMonth].toLowerCase()}</h2><div class="finance-controls"><div class="month-switch"><select data-finance-month aria-label="Месяц">${MON_FULL.map((name,i)=>`<option value="${i}"${i===financeMonth?' selected':''}>${name} ${YEAR}</option>`).join('')}</select></div></div></div><div class="scroll"><table class="dt finance-table"><thead><tr><th>Показатель</th><th>Значение</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}
function saveFinanceChanges(change){
 const next=JSON.parse(JSON.stringify(months()));
 change(next);fin=next;
 write('__fin',()=>db.doc('dash/y'+YEAR).set({year:YEAR,months:next}));
 renderDash();
}
function editFinanceCell(cell){
 if(cell.querySelector('input'))return;
 const isName=cell.hasAttribute('data-report-name'), id=isName?cell.dataset.reportName:cell.dataset.reportValue, initial=cell.dataset.value || '';
 const input=document.createElement('input');
 input.className='finance-cell-input';input.type='text';input.value=initial;
 input.setAttribute('aria-label',isName?'Название показателя':'Значение');
 if(!isName)input.inputMode='decimal';
 cell.replaceChildren(input);input.focus();input.select();
 let cancelled=false;
 input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();input.blur();}if(event.key==='Escape'){cancelled=true;input.blur();}});
 input.addEventListener('blur',()=>{
  if(cancelled || input.value===initial){renderDash();return;}
  const row=getFinanceRows(months()).find(item=>item.id===id);
  if(!row){renderDash();return;}
  if(isName){
   const label=input.value.trim();if(!label){renderDash();return;}
   saveFinanceChanges(next=>{next[0]=next[0] || {};next[0].reportLabels=next[0].reportLabels || {};next[0].reportLabels[id]=label;});
  }else{
   const value=parseNum(input.value);
   if(value===undefined){toast('Введите число',true);renderDash();return;}
   saveFinanceChanges(next=>{
    const month=next[financeMonth]=next[financeMonth] || {};
    if(row.extra){
     const items=Array.isArray(month.extraExpenses)?month.extraExpenses:[], item=items.find(entry=>entry.name===row.extra);
     if(item)item.amount=value;else items.push({name:row.extra,amount:value});month.extraExpenses=items;
    }else if(row.source && row.source.includes('.')){
     const [group,key]=row.source.split('.');month[group]=month[group] || {};month[group][key]=value;
    }else if(row.source)month[row.source]=value;
    else{month.manualFinance=month.manualFinance || {};month.manualFinance[id]=value;}
   });
  }
 },{once:true});
}
document.addEventListener('change',event=>{if(event.target.matches('[data-finance-month]')){financeMonth=Number(event.target.value);renderDash();}});
document.addEventListener('click',event=>{
 const remove=event.target.closest('[data-report-remove]');
 if(remove){const id=remove.dataset.reportRemove;saveFinanceChanges(next=>{next[0]=next[0] || {};next[0].reportHidden=next[0].reportHidden || [];if(!next[0].reportHidden.includes(id))next[0].reportHidden.push(id);});return;}
 const cell=event.target.closest('.finance-edit');
 if(cell && !event.target.closest('input'))editFinanceCell(cell);
});
document.addEventListener('keydown',event=>{if(event.key==='Enter' && event.target.matches('.finance-edit')){event.preventDefault();editFinanceCell(event.target);}});
function projectRegister(){
 const projectsList = projList();
 const normalize = value => String(value || '').trim().toLocaleLowerCase().replace(/ё/g,'е');
 const virtualTrials = all().filter(lead => lead.status === 'td' && !projectsList.some(project =>
   project.leadId === lead.id || (lead.company && normalize(project.name) === normalize(lead.company))
 )).map(lead => ({id:lead.id, name:lead.company || lead.name || 'Без названия', status:'trial', pay:[], trialLeadId:lead.id}));
 projectsList.push(...virtualTrials);
 const nowMonth = new Date().getFullYear() === YEAR ? new Date().getMonth() : 11;
 return `<div class="project-register"><div class="scroll">${projTable(projectsList, projectsList.map(projStats), nowMonth)}</div></div>`;
}
function renderOverview(){
 const el=document.getElementById('v-dash');
 if(!db||!dashLoaded.fin||!dashLoaded.proj||!leadsLoaded){el.innerHTML='<div class="empty-state">Загружаем обзор…</div>';return;}
 const months=effMonths().map(calc), now=new Date().getMonth(), current=months[now];
 const tasks=[...allTasks(),...crmTasks.map(t=>({...CRM_FREE,t})),...Array.from(leads.values()).flatMap(l=>(l.tasks||[]).map(t=>({pid:l.id,name:l.company||l.name||'CRM',t})))].filter(x=>!x.t.done).sort((a,b)=>(a.t.due||'9999').localeCompare(b.t.due||'9999')||(a.t.time||'').localeCompare(b.t.time||''));
 const todayTasks=tasks.filter(x=>groupOf(x.t)==='today');
 const max=Math.max(1,...months.map(x=>Math.abs(x.net))), total=months.reduce((a,c)=>a+c.net,0);
 const metric=(label,value,sub,cls='')=>`<div class="ov-metric ${cls}"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`;
 el.innerHTML=`<div class="overview"><div class="ov-metrics">${metric('Чистая прибыль за ' + MON_FULL[now].toLowerCase(),current.has?rub(current.net):'—','','ov-profit')}${metric('Проекты в работе',projList().filter(p=>p.status !== 'gone' && p.status !== 'trial').length,'')}${metric('Тест-драйвы в работе',projList().filter(p=>p.status === 'trial').length + all().filter(l=>l.status === 'td' && !projList().some(p=>p.status === 'trial' && p.name && (l.company||l.name||'').trim().toLowerCase() === p.name.trim().toLowerCase())).length,'')}</div><div class="ov-grid"><section class="ov-panel profit-chart"><div class="ov-panel-head"><h3>Доход по месяцам ${YEAR}</h3></div>${(()=>{const valid=months.map((month,i)=>({month,i})).filter(x=>x.month.has);if(!valid.length)return '<p class="ov-note">Нет данных</p>';const lo=Math.min(0,...valid.map(x=>x.month.net)),hi=Math.max(1,...valid.map(x=>x.month.net)),y=v=>88-(v-lo)/(hi-lo)*70,points=valid.map(x=>[4+x.i*8.35,y(x.month.net)]),path=smoothPath(points);return `<div class="profit-plot"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${path}" fill="none" stroke="#e0e0e0" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>${valid.map(x=>`<button type="button" class="profit-point" style="left:${4+x.i*8.35}%;top:${y(x.month.net)}%" aria-label="${MON_FULL[x.i]}: ${rub(x.month.net)}"><span class="profit-tooltip"><span>${MON_FULL[x.i]}</span><b>${rub(x.month.net)}</b></span></button>`).join('')}</div><div class="profit-month-labels">${MON.map(m=>`<span>${m}</span>`).join('')}</div>`;})()}</section><section class="ov-panel"><div class="ov-panel-head"><h3>Задачи на сегодня · ${todayTasks.length}</h3><button class="btn" data-overview-tasks>Все задачи</button></div><div class="ov-task-list">${todayTasks.map((x,i)=>`<button class="ov-task" data-overview-task="${i}"><span><b>${esc(x.t.text||'Задача')}</b><small>${esc(x.name)}</small></span><time>${esc(x.t.due?dayTitle(x.t.due):'Без срока')}${x.t.time?' · '+esc(x.t.time):''}</time></button>`).join('')||'<p class="ov-note">На сегодня задач нет</p>'}</div></section></div><section class="card combined-payments">${payPlanHTML(sources())}${projectRegister()}</section>${monthlyFinanceHTML()}</div>`;
 el.querySelector('[data-overview-tasks]').onclick=()=>document.querySelector('[data-sect="tasks"]').click();
 el.querySelectorAll('[data-overview-task]').forEach(b=>b.onclick=()=>{const x=todayTasks[Number(b.dataset.overviewTask)];openTask(x.pid,x.t.id);});
}
if(typeof view!=='undefined'&&view==='dash')renderOverview();
