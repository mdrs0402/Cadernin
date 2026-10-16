import { auth } from '../lib/firebase';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

/** fetch para a API com o ID token atual no header Authorization. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body) headers.set('Content-Type', 'application/json');

  let res: Response;
  try {
    res = await fetch(`${import.meta.env.VITE_API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'network', 'Não foi possível falar com o servidor. Verifique sua conexão.');
  }

  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = body?.error;
    throw new ApiError(res.status, err?.code ?? 'unknown', err?.message ?? 'Erro inesperado.', err?.details);
  }
  return body as T;
}
