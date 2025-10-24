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
  const baseURL = process.env.NEXT_PUBLIC_APP_URL || 'https://scopesafe.app';
  if (baseURL) {
    console.log('Base URL from env:', baseURL);
    return baseURL;
  }
  console.log('Base URL from env not found, using default');
  return 'http://localhost:3000';
}
