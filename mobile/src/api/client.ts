const API_URL = process.env.EXPO_PUBLIC_API_URL;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

function requireApiUrl(): string {
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
