/**
 * Heliox Mission Calculation Logic
 * Standards: US Navy Diving Manual Rev 7
 */

export const CONSTANTS = {
  ASCENT_RATE: 30,
  DESCENT_RATE: 75,
  VENT_TIME_MINS: 3.0,
  V_ASCENT_SURD: 40,
  BOTTOM_CONSUMPTION_ACFM: 1.4,
  DECO_CONSUMPTION_ACFM: 0.75,
  VENT_CONSUMPTION_ACFM: 8,
  O2_PERIOD_MINS: 30,
  AIR_BREAK_MINS: 5,
};

const getATA = (depth) => (depth + 33) / 33;

export const getGasType = (depth) => {
  if (depth > 90) return 'BOTTOM';
  if (depth > 30) return '5050';
  return 'O2';
};

export const calcBottomGas = (depth, time, divers) => Math.ceil(divers * time * CONSTANTS.BOTTOM_CONSUMPTION_ACFM * getATA(depth));

export const calcAscentGas = (startDepth, endDepth, divers) => {
  const avgDepth = (startDepth + endDepth) / 2;
  const ascentTime = (startDepth - endDepth) / CONSTANTS.ASCENT_RATE;
  return Math.ceil(divers * ascentTime * CONSTANTS.DECO_CONSUMPTION_ACFM * getATA(avgDepth));
};

export const calcTotalDecoGas = (stops, divers, o2Periods, mode) => {
  let decoMix = 0, oxygen = 0, bottomMix = 0, air = 0;
  
  stops.forEach(stop => {
    const ata = getATA(stop.depth);
    if (stop.depth >= 90) {
      bottomMix += divers * stop.time * CONSTANTS.DECO_CONSUMPTION_ACFM * ata;
    } else if (stop.depth > 30) {
      decoMix += divers * stop.time * CONSTANTS.DECO_CONSUMPTION_ACFM * ata;
    } else if (mode === 'WATER') {
      const totalTime = stop.time;
      const numBreaks = Math.floor(totalTime / 35);
      const airTime = numBreaks * 5;
      const o2Time = totalTime - airTime;
      oxygen += divers * o2Time * CONSTANTS.DECO_CONSUMPTION_ACFM * ata;
      air += divers * airTime * CONSTANTS.DECO_CONSUMPTION_ACFM * ata;
    }
  });

  if (stops.some(s => s.depth === 90)) {
    bottomMix += divers * 3 * CONSTANTS.VENT_CONSUMPTION_ACFM * getATA(90);
  }
  
  if (mode === 'WATER' && stops.some(s => s.depth === 30)) {
    oxygen += divers * 3 * CONSTANTS.VENT_CONSUMPTION_ACFM * getATA(30);
  } else if (mode === 'SURD') {
    // SurD O2 Periods: All at 0.75 ACFM as they are resting in chamber
    oxygen += divers * o2Periods * 30 * CONSTANTS.DECO_CONSUMPTION_ACFM * getATA(40); // Avg depth is roughly 40
  }

  return { 
    bottomMix: Math.ceil(bottomMix), 
    decoMix: Math.ceil(decoMix), 
    oxygen: Math.ceil(oxygen), 
    air: Math.ceil(air) 
  };
};

export const getCylinderAvailableSCF = (psi, vol, res) => {
  const va = (psi - res) * (vol / 14.7);
  return Math.floor(va * 100) / 100;
};
export const calcCylinderCount = (total, avail) => avail > 0 ? Math.ceil(total / avail) : 0;

