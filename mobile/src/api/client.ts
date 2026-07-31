const API_URL = process.env.EXPO_PUBLIC_API_URL;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export function requireApiUrl(): string {
  if (!API_URL) {
    throw new Error(
      'EXPO_PUBLIC_API_URL is not set. Copy .env.example to .env in /mobile and point it at your server (see README.md).'
    );
  }
  return API_URL;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = requireApiUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new ApiError(response.status, body?.error ?? 'Request failed');
  }

  return body as T;
}

export interface Character {
  id: string;
  name: string;
  level: number;
  xp: number;
  strength: number;
  agility: number;
  focus: number;
  intelligence: number;
  wisdom: number;
  luck: number;
  bankedAp: number;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
  character: Character;
}

export function signup(email: string, password: string, characterName: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, characterName }),
  });
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function fetchMe(token: string): Promise<{ user: AuthUser; character: Character }> {
  return request('/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface Enemy {
  id: string;
  name: string;
  maxVitality: number;
}

export type EncounterStatus = 'PENDING' | 'ACTIVE' | 'DEFEATED' | 'DESPAWNED';

export interface Encounter {
  id: string;
  status: EncounterStatus;
  currentVitality: number;
  enemy: Enemy;
  spawnedAt: string;
  expiresAt: string;
  engagedAt: string | null;
  resolvedAt: string | null;
}

export interface CombatResult {
  defeated: boolean;
  xpAwarded: number;
  levelsGained: number;
}

export interface ActivitySyncRequest {
  stepCount: number;
  clientStartedAt: string;
  clientEndedAt: string;
  location?: { latitude: number; longitude: number };
}

export interface ActivitySyncResponse {
  bankedAp: number;
  accepted: boolean;
  flagged: boolean;
  encounter: Encounter | null;
  combat: CombatResult | null;
}

export function syncActivity(token: string, payload: ActivitySyncRequest): Promise<ActivitySyncResponse> {
  return request<ActivitySyncResponse>('/activity/sync', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export function fetchCurrentEncounter(token: string): Promise<{ encounter: Encounter | null }> {
  return request('/encounters/current', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function engageEncounter(token: string, encounterId: string): Promise<{ encounter: Encounter }> {
  return request(`/encounters/${encounterId}/engage`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function dismissEncounter(token: string, encounterId: string): Promise<{ ok: boolean }> {
  return request(`/encounters/${encounterId}/dismiss`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface SpendApResponse {
  encounter: Encounter;
  defeated: boolean;
  xpAwarded: number;
  levelsGained: number;
  bankedAp: number;
}

export function spendApOnEncounter(token: string, encounterId: string, amount: number): Promise<SpendApResponse> {
  return request(`/encounters/${encounterId}/spend-ap`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ amount }),
  });
}
