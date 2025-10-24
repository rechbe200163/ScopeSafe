import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function renderBusinessPlan() {
  return process.env.NEXT_PUBLIC_BUSINESS_PLAN_ID;
}
// lib/getBaseUrl.ts
export function getBaseUrl() {
  // server (für Emails/Magic Links etc. oder SSG)
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}
