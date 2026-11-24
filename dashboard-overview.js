function projectRegister(){
 const rows = projList().map(p=>({name:p.name,status:p.status==='gone'?'Ушел':'В работе',amount:p.check,date:p.status==='gone'?'':p.payDate}))
   .concat(all().filter(l=>l.status==='td').map(l=>({name:l.company||l.name,status:'Тест-драйв'})));
 return `<section class="ov-panel register"><h3>Проекты</h3><div class="scroll"><table><thead><tr><th>Проект</th><th>Статус</th><th>Чек</th><th>Следующая оплата</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.name||'Без названия')}</td><td>${r.status}</td><td>${r.amount?rub(r.amount):'—'}</td><td>${r.date?esc(dayTitle(r.date)):'—'}</td></tr>`).join('')||'<tr><td colspan="4">Пока нет проектов</td></tr>'}</tbody></table></div></section>`;
}
function renderOverview(){
 const el=document.getElementById('v-dash');
 if(!db||!dashLoaded.fin||!dashLoaded.proj||!leadsLoaded){el.innerHTML='<div class="empty-state">Загружаем обзор…</div>';return;}
 const months=effMonths().map(calc), now=new Date().getMonth(), current=months[now];
 const tasks=[...allTasks(),...crmTasks.map(t=>({...CRM_FREE,t})),...Array.from(leads.values()).flatMap(l=>(l.tasks||[]).map(t=>({pid:l.id,name:l.company||l.name||'CRM',t})))].filter(x=>!x.t.done).sort((a,b)=>(a.t.due||'9999').localeCompare(b.t.due||'9999')||(a.t.time||'').localeCompare(b.t.time||''));
 const todayTasks=tasks.filter(x=>groupOf(x.t)==='today');
 const max=Math.max(1,...months.map(x=>Math.abs(x.net))), total=months.reduce((a,c)=>a+c.net,0);
 const metric=(label,value,sub,cls='')=>`<div class="ov-metric ${cls}"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`;
 el.innerHTML=`<div class="overview"><div class="ov-metrics">${metric('Чистая прибыль за месяц',current.has?rub(current.net):'—',MON_FULL[now],'ov-profit')}</div><div class="ov-grid"><section class="ov-panel"><div class="ov-panel-head"><h3>Чистая прибыль</h3><span>${YEAR}</span></div><div class="ov-total">${months.some(x=>x.has)?rub(total):'Нет данных'}<small>за год</small></div><div class="ov-chart" role="img" aria-label="Чистая прибыль по месяцам">${months.map((c,i)=>`<div class="ov-column"><div class="ov-track" tabindex="0" aria-label="${MON_FULL[i]}: ${c.has?rub(c.net):'нет данных'}"><div class="ov-bar ${c.net<0?'negative':''}" style="height:${c.has?Math.max(2,Math.abs(c.net)/max*100):0}%" title="${MON_FULL[i]}: ${c.has?rub(c.net):'нет данных'}"></div><span class="ov-tooltip">${MON_FULL[i]}<b>${c.has?rub(c.net):'Нет данных'}</b></span></div><span>${MON_FULL[i].slice(0,3)}</span></div>`).join('')}</div></section><section class="ov-panel"><div class="ov-panel-head"><h3>Задачи на сегодня · ${todayTasks.length}</h3><button class="btn" data-overview-tasks>Все задачи</button></div><div class="ov-task-list">${todayTasks.map((x,i)=>`<button class="ov-task" data-overview-task="${i}"><span><b>${esc(x.t.text||'Задача')}</b><small>${esc(x.name)}</small></span><time>${esc(x.t.due?dayTitle(x.t.due):'Без срока')}${x.t.time?' · '+esc(x.t.time):''}</time></button>`).join('')||'<p class="ov-note">На сегодня задач нет</p>'}</div></section></div>${payPlanHTML(sources())}${projectRegister()}</div>`;
 el.querySelector('[data-overview-tasks]').onclick=()=>document.querySelector('[data-sect="tasks"]').click();
 el.querySelectorAll('[data-overview-task]').forEach(b=>b.onclick=()=>{const x=todayTasks[Number(b.dataset.overviewTask)];openTask(x.pid,x.t.id);});
}
if(typeof view!=='undefined'&&view==='dash')renderOverview();
