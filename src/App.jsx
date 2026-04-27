import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { 
  Activity, Waves, FlaskConical, Target, Clock, AlertTriangle, 
  Info, Wind, Anchor, Users, ChevronDown, FileText, Download, Repeat, Sun, Moon, Database, Languages
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import decoTable from './data/deco_table.json';
import { 
  calcBottomGas, 
  calcTotalDecoGas, 
  calcAscentGas, 
  getGasType,
  getCylinderAvailableSCF,
  calcCylinderCount,
  generateProfileData,
  expandChamberSteps,
  CONSTANTS
} from './CalculationLogic';

const GAS_COLORS = { AIR: '#3b82f6', BOTTOM: '#f97316', '5050': '#eab308', O2: '#22c55e' };
const THEMES = {
  dark: { bg: '#020617', panel: '#0f172a', border: '#1e293b', textPrimary: '#f8fafc', textSecondary: '#64748b', inputBg: '#020617', grid: '#1e293b' },
  light: { bg: '#ffffff', panel: '#ffffff', border: '#cbd5e1', textPrimary: '#0f172a', textSecondary: '#475569', inputBg: '#f8fafc', grid: '#e2e8f0' }
};

const TRANSLATIONS = {
  en: {
    title: 'Heliox Mission', subtitle: 'US NAVY MANUAL REV.7', maxDepth: 'Max Depth', bottomTime: 'Bottom Time', decoMode: 'Deco Mode', divers: 'Divers', opTime: 'Op Time', export: 'Export PDF', generating: 'Generating...', profile: 'Mission Profile', waterDeco: 'Water Deco Schedule', chamber: 'Chamber Procedure', protocol: 'Protocol', logistics: 'Logistics & Mission Demand', runs: 'Mission Runs', cylinder: 'Cylinder Type', spec: 'Active Cylinder Spec', model: 'Selected Model', workPress: 'Work Press / Internal Vol', bottomMix: 'Bottom Mix', decoMix: 'Deco Mix (50/50)', oxygen: 'Oxygen (100% O2)', cyls: 'Cyls', singleRun: 'Single Run', airNote: 'Air supply is managed via local compressor.', noDeco: 'No deco required.', vent: 'VENT (3m)', switch: 'SW', depth: 'Depth', clock: 'Clock', duration: 'Duration', o2Period: 'O2 Period', airBreak: 'Air Break', gasSource: 'Gas Source', segmentTime: 'Seg. Time', ascent: 'Ascent', descent: 'Descent', chamberTravel: 'To Chamber', chamberDescent: 'Chamber Desc.', surface: 'Surface', surfInterval: 'Surf Interval', surfacing: 'Surfacing'
  },
  zh: {
    title: '氦氧潛水計畫', subtitle: '美國海軍潛水手冊第七版', maxDepth: '最大深度', bottomTime: '海底時間', decoMode: '減壓模式', divers: '潛水員人數', opTime: '總作業時間', export: '導出計畫報告', generating: '生成中...', profile: '任務剖面分析', waterDeco: '水下減壓站點', chamber: '減壓艙程序', protocol: '作業協議', logistics: '後勤與氣瓶需求', runs: '計畫執行次數', cylinder: '鋼瓶型號', spec: '目前鋼瓶規格', model: '選定型號', workPress: '工作壓力 / 內部容積', bottomMix: '海底混合氣', decoMix: '減壓混合氣 (50/50)', oxygen: '純氧 (100% O2)', cyls: '支', singleRun: '單次潛水需求', airNote: '空氣由空壓機現場填充。', noDeco: '無需減壓。', vent: '通風切換 (3分)', switch: '氣體切換', depth: '深度', clock: '時間', duration: '區段時長', o2Period: '氧氣週期', airBreak: '空氣呼吸期', gasSource: '呼吸氣源', segmentTime: '區段停留', ascent: '上升過程', descent: '下潛過程', chamberTravel: '前往減壓艙', chamberDescent: '減壓艙加壓', surface: '出水上岸', surfInterval: '水面間隔', surfacing: '正在出水', Travel: '上升移動'
  }
};

const CYLINDER_PRESETS = [
  { id: '3aa-2015', name: '3AA-2015', psi: 2015, vol: 1.518 },
  { id: '3aa-2265', name: '3AA-2265', psi: 2265, vol: 1.518 },
  { id: '3aa-3500', name: '3AA-3500', psi: 3500, vol: 1.518 },
  { id: 'sp-6000', name: 'SP10869-6000', psi: 6000, vol: 1.529 },
];

function App() {
  const [theme, setTheme] = useState('dark');
  const [lang, setLang] = useState('zh');
  const [maxDepth, setMaxDepth] = useState(270);
  const [bottomTime, setBottomTime] = useState(40);
  const [divers, setDivers] = useState(3);
  const [runs, setRuns] = useState(1);
  const [decoMode, setDecoMode] = useState('SURD'); 
  const [selectedCyl, setSelectedCyl] = useState(CYLINDER_PRESETS[0]);
  const [cylinderPSI, setCylinderPSI] = useState(2015);
  const [cylinderCF, setCylinderCF] = useState(1.518);
  const [reservePSI, setReservePSI] = useState(200);
  const [stops, setStops] = useState([]);
  const [o2Periods, setO2Periods] = useState(0);
  const [bottomGasSCF, setBottomGasSCF] = useState(0);
  const [ascentGasSCF, setAscentGasSCF] = useState(0);
  const [decoGasTotals, setDecoGasTotals] = useState({ bottomMix: 0, decoMix: 0, oxygen: 0, air: 0 });
  const [isExporting, setIsExporting] = useState(false);

  const currentTheme = THEMES[theme] || THEMES.dark;
  const t = currentTheme; 
  const msg = TRANSLATIONS[lang] || TRANSLATIONS.zh;

  useEffect(() => {
    try {
      const depthData = decoTable[maxDepth];
      if (depthData && depthData[bottomTime]) {
        const profile = depthData[bottomTime];
        const rawStops = [...(profile.stops || [])];
        const periods = rawStops.length > 0 ? rawStops.pop() : 0;
        setO2Periods(periods || 0);
        const mappedStops = rawStops.reverse().map((time, idx) => ({ id: `water-${idx}`, depth: 20 + (idx * 10), time: time })).filter(s => s.time > 0);
        if (decoMode === 'SURD') setStops(mappedStops.filter(s => s.depth >= 40).sort((a, b) => b.depth - a.depth));
        else setStops(mappedStops.sort((a, b) => b.depth - a.depth));
      }
      setBottomGasSCF(calcBottomGas(maxDepth, bottomTime, divers));
    } catch (e) { console.error(e); }
  }, [maxDepth, bottomTime, divers, decoMode]);

  useEffect(() => {
    const decoTotals = calcTotalDecoGas(stops, divers, o2Periods, decoMode);
    setDecoGasTotals(decoTotals);
    if (stops && stops.length > 0) setAscentGasSCF(calcAscentGas(maxDepth, stops[0].depth, divers));
    else setAscentGasSCF(calcAscentGas(maxDepth, 0, divers));
  }, [stops, divers, maxDepth, o2Periods, decoMode]);

  const { profileData, totalDuration, chamberSteps, gradStops } = useMemo(() => {
    const res = generateProfileData(maxDepth, bottomTime, stops, o2Periods, decoMode);
    const steps = decoMode === 'SURD' ? expandChamberSteps(o2Periods) : [];
    const duration = (res && res.data && res.data.length > 0) ? res.data[res.data.length - 1].time : 1;
    const gStops = [];
    let lastGas = 'BOTTOM';
    
    gStops.push({ offset: '0%', color: GAS_COLORS.BOTTOM });
    if (res && res.data && res.data.length > 1) {
      for (let i = 1; i < res.data.length; i++) {
        const prev = res.data[i - 1];
        const curr = res.data[i];
        const startOffset = Math.min(100, (prev.time / duration) * 100);
        const endOffset = Math.min(100, (curr.time / duration) * 100);
        
        const isGradientSegment = curr.phase === 'Ventilation' || curr.phase === 'Chamber Descent';
        const startColor = GAS_COLORS[isGradientSegment ? prev.gas : curr.gas];
        const endColor = GAS_COLORS[curr.gas];

        gStops.push({ offset: `${startOffset}%`, color: startColor });
        gStops.push({ offset: `${endOffset}%`, color: endColor });
      }
    }
    return { profileData: res.data || [], totalDuration: duration, chamberSteps: steps, gradStops: gStops };
  }, [maxDepth, bottomTime, stops, o2Periods, decoMode]);

  const handleCylChange = (e) => {
     const cyl = CYLINDER_PRESETS.find(c => c.id === e.target.value);
     if (cyl) { setSelectedCyl(cyl); setCylinderPSI(cyl.psi); setCylinderCF(cyl.vol); }
  };

  const handleExportPDF = async () => {
    if (isExporting) return;
    setIsExporting(true); setTheme('light'); 
    setTimeout(async () => {
      const element = document.getElementById('report-container');
      try {
        const canvas = await html2canvas(element, { scale: 1.5, useCORS: true, backgroundColor: THEMES.light.bg });
        const pdf = new jsPDF('l', 'mm', 'a4');
        const imgWidth = pdf.internal.pageSize.getWidth();
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, imgWidth, imgHeight > pdf.internal.pageSize.getHeight() ? pdf.internal.pageSize.getHeight() : imgHeight);
        pdf.save(`Heliox_Mission_${maxDepth}ft.pdf`);
      } catch (err) { alert('PDF Failed'); } finally { setTheme('dark'); setIsExporting(false); }
    }, 1000);
  };

  const getGasName = (k) => lang === 'zh' ? {BOTTOM:'海底混合氣','5050':'50/50 混合氣',O2:'100% 純氧',AIR:'空氣'}[k] || k : k;
  const getPhaseName = (k) => lang === 'zh' ? {Bottom:'海底時間','Ascent to 1st Stop':'海底上升過程','Deco Stop':'減壓停留',Ventilation:'通風切換',Descent:'下潛過程','Chamber Descent':'減壓艙加壓','O2 Period':'氧氣週期','Air Break':'空氣呼吸期','Surface Interval':'水面間隔',Surfacing:'正在出水',Surface:'完成作業',Travel:'上升移動'}[k] || k : k;

  const availableSCFPerCyl = getCylinderAvailableSCF(cylinderPSI, cylinderCF, reservePSI);
  const bottomCylCount = calcCylinderCount((Math.round(bottomGasSCF + ascentGasSCF + (decoGasTotals?.bottomMix || 0)) * runs), availableSCFPerCyl);
  const decoCylCount = calcCylinderCount(((decoGasTotals?.decoMix || 0) * runs), availableSCFPerCyl);
  const oxygenCylCount = calcCylinderCount(((decoGasTotals?.oxygen || 0) * runs), availableSCFPerCyl);

  return (
    <div className="min-h-screen transition-colors duration-500 p-4 md:p-8 font-sans" style={{ backgroundColor: t.bg, color: t.textPrimary }}>
      <div id="report-container" className="max-w-[1700px] mx-auto space-y-6 p-4">
        <header className="flex flex-col lg:flex-row items-stretch lg:items-center gap-6 p-6 lg:px-8 lg:py-5 rounded-[2.5rem] border shadow-2xl backdrop-blur-xl" style={{ backgroundColor: t.panel, borderColor: t.border }}>
          <div className="flex items-center gap-5 shrink-0 border-r pr-8" style={{ borderColor: t.border }}>
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg"><Waves className="text-white" size={28} /></div>
            <div><h1 className="text-xl font-black uppercase tracking-tighter leading-none">{msg?.title}</h1><p className="text-[10px] font-bold tracking-[0.2em] mt-1" style={{ color: t.textSecondary }}>{msg?.subtitle}</p></div>
          </div>
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
             <div className="p-3 px-4 rounded-2xl border" style={{ backgroundColor: t.inputBg, borderColor: t.border }}>
                <label className="block text-[8px] font-black mb-1 uppercase tracking-widest text-slate-500">{msg?.maxDepth}</label>
                <select className="bg-transparent border-none outline-none font-mono text-xl font-black w-full appearance-none" style={{ color: t.textPrimary }} value={maxDepth} onChange={(e)=>setMaxDepth(Number(e.target.value))}>
                  {Object.keys(decoTable || {}).sort((a,b)=>a-b).map(d => <option key={d} value={d} style={{backgroundColor: t.panel}}>{d} fsw</option>)}
                </select>
             </div>
             <div className="p-3 px-4 rounded-2xl border" style={{ backgroundColor: t.inputBg, borderColor: t.border }}>
                <label className="block text-[8px] font-black mb-1 uppercase tracking-widest text-slate-500">{msg?.bottomTime}</label>
                <select className="bg-transparent border-none outline-none font-mono text-xl font-black w-full appearance-none" style={{ color: t.textPrimary }} value={bottomTime} onChange={(e)=>setBottomTime(Number(e.target.value))}>
                  {decoTable?.[maxDepth] && Object.keys(decoTable[maxDepth]).sort((a,b)=>a-b).map(tm => <option key={tm} value={tm} style={{backgroundColor: t.panel}}>{tm} min</option>)}
                </select>
             </div>
             <div className="p-2 rounded-2xl border flex items-center" style={{ backgroundColor: t.inputBg, borderColor: t.border }}>
                <button onClick={()=>setDecoMode('SURD')} className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all ${decoMode === 'SURD' ? 'bg-orange-500 text-white shadow-lg' : ''}`}>SURD O2</button>
                <button onClick={()=>setDecoMode('WATER')} className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all ${decoMode === 'WATER' ? 'bg-green-600 text-white shadow-lg' : ''}`}>IN-WATER</button>
             </div>
             <div className="p-3 px-4 rounded-2xl border flex items-center justify-between" style={{ backgroundColor: t.inputBg, borderColor: t.border }}>
                <div><label className="block text-[8px] font-black mb-1 uppercase tracking-widest text-slate-500">{msg?.divers}</label><input type="number" className="bg-transparent border-none outline-none font-mono text-xl font-black w-12" style={{ color: t.textPrimary }} value={divers} onChange={(e)=>setDivers(Number(e.target.value))} /></div><Users size={20} className="text-slate-500" />
             </div>
          </div>
          <div className="flex items-center gap-2">
             <button onClick={() => setLang(lang === 'en' ? 'zh' : 'en')} className="px-4 h-12 rounded-2xl flex items-center justify-center border font-black text-xs shadow-lg" style={{ backgroundColor: t.panel, borderColor: t.border, color: t.textPrimary }}><Languages size={16} className="mr-2 text-orange-500" />{lang === 'en' ? '中文' : 'EN'}</button>
             <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-12 h-12 rounded-2xl flex items-center justify-center border shadow-lg" style={{ backgroundColor: t.panel, borderColor: t.border, color: t.textPrimary }}>{theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}</button>
             <button onClick={handleExportPDF} disabled={isExporting} className="flex items-center gap-2 px-6 py-4 rounded-3xl font-black text-[10px] uppercase shadow-2xl transition-all" style={{ backgroundColor: theme === 'dark' ? '#fff' : '#0f172a', color: theme === 'dark' ? '#000' : '#fff' }}>{isExporting ? <Clock className="animate-spin" size={16} /> : <Download size={16} />}{isExporting ? msg?.generating : msg?.export}</button>
          </div>
        </header>

        <section className="p-8 rounded-[3rem] border shadow-2xl" style={{ backgroundColor: t.panel, borderColor: t.border }}>
          <div className="flex items-center justify-between mb-8"><h2 className="text-[10px] font-black uppercase tracking-[0.4em] flex items-center gap-2 text-slate-500"><Activity size={14} className="text-orange-500" /> {msg?.profile}</h2><div className="flex gap-4 p-2 px-4 rounded-full border" style={{ backgroundColor: t.inputBg, borderColor: t.border }}>{Object.entries(GAS_COLORS).map(([k,v]) => (<div key={k} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500"><span className="w-2 h-2 rounded-full" style={{backgroundColor:v}}></span>{getGasName(k)}</div>))}</div></div>
          <div className="w-full h-[450px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={profileData}>
                <defs><linearGradient id="gasGradient" x1="0" y1="0" x2="1" y2="0">{gradStops?.map((s, i) => <stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={0.4} />)}</linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} opacity={0.5} />
                <XAxis dataKey="time" type="number" domain={[0, totalDuration]} tickFormatter={(v)=>`${Math.floor(v)}:${Math.round((v%1)*60).toString().padStart(2,'0')}`} stroke={t.textSecondary} fontSize={11} />
                <YAxis reversed domain={[0, maxDepth + 10]} ticks={[0,20,30,40,50,90,maxDepth]} stroke={t.textSecondary} fontSize={11} tickFormatter={(v)=>`${v}'`} />
                <Tooltip content={({ active, payload }) => { if (active && payload?.[0]) { const d = payload[0].payload; const m = Math.floor(d.duration), s = Math.round((d.duration % 1) * 60); return (<div className="bg-slate-950 border border-slate-700 p-4 rounded-2xl shadow-2xl text-xs space-y-2"><p className="text-[10px] font-black text-orange-500 uppercase tracking-widest border-b border-slate-800 pb-1">{getPhaseName(d.phase)} {d.pIndex ? `P${d.pIndex}` : ''}</p><div className="flex justify-between gap-8"><span className="text-slate-500 font-bold">{msg?.depth}</span><span className="text-white font-mono font-black">{d.depth} fsw</span></div><div className="flex justify-between gap-8"><span className="text-slate-500 font-bold">{msg?.clock}</span><span className="text-white font-mono font-black">{d.timeStr}</span></div>{d.duration > 0 && <div className="flex justify-between gap-8"><span className="text-sky-500 font-bold">{msg?.segmentTime}</span><span className="text-sky-400 font-mono font-black">{m}m {s}s</span></div>}<div className="flex justify-between gap-8 pt-1 border-t border-slate-800"><span className="text-slate-500 font-bold">{msg?.gasSource}</span><span style={{ color: GAS_COLORS[d.gas] }} className="font-black">{getGasName(d.gas)}</span></div></div>); } return null; }} />
                <Area type="linear" dataKey="depth" stroke={theme === 'dark' ? '#fff' : '#000'} strokeWidth={2} fill="url(#gasGradient)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 pb-20">
          <section className="p-6 rounded-[2.5rem] border shadow-lg" style={{ backgroundColor: t.panel, borderColor: t.border }}>
             <h2 className="text-[9px] font-black uppercase tracking-[0.4em] flex items-center gap-2 mb-6 text-slate-500"><Anchor size={14} className="text-sky-500" /> {msg?.waterDeco}</h2>
             <div className="space-y-2 max-h-[450px] overflow-y-auto pr-2 custom-scroll-container">
                {stops && stops.length > 0 ? stops.map(stop => (<div key={stop.id} className="flex items-center justify-between p-3 rounded-xl border" style={{ backgroundColor: t.inputBg, borderColor: t.border }}><span className="font-mono text-sm font-black" style={{ color: stop.depth <= 30 ? GAS_COLORS.O2 : t.textSecondary }}>{stop.depth}'</span><div className="flex items-center gap-2"><span className="font-mono text-lg font-black">{stop.time}</span><span className="text-[8px] font-black uppercase opacity-50">Min</span></div></div>)) : <div className="text-center py-10 opacity-30 text-[10px] uppercase font-black">{msg?.noDeco}</div>}
             </div>
          </section>
          <section className="p-6 rounded-[2.5rem] border shadow-lg" style={{ backgroundColor: t.panel, borderColor: t.border }}>
             <h2 className="text-[9px] font-black uppercase tracking-[0.4em] flex items-center gap-2 mb-6 text-slate-500"><Wind size={14} className="text-green-500" /> {decoMode === 'SURD' ? msg?.chamber : msg?.protocol}</h2>
             <div className="space-y-2 custom-scroll-container">
                {decoMode === 'SURD' ? expandChamberSteps(o2Periods).map((step, idx) => {
                  let pIdx = 0; if(step.phase === 'O2 Period') pIdx = expandChamberSteps(o2Periods).slice(0, idx+1).filter(s=>s.phase === 'O2 Period').length;
                  return (<div key={idx} className="flex items-center justify-between p-3 rounded-xl border" style={{ backgroundColor: t.inputBg, borderColor: t.border }}><span className="text-[8px] font-black uppercase" style={{ color: step.gas === 'O2' ? GAS_COLORS.O2 : t.textSecondary }}>{lang === 'zh' ? (step.gas === 'O2' ? `氧氣週期 P${pIdx}` : '空氣呼吸期') : step.phase}</span><span className="font-mono text-sm font-black">{step.time}m</span></div>);
                }) : <div className="p-5 rounded-2xl border" style={{ backgroundColor: t.inputBg, borderColor: t.border }}><p className="text-xs leading-relaxed opacity-70">{msg?.airNote}</p></div>}
             </div>
          </section>
          <section className="p-6 rounded-[2.5rem] border shadow-lg flex flex-col" style={{ backgroundColor: t.panel, borderColor: t.border }}>
             <h2 className="text-[9px] font-black uppercase tracking-[0.4em] flex items-center gap-2 mb-6 text-slate-500"><FlaskConical size={14} className="text-amber-500" /> {msg?.logistics}</h2>
             <div className="bg-amber-500/10 p-4 rounded-3xl border border-amber-500/20 mb-4 flex justify-between items-end"><div><p className="text-lg font-black">{selectedCyl?.name}</p><p className="text-[8px] font-bold opacity-50 uppercase tracking-tighter">{msg?.model}</p></div><div className="text-right"><p className="font-mono text-sm font-bold text-amber-600">{selectedCyl?.psi} PSI / {selectedCyl?.vol} CF</p><p className="text-[8px] font-bold opacity-50 uppercase tracking-tighter">{msg?.workPress}</p></div></div>
             <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-4 rounded-3xl border" style={{ backgroundColor: t.inputBg, borderColor: t.border }}><label className="text-[7px] font-black uppercase tracking-widest opacity-50 block mb-1">{msg?.runs}</label><input type="number" className="bg-transparent border-none outline-none font-mono text-xl font-black w-full" style={{ color: t.textPrimary }} value={runs} onChange={(e)=>setRuns(Math.max(1, Number(e.target.value)))} /></div>
                <div className="p-4 rounded-3xl border" style={{ backgroundColor: t.inputBg, borderColor: t.border }}><label className="text-[7px] font-black uppercase tracking-widest opacity-50 block mb-1">{msg?.cylinder}</label><select className="bg-transparent border-none outline-none font-mono text-xs font-black w-full appearance-none" style={{ color: GAS_COLORS.BOTTOM }} value={selectedCyl?.id} onChange={handleCylChange}>{CYLINDER_PRESETS.map(c => <option key={c.id} value={c.id} style={{backgroundColor: t.panel}}>{c.name}</option>)}</select></div>
             </div>
             <div className="space-y-3 flex-1">
                {[
                  { label: msg?.bottomMix, val: Math.round(bottomGasSCF + ascentGasSCF + (decoGasTotals?.bottomMix || 0)) * runs, count: bottomCylCount, color: GAS_COLORS.BOTTOM },
                  { label: msg?.decoMix, val: (decoGasTotals?.decoMix || 0) * runs, count: decoCylCount, color: GAS_COLORS['5050'] },
                  { label: msg?.oxygen, val: (decoGasTotals?.oxygen || 0) * runs, count: oxygenCylCount, color: GAS_COLORS.O2 }
                ].map(item => (
                  <div key={item.label} className="p-4 rounded-2xl border flex items-center justify-between" style={{ backgroundColor: t.inputBg, borderColor: t.border }}>
                    <div><p className="text-[8px] font-black uppercase opacity-50 tracking-widest">{item.label}</p><p className="text-lg font-mono font-black">{item.val} SCF</p></div>
                    <div className="text-right"><span className="text-3xl font-mono font-black" style={{ color: item.color }}>{item.count}</span><span className="text-[8px] font-black uppercase opacity-50 ml-1">{msg?.cyls}</span></div>
                  </div>
                ))}
             </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default App;
