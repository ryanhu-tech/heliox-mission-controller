import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { 
  Activity, Waves, FlaskConical, Target, Clock, AlertTriangle, 
  Info, Wind, Anchor, Users, ChevronDown, FileText, Download, Repeat, Sun, Moon, Database, Languages, ExternalLink, Edit2
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import dsodLogo from './assets/dsod_logo.png';
import decoTable from './data/deco_table.json';
import airDecoTable from './data/air_deco_table.json';
import { 
  calcBottomGas, 
  calcTotalDecoGas, 
  calcAscentGas, 
  getGasType,
  getCylinderAvailableSCF,
  calcCylinderCount,
  generateProfileData,
  expandChamberSteps,
  CONSTANTS,
  CHAMBER_PRESETS,
  calcChamberGasRequirements
} from './CalculationLogic';

const GAS_COLORS = { AIR: '#3b82f6', BOTTOM: '#f97316', '5050': '#eab308', O2: '#22c55e' };
const THEMES = {
  dark: { bg: '#020617', panel: '#0f172a', border: '#1e293b', textPrimary: '#f8fafc', textSecondary: '#64748b', inputBg: '#020617', grid: '#1e293b' },
  light: { bg: '#ffffff', panel: '#ffffff', border: '#cbd5e1', textPrimary: '#0f172a', textSecondary: '#475569', inputBg: '#f8fafc', grid: '#e2e8f0' }
};

const TRANSLATIONS = {
    en: {
    title: 'Mission Calculator', subtitle: 'US NAVY MANUAL REV.7', maxDepth: 'Max Depth', bottomTime: 'Bottom Time', decoMode: 'Deco Mode', divingMode: 'Diving Mode', divers: 'Divers', opTime: 'Op Time', export: 'Export PDF', generating: 'Generating...', profile: 'Mission Profile', repGroup: 'Repetitive Group', inWaterGas: 'In-Water Gas', waterDeco: 'Water Deco Schedule', chamber: 'Chamber Procedure', protocol: 'Protocol', logistics: 'Logistics & Mission Demand', runs: 'Mission Runs', cylinder: 'Cylinder Type', spec: 'Active Cylinder Spec', model: 'Selected Model', workPress: 'Fill Press / Internal Vol', bottomMix: 'Bottom Mix', decoMix: 'Deco Mix (50/50)', oxygen: 'Oxygen (100% O2)', airMix: 'Air (Compressor/Cyl)', cyls: 'Cyls', singleRun: 'Single Run', airNote: 'Air supply is managed via local compressor.', noDeco: 'No deco required.', vent: 'VENT (3m)', switch: 'SW', depth: 'Depth', clock: 'Clock', duration: 'Duration', o2Period: 'O2 Period', airBreak: 'Air Break', gasSource: 'Gas Source', segmentTime: 'Seg. Time', ascent: 'Ascent', descent: 'Descent', chamberTravel: 'To Chamber', chamberDescent: 'Chamber Desc.', surface: 'Surface', surfInterval: 'Surf Interval', surfacing: 'Surfacing', budget: 'Est. Budget', totalBudget: 'Total Est. Budget'
  },
  zh: {
    title: '潛水作業計畫', subtitle: '美國海軍潛水手冊第七版', maxDepth: '最大深度', bottomTime: '海底時間', decoMode: '減壓模式', divingMode: '潛水模式', divers: '潛水員人數', opTime: '總作業時間', export: '導出計畫報告', generating: '生成中...', profile: '任務剖面分析', repGroup: '覆潛組別代號', inWaterGas: '水中減壓氣體', waterDeco: '水下減壓站點', chamber: '減壓艙程序', protocol: '作業協議', logistics: '後勤與氣瓶需求', runs: '計畫執行次數', cylinder: '鋼瓶型號', spec: '目前鋼瓶規格', model: '選定型號', workPress: '實務充填壓力 / 內部容積', bottomMix: '海底混合氣', decoMix: '減壓混合氣 (50/50)', oxygen: '純氧 (100% O2)', airMix: '空氣 (Air)', cyls: '支', singleRun: '單次潛水需求', airNote: '空氣由空壓機現場填充。', noDeco: '無需減壓。', vent: '通風切換 (3分)', switch: '氣體切換', depth: '深度', clock: '時間', duration: '區段時長', o2Period: '氧氣週期', airBreak: '空氣呼吸期', gasSource: '呼吸氣源', segmentTime: '區段停留', ascent: '上升過程', descent: '下潛過程', chamberTravel: '前往減壓艙', chamberDescent: '減壓艙加壓', surface: '出水上岸', surfInterval: '水面間隔', surfacing: '正在出水', Travel: '上升移動', budget: '預算估計', totalBudget: '總預算估計'
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
  const [divingMode, setDivingMode] = useState('HELIOX');
  const [selectedCyl, setSelectedCyl] = useState(CYLINDER_PRESETS[0]);
  const [cylinderPSI, setCylinderPSI] = useState(CYLINDER_PRESETS[0].psi);
  const [cylinderCF, setCylinderCF] = useState(1.518);
  const [reservePSI, setReservePSI] = useState(200);
  const [inWaterGas, setInWaterGas] = useState('O2');
  const [stops, setStops] = useState([]);
  const [o2Periods, setO2Periods] = useState(0);
  const [repetitiveGroup, setRepetitiveGroup] = useState(null);
  const [bottomGasSCF, setBottomGasSCF] = useState(0);
  const [ascentGasSCF, setAscentGasSCF] = useState(0);
  const [decoGasTotals, setDecoGasTotals] = useState({ bottomMix: 0, decoMix: 0, oxygen: 0, air: 0 });
  const [isExporting, setIsExporting] = useState(false);

  // Chamber Mode States
  const [treatmentTableId, setTreatmentTableId] = useState('Table 6');
  const [chamberModelId, setChamberModelId] = useState('pcwmi');
  const [customInnerVol, setCustomInnerVol] = useState(124.5);
  const [ext60Count, setExt60Count] = useState(0);
  const [ext30Count, setExt30Count] = useState(0);
  const [numPatients, setNumPatients] = useState(1);
  const [numTenders, setNumTenders] = useState(1);
  const [chamberExposure, setChamberExposure] = useState(false);
  const [chamberBibsDump, setChamberBibsDump] = useState(true);
  const [chamberLock, setChamberLock] = useState('inner'); // 'inner', 'outer', 'both'

  const currentTheme = THEMES[theme] || THEMES.dark;
  const t = currentTheme; 
  const msg = TRANSLATIONS[lang] || TRANSLATIONS.zh;

  const activeTable = divingMode === 'AIR' ? airDecoTable : decoTable;

  useEffect(() => {
    if (divingMode === 'TREATMENT') return;
    const depths = Object.keys(activeTable).map(Number).sort((a, b) => a - b);
    if (!depths.includes(maxDepth)) {
       const newDepth = depths[0] || 0;
       setMaxDepth(newDepth);
       const times = Object.keys(activeTable[newDepth] || {}).map(Number).sort((a, b) => a - b);
       setBottomTime(times[0] || 0);
    } else {
       const times = Object.keys(activeTable[maxDepth] || {}).map(Number).sort((a, b) => a - b);
       if (!times.includes(bottomTime)) {
         setBottomTime(times[0] || 0);
       }
    }
  }, [divingMode, activeTable]);

  useEffect(() => {
    if (divingMode === 'TREATMENT') return;
    try {
      const depthData = activeTable[maxDepth];
      if (depthData && depthData[bottomTime]) {
        const profile = depthData[bottomTime];
        setRepetitiveGroup(profile.repetitiveGroup || null);
        
        let rawStops = [];
        let periods = 0;
        
        if (divingMode === 'AIR') {
          rawStops = inWaterGas === 'O2' ? [...(profile.airo2Stops || [])] : [...(profile.airStops || [])];
          periods = profile.chamberO2 || 0;
        } else {
          rawStops = [...(profile.stops || [])];
          periods = rawStops.length > 0 ? rawStops.pop() : 0;
        }
        
        setO2Periods(periods || 0);
        const mappedStops = rawStops.reverse().map((time, idx) => ({ id: `water-${idx}`, depth: 20 + (idx * 10), time: time })).filter(s => s.time > 0);
        if (decoMode === 'SURD') setStops(mappedStops.filter(s => s.depth >= 40).sort((a, b) => b.depth - a.depth));
        else setStops(mappedStops.sort((a, b) => b.depth - a.depth));
      }
      setBottomGasSCF(calcBottomGas(maxDepth, bottomTime, divers));
    } catch (e) { console.error(e); }
  }, [maxDepth, bottomTime, divers, decoMode, divingMode, activeTable, inWaterGas]);

  useEffect(() => {
    if (divingMode === 'TREATMENT') return;
    const decoTotals = calcTotalDecoGas(stops, divers, o2Periods, decoMode, divingMode, inWaterGas);
    setDecoGasTotals(decoTotals);
    if (stops && stops.length > 0) setAscentGasSCF(calcAscentGas(maxDepth, stops[0].depth, divers));
    else setAscentGasSCF(calcAscentGas(maxDepth, 0, divers));
  }, [stops, divers, maxDepth, o2Periods, decoMode, divingMode, inWaterGas]);

  const chamberVolume = useMemo(() => {
    let baseVol = 124.5;
    if (chamberModelId === 'custom') {
      baseVol = customInnerVol;
    } else {
      const preset = CHAMBER_PRESETS.find(c => c.id === chamberModelId);
      baseVol = preset ? preset.inner : 124.5;
    }
    const factor = chamberLock === 'inner' ? 0.75 : (chamberLock === 'outer' ? 0.25 : 1.0);
    return baseVol * factor;
  }, [chamberModelId, customInnerVol, chamberLock]);

  const chamberResults = useMemo(() => {
    return calcChamberGasRequirements(
      treatmentTableId,
      numPatients,
      numTenders,
      chamberVolume,
      chamberExposure,
      chamberBibsDump,
      ext60Count,
      ext30Count
    );
  }, [treatmentTableId, numPatients, numTenders, chamberVolume, chamberExposure, chamberBibsDump, ext60Count, ext30Count]);

  const chamberChartData = useMemo(() => {
    const data = [];
    let currentTime = 0;
    
    data.push({
      time: 0,
      depth: 0,
      displayDepth: 0,
      phase: 'Start',
      gas: 'AIR',
      timeStr: '00:00',
      duration: 0,
      segmentGasSCF: 0
    });

    const formatTime = (t) => {
      const mins = Math.floor(t);
      const secs = Math.round((t % 1) * 60);
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const maxChamberDepth = treatmentTableId === 'Table 6A' ? 165 : 60;
    const DECO_ZONE_LIMIT = 130;
    const DECO_ZONE_HEIGHT_PCT = 80;

    const getDisplayDepth = (d) => {
      if (d <= DECO_ZONE_LIMIT) return d * (DECO_ZONE_HEIGHT_PCT / DECO_ZONE_LIMIT);
      const remainingDepth = (maxChamberDepth + 10) - DECO_ZONE_LIMIT;
      return remainingDepth <= 0 ? d : DECO_ZONE_HEIGHT_PCT + ((d - DECO_ZONE_LIMIT) / remainingDepth) * (100 - DECO_ZONE_HEIGHT_PCT);
    };

    let patientO2Time = 0;
    let tenderO2Time = 0;
    let tenderO2StartTime = null;

    chamberResults.detailedSteps.forEach((step, idx) => {
      currentTime += step.duration;
      if (step.pGas === 'O2') {
        patientO2Time += step.duration;
      }
      if (step.tGas === 'O2') {
        tenderO2Time += step.duration;
        if (tenderO2StartTime === null && step.duration > 0) {
          tenderO2StartTime = currentTime - step.duration;
        }
      }

      const stepAir = step.airVentScf + (idx === 0 ? (chamberResults?.pressurizeAir || 0) : 0);

      data.push({
        time: currentTime,
        depth: step.endDepth,
        displayDepth: getDisplayDepth(step.endDepth),
        phase: step.name,
        gas: step.pGas === 'O2' ? 'O2' : 'AIR',
        patientGas: step.pGas === 'O2' ? 'O2' : 'AIR',
        tenderGas: step.tGas === 'O2' ? 'O2' : 'AIR',
        patientO2Time: patientO2Time,
        tenderO2Time: tenderO2Time,
        timeStr: formatTime(currentTime),
        duration: step.duration,
        o2Scf: step.o2Scf,
        airVentScf: stepAir,
        segmentGasSCF: step.o2Scf + stepAir
      });
    });

    const totalDur = currentTime > 0 ? currentTime : 1;
    const depths = data.map(p => p.depth);
    const allTicks = Array.from(new Set([0, 30, 60, ...depths])).sort((a, b) => a - b);
    const displayTicks = allTicks.map(v => getDisplayDepth(v));

    const gStops = [];
    gStops.push({ offset: '0%', color: '#3b82f6' }); // Start with air
    for (let i = 1; i < data.length; i++) {
      const prev = data[i - 1];
      const curr = data[i];
      const startOffset = Math.min(100, (prev.time / totalDur) * 100);
      const endOffset = Math.min(100, (curr.time / totalDur) * 100);
      
      const startColor = prev.gas === 'O2' ? '#22c55e' : '#3b82f6';
      const endColor = curr.gas === 'O2' ? '#22c55e' : '#3b82f6';

      if (startColor !== endColor) {
        gStops.push({ offset: `${startOffset}%`, color: startColor });
        gStops.push({ offset: `${startOffset}%`, color: endColor });
      }
      gStops.push({ offset: `${endOffset}%`, color: endColor });
    }

    return {
      profileData: data,
      totalDuration: totalDur,
      originalYTicks: allTicks,
      displayTicks,
      gradStops: gStops,
      getDisplayDepth,
      tenderO2StartTime,
      chamberSteps: []
    };
  }, [chamberResults, treatmentTableId]);

  const activeProfile = useMemo(() => {
    if (divingMode === 'TREATMENT') {
      return chamberChartData;
    }

    const res = generateProfileData(maxDepth, bottomTime, stops, o2Periods, decoMode, divers, divingMode, inWaterGas);
    const steps = decoMode === 'SURD' ? expandChamberSteps(o2Periods) : [];
    const duration = (res && res.data && res.data.length > 0) ? res.data[res.data.length - 1].time : 1;
    
    const profileDepths = (res?.data || []).map(p => p.depth);
    const allTicks = Array.from(new Set([0, ...profileDepths, maxDepth])).sort((a, b) => a - b);

    const gStops = [];
    gStops.push({ offset: '0%', color: '#f97316' });

    if (res && res.data && res.data.length > 1 && duration > 0) {
      for (let i = 1; i < res.data.length; i++) {
        const prev = res.data[i - 1];
        const curr = res.data[i];
        const startOffset = Math.min(100, (prev.time / duration) * 100);
        const endOffset = Math.min(100, (curr.time / duration) * 100);
        
        const isGradientSegment = curr.phase === 'Ventilation' || curr.phase === 'Chamber Descent';
        const startColor = GAS_COLORS[isGradientSegment ? prev.gas : curr.gas] || GAS_COLORS.BOTTOM;
        const endColor = GAS_COLORS[curr.gas] || GAS_COLORS.BOTTOM;

        gStops.push({ offset: `${startOffset}%`, color: startColor });
        gStops.push({ offset: `${endOffset}%`, color: endColor });
      }
    }

    const DECO_ZONE_LIMIT = 130;
    const DECO_ZONE_HEIGHT_PCT = 80;
    const getDisplayDepth = (d) => {
      if (d <= DECO_ZONE_LIMIT) return d * (DECO_ZONE_HEIGHT_PCT / DECO_ZONE_LIMIT);
      const remainingDepth = (maxDepth + 10) - DECO_ZONE_LIMIT;
      return remainingDepth <= 0 ? d : DECO_ZONE_HEIGHT_PCT + ((d - DECO_ZONE_LIMIT) / remainingDepth) * (100 - DECO_ZONE_HEIGHT_PCT);
    };

    const transformedData = (res.data || []).map(p => ({ ...p, displayDepth: getDisplayDepth(p.depth) }));
    const displayTicks = allTicks.map(v => getDisplayDepth(v));

    return { 
      profileData: transformedData, 
      originalYTicks: allTicks,
      displayTicks,
      getDisplayDepth,
      totalDuration: duration, 
      chamberSteps: steps, 
      gradStops: gStops,
      tenderO2StartTime: null
    };
  }, [maxDepth, bottomTime, stops, o2Periods, decoMode, divingMode, chamberChartData]);

  const { profileData, totalDuration, chamberSteps, gradStops, originalYTicks, displayTicks, getDisplayDepth, tenderO2StartTime } = activeProfile;

  const handleCylChange = (e) => {
     const cyl = CYLINDER_PRESETS.find(c => c.id === e.target.value);
     if (cyl) { setSelectedCyl(cyl); setCylinderPSI(cyl.psi); setCylinderCF(cyl.vol); }
  };

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      const originalTheme = theme;
      setTheme('light'); 
      
      // 強制將容器寬度設為桌機版寬度，確保無論手機如何旋轉，PDF 都是完美的排版
      const container = document.getElementById('report-container');
      const originalWidth = container.style.width;
      const originalMaxWidth = container.style.maxWidth;
      container.style.width = '1200px';
      container.style.maxWidth = 'none';

      // 稍微等待讓 Recharts 重新適應 1200px 寬度
      await new Promise(r => setTimeout(r, 800));
      
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 12;
      let currentY = 15;

      const sections = ['pdf-header', 'pdf-chart', 'pdf-tables', 'pdf-footer'];
      
      for (const id of sections) {
        const el = document.getElementById(id);
        if (!el) continue;
        
        const canvas = await html2canvas(el, { 
          scale: 2.5, 
          backgroundColor: '#ffffff', 
          useCORS: true,
          logging: false
        });
        
        const imgData = canvas.toDataURL('image/jpeg', 0.8);
        const imgProps = doc.getImageProperties(imgData);
        const imgWidth = pageWidth - margin * 2;
        const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

        if (currentY + imgHeight > pageHeight - margin) {
          doc.addPage();
          currentY = margin;
        }

        doc.addImage(imgData, 'JPEG', margin, currentY, imgWidth, imgHeight);
        currentY += imgHeight + 8;
      }

      // 恢復原始樣式
      container.style.width = originalWidth;
      container.style.maxWidth = originalMaxWidth;
      
      setTheme(originalTheme);
      setIsExporting(false);
      doc.save(`${divingMode}_Mission_${maxDepth}ft.pdf`);
    } catch (err) {
      console.error('PDF Export Error:', err);
      setIsExporting(false);
      alert(`PDF 導出失敗: ${err.message}`);
    }
  };

  const getGasName = (k) => lang === 'zh' ? {BOTTOM:'海底混合氣','5050':'50/50 混合氣',O2:'100% 純氧',AIR:'空氣'}[k] || k : k;
  const getPhaseName = (k) => lang === 'zh' ? {Bottom:'海底時間','Ascent to 1st Stop':'海底上升過程','Deco Stop':'減壓停留',Ventilation:'通風切換',Descent:'下潛過程','Chamber Descent':'減壓艙加壓','O2 Period':'氧氣週期','Air Break':'空氣呼吸期','Surface Interval':'水面間隔',Surfacing:'正在出水',Surface:'完成作業',Travel:'上升移動'}[k] || k : k;

  const availableSCFPerCyl = getCylinderAvailableSCF(cylinderPSI, cylinderCF, reservePSI);
  
  const bottomTotalBase = Math.round(bottomGasSCF + ascentGasSCF + (decoGasTotals?.bottomMix || 0)) * runs;
  const airTotalBase = (decoGasTotals?.air || 0) * runs;
  const isAirMode = divingMode === 'AIR';

  const bottomTotal = isAirMode ? 0 : bottomTotalBase;
  const bottomCylCount = calcCylinderCount(bottomTotal, availableSCFPerCyl);
  const decoTotal = (decoGasTotals?.decoMix || 0) * runs;
  const decoCylCount = calcCylinderCount(decoTotal, availableSCFPerCyl);
  const oxygenTotal = (decoGasTotals?.oxygen || 0) * runs;
  const oxygenCylCount = calcCylinderCount(oxygenTotal, availableSCFPerCyl);
  const airTotal = isAirMode ? (bottomTotalBase + airTotalBase) : airTotalBase;
  const airCylCount = calcCylinderCount(airTotal, availableSCFPerCyl);

  return (
      <div id="report-container" className="mx-auto space-y-4 p-4" style={{ maxWidth: '1700px' }}>
        <div className="lg:hidden p-3 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex items-center justify-center gap-3 mb-2 no-print">
          <Repeat className="animate-pulse text-orange-500" size={16} />
          <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">
            {lang === 'zh' ? '建議旋轉手機使用橫式瀏覽' : 'Please rotate to landscape for best experience'}
          </p>
        </div>
        <header id="pdf-header" className="flex flex-col p-6 gap-6 rounded-[2.5rem] border" style={{ backgroundColor: t.panel, borderColor: t.border, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
          {/* Top Row: Brand & Global Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: t.border }}>
            <div className="flex items-center gap-5 shrink-0">
              <img src={dsodLogo} alt="DSOD Logo" className="w-14 h-14 object-contain" />
              <div>
                <h1 className="text-[18px] font-black uppercase tracking-tighter leading-none" style={{ color: t.textPrimary }}>
                  <a href="https://www.navsea.navy.mil/Portals/103/Documents/SUPSALV/Diving/Dive%20Manual%20Rev%207%20Change%20A.pdf" target="_blank" rel="noopener noreferrer" className="hover:text-[#f97316] transition-colors flex items-center">
                    出處:美海軍潛水教範V7 <ExternalLink size={14} className="ml-1 opacity-70" />
                  </a>
                </h1>
                <p className="text-[8px] font-bold tracking-tight mt-1 opacity-70" style={{ color: t.textSecondary }}>
                  Design By R.O.C. Naval U.O.U. DSOD<br/>
                  中華民國海軍水下作業大隊深海組設計
                </p>
              </div>
            </div>
            
            <div className={`flex items-center gap-2 ${isExporting ? 'invisible h-0 w-0' : ''}`}>
               <button onClick={() => setLang(lang === 'en' ? 'zh' : 'en')} className="px-4 h-12 rounded-2xl flex items-center justify-center border font-black text-xs shadow-lg" style={{ backgroundColor: t.panel, borderColor: t.border, color: t.textPrimary }}><Languages size={16} className="mr-2" style={{ color: '#f97316' }} />{lang === 'en' ? '中文' : 'EN'}</button>
               <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-12 h-12 rounded-2xl flex items-center justify-center border shadow-lg" style={{ backgroundColor: t.panel, borderColor: t.border, color: t.textPrimary }}>{theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}</button>
               <button onClick={handleExportPDF} className="flex items-center gap-2 px-6 py-4 rounded-3xl font-black text-[10px] uppercase shadow-2xl transition-all" style={{ backgroundColor: theme === 'dark' ? '#ffffff' : '#0f172a', color: theme === 'dark' ? '#000000' : '#ffffff' }}><Download size={16} />{msg?.export}</button>
            </div>
          </div>
          
          {/* Bottom Row: Decompression Parameters Dashboard */}
          <div className="w-full">
            {divingMode === 'TREATMENT' ? (
            <div className="flex-1 grid grid-cols-2 lg:grid-cols-12 gap-4">
            <div className="p-1 rounded-xl border flex flex-col gap-1 relative justify-between lg:col-span-2" style={{ backgroundColor: 'rgba(0,0,0,0.1)', borderColor: t.border }}>
            <label className="block text-[7px] font-black uppercase tracking-widest flex justify-between items-center px-2 mb-0.5" style={{ color: '#64748b' }}>
            {msg?.divingMode}
            <Edit2 size={10} className="opacity-60" style={{ color: '#f97316' }} />
            </label>
            <div className="flex flex-col gap-1">
            <div className="flex gap-1">
            <button 
            onClick={()=>setDivingMode('HELIOX')} 
            className="flex-1 py-1 rounded-lg text-[9px] font-black transition-all border" 
            style={{ 
            backgroundColor: divingMode === 'HELIOX' ? '#3b82f6' : 'transparent', 
            borderColor: divingMode === 'HELIOX' ? '#93c5fd' : 'transparent',
            color: divingMode === 'HELIOX' ? '#fff' : '#64748b'
            }}
            >
            HELIOX
            </button>
            <button 
            onClick={()=>setDivingMode('AIR')} 
            className="flex-1 py-1 rounded-lg text-[9px] font-black transition-all border" 
            style={{ 
            backgroundColor: divingMode === 'AIR' ? '#0ea5e9' : 'transparent', 
            borderColor: divingMode === 'AIR' ? '#7dd3fc' : 'transparent',
            color: divingMode === 'AIR' ? '#fff' : '#64748b'
            }}
            >
            AIR
            </button>
            </div>
            <button 
            onClick={()=>setDivingMode('TREATMENT')} 
            className="w-full py-1 rounded-lg text-[9px] font-black transition-all border" 
            style={{ 
            backgroundColor: divingMode === 'TREATMENT' ? '#f59e0b' : 'transparent', 
            borderColor: divingMode === 'TREATMENT' ? '#fcd34d' : 'transparent',
            color: divingMode === 'TREATMENT' ? '#fff' : '#64748b'
            }}
            >
            {lang === 'zh' ? '治療表' : 'TREATMENT'}
            </button>
            </div>
            </div>

            <div className="p-3 px-4 rounded-xl border relative opacity-90 flex flex-col justify-between lg:col-span-2" style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderColor: t.border }}>
            <label className="block text-[7px] font-black mb-0.5 uppercase tracking-widest flex justify-between items-center" style={{ color: '#64748b' }}>
            {lang === 'zh' ? '治療深度' : 'TREATMENT DEPTH'}
            </label>
            <div className="font-mono text-lg font-black" style={{ color: t.textPrimary }}>
            {treatmentTableId === 'Table 6A' ? '165' : (treatmentTableId === 'Table 9' ? '45' : '60')} fsw
            </div>
            </div>

            <div className="p-3 px-4 rounded-xl border relative flex flex-col justify-between lg:col-span-2" style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderColor: t.border }}>
            <label className="block text-[7px] font-black mb-0.5 uppercase tracking-widest flex justify-between items-center" style={{ color: '#64748b' }}>
            {lang === 'zh' ? '總療程時間' : 'TOTAL DURATION'}
            </label>
            <div className="font-mono text-lg font-black" style={{ color: '#f59e0b' }}>
            {chamberResults.detailedSteps.reduce((acc, s)=>acc+s.duration, 0)} min
            </div>
            </div>

            <div className="p-2 rounded-xl border flex flex-col gap-1 justify-between lg:col-span-3" style={{ backgroundColor: 'rgba(0,0,0,0.1)', borderColor: t.border }}>
            <label className="block text-[7px] font-black uppercase tracking-widest px-1 mb-0.5" style={{ color: '#64748b' }}>
            {lang === 'zh' ? '乘員配置' : 'CREW CONFIG'}
            </label>
            <div className="flex gap-2 justify-around">
            <div className="flex flex-col items-center">
            <span className="text-[6px] text-[#64748b] font-bold">{lang === 'zh' ? '患者' : 'patient'}</span>
            <input type="number" min="1" className="w-12 bg-transparent border-b border-white/20 outline-none font-mono text-xs font-black text-center focus:border-[#f59e0b]" style={{ color: t.textPrimary }} value={numPatients} onChange={(e)=>setNumPatients(Math.max(1, Number(e.target.value)))} />
            </div>
            <div className="flex flex-col items-center">
            <span className="text-[6px] text-[#64748b] font-bold">{lang === 'zh' ? '艙內助手' : 'tender'}</span>
            <input type="number" min="1" className="w-12 bg-transparent border-b border-white/20 outline-none font-mono text-xs font-black text-center focus:border-[#f59e0b]" style={{ color: t.textPrimary }} value={numTenders} onChange={(e)=>setNumTenders(Math.max(1, Number(e.target.value)))} />
            </div>
            </div>
            </div>

            <div className="p-2 rounded-xl border flex flex-col gap-1 justify-between lg:col-span-3" style={{ backgroundColor: 'rgba(0,0,0,0.1)', borderColor: t.border }}>
            <label className="block text-[7px] font-black uppercase tracking-widest px-1 mb-0.5" style={{ color: '#64748b' }}>
            {lang === 'zh' ? '系統設定' : 'SYSTEM SETTINGS'}
            </label>
            <div className="flex flex-col gap-0.5 text-[8px] font-bold">
            <label className="flex items-center gap-1 cursor-pointer select-none" style={{ color: t.textPrimary }}>
            <input type="checkbox" checked={chamberBibsDump} onChange={(e)=>setChamberBibsDump(e.target.checked)} className="rounded bg-transparent border-white/20 text-[#f59e0b] focus:ring-0 w-2.5 h-2.5" />
            <span>BIBS Overboard</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer select-none" style={{ color: t.textPrimary }}>
            <input type="checkbox" checked={chamberExposure} onChange={(e)=>setChamberExposure(e.target.checked)} className="rounded bg-transparent border-white/20 text-[#f59e0b] focus:ring-0 w-2.5 h-2.5" />
            <span>18h Exposure</span>
            </label>
            </div>
            </div>

            <div className="hidden lg:flex p-3 px-4 rounded-xl border items-center justify-center opacity-40 border-dashed lg:col-span-1" style={{ borderColor: t.border }}>
            <span className="text-[9px] font-black tracking-widest uppercase text-center" style={{ color: t.textSecondary }}>
            {lang === 'zh' ? '減壓' : 'DECO'}
            </span>
            </div>

            <div className="p-3 px-4 rounded-xl border relative border-[#f59e0b]/40 lg:col-span-2" style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderColor: t.border }}>
            <label className="block text-[7px] font-black mb-0.5 uppercase tracking-widest flex justify-between items-center" style={{ color: '#f59e0b' }}>
            {lang === 'zh' ? '治療表選擇' : 'TREATMENT TABLE'}
            <ChevronDown size={10} className="opacity-70" />
            </label>
            <div className="border-b border-white/20">
            <select className="bg-transparent border-none outline-none font-mono text-xs font-black w-full appearance-none cursor-pointer focus:text-[#f59e0b] transition-colors" style={{ color: t.textPrimary }} value={treatmentTableId} onChange={(e)=>{
            setTreatmentTableId(e.target.value);
            setExt60Count(0);
            setExt30Count(0);
            }}>
            <option value="Table 5" style={{backgroundColor: t.panel}}>Table 5 (60′)</option>
            <option value="Table 6" style={{backgroundColor: t.panel}}>Table 6 (60′)</option>
            <option value="Table 6A" style={{backgroundColor: t.panel}}>Table 6A (165′)</option>
            <option value="Table 8" style={{backgroundColor: t.panel}}>Table 8 (60′)</option>
            <option value="Table 9" style={{backgroundColor: t.panel}}>Table 9 (45′)</option>
            </select>
            </div>
            </div>

            <div className="p-3 px-4 rounded-xl border relative lg:col-span-3" style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderColor: t.border }}>
            <label className="block text-[7px] font-black mb-0.5 uppercase tracking-widest flex justify-between items-center" style={{ color: '#64748b' }}>
            {lang === 'zh' ? '減壓艙型號' : 'CHAMBER SELECT'}
            <ChevronDown size={10} className="opacity-70" />
            </label>
            <div className="border-b border-white/20">
            <select className="bg-transparent border-none outline-none font-mono text-[9px] font-black w-full appearance-none cursor-pointer focus:text-[#f59e0b] transition-colors" style={{ color: t.textPrimary }} value={chamberModelId} onChange={(e)=>setChamberModelId(e.target.value)}>
            {CHAMBER_PRESETS.map(c => (
            <option key={c.id} value={c.id} style={{backgroundColor: t.panel}}>{c.name} ({c.inner} ft³)</option>
            ))}
            <option value="custom" style={{backgroundColor: t.panel}}>{lang === 'zh' ? '自訂客製艙' : 'Custom Chamber'}</option>
            </select>
            </div>
            {chamberModelId === 'custom' && (
            <div className="absolute bottom-1 right-3 flex items-center gap-1">
            <input type="number" className="bg-transparent border-b border-white/20 outline-none font-mono text-[9px] font-bold text-right w-10" style={{ color: t.textPrimary }} value={customInnerVol} onChange={(e)=>setCustomInnerVol(Number(e.target.value))} />
            <span className="text-[7px] text-[#64748b]">ft³</span>
            </div>
            )}
            </div>

            <div className="p-3 px-4 rounded-xl border relative lg:col-span-2" style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderColor: t.border }}>
            <label className="block text-[7px] font-black mb-0.5 uppercase tracking-widest flex justify-between items-center" style={{ color: '#64748b' }}>
            {lang === 'zh' ? '艙間選擇' : 'LOCK'}
            <ChevronDown size={10} className="opacity-70" />
            </label>
            <div className="border-b border-white/20">
            <select className="bg-transparent border-none outline-none font-mono text-xs font-black w-full appearance-none cursor-pointer focus:text-[#f59e0b] transition-colors" style={{ color: t.textPrimary }} value={chamberLock} onChange={(e)=>setChamberLock(e.target.value)}>
            <option value="inner" style={{backgroundColor: t.panel}}>{lang === 'zh' ? '內艙' : 'Inner Lock'}</option>
            <option value="outer" style={{backgroundColor: t.panel}}>{lang === 'zh' ? '外艙' : 'Outer Lock'}</option>
            <option value="both" style={{backgroundColor: t.panel}}>{lang === 'zh' ? '全艙' : 'Both Locks'}</option>
            </select>
            </div>
            </div>

            <div className="p-3 px-4 rounded-xl border relative lg:col-span-2" style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderColor: t.border }}>
            <label className="block text-[7px] font-black mb-0.5 uppercase tracking-widest flex justify-between items-center" style={{ color: '#64748b' }}>
            {lang === 'zh' ? '60呎延長次數' : '60 FT EXTENSION'}
            <ChevronDown size={10} className="opacity-70" />
            </label>
            <div className="border-b border-white/20">
            <select className="bg-transparent border-none outline-none font-mono text-sm font-black w-full appearance-none cursor-pointer focus:text-[#f59e0b] transition-colors" style={{ color: t.textPrimary }} value={ext60Count} onChange={(e)=>setExt60Count(Number(e.target.value))}>
            <option value="0" style={{backgroundColor: t.panel}}>0 (No Ext)</option>
            <option value="1" style={{backgroundColor: t.panel}}>1 Period</option>
            <option value="2" style={{backgroundColor: t.panel}}>2 Periods</option>
            </select>
            </div>
            </div>

            <div className="p-3 px-4 rounded-xl border relative lg:col-span-2" style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderColor: t.border }}>
                <label className="block text-[7px] font-black mb-0.5 uppercase tracking-widest flex justify-between items-center" style={{ color: '#64748b' }}>
                  {lang === 'zh' ? '30呎延長次數' : '30 FT EXTENSION'}
                  <ChevronDown size={10} className="opacity-70" />
                </label>
                <div className="border-b border-white/20">
                  <select className="bg-transparent border-none outline-none font-mono text-sm font-black w-full appearance-none cursor-pointer focus:text-[#f59e0b] transition-colors" style={{ color: t.textPrimary }} value={ext30Count} onChange={(e)=>setExt30Count(Number(e.target.value))}>
                    <option value="0" style={{backgroundColor: t.panel}}>0 (No Ext)</option>
                    <option value="1" style={{backgroundColor: t.panel}}>1 Period</option>
                    <option value="2" style={{backgroundColor: t.panel}}>2 Periods</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-1 rounded-xl border flex flex-col gap-1 relative justify-between" style={{ backgroundColor: 'rgba(0,0,0,0.1)', borderColor: t.border }}>
                <label className="block text-[7px] font-black uppercase tracking-widest flex justify-between items-center px-2 mb-0.5" style={{ color: '#64748b' }}>
                  {msg?.divingMode}
                  <Edit2 size={10} className="opacity-60" style={{ color: '#f97316' }} />
                </label>
                <div className="flex flex-col gap-1">
                  <div className="flex gap-1">
                    <button 
                      onClick={()=>setDivingMode('HELIOX')} 
                      className="flex-1 py-1 rounded-lg text-[9px] font-black transition-all border" 
                      style={{ 
                        backgroundColor: divingMode === 'HELIOX' ? '#3b82f6' : 'transparent', 
                        borderColor: divingMode === 'HELIOX' ? '#93c5fd' : 'transparent',
                        color: divingMode === 'HELIOX' ? '#fff' : '#64748b'
                      }}
                    >
                      HELIOX
                    </button>
                    <button 
                      onClick={()=>setDivingMode('AIR')} 
                      className="flex-1 py-1 rounded-lg text-[9px] font-black transition-all border" 
                      style={{ 
                        backgroundColor: divingMode === 'AIR' ? '#0ea5e9' : 'transparent', 
                        borderColor: divingMode === 'AIR' ? '#7dd3fc' : 'transparent',
                        color: divingMode === 'AIR' ? '#fff' : '#64748b'
                      }}
                    >
                      AIR
                    </button>
                  </div>
                  <button 
                    onClick={()=>setDivingMode('TREATMENT')} 
                    className="w-full py-1 rounded-lg text-[9px] font-black transition-all border" 
                    style={{ 
                      backgroundColor: divingMode === 'TREATMENT' ? '#f59e0b' : 'transparent', 
                      borderColor: divingMode === 'TREATMENT' ? '#fcd34d' : 'transparent',
                      color: divingMode === 'TREATMENT' ? '#fff' : '#64748b'
                    }}
                  >
                    {lang === 'zh' ? '治療表' : 'TREATMENT'}
                  </button>
                </div>
              </div>
              <div className="p-3 px-4 rounded-xl border relative" style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderColor: t.border }}>
                 <label className="block text-[7px] font-black mb-0.5 uppercase tracking-widest flex justify-between items-center" style={{ color: '#64748b' }}>
                   {msg?.maxDepth}
                   <Edit2 size={10} className="opacity-60" style={{ color: '#f97316' }} />
                 </label>
                 <div className="border-b border-white/20">
                   <select className="bg-transparent border-none outline-none font-mono text-lg font-black w-full appearance-none cursor-pointer focus:text-[#f97316] transition-colors" style={{ color: t.textPrimary }} value={maxDepth} onChange={(e)=>setMaxDepth(Number(e.target.value))}>
                     {Object.keys(activeTable || {}).sort((a,b)=>a-b).map(d => <option key={d} value={d} style={{backgroundColor: t.panel}}>{d} fsw</option>)}
                   </select>
                 </div>
              </div>
              <div className="p-3 px-4 rounded-xl border relative" style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderColor: t.border }}>
                 <label className="block text-[7px] font-black mb-0.5 uppercase tracking-widest flex justify-between items-center" style={{ color: '#64748b' }}>
                   {msg?.bottomTime}
                   <Edit2 size={10} className="opacity-60" style={{ color: '#f97316' }} />
                 </label>
                 <div className="border-b border-white/20">
                   <select className="bg-transparent border-none outline-none font-mono text-lg font-black w-full appearance-none cursor-pointer focus:text-[#f97316] transition-colors" style={{ color: t.textPrimary }} value={bottomTime} onChange={(e)=>setBottomTime(Number(e.target.value))}>
                     {activeTable?.[maxDepth] && Object.keys(activeTable[maxDepth]).sort((a,b)=>a-b).map(tm => <option key={tm} value={tm} style={{backgroundColor: t.panel}}>{tm} min</option>)}
                   </select>
                 </div>
              </div>
              <div className="p-1 rounded-xl border flex flex-col gap-1 relative" style={{ backgroundColor: 'rgba(0,0,0,0.1)', borderColor: t.border }}>
                 <label className="block text-[7px] font-black uppercase tracking-widest flex justify-between items-center px-2 mb-0.5" style={{ color: '#64748b' }}>
                   {lang === 'zh' ? '減壓模式' : 'DECO MODE'}
                   <Edit2 size={10} className="opacity-60" style={{ color: '#f97316' }} />
                 </label>
                 <div className="flex gap-1">
                   <button 
                     onClick={()=>setDecoMode('SURD')} 
                     className="flex-1 py-2 rounded-lg text-[10px] font-black transition-all border" 
                     style={{ 
                       backgroundColor: decoMode === 'SURD' ? '#f97316' : 'transparent', 
                       borderColor: decoMode === 'SURD' ? '#fdba74' : 'transparent',
                       color: decoMode === 'SURD' ? '#fff' : '#64748b'
                     }}
                   >
                     SURD
                   </button>
                   <button 
                     onClick={()=>setDecoMode('WATER')} 
                     className="flex-1 py-2 rounded-lg text-[10px] font-black transition-all border" 
                     style={{ 
                       backgroundColor: decoMode === 'WATER' ? '#22c55e' : 'transparent', 
                       borderColor: decoMode === 'WATER' ? '#86efac' : 'transparent',
                       color: decoMode === 'WATER' ? '#fff' : '#64748b'
                     }}
                   >
                     WATER
                   </button>
                 </div>
              </div>
              <div className="p-3 px-4 rounded-xl border flex items-center justify-between" style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderColor: t.border }}>
                 <div className="w-full">
                   <label className="block text-[7px] font-black mb-0.5 uppercase tracking-widest flex justify-between items-center" style={{ color: '#64748b' }}>
                     {msg?.divers}
                     <Edit2 size={10} className="opacity-60" style={{ color: '#f97316' }} />
                   </label>
                   <div className="border-b border-white/20">
                     <input type="number" className="bg-transparent border-none outline-none font-mono text-lg font-black w-full focus:text-[#f97316] transition-colors" style={{ color: t.textPrimary }} value={divers} onChange={(e)=>setDivers(Number(e.target.value))} />
                   </div>
                 </div>
                 <Users size={20} className="ml-2" style={{ color: '#64748b' }} />
              </div>
               {divingMode === 'AIR' && (
                 <div className="p-1 rounded-xl border flex flex-col gap-1 relative" style={{ backgroundColor: 'rgba(0,0,0,0.1)', borderColor: t.border }}>
                    <label className="block text-[7px] font-black uppercase tracking-widest flex justify-between items-center px-2 mb-0.5" style={{ color: '#64748b' }}>
                      {msg?.inWaterGas}
                      <Edit2 size={10} className="opacity-60" style={{ color: '#f97316' }} />
                    </label>
                    <div className="flex gap-1">
                      <button 
                        onClick={()=>setInWaterGas('AIR')} 
                        className="flex-1 py-2 rounded-lg text-[10px] font-black transition-all border" 
                        style={{ 
                          backgroundColor: inWaterGas === 'AIR' ? '#3b82f6' : 'transparent', 
                          borderColor: inWaterGas === 'AIR' ? '#60a5fa' : 'transparent',
                          color: inWaterGas === 'AIR' ? '#fff' : '#64748b'
                        }}
                      >
                        AIR
                      </button>
                      <button 
                        onClick={()=>setInWaterGas('O2')} 
                        className="flex-1 py-2 rounded-lg text-[10px] font-black transition-all border" 
                        style={{ 
                          backgroundColor: inWaterGas === 'O2' ? '#22c55e' : 'transparent', 
                          borderColor: inWaterGas === 'O2' ? '#86efac' : 'transparent',
                          color: inWaterGas === 'O2' ? '#fff' : '#64748b'
                        }}
                      >
                        O2
                      </button>
                    </div>
                 </div>
               )}
            </div>
            )}
          </div>
            </header>

        <section id="pdf-chart" className="p-8 rounded-[3rem] border shadow-2xl" style={{ backgroundColor: t.panel, borderColor: t.border }}>
          <div className="flex items-center justify-between mb-8 gap-4">
            <div className="flex items-center gap-4 shrink-0">
              <h2 className="text-[10px] font-black uppercase tracking-[0.4em] flex items-center gap-2" style={{ color: '#64748b' }}><Activity size={14} style={{ color: '#f97316' }} /> {msg?.profile}</h2>
              {repetitiveGroup && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md border" style={{ backgroundColor: 'rgba(249, 115, 22, 0.1)', borderColor: 'rgba(249, 115, 22, 0.2)' }}>
                  <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: '#f97316' }}>{msg?.repGroup}</span>
                  <span className="font-mono text-xs font-black" style={{ color: t.textPrimary }}>{repetitiveGroup}</span>
                </div>
              )}
            </div>
            <div className="flex flex-nowrap gap-3 p-2 px-3 rounded-full border overflow-hidden shrink-0" style={{ backgroundColor: t.inputBg, borderColor: t.border }}>
              {Object.entries(GAS_COLORS).map(([k,v]) => (
                <div key={k} className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest whitespace-nowrap" style={{ color: '#64748b' }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{backgroundColor:v}}></span>{getGasName(k)}
                </div>
              ))}
            </div>
          </div>
          <div className="w-full h-[675px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={profileData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <defs><linearGradient id="gasGradient" x1="0" y1="0" x2="1" y2="0">{gradStops?.map((s, i) => <stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={0.4} />)}</linearGradient></defs>
                {tenderO2StartTime !== null && tenderO2StartTime !== undefined && (
                  <ReferenceLine
                    x={tenderO2StartTime}
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    label={{
                      value: lang === 'zh' ? `艙內助手吸氧起點 (${tenderO2StartTime} min)` : `Tender O2 Start (${tenderO2StartTime}m)`,
                      position: 'insideTopLeft',
                      fill: '#10b981',
                      fontSize: 10,
                      fontWeight: '900',
                      style: { textShadow: '0 2px 4px rgba(0,0,0,0.8)' }
                    }}
                  />
                )}
                <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} opacity={0.5} />
                <XAxis dataKey="time" type="number" domain={[0, totalDuration]} tickFormatter={(v)=>`${Math.floor(v)}:${Math.round((v%1)*60).toString().padStart(2,'0')}`} stroke={t.textSecondary} fontSize={11} />
                <YAxis 
                  reversed 
                  domain={[0, 100]} 
                  ticks={displayTicks} 
                  interval={0} 
                  stroke={t.textSecondary} 
                  fontSize={11} 
                  tickFormatter={(v) => {
                    if (v === 0) return "0'";
                    const idx = displayTicks.findIndex(t => Math.abs(t - v) < 0.1);
                    return idx !== -1 ? `${originalYTicks[idx]}'` : "";
                  }} 
                />
                <Tooltip 
                  content={({ active, payload }) => { 
                    if (active && payload?.[0]) { 
                      const d = payload[0].payload; 
                      const m = Math.floor(d.duration), s = Math.round((d.duration % 1) * 60); 
                      let pStr = ""; 
                      if(d.pIndex) pStr = d.pIndex === 1 ? "P0.5" : `P${d.pIndex - 1}`; 
                      
                      return (
                        <div className="lg:relative fixed bottom-2 left-0 right-0 flex justify-center pointer-events-none z-[9999] px-2">
                          <div className="bg-[#020617]/95 backdrop-blur-2xl border border-[#1e293b] p-2 px-3 rounded-[1rem] shadow-[0_10px_40px_rgba(0,0,0,0.7)] pointer-events-auto relative w-auto">
                            <div className="flex flex-col gap-1">
                              <p className="text-[7px] font-black text-[#f97316] uppercase tracking-[0.2em] border-b border-[#1e293b]/50 pb-0.5 flex justify-between items-center mb-0.5">
                                <span>{getPhaseName(d.phase)} {pStr}</span>
                                <Activity size={8} className="opacity-50" />
                              </p>
                              
                              <div className="grid grid-cols-3 gap-x-2.5 gap-y-1">
                                <div className="flex flex-col"><span className="text-[#64748b] font-bold text-[6px] leading-tight uppercase">{msg?.depth}</span><span className="text-white font-mono font-black text-[10px]">{d.depth}</span></div>
                                <div className="flex flex-col"><span className="text-[#64748b] font-bold text-[6px] leading-tight uppercase">{msg?.clock}</span><span className="text-white font-mono font-black text-[10px]">{d.timeStr}</span></div>
                                <div className="flex flex-col"><span className="text-[#0ea5e9] font-bold text-[6px] leading-tight uppercase">{msg?.segmentTime}</span><span className="text-[#38bdf8] font-mono font-black text-[10px]">{m}m {s}s</span></div>
                                
                                {divingMode === 'TREATMENT' ? (
                                  <div className="flex flex-col col-span-2">
                                    <span className="text-[#f59e0b] font-bold text-[6px] leading-tight uppercase">{lang === 'zh' ? '消耗估計' : 'GAS CONS.'}</span>
                                    <span className="text-white font-mono text-[9px] font-black leading-tight">
                                      <span style={{ color: '#22c55e' }}>O₂: {Math.ceil(d.o2Scf || 0)}</span> | <span style={{ color: '#3b82f6' }}>Air: {Math.ceil(d.airVentScf || 0)}</span> SCF
                                    </span>
                                  </div>
                                ) : (
                                  d.segmentGasSCF > 0 ? (
                                    <div className="flex flex-col"><span className="text-[#f59e0b] font-bold text-[6px] leading-tight uppercase">{lang === 'zh' ? '消耗' : 'Gas'}</span><span className="text-[#fbbf24] font-mono font-black text-[10px]">{Math.ceil(d.segmentGasSCF)} SCF</span></div>
                                  ) : <div />
                                )}
                                
                                {divingMode === 'TREATMENT' ? (
                                  <div className="col-span-3 border-t border-[#1e293b]/50 pt-1.5 mt-1 grid grid-cols-2 gap-4">
                                    <div className="flex flex-col border-r border-[#1e293b]/30 pr-2">
                                      <span className="text-[#64748b] font-bold text-[6px] leading-tight uppercase">{lang === 'zh' ? '患者氣源' : 'PATIENT GAS'}</span>
                                      <span style={{ color: d.patientGas === 'O2' ? '#22c55e' : '#3b82f6' }} className="font-black text-[9px]">
                                        {d.patientGas === 'O2' ? (lang === 'zh' ? '100% 氧氣' : '100% O2') : (lang === 'zh' ? '空氣' : 'AIR')}
                                      </span>
                                      <span className="text-[6px] text-white/40 mt-0.5">
                                        {lang === 'zh' ? `累計吸氧: ${d.patientO2Time}m` : `O2 Cum: ${d.patientO2Time}m`}
                                      </span>
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[#64748b] font-bold text-[6px] leading-tight uppercase">{lang === 'zh' ? '艙內助手氣源' : 'TENDER GAS'}</span>
                                      <span style={{ color: d.tenderGas === 'O2' ? '#22c55e' : '#3b82f6' }} className="font-black text-[9px]">
                                        {d.tenderGas === 'O2' ? (lang === 'zh' ? '100% 氧氣' : '100% O2') : (lang === 'zh' ? '空氣' : 'AIR')}
                                      </span>
                                      <span className="text-[6px] text-white/40 mt-0.5">
                                        {lang === 'zh' ? `累計吸氧: ${d.tenderO2Time}m` : `O2 Cum: ${d.tenderO2Time}m`}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col col-span-2">
                                    <span className="text-[#64748b] font-bold text-[6px] leading-tight uppercase">{msg?.gasSource}</span>
                                    <span style={{ color: GAS_COLORS[d.gas] }} className="font-black text-[9px] truncate">{getGasName(d.gas)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ); 
                    } 
                    return null; 
                  }} 
                />
                <Area type="linear" dataKey="displayDepth" stroke={theme === 'dark' ? '#ffffff' : '#000000'} strokeWidth={2} fill="url(#gasGradient)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <div id="pdf-tables" className={`grid ${isExporting ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'} gap-6 pb-20`}>
          {divingMode === 'TREATMENT' ? (
            <section className="p-6 rounded-[2.5rem] border shadow-lg col-span-1 sm:col-span-2 flex flex-col" style={{ backgroundColor: t.panel, borderColor: t.border }}>
              <h2 className="text-[9px] font-black uppercase tracking-[0.4em] flex items-center gap-2 mb-6" style={{ color: '#64748b' }}>
                <Anchor size={14} style={{ color: '#0ea5e9' }} /> 
                {lang === 'zh' ? '減壓艙治療步驟明細' : 'TREATMENT STEPS'}
              </h2>
              <div className={`space-y-2 pr-2 custom-scroll-container flex-1 ${isExporting ? '' : 'max-h-[450px] overflow-y-auto'}`}>
                {chamberResults?.detailedSteps?.map((step, idx) => {
                  const pGasDisplay = step.pGas === 'O2' ? 'O2' : 'AIR';
                  const tGasDisplay = step.tGas === 'O2' ? 'O2' : 'AIR';
                  const stepAirGas = step.airVentScf + (idx === 0 ? (chamberResults?.pressurizeAir || 0) : 0);
                  
                  return (
                    <div key={idx} className="flex flex-col p-3 rounded-xl border gap-2" style={{ backgroundColor: t.inputBg, borderColor: t.border }}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black flex items-center gap-2" style={{ color: t.textPrimary }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pGasDisplay === 'O2' ? '#22c55e' : '#3b82f6' }}></span>
                          {step.name}
                        </span>
                        <span className="text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border" style={{ color: GAS_COLORS[pGasDisplay], borderColor: `${GAS_COLORS[pGasDisplay]}44`, backgroundColor: `${GAS_COLORS[pGasDisplay]}11` }}>
                          {lang === 'zh' ? `患者: ${pGasDisplay}` : `Patient: ${pGasDisplay}`}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center pt-1.5 border-t border-dashed" style={{ borderColor: t.border }}>
                        <div className="flex flex-col text-left">
                          <span className="text-[6px] font-bold text-[#64748b] uppercase leading-tight">{lang === 'zh' ? '起訖深度' : 'DEPTH RANGE'}</span>
                          <span className="text-[10px] font-mono font-black" style={{ color: t.textPrimary }}>{step.startDepth}′ → {step.endDepth}′</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[6px] font-bold text-[#64748b] uppercase leading-tight">{lang === 'zh' ? '停留時長' : 'DURATION'}</span>
                          <span className="text-[10px] font-mono font-black" style={{ color: t.textPrimary }}>{step.duration} Min</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[6px] font-bold text-[#64748b] uppercase leading-tight">{lang === 'zh' ? '艙內助手' : 'TENDER GAS'}</span>
                          <span className="text-[10px] font-black" style={{ color: tGasDisplay === 'O2' ? '#22c55e' : t.textSecondary }}>{tGasDisplay}</span>
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="text-[6px] font-bold text-[#64748b] uppercase leading-tight">{lang === 'zh' ? '氣源消耗' : 'GAS CONS.'}</span>
                          <div className="text-[8px] font-mono font-black flex flex-col items-end leading-tight">
                            <span style={{ color: '#22c55e' }}>O₂: {Math.ceil(step.o2Scf)}</span>
                            <span style={{ color: '#3b82f6' }}>Air: {Math.ceil(stepAirGas)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : (
            <>
              <section className="p-6 rounded-[2.5rem] border shadow-lg" style={{ backgroundColor: t.panel, borderColor: t.border }}>
                 <h2 className="text-[9px] font-black uppercase tracking-[0.4em] flex items-center gap-2 mb-6" style={{ color: '#64748b' }}><Anchor size={14} style={{ color: '#0ea5e9' }} /> {msg?.waterDeco}</h2>
                 <div className={`space-y-2 pr-2 custom-scroll-container ${isExporting ? '' : 'max-h-[450px] overflow-y-auto'}`}>
                    {stops && stops.length > 0 ? stops.map(stop => {
                      const gas = getGasType(stop.depth, divingMode, inWaterGas);
                      return (
                        <div key={stop.id} className="flex items-center justify-between p-3 rounded-xl border" style={{ backgroundColor: t.inputBg, borderColor: t.border }}>
                          <span className="font-mono text-sm font-black" style={{ color: (divingMode === 'AIR' ? (inWaterGas === 'O2' && stop.depth <= 30) : stop.depth <= 30) ? GAS_COLORS.O2 : t.textSecondary }}>{stop.depth}'</span>
                          <span className="text-[7px] font-black uppercase tracking-widest opacity-60 px-2 py-0.5 rounded-md border" style={{ color: GAS_COLORS[gas], borderColor: `${GAS_COLORS[gas]}44`, backgroundColor: `${GAS_COLORS[gas]}11` }}>{getGasName(gas)}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-lg font-black" style={{ color: t.textPrimary }}>{stop.time}</span>
                            <span className="text-[8px] font-black uppercase opacity-50" style={{ color: t.textSecondary }}>Min</span>
                          </div>
                        </div>
                      );
                    }) : <div className="text-center py-10 opacity-30 text-[10px] uppercase font-black" style={{ color: t.textSecondary }}>{msg?.noDeco}</div>}
                 </div>
              </section>
              <section className="p-6 rounded-[2.5rem] border shadow-lg" style={{ backgroundColor: t.panel, borderColor: t.border }}>
                 <h2 className="text-[9px] font-black uppercase tracking-[0.4em] flex items-center gap-2 mb-6" style={{ color: '#64748b' }}><Wind size={14} style={{ color: '#22c55e' }} /> {decoMode === 'SURD' ? msg?.chamber : msg?.protocol}</h2>
                 <div className="space-y-2 custom-scroll-container">
                    {decoMode === 'SURD' ? expandChamberSteps(o2Periods).map((step, idx) => {
                      let pIdxStr = ""; 
                      if(step.phase === 'O2 Period') {
                        const originalPIdx = expandChamberSteps(o2Periods).slice(0, idx+1).filter(s=>s.phase === 'O2 Period').length;
                        pIdxStr = originalPIdx === 1 ? "0.5" : (originalPIdx - 1).toString();
                      }
                      return (<div key={idx} className="flex items-center justify-between p-3 rounded-xl border" style={{ backgroundColor: t.inputBg, borderColor: t.border }}><span className="text-[8px] font-black uppercase" style={{ color: step.gas === 'O2' ? GAS_COLORS.O2 : t.textSecondary }}>{lang === 'zh' ? (step.gas === 'O2' ? `氧氣週期 P${pIdxStr}` : '空氣呼吸期') : `${step.phase} P${pIdxStr}`}</span><span className="font-mono text-sm font-black" style={{ color: t.textPrimary }}>{step.time}m</span></div>);
                    }) : <div className="p-5 rounded-2xl border" style={{ backgroundColor: t.inputBg, borderColor: t.border }}><p className="text-xs leading-relaxed opacity-70" style={{ color: t.textPrimary }}>{msg?.airNote}</p></div>}
                 </div>
              </section>
            </>
          )}
          <section className="p-6 rounded-[2.5rem] border shadow-lg flex flex-col" style={{ backgroundColor: t.panel, borderColor: t.border }}>
             <h2 className="text-[9px] font-black uppercase tracking-[0.4em] flex items-center gap-2 mb-6" style={{ color: '#64748b' }}><FlaskConical size={14} style={{ color: '#f59e0b' }} /> {msg?.logistics}</h2>
             <div className={`p-4 rounded-3xl border ${isExporting ? 'mb-2' : 'mb-4'} flex justify-between items-end`} style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.2)' }}>
                <div>
                  <p className="text-lg font-black" style={{ color: t.textPrimary }}>{selectedCyl?.name}</p>
                  <p className="text-[8px] font-bold opacity-50 uppercase tracking-tighter" style={{ color: t.textSecondary }}>{msg?.model}</p>
                </div>
                <div className="text-right flex flex-col items-end pb-1 group cursor-pointer">
                  <div className="flex items-center gap-1 mb-0.5 border-b border-white/20 group-hover:border-[#f59e0b]/50 transition-all">
                    {isExporting ? (
                      <span className="font-mono text-base font-black" style={{ color: '#d97706' }}>{cylinderPSI}</span>
                    ) : (
                      <input type="number" className="bg-transparent border-none outline-none font-mono text-sm font-bold w-12 text-right focus:text-white transition-colors" style={{ color: '#d97706' }} value={cylinderPSI} onChange={(e)=>setCylinderPSI(Number(e.target.value))} />
                    )}
                    <span className="text-[10px] font-bold" style={{ color: '#d97706' }}>PSI</span>
                    <Edit2 size={10} className="opacity-60 ml-1" style={{ color: '#f97316' }} />
                  </div>
                  <p className="text-[8px] font-bold opacity-50 uppercase tracking-tighter" style={{ color: t.textSecondary }}>{msg?.workPress}</p>
                </div>
              </div>
             <div className={`grid grid-cols-2 ${isExporting ? 'gap-1 mb-2' : 'gap-3 mb-6'}`}>
                <div className={`${isExporting ? 'p-2' : 'p-4'} rounded-2xl border group hover:border-[#f97316]/50 transition-all cursor-pointer`} style={{ backgroundColor: 'rgba(0,0,0,0.1)', borderColor: t.border }}>
                  <label className="text-[7px] font-black uppercase tracking-widest opacity-50 block mb-0.5 flex justify-between items-center" style={{ color: t.textSecondary }}>
                    {msg?.runs}
                    <Edit2 size={10} className="opacity-60" style={{ color: '#f97316' }} />
                  </label>
                  <div className="border-b border-white/20">
                    {isExporting ? (
                      <div className="font-mono text-sm font-black" style={{ color: t.textPrimary }}>{runs}</div>
                    ) : (
                      <input type="number" className="bg-transparent border-none outline-none font-mono text-xl font-black w-full focus:text-[#f97316] transition-colors" style={{ color: t.textPrimary }} value={runs} onChange={(e)=>setRuns(Math.max(1, Number(e.target.value)))} />
                    )}
                  </div>
                </div>
                <div className={`${isExporting ? 'p-2' : 'p-4'} rounded-2xl border group hover:border-[#f97316]/50 transition-all cursor-pointer`} style={{ backgroundColor: 'rgba(0,0,0,0.1)', borderColor: t.border }}>
                  <label className="text-[7px] font-black uppercase tracking-widest opacity-50 block mb-0.5 flex justify-between items-center" style={{ color: t.textSecondary }}>
                    {msg?.cylinder}
                    <Edit2 size={10} className="opacity-60" style={{ color: '#f97316' }} />
                  </label>
                  <div className="border-b border-white/20">
                    {isExporting ? (
                      <div className="font-mono text-[10px] font-black leading-tight" style={{ color: '#f97316' }}>{selectedCyl?.name}</div>
                    ) : (
                      <select className="bg-transparent border-none outline-none font-mono text-xs font-black w-full appearance-none cursor-pointer focus:text-[#f97316] transition-colors" style={{ color: '#f97316' }} value={selectedCyl?.id} onChange={handleCylChange}>{CYLINDER_PRESETS.map(c => <option key={c.id} value={c.id} style={{backgroundColor: t.panel}}>{c.name}</option>)}</select>
                    )}
                  </div>
                </div>
             </div>
             <div className="space-y-2 flex-1">
                {(divingMode === 'TREATMENT' ? [
                { label: lang === 'zh' ? '空氣需求 (Chamber Air)' : 'Chamber Air', val: Math.round(chamberResults?.totalAir || 0), count: calcCylinderCount(chamberResults?.totalAir || 0, availableSCFPerCyl), color: '#3b82f6', price: 0 },
                { label: lang === 'zh' ? '純氧氣需求 (Chamber Oxygen)' : 'Chamber Oxygen', val: Math.round(chamberResults?.totalO2 || 0), count: calcCylinderCount(chamberResults?.totalO2 || 0, availableSCFPerCyl), color: '#22c55e', price: 1000 }
                ] : [
                  { label: msg?.bottomMix, val: bottomTotal, count: bottomCylCount, color: '#f97316', price: divingMode === 'AIR' ? 0 : 15000, hidden: bottomTotal === 0 },
                  { label: msg?.decoMix, val: decoTotal, count: decoCylCount, color: '#eab308', price: divingMode === 'AIR' ? 0 : 15000, hidden: decoTotal === 0 && divingMode === 'AIR' },
                  { label: msg?.oxygen, val: oxygenTotal, count: oxygenCylCount, color: '#22c55e', price: 1000, hidden: oxygenTotal === 0 },
                  { label: msg?.airMix, val: airTotal, count: airCylCount, color: '#3b82f6', price: 0, hidden: airTotal === 0 }
                ].filter(i => !i.hidden)).map(item => (
                  <div key={item.label} className="p-3 rounded-2xl border" style={{ backgroundColor: t.inputBg, borderColor: t.border }}>
                    <div className="flex items-center justify-between mb-1">
                      <div><p className="text-[7px] font-black uppercase opacity-50 tracking-widest" style={{ color: t.textSecondary }}>{item.label}</p><p className="text-sm font-mono font-black" style={{ color: t.textPrimary }}>{item.val} SCF</p></div>
                      <div className="text-right"><span className="text-2xl font-mono font-black" style={{ color: item.color }}>{item.count}</span><span className="text-[8px] font-black uppercase opacity-50 ml-1" style={{ color: t.textSecondary }}>{msg?.cyls}</span></div>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-dashed" style={{ borderColor: t.border }}>
                      <span className="text-[7px] font-bold opacity-40 uppercase" style={{ color: t.textSecondary }}>{msg?.budget}</span>
                      <span className="text-[10px] font-mono font-bold" style={{ color: t.textSecondary }}>NT$ {(item.count * item.price).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
             </div>
             <div className="mt-4 p-4 rounded-3xl border-2 border-dashed flex justify-between items-center" style={{ backgroundColor: 'rgba(34, 197, 94, 0.05)', borderColor: 'rgba(34, 197, 94, 0.2)' }}>
                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#22c55e' }}>{msg?.totalBudget}</span>
                <span className="text-xl font-mono font-black" style={{ color: '#22c55e' }}>NT$ {(divingMode === 'TREATMENT' ? (calcCylinderCount(chamberResults?.totalO2 || 0, availableSCFPerCyl) * 1000) : ((bottomCylCount * (divingMode==='AIR'?0:15000)) + (decoCylCount * (divingMode==='AIR'?0:15000)) + oxygenCylCount * 1000)).toLocaleString()}</span>
             </div>
          </section>
        </div>

        <footer id="pdf-footer" className={`mt-12 pt-8 border-t leading-relaxed ${isExporting ? 'opacity-80' : 'opacity-40'} text-[9px]`} style={{ borderColor: t.border, color: t.textSecondary }}>
          <div className="grid grid-cols-2 gap-12">
            <div>
              <p className="font-black mb-2 uppercase tracking-widest" style={{ color: t.textPrimary }}>Disclaimer / 免責聲明</p>
              <p>本工具僅供學術討論與教學演示使用，嚴禁直接用於實際潛水計畫之制定。潛水具備高度危險性，請務必遵循專業機構之訓練與官方教範。開發者不對因使用本軟體而導致的任何事故承擔法律責任。</p>
            </div>
            <div>
              <p className="font-black mb-2 uppercase tracking-widest" style={{ color: t.textPrimary }}>English Disclaimer</p>
              <p>This tool is for educational and simulation purposes ONLY. DO NOT use it for actual dive planning. Scuba diving is a high-risk activity; always follow certified training and official manuals. The developers are not liable for any injuries or damages resulting from the use of this software.</p>
            </div>
          </div>
          <div className="mt-8 flex justify-between items-center opacity-60">
            <p>© 2026 Diving Mission Controller V1.0.0</p>
            <p>Based on U.S. Navy Diving Manual Rev 7</p>
          </div>
        </footer>
      </div>
  );
}

export default App;
