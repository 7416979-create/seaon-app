import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapPoint {
  lat: number;
  lng: number;
  label: string;
  color: string;
}

interface Props {
  points?: MapPoint[];
  circle?: { lat: number; lng: number; radius: number } | null;
  center?: { lat: number; lng: number };
  height?: number;
  onPick?: (lat: number, lng: number) => void;
}

const SEOUL = { lat: 37.5665, lng: 126.978 };

// OpenStreetMap tiles: free, no API key. Attribution is required by their usage policy.
export function MapView({ points = [], circle, center, height = 320, onPick }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: true, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => pickRef.current?.(e.latlng.lat, e.latlng.lng));
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    // Leaflet measures its box on creation; modals and tabs may still be laying out.
    const t = window.setTimeout(() => m.invalidateSize(), 150);
    return () => {
      window.clearTimeout(t);
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const bounds: L.LatLngExpression[] = [];
    if (circle) {
      L.circle([circle.lat, circle.lng], { radius: circle.radius, color: '#1f5eff', weight: 2, fillOpacity: 0.08 }).addTo(g);
      L.circleMarker([circle.lat, circle.lng], { radius: 6, color: '#1f5eff', fillColor: '#1f5eff', fillOpacity: 1 })
        .bindTooltip('회사 위치')
        .addTo(g);
      bounds.push([circle.lat, circle.lng]);
    }
    for (const p of points) {
      L.circleMarker([p.lat, p.lng], { radius: 8, color: '#fff', weight: 2, fillColor: p.color, fillOpacity: 1 })
        .bindTooltip(p.label)
        .addTo(g);
      bounds.push([p.lat, p.lng]);
    }
    if (center) m.setView([center.lat, center.lng], 17);
    else if (bounds.length > 1) m.fitBounds(L.latLngBounds(bounds), { padding: [30, 30], maxZoom: 18 });
    else if (bounds.length === 1) m.setView(bounds[0], 17);
    else m.setView([SEOUL.lat, SEOUL.lng], 12);
  }, [points, circle, center]);

  return <div ref={el} className="map-box" style={{ height }} />;
}
