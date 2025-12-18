import { StatResult } from '../types';

function getZPercentile(p: number): number {
  const a1 = -39.69683028665376;
  const a2 = 220.9460984245205;
  const a3 = -275.9285104469687;
  const a4 = 138.3577518672690;
  const a5 = -30.66479806614716;
  const a6 = 2.506628277459239;

  const b1 = -54.47609879822406;
  const b2 = 161.58503682528349;
  const b3 = -155.6989798598866;
  const b4 = 66.80131188771972;
  const b5 = -13.28068155288572;

  const c1 = -0.007784894002430293;
  const c2 = -0.3223964580411365;
  const c3 = -2.400758277161838;
  const c4 = -2.549732539343734;
  const c5 = 4.374664141464968;
  const c6 = 2.938163982698783;

  const q = p - 0.5;
  let r, x;

  if (Math.abs(q) <= 0.42) {
    r = q * q;
    x = q * (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) /
        (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
  } else {
    r = p;
    if (q > 0) r = 1 - p;
    r = Math.sqrt(-Math.log(r));
    x = (((((c1 * r + c2) * r + c3) * r + c4) * r + c5) * r + c6);
    if (q < 0) x = -x;
  }
  return x;
}

export const calculateStats = (data: number[]): StatResult | null => {
  const n = data.length;
  if (n < 2) return null;

  const sorted = [...data].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[n - 1];
  const sum = data.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  
  const mid = Math.floor(n / 2);
  const median = n % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
  const stdDev = Math.sqrt(variance);
  const marginError = 1.96 * (stdDev / Math.sqrt(n));
  const confidenceInterval: [number, number] = [mean - marginError, mean + marginError];

  let m3 = 0;
  let m4 = 0;
  data.forEach(x => {
    const d = x - mean;
    m3 += Math.pow(d, 3);
    m4 += Math.pow(d, 4);
  });
  
  m3 /= n;
  m4 /= n;
  const populationVar = variance * (n-1)/n;
  const skewness = m3 / Math.pow(Math.sqrt(populationVar), 3);
  const kurtosis = (m4 / Math.pow(populationVar, 2)) - 3; 

  const jb = (n / 6) * (Math.pow(skewness, 2) + 0.25 * Math.pow(kurtosis, 2));
  const isNormal = jb < 5.99;

  return {
    mean,
    median,
    stdDev,
    min,
    max,
    confidenceInterval,
    skewness,
    kurtosis,
    jarqueBera: jb,
    isNormal
  };
};

export const calculateQQData = (data: number[]) => {
  const sorted = [...data].sort((a, b) => a - b);
  const n = sorted.length;
  return sorted.map((value, i) => {
    const p = (i + 0.5) / n; 
    const theoretical = getZPercentile(p);
    return { x: theoretical, y: value, index: i };
  });
};