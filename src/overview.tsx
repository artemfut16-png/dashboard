import React from "react";
import { createRoot } from "react-dom/client";
import { BriefcaseBusiness, Wallet, Gauge } from "lucide-react";
import { GlassEffect } from "../components/ui/liquid-glass";

type Month = {label: string; net: number | null};
type Overview = {projects: string[]; months: Month[]; year: number; current: number | null; trials: number; tasks: {name:string; text:string}[]; openTasks: () => void};
const money = (n:number | null) => n === null ? "—" : new Intl.NumberFormat("ru-RU", {style:"currency",currency:"RUB",maximumFractionDigits:0}).format(n);
function ProfitChart({months}: {months:Month[]}) {
  const values = months.map(m => m.net ?? 0);
  const high = Math.max(0,...values), low = Math.min(0,...values);
  const y = (v:number) => 12 + 126 * (high-v)/(high-low || 1);
  return <div className="profit-scroll"><div className="profit-bars">{months.map(({label,net}) => <div className="profit-month" key={label}>
    <span>{net === null ? "—" : money(net)}</span>
    <svg viewBox="0 0 46 150" aria-hidden="true"><path d={`M0 ${y(0)}h46`} stroke="currentColor" opacity=".3"/>{net !== null && <rect x="12" width="22" y={Math.min(y(0),y(net))} height={Math.max(2,Math.abs(y(net)-y(0)))} rx="3" fill={net<0?"#ff998a":"#91cbb8"}/>}</svg><b>{label}</b></div>)}</div></div>;
}
function Dashboard({projects,months,current,trials,tasks,year,openTasks}: Overview) {
  return <div className="overview">
    <GlassEffect><h2>Проекты в работе</h2><div className="project-tags">{projects.length ? projects.map((p,i)=><span key={i}>{p}</span>) : "Пока нет активных проектов"}</div></GlassEffect>
    <GlassEffect><h2>Чистая прибыль по месяцам · {year}</h2><ProfitChart months={months}/></GlassEffect>
    <div className="metric-grid">{[[Gauge,"Тест-драйвы в работе",trials],[BriefcaseBusiness,"Проекты в работе",projects.length],[Wallet,"Чистая прибыль за текущий месяц",money(current)]].map(([Icon,label,value])=>{const Glyph=Icon as typeof Gauge;return <GlassEffect key={String(label)}><Glyph size={20}/><p>{String(label)}</p><strong>{String(value)}</strong></GlassEffect>})}</div>
    <GlassEffect><div className="overview-title"><h2>Ближайшие задачи</h2><button className="btn" onClick={openTasks}>Все задачи</button></div>{tasks.length ? tasks.map((t,i)=><div className="task-preview" key={i}><b>{t.text}</b><span>{t.name}</span></div>):"Открытых задач нет"}</GlassEffect>
  </div>;
}
let mounted: HTMLElement | undefined, root: ReturnType<typeof createRoot> | undefined;
export function render(el:HTMLElement, data:Overview) {
  if (mounted !== el) {root?.unmount(); root=createRoot(el); mounted=el;}
  root!.render(<Dashboard {...data}/>);
}
