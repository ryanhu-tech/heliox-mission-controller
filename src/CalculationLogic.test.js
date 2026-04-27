import { describe, it, expect } from 'vitest';
import { getATA, getGasType, generateProfileData } from './CalculationLogic';

describe('CalculationLogic Core Math', () => {
  it('should calculate ATA correctly', () => {
    expect(getATA(0)).toBe(1);
    expect(getATA(33)).toBe(2);
    expect(getATA(297)).toBe(10);
  });

  it('should return correct gas type based on depth', () => {
    expect(getGasType(300)).toBe('BOTTOM');
    expect(getGasType(90)).toBe('5050');
    expect(getGasType(30)).toBe('O2');
    expect(getGasType(20)).toBe('O2');
  });

  it('should calculate segment gas consumption correctly', () => {
    // 100 fsw descent at 75 fpm = 1.333 min
    // Avg depth 50 fsw, ATA = 2.515
    // Rate 1.4, Divers 1
    // SCF = 1.333 * 1.4 * 2.515 = 4.69
    const maxDepth = 100;
    const bottomTime = 10;
    const res = generateProfileData(maxDepth, bottomTime, [], 0, 'WATER', 1);
    const descentSeg = res.data.find(d => d.phase === 'Descent');
    
    expect(descentSeg.segmentGasSCF).toBeGreaterThan(4);
    expect(descentSeg.segmentGasSCF).toBeLessThan(5);
  });

  it('should apply SURD rules (surfacing gas is 5050)', () => {
    const res = generateProfileData(100, 10, [{depth:40, time:5}], 2, 'SURD', 1);
    const surfacing = res.data.find(d => d.phase === 'Surfacing');
    expect(surfacing).toBeDefined();
    expect(surfacing.gas).toBe('5050');
  });

  it('should handle Chamber P0.5 naming correctly in profile data', () => {
     // pIndex 1 in SurD is P0.5
     const res = generateProfileData(100, 10, [], 1, 'SURD', 1);
     const o2Period = res.data.find(d => d.phase === 'O2 Period');
     expect(o2Period.pIndex).toBe(1);
  });
});
