export type SamplerID = 'محمدرضا ابتکاری' | 'ابوالفضل شرقی' | 'سعید محرری';

export interface GeoLocation {
  lat: number;
  lng: number;
  accuracy: number; // in meters
  address?: string;
  timestamp: number;
}

export interface WaterMetrics {
  chlorine: number; // mg/L
  ec: number; // µS/cm
  ph: number; // 0-14
  turbidity?: number | null; // NTU (Optional)
}

export interface WaterSample {
  id: string;
  samplerId: SamplerID;
  timestamp: number;
  location: GeoLocation;
  metrics: WaterMetrics;
  notes?: string;
}

export interface IntegrityFlag {
  type: 'speed' | 'frequency' | 'identical' | 'static';
  severity: 'low' | 'medium' | 'high';
  message: string;
}

export interface SamplerPerformance {
  samplerId: SamplerID;
  totalSamples: number;
  avgTimeInterval: number; // minutes
  avgDistance: number; // meters
  integrityScore: number; // 0-100
  flagsCount: number;
}

export interface StatResult {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  confidenceInterval: [number, number]; // 95%
  skewness: number;
  kurtosis: number;
  jarqueBera: number;
  isNormal: boolean;
}

export type MetricKey = keyof WaterMetrics;

export const METRIC_LABELS: Record<MetricKey, string> = {
  chlorine: 'کلر آزاد (mg/L)',
  ec: 'هدایت الکتریکی (µS/cm)',
  ph: 'pH',
  turbidity: 'کدورت (NTU)',
};

export interface MetricRange {
  min: number;
  max: number;
  low_warn: number;
  high_warn: number;
  unit: string;
}

export const METRIC_RANGES: Record<MetricKey, MetricRange> = {
  ph: { min: 6.5, max: 8.5, low_warn: 7.0, high_warn: 8.0, unit: '' },
  chlorine: { min: 0.2, max: 1.2, low_warn: 0.5, high_warn: 1.0, unit: 'mg/L' },
  ec: { min: 0, max: 2000, low_warn: 0, high_warn: 1000, unit: 'µS/cm' },
  turbidity: { min: 0, max: 5, low_warn: 0, high_warn: 1, unit: 'NTU' },
};

export const SAMPLERS: SamplerID[] = ['محمدرضا ابتکاری', 'ابوالفضل شرقی', 'سعید محرری'];