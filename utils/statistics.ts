import { StatResult, WaterSample, MetricKey } from '../types';
import { calculateDistance } from './geo';

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
  const filteredData = data.filter(v => v !== null && v !== undefined);
  const n = filteredData.length;
  if (n < 2) return null;

  const sorted = [...filteredData].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[n - 1];
  const sum = filteredData.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  
  const mid = Math.floor(n / 2);
  const median = n % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  const variance = filteredData.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
  const stdDev = Math.sqrt(variance);
  const marginError = 1.96 * (stdDev / Math.sqrt(n));
  const confidenceInterval: [number, number] = [mean - marginError, mean + marginError];

  let m3 = 0;
  let m4 = 0;
  filteredData.forEach(x => {
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

  return { mean, median, stdDev, min, max, confidenceInterval, skewness, kurtosis, jarqueBera: jb, isNormal };
};

export const calculateLastDigitDistribution = (data: number[]) => {
  const actual = Array(10).fill(0);
  let count = 0;
  data.forEach(val => {
    const s = val.toFixed(2);
    const digit = parseInt(s[s.length - 1]);
    if (!isNaN(digit)) {
      actual[digit]++;
      count++;
    }
  });
  if (count === 0) return Array(10).fill(0).map((_, i) => ({ digit: i, percentage: 0, expected: 10 }));
  return actual.map((val, i) => ({
    digit: i,
    percentage: (val / count) * 100,
    expected: 10
  }));
};

export const calculateDigitPreferenceScore = (data: number[]) => {
  const dist = calculateLastDigitDistribution(data);
  const totalDeviation = dist.reduce((acc, curr) => acc + Math.abs(curr.percentage - 10), 0);
  return Math.max(0, 100 - (totalDeviation * 2));
};

export const calculateCorrelation = (x: number[], y: number[]): number => {
  const xF = x.filter((_, i) => x[i] != null && y[i] != null);
  const yF = y.filter((_, i) => x[i] != null && y[i] != null);
  const n = xF.length;
  if (n < 2) return 0;
  const meanX = xF.reduce((a, b) => a + b, 0) / n;
  const meanY = yF.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xF[i] - meanX;
    const dy = yF[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX) * Math.sqrt(denY);
  return den === 0 ? 0 : num / den;
};

export const calculateBenfordAnalysis = (data: number[]) => {
  const expected = [0, 30.1, 17.6, 12.5, 9.7, 7.9, 6.7, 5.8, 5.1, 4.6];
  const actual = Array(10).fill(0);
  let count = 0;
  data.forEach(val => {
    const s = Math.abs(val!).toString().replace(/[0.]/g, '');
    if (s.length > 0) {
      const firstDigit = parseInt(s[0]);
      if (firstDigit >= 1 && firstDigit <= 9) {
        actual[firstDigit]++;
        count++;
      }
    }
  });
  if (count === 0) return [];
  return actual.map((val, i) => ({
    digit: i,
    actual: (val / count) * 100,
    expected: expected[i]
  })).slice(1);
};

export const calculateSpatialAnomalyScore = (sample: WaterSample, neighbors: WaterSample[], metric: MetricKey) => {
  if (neighbors.length === 0) return 0;
  const val = sample.metrics[metric] as number;
  if (val === null || val === undefined) return 0;
  
  const distances = neighbors.map(n => ({
    dist: calculateDistance(sample.location.lat, sample.location.lng, n.location.lat, n.location.lng),
    val: n.metrics[metric] as number
  })).filter(d => d.val !== null);

  distances.sort((a, b) => a.dist - b.dist);
  const nearest = distances.slice(0, 3);
  if (nearest.length === 0) return 0;

  const avgNeighbor = nearest.reduce((a, b) => a + b.val, 0) / nearest.length;
  const diff = Math.abs(val - avgNeighbor);
  // Anomaly if difference is > 2 standard deviations of the neighbors (mock check)
  return diff;
};

export const calculateQQDataFromSamples = (samples: WaterSample[], metric: MetricKey) => {
  const filtered = samples
    .filter(s => s.metrics[metric] !== null && s.metrics[metric] !== undefined)
    .sort((a, b) => (a.metrics[metric] as number) - (b.metrics[metric] as number));
  const n = filtered.length;
  return filtered.map((sample, i) => {
    const theoretical = getZPercentile((i + 0.5) / n);
    return { x: theoretical, y: sample.metrics[metric], samplerId: sample.samplerId };
  });
};