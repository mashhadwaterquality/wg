import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { WaterSample, MetricKey } from '../types';
import { calculateIDW, getMetricColor } from '../utils/interpolation';

interface InterpolationLayerProps {
  samples: WaterSample[];
  metric: MetricKey;
  opacity?: number;
}

const InterpolationLayer: React.FC<InterpolationLayerProps> = ({ samples, metric, opacity = 0.5 }) => {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    const CustomLayer = L.Layer.extend({
      onAdd: function (map: L.Map) {
        const pane = map.getPane('overlayPane');
        const container = L.DomUtil.create('canvas', 'leaflet-interpolation-layer');
        container.style.opacity = opacity.toString();
        container.style.position = 'absolute';
        container.style.pointerEvents = 'none';
        pane?.appendChild(container);
        this._canvas = container;
        this._map = map;

        map.on('moveend zoomend', this._update, this);
        this._update();
      },

      onRemove: function (map: L.Map) {
        L.DomUtil.remove(this._canvas);
        map.off('moveend zoomend', this._update, this);
      },

      _update: function () {
        const size = this._map.getSize();
        this._canvas.width = size.x;
        this._canvas.height = size.y;

        const bounds = this._map.getBounds();
        const topLeft = this._map.latLngToLayerPoint(bounds.getNorthWest());
        L.DomUtil.setPosition(this._canvas, topLeft);

        this._draw();
      },

      _draw: function () {
        const ctx = this._canvas.getContext('2d');
        const width = this._canvas.width;
        const height = this._canvas.height;
        
        // Dynamic resolution based on zoom
        const zoom = this._map.getZoom();
        const step = zoom > 14 ? 10 : zoom > 12 ? 15 : 20; 

        ctx.clearRect(0, 0, width, height);

        for (let x = 0; x < width; x += step) {
          for (let y = 0; y < height; y += step) {
            const point = L.point(x, y);
            const latLng = this._map.containerPointToLatLng(point);
            
            const value = calculateIDW(latLng.lat, latLng.lng, samples, metric);
            if (value !== null) {
              const color = getMetricColor(value, metric);
              ctx.fillStyle = `rgba(${color}, 0.65)`;
              ctx.fillRect(x, y, step, step);
            }
          }
        }
      }
    });

    const layer = new (CustomLayer as any)();
    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
      }
    };
  }, [map, samples, metric, opacity]);

  return null;
};

export default InterpolationLayer;