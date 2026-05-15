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

export const getATA = (depth) => (depth + 33) / 33;

export const getGasType = (depth, divingMode = 'HELIOX', inWaterGas = 'O2') => {
  if (divingMode === 'AIR') {
    if (inWaterGas === 'AIR') return 'AIR';
    if (depth > 30) return 'AIR';
    return 'O2';
  }
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

export const calcTotalDecoGas = (stops, divers, o2Periods, mode, divingMode = 'HELIOX', inWaterGas = 'O2') => {
  let decoMix = 0, oxygen = 0, bottomMix = 0, air = 0;
  
  stops.forEach(stop => {
    const ata = getATA(stop.depth);
    if (stop.depth >= 90) {
      bottomMix += divers * stop.time * CONSTANTS.DECO_CONSUMPTION_ACFM * ata;
    } else if (divingMode === 'AIR' && stop.depth > 30) {
      air += divers * stop.time * CONSTANTS.DECO_CONSUMPTION_ACFM * ata;
    } else if (divingMode === 'AIR' && stop.depth <= 30) {
      if (inWaterGas === 'O2') {
        const o2Time = stop.time;
        let numBreaks = 0;
        if (!(stop.depth === 20 && o2Time <= 35)) {
          numBreaks = Math.max(0, Math.floor((o2Time - 0.01) / 30));
        }
        const airTime = numBreaks * 5;
        oxygen += divers * o2Time * CONSTANTS.DECO_CONSUMPTION_ACFM * ata;
        air += divers * airTime * CONSTANTS.DECO_CONSUMPTION_ACFM * ata;
      } else {
        air += divers * stop.time * CONSTANTS.DECO_CONSUMPTION_ACFM * ata;
      }
    } else if (stop.depth > 30) {
      decoMix += divers * stop.time * CONSTANTS.DECO_CONSUMPTION_ACFM * ata;
    } else if (mode === 'WATER') {
      const o2Time = stop.time;
      let numBreaks = 0;
      if (!(stop.depth === 20 && o2Time <= 35)) {
        numBreaks = Math.max(0, Math.floor((o2Time - 0.01) / 30));
      }
      const airTime = numBreaks * 5;
      oxygen += divers * o2Time * CONSTANTS.DECO_CONSUMPTION_ACFM * ata;
      air += divers * airTime * CONSTANTS.DECO_CONSUMPTION_ACFM * ata;
    }
  });

  if (stops.some(s => s.depth === 90) && divingMode === 'HELIOX') {
    bottomMix += divers * 3 * CONSTANTS.VENT_CONSUMPTION_ACFM * getATA(90);
  }
  
  if (mode === 'WATER') {
    const firstO2Stop = stops.find(s => getGasType(s.depth, divingMode, inWaterGas) === 'O2');
    if (firstO2Stop) {
      oxygen += divers * 3 * CONSTANTS.VENT_CONSUMPTION_ACFM * getATA(firstO2Stop.depth);
    }
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

export const generateProfileData = (maxDepth, bottomTime, stops, o2Periods, mode, divers = 1, divingMode = 'HELIOX', inWaterGas = 'O2') => {
  let currentTime = 0;
  const data = [];
  
  const getSegmentGas = (duration, depth, phase, gas) => {
    if (duration <= 0) return 0;
    const rate = (phase === 'Descent' || phase === 'Bottom' || gas === 'BOTTOM') ? 
                 CONSTANTS.BOTTOM_CONSUMPTION_ACFM : 
                 (phase === 'Ventilation' ? CONSTANTS.VENT_CONSUMPTION_ACFM : CONSTANTS.DECO_CONSUMPTION_ACFM);
    return divers * duration * rate * getATA(depth);
  };

  const formatTime = (t) => {
    const mins = Math.floor(t);
    const secs = Math.round((t % 1) * 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const bottomGas = divingMode === 'AIR' ? 'AIR' : 'BOTTOM';
  
  data.push({ time: 0, depth: 0, phase: 'Start', gas: bottomGas, timeStr: '00:00', duration: 0, segmentGasSCF: 0 });
  const descT = maxDepth / CONSTANTS.DESCENT_RATE;
  data.push({ 
    time: descT, depth: maxDepth, phase: 'Descent', gas: bottomGas, timeStr: formatTime(descT), duration: descT,
    segmentGasSCF: getSegmentGas(descT, maxDepth/2, 'Descent', bottomGas)
  });
  currentTime = descT + bottomTime;
  data.push({ 
    time: currentTime, depth: maxDepth, phase: 'Bottom', gas: bottomGas, timeStr: formatTime(currentTime), duration: bottomTime,
    segmentGasSCF: getSegmentGas(bottomTime, maxDepth, 'Bottom', bottomGas)
  });

  let lastDepth = maxDepth;
  let o2Acc = 0; 

  stops.forEach((stop, idx) => {
    // 1. Calculate Travel to current stop
    const travelStepT = (lastDepth - stop.depth) / CONSTANTS.ASCENT_RATE;
    if (travelStepT > 0) {
      currentTime += travelStepT;
      const travelGas = getGasType(lastDepth, divingMode, inWaterGas);
      
      // If we are already breathing O2 during travel (i.e. moving between O2 stations), count it.
      if (travelGas === 'O2' && mode === 'WATER') {
         o2Acc += travelStepT;
      }

      data.push({ 
        time: currentTime, 
        depth: stop.depth, 
        phase: idx === 0 ? 'Ascent to 1st Stop' : 'Travel', 
        gas: travelGas, 
        timeStr: formatTime(currentTime), 
        duration: travelStepT,
        segmentGasSCF: getSegmentGas(travelStepT, (lastDepth + stop.depth)/2, 'Travel', travelGas)
      });
    }

    // 2. Identify Gas Change / Ventilation
    const currentGasBase = getGasType(stop.depth, divingMode, inWaterGas);
    const prevGas = getGasType(lastDepth, divingMode, inWaterGas);
    
    // US Navy Rule: travel time between stops is included in the next stop's time.
    // However, the very first ascent (Bottom to Stop 1) is NOT included.
    const travelToSubtract = (idx === 0) ? 0 : travelStepT;

    const isFirstO2 = currentGasBase === 'O2' && prevGas !== 'O2';
    const isHeliox5050 = divingMode === 'HELIOX' && currentGasBase === '5050' && prevGas !== '5050';

    if (isFirstO2 || isHeliox5050) {
       // Ventilation Segment (starts AFTER arriving at the stop)
       currentTime += 3; 
       const ventGas = currentGasBase;
       data.push({ 
         time: currentTime, 
         depth: stop.depth, 
         phase: 'Ventilation', 
         gas: ventGas, 
         timeStr: formatTime(currentTime), 
         duration: 3,
         segmentGasSCF: getSegmentGas(3, stop.depth, 'Ventilation', ventGas)
       });

       
       // Calculate remaining duration for the stop
       let remainingStopDuration;
       if (isHeliox5050) {
         // 90' station: Travel and 3 mins vent are BOTH INCLUDED in stop time
         remainingStopDuration = stop.time - travelToSubtract - 3;
       } else { // isFirstO2
         // O2 station: Travel and Vent are EXTRA time in water mode
         remainingStopDuration = (mode === 'WATER') ? stop.time : stop.time - travelToSubtract;
       }

       if (remainingStopDuration > 0) {
          if (currentGasBase === 'O2' && mode === 'WATER') {
             const res = handleWaterO2(remainingStopDuration, stop.depth, data, currentTime, formatTime, o2Acc);
             currentTime = res.endTime;
             o2Acc = res.newO2Acc;
          } else {
             currentTime += remainingStopDuration;
             data.push({ 
               time: currentTime, depth: stop.depth, phase: 'Deco Stop', gas: currentGasBase, timeStr: formatTime(currentTime), duration: remainingStopDuration,
               segmentGasSCF: getSegmentGas(remainingStopDuration, stop.depth, 'Deco Stop', currentGasBase)
             });
          }
       }
    } else {
       // Normal Stop without gas switch
       const stopDuration = stop.time - travelToSubtract;
       if (stopDuration > 0) {
          if (currentGasBase === 'O2' && mode === 'WATER') {
             const res = handleWaterO2(stopDuration, stop.depth, data, currentTime, formatTime, o2Acc);
             currentTime = res.endTime;
             o2Acc = res.newO2Acc;
          } else {
             currentTime += stopDuration;
             data.push({ 
               time: currentTime, depth: stop.depth, phase: 'Deco Stop', gas: currentGasBase, timeStr: formatTime(currentTime), duration: stopDuration,
               segmentGasSCF: getSegmentGas(stopDuration, stop.depth, 'Deco Stop', currentGasBase)
             });
          }
       }
    }
    lastDepth = stop.depth;
  });

  function handleWaterO2(totalTime, depth, data, startTime, formatter, currentO2) {
    let t = startTime;
    let remDeco = totalTime;
    let o2Timer = currentO2;
    
    // US Navy Rule: If TOTAL continuous O2 time is <= 35, skip air breaks AT THIS STATION.
    if (depth === 20 && (o2Timer + totalTime) <= 35.01) {
       data.push({ 
         time: t + totalTime, depth, phase: 'Deco Stop', gas: 'O2', timeStr: formatter(t + totalTime), duration: totalTime,
         segmentGasSCF: getSegmentGas(totalTime, depth, 'Deco Stop', 'O2')
       });
       return { endTime: t + totalTime, newO2Acc: o2Timer + totalTime };
    }

    while (remDeco > 0) {
       // Check if we need a break BEFORE starting more O2
       if (o2Timer >= 29.99) {
          data.push({ 
            time: t + 5, depth, phase: 'Air Break', gas: 'AIR', timeStr: formatter(t + 5), duration: 5,
            segmentGasSCF: getSegmentGas(5, depth, 'Air Break', 'AIR')
          });
          t += 5;
          o2Timer = 0;
       }

       let timeToNextBreak = 30 - o2Timer;
       let o2Chunk = Math.min(remDeco, timeToNextBreak);
       
       // US Navy 35-minute Exception: If the remaining O2 time at 20 fsw is 35 minutes or less,
       // and we have just handled any required breaks, finish it in one go.
       if (depth === 20 && remDeco <= 35.01) {
          o2Chunk = remDeco;
       }
       
       data.push({ 
         time: t + o2Chunk, depth, phase: 'Deco Stop', gas: 'O2', timeStr: formatter(t + o2Chunk), duration: o2Chunk,
         segmentGasSCF: getSegmentGas(o2Chunk, depth, 'Deco Stop', 'O2')
       });
       
       t += o2Chunk;
       remDeco -= o2Chunk;
       o2Timer += o2Chunk;
    }
    return { endTime: t, newO2Acc: o2Timer };
  }

  if (mode === 'WATER') {
    const finalT = lastDepth / CONSTANTS.ASCENT_RATE;
    if (finalT > 0) {
      currentTime += finalT;
      const finalGas = getGasType(lastDepth, divingMode, inWaterGas);
      data.push({ 
        time: currentTime, depth: 0, phase: 'Surface', gas: finalGas, timeStr: formatTime(currentTime), duration: finalT,
        segmentGasSCF: getSegmentGas(finalT, lastDepth/2, 'Ascent', finalGas)
      });
    }
  } else {
    const travelToSurf = lastDepth / 40;
    if (travelToSurf > 0) {
      currentTime += travelToSurf;
      const surfGas = divingMode === 'AIR' ? 'AIR' : '5050';
      data.push({ 
        time: currentTime, depth: 0, phase: 'Surfacing', gas: surfGas, timeStr: formatTime(currentTime), duration: travelToSurf,
        segmentGasSCF: getSegmentGas(travelToSurf, lastDepth/2, 'Ascent', surfGas)
      });
    }
    
    data.push({ 
      time: currentTime + 3.5, depth: 0, phase: 'Surface Interval', gas: 'AIR', timeStr: formatTime(currentTime+3.5), duration: 3.5,
      segmentGasSCF: 0 
    });
    currentTime += 3.5;
    
    let chamberDepth = 50;
    currentTime += 0.5;
    data.push({ 
      time: currentTime, depth: 50, phase: 'Chamber Descent', gas: 'AIR', timeStr: formatTime(currentTime), duration: 0.5,
      segmentGasSCF: getSegmentGas(0.5, 25, 'Chamber Descent', 'AIR')
    });

    const fullPeriods = Math.ceil(o2Periods);
    for (let i = 1; i <= fullPeriods; i++) {
      const isHalfPeriod = (i === fullPeriods && o2Periods % 1 !== 0);
      if (i === 1) {
        if (isHalfPeriod) {
          data.push({ 
            time: currentTime + 15, depth: 50, phase: 'O2 Period', gas: 'O2', timeStr: formatTime(currentTime+15), duration: 15, pIndex: 1,
            segmentGasSCF: getSegmentGas(15, 50, 'O2 Period', 'O2')
          });
          currentTime += 15;
          chamberDepth = 50;
        } else {
          data.push({ 
            time: currentTime + 15, depth: 50, phase: 'O2 Period', gas: 'O2', timeStr: formatTime(currentTime+15), duration: 15, pIndex: 1,
            segmentGasSCF: getSegmentGas(15, 50, 'O2 Period', 'O2')
          });
          currentTime += 15;
          
          const moveT = 40 / 60;
          const stayT = 15 - moveT;
          currentTime += moveT;
          data.push({ 
            time: currentTime, depth: 40, phase: 'O2 Period', gas: 'O2', timeStr: formatTime(currentTime), duration: moveT, pIndex: 1,
            segmentGasSCF: getSegmentGas(moveT, 45, 'O2 Period', 'O2')
          });
          currentTime += stayT;
          data.push({ 
            time: currentTime, depth: 40, phase: 'O2 Period', gas: 'O2', timeStr: formatTime(currentTime), duration: stayT, pIndex: 1,
            segmentGasSCF: getSegmentGas(stayT, 40, 'O2 Period', 'O2')
          });
          chamberDepth = 40;
        }
      } else {
        const currentDepth = i >= 5 ? 30 : 40;
        if (isHalfPeriod) {
          data.push({ 
            time: currentTime + 15, depth: currentDepth, phase: 'O2 Period', gas: 'O2', timeStr: formatTime(currentTime+15), duration: 15, pIndex: i,
            segmentGasSCF: getSegmentGas(15, currentDepth, 'O2 Period', 'O2')
          });
          currentTime += 15;
        } else {
          data.push({ 
            time: currentTime + 30, depth: currentDepth, phase: 'O2 Period', gas: 'O2', timeStr: formatTime(currentTime+30), duration: 30, pIndex: i,
            segmentGasSCF: getSegmentGas(30, currentDepth, 'O2 Period', 'O2')
          });
          currentTime += 30;
        }
        chamberDepth = currentDepth;
      }

      if (i < fullPeriods) {
        const nextDepth = (i + 1) >= 5 ? 30 : 40;
        if (nextDepth !== chamberDepth) {
          const moveT = 40 / 60;
          const stayT = 5 - moveT;
          currentTime += moveT;
          data.push({ 
            time: currentTime, depth: nextDepth, phase: 'Air Break', gas: 'AIR', timeStr: formatTime(currentTime), duration: moveT,
            segmentGasSCF: getSegmentGas(moveT, (chamberDepth + nextDepth)/2, 'Air Break', 'AIR')
          });
          currentTime += stayT;
          data.push({ 
            time: currentTime, depth: nextDepth, phase: 'Air Break', gas: 'AIR', timeStr: formatTime(currentTime), duration: stayT,
            segmentGasSCF: getSegmentGas(stayT, nextDepth, 'Air Break', 'AIR')
          });
          chamberDepth = nextDepth;
        } else {
          data.push({ 
            time: currentTime + 5, depth: chamberDepth, phase: 'Air Break', gas: 'AIR', timeStr: formatTime(currentTime+5), duration: 5,
            segmentGasSCF: getSegmentGas(5, chamberDepth, 'Air Break', 'AIR')
          });
          currentTime += 5;
        }
      }
    }
    const finalAscentT = chamberDepth / 30;
    data.push({ 
      time: currentTime + finalAscentT, depth: 0, phase: 'Surface', gas: 'AIR', timeStr: formatTime(currentTime + finalAscentT), duration: finalAscentT,
      segmentGasSCF: getSegmentGas(finalAscentT, chamberDepth/2, 'Ascent', 'AIR')
    });
  }

  return { data, switches: [] };
};

export const expandChamberSteps = (o2Periods) => {
  const steps = [];
  const fullPeriods = Math.ceil(o2Periods);
  for (let i = 1; i <= fullPeriods; i++) {
    const isHalfPeriod = (i === fullPeriods && o2Periods % 1 !== 0);
    if (i === 1) {
      steps.push({ phase: 'O2 Period', depth: 50, time: 15, gas: 'O2', pIndex: 1 });
      if (!isHalfPeriod) {
        steps.push({ phase: 'O2 Period', depth: 40, time: 15, gas: 'O2', pIndex: 1 });
      }
    } else {
      const currentDepth = i >= 5 ? 30 : 40;
      steps.push({ phase: 'O2 Period', depth: currentDepth, time: isHalfPeriod ? 15 : 30, gas: 'O2', pIndex: i });
    }

    if (i < fullPeriods) {
      const nextDepth = (i + 1) >= 5 ? 30 : 40;
      steps.push({ phase: 'Air Break', depth: nextDepth, time: 5, gas: 'AIR' });
    }
  }
  return steps;
};
