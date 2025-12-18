export type SamplerID = 'Sampler 1' | 'Sampler 2' | 'Sampler 3';

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
  turbidity: number; // NTU
}

export interface WaterSample {
  id: string;
  samplerId: SamplerID;
  timestamp: number;
  location: GeoLocation;
  metrics: WaterMetrics;
  notes?: string;
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

export const SAMPLERS: SamplerID[] = ['Sampler 1', 'Sampler 2', 'Sampler 3'];
