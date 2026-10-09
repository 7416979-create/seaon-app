import type { AdminApi, Api } from './types';
import { adminApi as demoAdminApi, demoApi } from './demoApi';
import { supabaseAdminApi, supabaseApi } from './supabaseApi';

// With Supabase settings in .env the app uses the server; without them it runs the
// browser-only demo with sample data.
export const IS_DEMO = !(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

export const api: Api = IS_DEMO ? demoApi : supabaseApi;
export const adminApi: AdminApi = IS_DEMO ? demoAdminApi : supabaseAdminApi;

export { DEMO_ADMIN_TOKEN, DEMO_EMPLOYEE_TOKEN } from './demoApi';
