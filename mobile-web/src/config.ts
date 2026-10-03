// Runtime configuration comes only from build-time env vars (see .env.example).
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  vapidPublicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '',
  /** True when no backend is configured: auth and attendance use local mock data. */
  get mockMode() {
    return this.apiBaseUrl === ''
  },
}
