/* Calendar reads existing tasks; task editing stays in the existing editor */
(() => {
  const host = document.getElementById('workspaceCalendar');
  if (!host) return;
  const localISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  let selected = localISO(new Date()), month = new Date(new Date().getFullYear(),new Date().getMonth(),1);
  let entries = [], signature = '';
  const agenda = document.createElement('section');
  agenda.className = 'calendar-agenda';
  agenda.setAttribute('aria-label','Задачи выбранного дня');
  document.getElementById('taskTabs').before(agenda);
  const read = () => [...allTasks(), ...(typeof crmBoardTasks==='function' ? crmBoardTasks() : crmTasks.map(t=>({...CRM_FREE,t})).concat(Array.from(leads.values()).flatMap(l=>(l.tasks||[]).map(t=>({pid:l.id,name:l.company||l.name||'CRM',t})))))].filter(x => !x.t.done);
  function render(){
    entries = read();
    const start = new Date(month.getFullYear(),month.getMonth(),1);
    start.setDate(start.getDate() - (start.getDay()+6)%7);
    const title = month.toLocaleDateString('ru-RU',{month:'long',year:'numeric'}).replace(' г.','');
    host.innerHTML = `<div class="cal-heading"><h2>Календарь</h2><button type="button" data-cal="today" class="cal-today">Сегодня</button></div><div class="cal-month"><button type="button" data-cal="prev" aria-label="Предыдущий месяц">‹</button><span aria-live="polite">${esc(title)}</span><button type="button" data-cal="next" aria-label="Следующий месяц">›</button></div><div class="cal-grid"><span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span>${Array.from({length:42},(_,i)=>{
      const d=new Date(start);d.setDate(d.getDate()+i);const iso=localISO(d), count=entries.filter(x=>x.t.due===iso).length;
      return `<button type="button" data-date="${iso}" class="${d.getMonth()!==month.getMonth()?'outside ':''}${iso===selected?'selected ':''}${iso===localISO(new Date())?'today ':''}" aria-pressed="${iso===selected}" aria-label="${esc(d.toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'}))}${count?', задач: '+count:''}">${d.getDate()}${count?'<i></i>':''}</button>`;
    }).join('')}</div>`;
    const day=new Date(selected+'T12:00:00'), items=entries.filter(x=>x.t.due===selected).sort((a,b)=>(a.t.time||'99:99').localeCompare(b.t.time||'99:99'));
    agenda.hidden = document.getElementById('taskTabs').hidden;
    agenda.innerHTML=`<header class="agenda-heading"><h2>План на день</h2><button type="button" class="btn" data-new>Добавить задачу</button></header><div class="agenda-layout"><div class="agenda-date"><strong>${day.getDate().toString().padStart(2,'0')}</strong><span>${esc(day.toLocaleDateString('ru-RU',{weekday:'long',month:'long'}))}</span></div><div class="agenda-events">${items.length?items.map(x=>`<button type="button" class="agenda-event" data-entry="${entries.indexOf(x)}"><time>${esc(x.t.time||'Без времени')}</time><span><b>${esc(x.t.text||'Задача')}</b><small>${esc(x.name)}</small></span><span aria-hidden="true">↗</span></button>`).join(''):'<div class="agenda-empty">На этот день задач нет<span>Выберите дату в календаре или добавьте задачу</span></div>'}</div></div>`;
  }
  host.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.date){selected=b.dataset.date;month=new Date(selected+'T12:00:00');month.setDate(1);document.querySelector('.side [data-sect="tasks"]').click();if(innerWidth<=860){document.getElementById('app').classList.remove('mopen');}}
    else if(b.dataset.cal==='today'){selected=localISO(new Date());month=new Date(new Date().getFullYear(),new Date().getMonth(),1);}
    else month.setMonth(month.getMonth()+(b.dataset.cal==='prev'?-1:1));
    render();
  });
  agenda.addEventListener('click',e=>{
    const row=e.target.closest('[data-entry]');if(row){const x=entries[Number(row.dataset.entry)];openTask(x.pid,x.t.id);return;}
    if(e.target.closest('[data-new]')){newTask(GEN);edPatch({due:selected});}
  });
  const refresh=()=>{
    const next=JSON.stringify([document.getElementById('taskTabs').hidden,read().map(x=>[x.pid,x.name,x.t])]);
    if(next!==signature){signature=next;render();}
  };
  new MutationObserver(refresh).observe(document.querySelector('main'),{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  refresh();
})();