export const generateProfileData = (maxDepth, bottomTime, stops, o2Periods, mode) => {
  let currentTime = 0;
  const data = [];
  const switches = [];

  const formatTime = (t) => {
    const mins = Math.floor(t);
    const secs = Math.round((t % 1) * 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  data.push({ time: 0, depth: 0, phase: 'Start', gas: 'BOTTOM', timeStr: '00:00', duration: 0 });
  const descT = maxDepth / CONSTANTS.DESCENT_RATE;
  data.push({ time: descT, depth: maxDepth, phase: 'Descent', gas: 'BOTTOM', timeStr: formatTime(descT), duration: descT });
  currentTime = descT + bottomTime;
  data.push({ time: currentTime, depth: maxDepth, phase: 'Bottom', gas: 'BOTTOM', timeStr: formatTime(currentTime), duration: bottomTime });

  let lastDepth = maxDepth;
  const firstStopDepth = stops.length > 0 ? stops[0].depth : 0;
  const travelT = (lastDepth - firstStopDepth) / CONSTANTS.ASCENT_RATE;
  if (travelT > 0) {
    currentTime += travelT;
    data.push({ time: currentTime, depth: firstStopDepth, phase: 'Ascent to 1st Stop', gas: 'BOTTOM', timeStr: formatTime(currentTime), duration: travelT });
    lastDepth = firstStopDepth;
  }

  let o2Acc = 0; 

  stops.forEach((stop, idx) => {
    const currentGasBase = getGasType(stop.depth);
    const prevGas = idx === 0 ? 'BOTTOM' : getGasType(stops[idx-1].depth);

    if (currentGasBase !== prevGas && (stop.depth === 90 || stop.depth === 30)) {
       currentTime += 3; 
       const ventGas = (stop.depth === 30 && mode === 'WATER') ? prevGas : currentGasBase;
       data.push({ time: currentTime, depth: stop.depth, phase: 'Ventilation', gas: ventGas, timeStr: formatTime(currentTime), duration: 3 });
       
       let remainingTime = stop.depth === 90 ? stop.time - 3 : stop.time;
       if (remainingTime > 0) {
         if (stop.depth <= 30 && mode === 'WATER') {
            const res = handleWaterO2(remainingTime, stop.depth, data, currentTime, formatTime, o2Acc);
            currentTime = res.endTime;
            o2Acc = res.newO2Acc;
         } else {
            currentTime += remainingTime;
            data.push({ time: currentTime, depth: stop.depth, phase: 'Deco Stop', gas: currentGasBase, timeStr: formatTime(currentTime), duration: remainingTime });
         }
       }
    } else {
       const travelStepT = idx === 0 ? 0 : (stops[idx-1].depth - stop.depth) / CONSTANTS.ASCENT_RATE;
       if (travelStepT > 0) {
          currentTime += travelStepT;
          if (stop.depth <= 30 && mode === 'WATER') o2Acc += travelStepT;
          data.push({ time: currentTime, depth: stop.depth, phase: 'Travel', gas: currentGasBase, timeStr: formatTime(currentTime), duration: travelStepT });
       }
       
       let stopDuration = idx === 0 ? stop.time : stop.time - travelStepT;
       if (stopDuration > 0) {
         if (stop.depth <= 30 && mode === 'WATER') {
            const res = handleWaterO2(stopDuration, stop.depth, data, currentTime, formatTime, o2Acc);
            currentTime = res.endTime;
            o2Acc = res.newO2Acc;
         } else {
            data.push({ time: currentTime + stopDuration, depth: stop.depth, phase: 'Deco Stop', gas: currentGasBase, timeStr: formatTime(currentTime + stopDuration), duration: stopDuration });
            currentTime += stopDuration;
         }
       }
    }
    lastDepth = stop.depth;
  });

  function handleWaterO2(totalTime, depth, data, startTime, formatter, currentO2) {
    let t = startTime;
    let remDeco = totalTime;
    let o2Timer = currentO2;
    
    if (depth === 20 && totalTime <= 35) {
       data.push({ time: t + totalTime, depth, phase: 'Deco Stop', gas: 'O2', timeStr: formatter(t + totalTime), duration: totalTime });
       return { endTime: t + totalTime, newO2Acc: o2Timer + totalTime };
    }

    while (remDeco > 0) {
       let timeToNextBreak = 30 - o2Timer;
       
       if (timeToNextBreak <= 0.001) {
          data.push({ time: t + 5, depth, phase: 'Air Break', gas: 'AIR', timeStr: formatter(t + 5), duration: 5 });
          t += 5;
          o2Timer = 0;
          timeToNextBreak = 30;
       }

       let o2Chunk = Math.min(remDeco, timeToNextBreak);
       data.push({ time: t + o2Chunk, depth, phase: 'Deco Stop', gas: 'O2', timeStr: formatter(t + o2Chunk), duration: o2Chunk });
       
       t += o2Chunk;
       remDeco -= o2Chunk; // 只有這裡扣除減壓時間
       o2Timer += o2Chunk;

       if (o2Timer >= 29.99 && remDeco > 0) {
          data.push({ time: t + 5, depth, phase: 'Air Break', gas: 'AIR', timeStr: formatter(t + 5), duration: 5 });
          t += 5;
          o2Timer = 0;
       }
    }
    return { endTime: t, newO2Acc: o2Timer };
  }

  if (mode === 'WATER') {
    const finalT = lastDepth / CONSTANTS.ASCENT_RATE;
    if (finalT > 0) {
      currentTime += finalT;
      data.push({ time: currentTime, depth: 0, phase: 'Surface', gas: 'O2', timeStr: formatTime(currentTime), duration: finalT });
    }
  } else {
    // SurD O2 specific
    const travelToSurf = lastDepth / 40;
    if (travelToSurf > 0) {
      currentTime += travelToSurf;
      data.push({ time: currentTime, depth: 0, phase: 'Surfacing', gas: '5050', timeStr: formatTime(currentTime), duration: travelToSurf });
    }
    
    // SI Window
    data.push({ time: currentTime + 3.5, depth: 0, phase: 'Surface Interval', gas: 'AIR', timeStr: formatTime(currentTime+3.5), duration: 3.5 });
    currentTime += 3.5;
    
    const getChamberDepth = (pIndex) => {
      if (pIndex <= 4) return 50;
      if (pIndex <= 8) return 40;
      return 30;
    };

    let chamberDepth = 50;
    currentTime += 0.5;
    data.push({ time: currentTime, depth: 50, phase: 'Chamber Descent', gas: 'AIR', timeStr: formatTime(currentTime), duration: 0.5 });

    for (let i = 1; i <= o2Periods; i++) {
      if (i === 1) {
        // Special P1 Rule: 15m at 50ft, then move to 40ft for remaining 15m
        data.push({ time: currentTime + 15, depth: 50, phase: 'O2 Period', gas: 'O2', timeStr: formatTime(currentTime+15), duration: 15, pIndex: 1 });
        currentTime += 15;
        
        const moveT = 40 / 60;
        const stayT = 15 - moveT;
        currentTime += moveT;
        data.push({ time: currentTime, depth: 40, phase: 'O2 Period', gas: 'O2', timeStr: formatTime(currentTime), duration: moveT, pIndex: 1 });
        currentTime += stayT;
        data.push({ time: currentTime, depth: 40, phase: 'O2 Period', gas: 'O2', timeStr: formatTime(currentTime), duration: stayT, pIndex: 1 });
        chamberDepth = 40;
      } else {
        // Normal P2+ Period
        data.push({ time: currentTime + 30, depth: chamberDepth, phase: 'O2 Period', gas: 'O2', timeStr: formatTime(currentTime+30), duration: 30, pIndex: i });
        currentTime += 30;
      }

      if (i < o2Periods) {
        const nextDepth = (i + 1) >= 5 ? 30 : 40; // P5+ is 30, P2-4 is 40
        if (nextDepth !== chamberDepth) {
          // Ascent covered by 5-min Air Break (P4 -> P5)
          const moveT = 40 / 60;
          const stayT = 5 - moveT;
          currentTime += moveT;
          data.push({ time: currentTime, depth: nextDepth, phase: 'Air Break', gas: 'AIR', timeStr: formatTime(currentTime), duration: moveT });
          currentTime += stayT;
          data.push({ time: currentTime, depth: nextDepth, phase: 'Air Break', gas: 'AIR', timeStr: formatTime(currentTime), duration: stayT });
          chamberDepth = nextDepth;
        } else {
          data.push({ time: currentTime + 5, depth: chamberDepth, phase: 'Air Break', gas: 'AIR', timeStr: formatTime(currentTime+5), duration: 5 });
          currentTime += 5;
        }
      }
    }
    const finalAscentT = chamberDepth / 30;
    data.push({ time: currentTime + finalAscentT, depth: 0, phase: 'Surface', gas: 'AIR', timeStr: formatTime(currentTime + finalAscentT), duration: finalAscentT });
  }

  return { data, switches: [] };
};

export const expandChamberSteps = (o2Periods) => {
  const steps = [];
  for (let i = 1; i <= o2Periods; i++) {
    if (i === 1) {
      steps.push({ phase: 'O2 Period', depth: 50, time: 15, gas: 'O2', pIndex: 1 });
      steps.push({ phase: 'O2 Period', depth: 40, time: 15, gas: 'O2', pIndex: 1 });
    } else {
      const currentDepth = i >= 5 ? 30 : 40;
      steps.push({ phase: 'O2 Period', depth: currentDepth, time: 30, gas: 'O2', pIndex: i });
    }

    if (i < o2Periods) {
      const nextDepth = (i + 1) >= 5 ? 30 : 40;
      steps.push({ phase: 'Air Break', depth: nextDepth, time: 5, gas: 'AIR' });
    }
  }
  return steps;
};
