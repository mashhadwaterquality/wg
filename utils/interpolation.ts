
import { WaterSample, MetricKey, METRIC_RANGES } from '../types';

/**
 * Calculates the interpolated value at a given point using Inverse Distance Weighting.
 */
export const calculateIDW = (
  lat: number,
  lng: number,
  samples: WaterSample[],
  metric: MetricKey,
  power: number = 2
): number | null => {
  if (samples.length === 0) return null;

  let numerator = 0;
  let denominator = 0;

  for (const sample of samples) {
    const val = sample.metrics[metric];
    if (val === null || val === undefined) continue;

    const dLat = lat - sample.location.lat;
    const dLng = lng - sample.location.lng;
    const distanceSq = dLat * dLat + dLng * dLng;

    if (distanceSq < 0.0000000001) return val;

    const weight = 1 / Math.pow(Math.sqrt(distanceSq), power);
    numerator += weight * val;
    denominator += weight;
  }

  return denominator === 0 ? null : numerator / denominator;
};

/**
 * Helper to interpolate between two RGB colors
 */
const interpolateRGB = (color1: number[], color2: number[], factor: number): string => {
  const f = Math.min(1, Math.max(0, factor));
  const r = Math.round(color1[0] + (color2[0] - color1[0]) * f);
  const g = Math.round(color1[1] + (color2[1] - color1[1]) * f);
  const b = Math.round(color1[2] + (color2[2] - color1[2]) * f);
  return `${r}, ${g}, ${b}`;
};

const COLORS = {
  RED: [239, 68, 68],      // tailwind red-500
  ORANGE: [245, 158, 11],   // tailwind amber-500
  GREEN: [16, 185, 129]     // tailwind emerald-500
};

/**
 * Returns a continuous RGB color string based on the value and metric scale
 * logic: Green (Good) -> Orange (Middle/Warning) -> Red (Bad)
 */
export const getMetricColor = (val: number, metric: MetricKey): string => {
  const range = METRIC_RANGES[metric];
  
  if (metric === 'ec' || metric === 'turbidity') {
    // One-sided metrics: 0 is Good (Green), Max is Bad (Red)
    const ratio = Math.min(1, Math.max(0, val / range.max));
    
    // We want Green at 0, Orange at 0.5 (Warning threshold), Red at 1.0 (Danger)
    if (ratio < 0.5) {
      return interpolateRGB(COLORS.GREEN, COLORS.ORANGE, ratio * 2);
    } else {
      return interpolateRGB(COLORS.ORANGE, COLORS.RED, (ratio - 0.5) * 2);
    }
  } else {
    // Two-sided metrics (pH, Chlorine): Center is Good, extremes are Bad
    const mid = (range.min + range.max) / 2;
    const rangeHalf = (range.max - range.min) / 2;
    
    // Hard cutoff for values strictly outside range
    if (val < range.min || val > range.max) return `${COLORS.RED[0]}, ${COLORS.RED[1]}, ${COLORS.RED[2]}`;
    
    // Normalized distance from center (0 = center/Good, 1 = bounds/Bad)
    const distRatio = Math.abs(val - mid) / rangeHalf;
    
    if (distRatio < 0.5) {
      // 0 to 0.5: Green to Orange
      return interpolateRGB(COLORS.GREEN, COLORS.ORANGE, distRatio * 2);
    } else {
      // 0.5 to 1: Orange to Red
      return interpolateRGB(COLORS.ORANGE, COLORS.RED, (distRatio - 0.5) * 2);
    }
  }
};
