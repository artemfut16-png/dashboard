/* Calendar reads existing tasks; task editing stays in the existing editor */
(() => {
  const host = document.getElementById('workspaceCalendar');
  if (!host) return;
  const localISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  let selected = localISO(new Date()), month = new Date(new Date().getFullYear(),new Date().getMonth(),1);
  let entries = [], signature = '';
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
  }
  host.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.date){selected=b.dataset.date;month=new Date(selected+'T12:00:00');month.setDate(1);document.querySelector('.side [data-sect="tasks"]').click();if(innerWidth<=860){document.getElementById('app').classList.remove('mopen');}}
    else if(b.dataset.cal==='today'){selected=localISO(new Date());month=new Date(new Date().getFullYear(),new Date().getMonth(),1);}
    else month.setMonth(month.getMonth()+(b.dataset.cal==='prev'?-1:1));
    render();
  });
  const refresh=()=>{
    const next=JSON.stringify([document.getElementById('taskTabs').hidden,read().map(x=>[x.pid,x.name,x.t])]);
    if(next!==signature){signature=next;render();}
  };
  new MutationObserver(refresh).observe(document.querySelector('main'),{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  refresh();
})();
