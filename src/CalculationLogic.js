/**
 * Heliox Mission Calculation Logic
 * Standards: US Navy Diving Manual Rev 7
 */

export const CONSTANTS = {
  ASCENT_RATE: 30,
  DESCENT_RATE: 75,
  VENT_TIME_MINS: 3.0,
  V_ASCENT_SURD: 40,
  DIVER_CONSUMPTION_ACFM: 1.4,
  O2_PERIOD_MINS: 30,
  AIR_BREAK_MINS: 5,
};

const getATA = (depth) => (depth + 33) / 33;

export const getGasType = (depth) => {
  if (depth > 90) return 'BOTTOM';
  if (depth > 30) return '5050';
  return 'O2';
};

export const calcBottomGas = (depth, time, divers) => Math.round(divers * time * 1.4 * getATA(depth));

export const calcAscentGas = (startDepth, endDepth, divers) => {
  const avgDepth = (startDepth + endDepth) / 2;
  const ascentTime = (startDepth - endDepth) / CONSTANTS.ASCENT_RATE;
  return Math.round(divers * ascentTime * 1.4 * getATA(avgDepth));
};

export const calcTotalDecoGas = (stops, divers, o2Periods, mode) => {
  let decoMix = 0, oxygen = 0, bottomMix = 0, air = 0;
  
  stops.forEach(stop => {
    const ata = getATA(stop.depth);
    if (stop.depth >= 90) {
      bottomMix += divers * stop.time * 1.4 * ata;
    } else if (stop.depth > 30) {
      decoMix += divers * stop.time * 1.4 * ata;
    } else if (mode === 'WATER') {
      const totalTime = stop.time;
      const numBreaks = Math.floor(totalTime / 35);
      const airTime = numBreaks * 5;
      const o2Time = totalTime - airTime;
      oxygen += divers * o2Time * 1.4 * ata;
      air += divers * airTime * 1.4 * ata;
    }
  });

  if (stops.some(s => s.depth === 90)) decoMix += divers * 3 * 8 * getATA(90);
  if (mode === 'WATER' && stops.some(s => s.depth === 30)) oxygen += divers * 3 * 8 * getATA(30);
  else if (mode === 'SURD') oxygen += divers * o2Periods * 30 * 1.4 * getATA(50);

  return { bottomMix: Math.round(bottomMix), decoMix: Math.round(decoMix), oxygen: Math.round(oxygen), air: Math.round(air) };
};

