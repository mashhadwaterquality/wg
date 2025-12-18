
import { createClient } from '@supabase/supabase-js';
import { WaterSample, SamplerID } from '../types';

const SUPABASE_URL = 'https://akfwdhsurglinczfzwqx.supabase.co' as string;
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrZndkaHN1cmdsaW5jemZ6d3F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMjM2NDUsImV4cCI6MjA4MTU5OTY0NX0.k3Dj3YDVYGhcR9e24A7U3C532UQpK50ZBpRIfYlEsOw' as string;

export const isDbConfigured = SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== '';

const supabase = isDbConfigured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export const dbService = {
  async fetchSamples(): Promise<WaterSample[]> {
    if (!supabase) {
      const local = localStorage.getItem('aquaguard_data');
      return local ? JSON.parse(local) : [];
    }

    const { data, error } = await supabase
      .from('water_samples')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching samples:', error);
      throw error;
    }

    return data.map(item => {
      const sampleTimestamp = new Date(item.timestamp).getTime();
      return {
        id: item.id,
        samplerId: item.sampler_id as SamplerID,
        timestamp: sampleTimestamp,
        location: {
          lat: item.lat,
          lng: item.lng,
          accuracy: item.accuracy,
          address: item.address,
          timestamp: sampleTimestamp
        },
        metrics: {
          chlorine: item.chlorine,
          ec: item.ec,
          ph: item.ph,
          turbidity: item.turbidity
        },
        notes: item.notes
      };
    });
  },

  async saveSample(sample: WaterSample): Promise<void> {
    if (!supabase) {
      const local = localStorage.getItem('aquaguard_data');
      const samples = local ? JSON.parse(local) : [];
      samples.push(sample);
      localStorage.setItem('aquaguard_data', JSON.stringify(samples));
      return;
    }

    const { error } = await supabase.from('water_samples').insert({
      id: sample.id,
      sampler_id: sample.samplerId,
      timestamp: new Date(sample.timestamp).toISOString(),
      lat: sample.location.lat,
      lng: sample.location.lng,
      accuracy: sample.location.accuracy,
      address: sample.location.address,
      chlorine: sample.metrics.chlorine,
      ec: sample.metrics.ec,
      ph: sample.metrics.ph,
      turbidity: sample.metrics.turbidity,
      notes: sample.notes
    });

    if (error) {
      console.error('Error saving sample:', error);
      throw error;
    }
  }
};
