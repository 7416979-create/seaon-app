// Loads the Leaflet map on first use, so screens without a map do not download leaflet (6차 M6).
import { lazy, Suspense, type ComponentProps } from 'react';

const Map = lazy(() => import('./MapView').then((m) => ({ default: m.MapView })));

export type { MapPoint } from './MapView';

export function MapView(props: ComponentProps<typeof Map>) {
  return (
    <Suspense fallback={<div className="map-box muted" style={{ height: props.height ?? 320, display: 'grid', placeItems: 'center' }}>지도를 불러오는 중…</div>}>
      <Map {...props} />
    </Suspense>
  );
}
