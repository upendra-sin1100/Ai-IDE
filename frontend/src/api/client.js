import { getSupabaseAuthHeaders } from '../lib/supabase';

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
const deployedFallback = typeof window !== "undefined"
  ? `${window.location.origin}/api`
  : "/api";
const BASE_URL = (configuredBaseUrl || deployedFallback).replace(/\/$/, "");

export async function getAuthHeaders(extraHeaders = {}) {
  const authHeaders = await getSupabaseAuthHeaders();
  return {
    "Content-Type": "application/json",
    ...authHeaders,
    ...extraHeaders,
  };
}

export async function requestJson(endpoint, options = {}) {
  const url = endpoint.startsWith("http") ? endpoint : getApiUrl(endpoint);
  const headers = await getAuthHeaders(options.headers || {});

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}: ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.detail) {
        errorMsg = typeof errorData.detail === "string" ? errorData.detail : JSON.stringify(errorData.detail);
      }
    } catch {
      // Keep default statusText if JSON body fails
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export function getBaseUrl() {
  return BASE_URL;
}

export function getApiUrl(endpoint) {
  return `${BASE_URL}/${endpoint.replace(/^\/+/, "")}`;
}