export const getCylinderAvailableSCF = (psi, vol, res) => Math.floor((psi - res) * (vol / 14.7));
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
  if (stops.length > 0) {
    const firstStop = stops[0];
    const travelT = (lastDepth - firstStop.depth) / CONSTANTS.ASCENT_RATE;
    currentTime += travelT;
    data.push({ time: currentTime, depth: firstStop.depth, phase: 'Ascent to 1st Stop', gas: 'BOTTOM', timeStr: formatTime(currentTime), duration: travelT });
    lastDepth = firstStop.depth;
  }

  stops.forEach((stop, idx) => {
    const currentGasBase = getGasType(stop.depth);
    const prevGas = idx === 0 ? 'BOTTOM' : getGasType(stops[idx-1].depth);

    if (currentGasBase !== prevGas && (stop.depth === 90 || stop.depth === 30)) {
       switches.push({ time: currentTime, from: prevGas, to: currentGasBase, type: 'gradient_start' });
       currentTime += 3; 
       switches.push({ time: currentTime, from: prevGas, to: currentGasBase, type: 'gradient_end' });
       data.push({ time: currentTime, depth: stop.depth, phase: 'Ventilation', gas: currentGasBase, timeStr: formatTime(currentTime), duration: 3 });
       
       let remainingTime = stop.time - 3;
       if (stop.depth <= 30 && mode === 'WATER') {
          handleWaterO2(remainingTime, stop.depth, data, currentTime, formatTime);
          currentTime += remainingTime;
       } else {
          currentTime += remainingTime;
          data.push({ time: currentTime, depth: stop.depth, phase: 'Deco Stop', gas: currentGasBase, timeStr: formatTime(currentTime), duration: remainingTime });
       }
    } else {
       const travelT = idx === 0 ? 0 : (stops[idx-1].depth - stop.depth) / CONSTANTS.ASCENT_RATE;
       if (travelT > 0) {
          data.push({ time: currentTime + travelT, depth: stop.depth, phase: 'Travel', gas: currentGasBase, timeStr: formatTime(currentTime + travelT), duration: travelT });
       }
       currentTime += travelT;
       let stopDuration = stop.time - travelT;
       
       if (stop.depth <= 30 && mode === 'WATER') {
          handleWaterO2(stopDuration, stop.depth, data, currentTime, formatTime);
       } else {
          data.push({ time: currentTime + stopDuration, depth: stop.depth, phase: 'Deco Stop', gas: currentGasBase, timeStr: formatTime(currentTime + stopDuration), duration: stopDuration });
       }
       currentTime += stopDuration;
    }
    lastDepth = stop.depth;
  });

  function handleWaterO2(totalTime, depth, data, startTime, formatter) {
    let t = startTime;
    let rem = totalTime;
    while (rem > 0) {
       let o2T = Math.min(rem, 30);
       data.push({ time: t + o2T, depth, phase: 'Deco Stop', gas: 'O2', timeStr: formatter(t + o2T), duration: o2T });
       t += o2T; rem -= o2T;
       if (rem > 0) {
          let airT = Math.min(rem, 5);
          data.push({ time: t + airT, depth, phase: 'Air Break', gas: 'AIR', timeStr: formatter(t + airT), duration: airT });
          t += airT; rem -= airT;
       }
    }
  }

  if (mode === 'WATER') {
    const finalT = lastDepth / CONSTANTS.ASCENT_RATE;
    currentTime += finalT;
    data.push({ time: currentTime, depth: 0, phase: 'Surface', gas: 'AIR', timeStr: formatTime(currentTime), duration: finalT });
  } else {
    const travelToSurf = lastDepth / 40;
    currentTime += travelToSurf;
    data.push({ time: currentTime, depth: 0, phase: 'Surfacing', gas: '5050', timeStr: formatTime(currentTime), duration: travelToSurf });
    data.push({ time: currentTime + 3.5, depth: 0, phase: 'Surface Interval', gas: 'AIR', timeStr: formatTime(currentTime+3.5), duration: 3.5 });
    currentTime += 3.5;
    switches.push({ time: currentTime, from: 'AIR', to: 'O2', type: 'gradient_start' });
    currentTime += 0.5;
    switches.push({ time: currentTime, from: 'AIR', to: 'O2', type: 'gradient_end' });
    data.push({ time: currentTime, depth: 50, phase: 'Chamber Descent', gas: 'O2', timeStr: formatTime(currentTime), duration: 0.5 });

    for (let i = 1; i <= o2Periods; i++) {
      data.push({ time: currentTime + 30, depth: 50, phase: 'O2 Period', gas: 'O2', timeStr: formatTime(currentTime+30), duration: 30, pIndex: i });
      currentTime += 30;
      if (i < o2Periods) {
        data.push({ time: currentTime + 5, depth: 50, phase: 'Air Break', gas: 'AIR', timeStr: formatTime(currentTime+5), duration: 5 });
        currentTime += 5;
      }
    }
    data.push({ time: currentTime + 2, depth: 0, phase: 'Surface', gas: 'AIR', timeStr: formatTime(currentTime+2), duration: 2 });
  }

  return { data, switches };
};

export const expandChamberSteps = (o2Periods) => {
  const steps = [];
  for (let i = 1; i <= o2Periods; i++) {
    steps.push({ phase: 'O2 Period', depth: 50, time: 30, gas: 'O2' });
    if (i < o2Periods) steps.push({ phase: 'Air Break', depth: 50, time: 5, gas: 'AIR' });
  }
  return steps;
};
