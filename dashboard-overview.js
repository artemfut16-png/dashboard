let financeMonth = new Date().getFullYear() === YEAR ? new Date().getMonth() : 11;
const financeRows = [
 {id:'budgetFunnel',label:'Рекламный бюджет',source:'auto.budget'},
 {id:'leads',unit:'count',label:'Лиды',source:'auto.leads'},
 {id:'leadCost',label:'Стоимость лида'},
 {id:'leadTrialRate',unit:'percent',label:'Конверсия (лид → тест-драйв)'},
 {id:'trials',unit:'count',label:'Тест-драйвы',source:'auto.td'},
 {id:'trialCost',label:'Стоимость тест-драйва'},
 {id:'trialDealRate',unit:'percent',label:'Конверсия (тест-драйв → сделка)'},
 {id:'deals',unit:'count',label:'Сделки',source:'auto.sales'},
 {id:'cac',label:'Стоимость сделки (CAC)'},
 {id:'leadDealRate',unit:'percent',label:'Конверсия (лид → сделка)'},
 {id:'cycle',unit:'days',label:'Средний цикл (лид → сделка)',source:'auto.cycleDays'},
 {id:'trialRevenue',label:'Выручка от тест-драйвов'},
 {id:'newRevenue',label:'Выручка от новых проектов'},
 {id:'renewals',unit:'count',label:'Продление проектов по базе',group:true},
 {id:'churn',unit:'count',label:'Отток проектов по базе',source:'base.churn'},
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
const financePercent = new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1});
const financeMoney = new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2});
const financeDayForm = new Intl.PluralRules('ru-RU');
function financeDisplay(row,value){
 if(value==null || value==='')return '';
 if(row.unit==='percent')return financePercent.format(value*100)+'%';
 if(row.unit==='count')return nf.format(value);
 if(row.unit==='days'){
  const form=financeDayForm.select(value);
  const word={one:'день',few:'дня',many:'дней',other:'дня'}[form];
  return nf.format(value)+' '+word;
 }
 const amount=['leadCost','trialCost','cac'].includes(row.id)?Math.round(value):value;
 return financeMoney.format(amount)+' ₽';
}
const channelPreview = new URLSearchParams(location.search).get('analytics') !== 'classic';
const reportChannels = [['auto','Автообзвон'],['ref','Рекомендации'],['base','База']];
function previewKey(channel,id,month=financeMonth){
 return JSON.stringify(['finance-preview',YEAR,month,channel,id]);
}
function channelReportHTML(raw){
 const month=raw[financeMonth] || {}, meta=raw[0] || {};
 const rows=getFinanceRows(raw);
 const columns=reportChannels.map(([channel])=>{
  const draft={auto:{...month[channel]},manualFinance:{},extraExpenses:[]};
  const values={};
  for(const row of rows){
   const key=row.source?.split('.')[1];
   let value=row.source?.startsWith('auto.')?draft.auto[key]:null;
   if(channel==='base'){
    if(row.id==='churn')value=getp(month,'base.churn');
    if(['renewals','baseRevenue'].includes(row.id))value=month.manualFinance?.[row.id];
   }
   const stored=localStorage.getItem(previewKey(channel,row.id==='budgetExpense'?'budgetFunnel':row.id));
   if(stored!==null)value=JSON.parse(stored);
   values[row.id]=value;
   if(row.source?.startsWith('auto.'))draft.auto[key]=value;
   else if(row.extra)draft.extraExpenses.push({amount:value});
   else if(row.source && !row.source.includes('.'))draft[row.source]=value;
   else draft.manualFinance[row.id]=value;
  }
  return {channel,values,calculated:financeCalculated(draft)};
 });
 const body=rows.filter(row=>!meta.reportHidden?.includes(row.id)).map(row=>{
  const label=meta.reportLabels?.[row.id] || meta.financeLabels?.[row.source] || row.label;
  const baseRows=rows.filter(item=>['renewals','churn','baseRevenue'].includes(item.id));
  const sharedRows=rows.filter(item=>item.id==='tax' || (item.expense && item.id!=='budgetExpense'));
  const sharedValue=item=>{
   const saved=localStorage.getItem(previewKey('shared',item.id));
   if(saved!==null)return JSON.parse(saved);
   if(['renewals','churn','baseRevenue'].includes(item.id)){
    const baseSaved=localStorage.getItem(previewKey('base',item.id));
    if(baseSaved!==null)return JSON.parse(baseSaved);
    if(item.id==='churn')return getp(month,'base.churn');
    return month.manualFinance?.[item.id] ?? null;
   }
   if(item.extra)return (month.extraExpenses || []).find(entry=>entry.name===item.extra)?.amount ?? null;
   return item.source ? getp(month,item.source) : null;
  };
  const sum=values=>values.some(value=>value!=null)?values.reduce((a,b)=>a+(Number(b)||0),0):null;
  const budget=sum(columns.map(column=>column.values.budgetFunnel));
  const revenue=sum([...columns.flatMap(column=>[column.values.trialRevenue,column.values.newRevenue]),sharedValue({id:'baseRevenue'})]);
  const expenses=sum([...sharedRows.map(sharedValue),budget]);
  if(baseRows.includes(row) || sharedRows.includes(row) || ['budgetExpense','totalExpenses','totalRevenue','netProfit'].includes(row.id)){
   const editable=baseRows.includes(row) || sharedRows.includes(row);
   const value=editable?sharedValue(row):row.id==='budgetExpense'?budget:row.id==='totalExpenses'?expenses:row.id==='totalRevenue'?revenue:revenue!=null && expenses!=null?revenue-expenses:null;
   const attrs=editable?`class="finance-edit finance-amount" data-preview-channel="shared" data-report-value="${esc(row.id)}" data-value="${esc(String(value??''))}" tabindex="0"`:'class="finance-calculated"';
   return `${row.group?'<tr class="finance-divider"><td colspan="4"></td></tr>':''}<tr><td>${esc(label)}</td><td colspan="3" ${attrs}>${esc(financeDisplay(row,value))}</td></tr>`;
  }
  const cells=columns.map(({channel,values,calculated})=>{
   const computed=Object.hasOwn(calculated,row.id);
   const value=computed?calculated[row.id]:values[row.id];
   const attributes=computed?'class="finance-calculated"':`class="finance-edit finance-amount" data-preview-channel="${channel}" data-report-value="${esc(row.id)}" data-value="${esc(String(value??''))}" tabindex="0"`;
   return `<td ${attributes}>${esc(financeDisplay(row,row.id==='churn' && value!=null?Math.abs(value):value))}</td>`;
  }).join('');
  return `${row.group?'<tr class="finance-divider"><td colspan="4"></td></tr>':''}<tr><td style="width:auto">${esc(label)}</td>${cells}</tr>`;
 }).join('');
 const options=MON_FULL.map((name,i)=>`<option value="${i}" ${i===financeMonth?'selected':''}>${name} ${YEAR}</option>`).join('');
 return `<section class="card monthly-finance"><div class="card-h"><h2>Показатели за ${MON_FULL[financeMonth].toLowerCase()}</h2><div class="finance-controls"><div class="month-switch"><select data-finance-month aria-label="Месяц">${options}</select></div></div></div><div class="scroll"><table class="dt finance-table channel-table" style="min-width:580px"><colgroup><col style="width:40%"><col span="3" style="width:20%"></colgroup><thead><tr><th aria-label="Название показателя"></th>${reportChannels.map(([,label])=>`<th>${label}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div></section>`;
}
function monthlyFinanceHTML(){
 if(channelPreview)return channelReportHTML(months());
 const raw=months(), month=raw[financeMonth] || {}, meta=raw[0] || {};
 const labels=meta.reportLabels || {}, hidden=meta.reportHidden || [], legacyLabels=meta.financeLabels || {};
 const calculated=financeCalculated(month);
 const rows=getFinanceRows(raw).filter(row=>!hidden.includes(row.id)).map(row=>{
  const label=labels[row.id] || (row.source && legacyLabels[row.source]) || row.label;
  let value;
  const computed=Object.prototype.hasOwnProperty.call(calculated,row.id);
  if(computed)value=calculated[row.id];
  else if(row.extra)value=(month.extraExpenses || []).find(item=>item.name===row.extra)?.amount;
  else if(row.source)value=getp(month,row.source);
  else value=(month.manualFinance || {})[row.id];
  if(row.id==='churn' && value!=null)value=Math.abs(value);
  return `${row.group?'<tr class="finance-divider" aria-hidden="true"><td colspan="2"></td></tr>':''}<tr class="${row.total?'tot':''}"><td><div class="finance-row-label"><span class="finance-edit" data-report-name="${esc(row.id)}" data-value="${esc(label)}" tabindex="0" title="Изменить название">${esc(label)}</span><button type="button" class="finance-remove" data-report-remove="${esc(row.id)}" aria-label="Удалить пункт ${esc(label)}">×</button></div></td><td class="${computed ? 'finance-calculated' : 'finance-edit finance-amount'}" ${computed ? 'title="Рассчитывается автоматически"' : `data-report-value="${esc(row.id)}" data-value="${value==null?'':esc(String(value))}" tabindex="0" title="Изменить значение"`}>${esc(financeDisplay(row,value))}</td></tr>`;
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
   if(cell.dataset.previewChannel){
    localStorage.setItem(previewKey(cell.dataset.previewChannel,id==='budgetExpense'?'budgetFunnel':id),JSON.stringify(value));
    renderDash();return;
   }
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
 const tasks=[...allTasks(),...crmBoardTasks()].filter(x=>!x.t.done).sort((a,b)=>(a.t.due||'9999').localeCompare(b.t.due||'9999')||(a.t.time||'').localeCompare(b.t.time||''));
 const expected=projList().filter(p=>p.status!=='gone' && p.payDate && p.payDate.slice(0,7)===`${YEAR}-${String(now+1).padStart(2,'0')}`).reduce((sum,p)=>sum+(Number(p.check)||0),0);
 const nextDate=new Date(new Date().getFullYear(),now+1,1), nextMonth=nextDate.getMonth(), nextKey=`${nextDate.getFullYear()}-${String(nextMonth+1).padStart(2,'0')}`;
 const nextExpected=projList().filter(p=>p.status!=='gone' && p.payDate && p.payDate.slice(0,7)===nextKey).reduce((sum,p)=>sum+(Number(p.check)||0),0);
 const todayTasks=tasks.filter(x=>x.t.due ? x.t.due===todayISO() : x.t.bucket==='today');

 const max=Math.max(1,...months.map(x=>Math.abs(x.net))), total=months.reduce((a,c)=>a+c.net,0);
 const currentFinance=Array.isArray(fin) ? (fin[now] || {}) : {};
 const summaryValue=(channel,id,source)=>{
  if(channelPreview){const saved=localStorage.getItem(previewKey(channel,id,now));if(saved!==null)return JSON.parse(saved);}
  return getp(currentFinance,source);
 };
 const summarySum=(id,source)=>{
  const values=(channelPreview?reportChannels.map(([channel])=>summaryValue(channel,id,source)):[getp(currentFinance,source)]);
  return values.some(v=>v!=null)?values.reduce((sum,v)=>sum+(Number(v)||0),0):null;
 };
 const budget=summarySum('budgetFunnel','auto.budget'), leadsTotal=summarySum('leads','auto.leads'), trialsTotal=summarySum('trials','auto.td'), dealsTotal=summarySum('deals','auto.sales');
 const metricItems=[
  ['Рекламный бюджет',budget,true],
  ['Лиды',leadsTotal,false],
  ['Тест-драйвы',trialsTotal,false],
  ['Сделки',dealsTotal,false],
  ['Стоимость сделки',dealsTotal ? budget / dealsTotal : null,true]
 ];
 const summary=`<section class="funnel-summary" aria-label="Ключевые показатели за ${MON_FULL[now].toLowerCase()}"><div class="funnel-summary-grid">${metricItems.map(([name,value,money])=>`<div class="funnel-summary-item"><span>${esc(name)}</span><strong>${value==null?'—':money?rub(value):nf.format(value)}</strong></div>`).join('')}</div></section>`;
 const metric=(label,value,sub,cls='')=>`<div class="ov-metric ${cls}"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`;
 el.innerHTML=`<div class="overview"><div class="overview-top"><div class="ov-metrics"><div class="ov-metric ov-revenue"><span>Выручка за ${MON_FULL[now].toLowerCase()}</span><div class="ov-revenue-row"><span>Факт</span><strong>${rub(projMonth(now).sum)}</strong></div><div class="ov-revenue-row"><span>Ожидается</span><strong>${rub(expected)}</strong></div></div>${metric('Выручка ожидается за '+MON_FULL[nextMonth].toLowerCase(),rub(nextExpected),'')}${metric('Проекты в работе',projList().filter(p=>p.status !== 'gone' && p.status !== 'trial').length,'')}${metric('Тест-драйвы в работе',projList().filter(p=>p.status === 'trial').length + all().filter(l=>l.status === 'td' && !projList().some(p=>p.status === 'trial' && p.name && (l.company||l.name||'').trim().toLowerCase() === p.name.trim().toLowerCase())).length,'')}</div>${summary}</div><div class="ov-grid"><section class="ov-panel profit-chart"><div class="ov-panel-head"><h3>Доход по месяцам ${YEAR}</h3></div>${(()=>{const valid=months.map((month,i)=>({month,i})).filter(x=>x.month.has);if(!valid.length)return '<p class="ov-note">Нет данных</p>';const lo=Math.min(0,...valid.map(x=>x.month.net)),hi=Math.max(1,...valid.map(x=>x.month.net)),y=v=>88-(v-lo)/(hi-lo)*70,points=valid.map(x=>[4+x.i*8.35,y(x.month.net)]),path=smoothPath(points);return `<div class="profit-plot"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${path}" fill="none" stroke="var(--chart-profit)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>${valid.map(x=>`<button type="button" class="profit-point" style="left:${4+x.i*8.35}%;top:${y(x.month.net)}%" aria-label="${MON_FULL[x.i]}: ${rub(x.month.net)}"><span class="profit-tooltip"><span>${MON_FULL[x.i]}</span><b>${rub(x.month.net)}</b></span></button>`).join('')}</div><div class="profit-month-labels">${MON.map(m=>`<span>${m}</span>`).join('')}</div>`;})()}</section><section class="ov-panel"><div class="ov-panel-head"><h3>Задачи на сегодня · ${todayTasks.length}</h3><button class="btn" data-overview-tasks>Все задачи</button></div><div class="ov-task-list">${todayTasks.map((x,i)=>`<button class="ov-task" data-overview-task="${i}"><span><b>${esc(x.t.text||'Задача')}</b><small>${esc(x.name)}</small></span><time>${esc(x.t.due?dayTitle(x.t.due):'Без срока')}${x.t.time?' · '+esc(x.t.time):''}</time></button>`).join('')||'<p class="ov-note">На сегодня задач нет</p>'}</div></section></div><section class="card combined-payments">${payPlanHTML(sources())}${projectRegister()}</section>${monthlyFinanceHTML()}</div>`;
 el.querySelector('[data-overview-tasks]').onclick=()=>document.querySelector('[data-sect="tasks"]').click();
 el.querySelectorAll('[data-overview-task]').forEach(button=>button.onclick=()=>{const task=todayTasks[Number(button.dataset.overviewTask)];openTask(task.pid,task.t.id);});
}
if(typeof view!=='undefined'&&view==='dash')renderOverview();
