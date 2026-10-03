// Browser Geolocation helpers. Workplace-radius enforcement for check-in is wired up in the GPS step.
export interface Coordinates {
  latitude: number
  longitude: number
  accuracy: number
}

export interface Workplace {
  name: string
  latitude: number
  longitude: number
  radiusMeters: number
}

export type LocationPermission = PermissionState | 'unsupported'

export async function locationPermission(): Promise<LocationPermission> {
  if (!('geolocation' in navigator)) return 'unsupported'
  try {
    // Safari < 16 has no Permissions API for geolocation; treat as "prompt".
    const status = await navigator.permissions.query({ name: 'geolocation' })
    return status.state
  } catch {
    return 'prompt'
  }
}

export function getCurrentPosition(timeoutMs = 15000): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('이 브라우저는 위치 정보를 지원하지 않습니다.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }),
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? '위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해 주세요.'
            : err.code === err.TIMEOUT
              ? '위치 확인 시간이 초과되었습니다. 다시 시도해 주세요.'
              : '현재 위치를 확인할 수 없습니다.'
        reject(new Error(msg))
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    )
  })
}

/** Great-circle distance in meters (haversine). */
export function distanceMeters(a: Pick<Coordinates, 'latitude' | 'longitude'>, b: Pick<Coordinates, 'latitude' | 'longitude'>): number {
  const R = 6371000
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.latitude - a.latitude)
  const dLon = rad(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function isWithinWorkplace(pos: Coordinates, place: Workplace): boolean {
  return distanceMeters(pos, place) <= place.radiusMeters
}
