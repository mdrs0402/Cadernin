import { FirestoreError } from 'firebase/firestore';
import { z, ZodError } from 'zod';

/**
 * Erro "de negócio" com o mesmo formato que a antiga API usava (status + código + mensagem),
 * para as telas continuarem tratando erros do mesmo jeito.
 */
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

export const notFound = (msg = 'Não encontrado.') => new ApiError(404, 'not_found', msg);
export const conflict = (msg: string) => new ApiError(409, 'conflict', msg);
export const unprocessable = (code: string, msg: string) => new ApiError(422, code, msg);

/** Converte erros do Firestore (rede, permissão…) em ApiError com mensagem em português. */
export function toApiError(err: unknown): unknown {
  if (err instanceof ApiError) return err;
  if (err instanceof ZodError) {
    return new ApiError(400, 'validation_error', err.issues[0]?.message ?? 'Dados inválidos.', z.flattenError(err).fieldErrors);
  }
  if (err instanceof FirestoreError) {
    switch (err.code) {
      case 'permission-denied':
        return new ApiError(403, 'forbidden', 'Você não tem permissão para fazer isso (ou os dados mudaram). Atualize a página e tente de novo.');
      case 'unauthenticated':
        return new ApiError(401, 'unauthorized', 'Sua sessão expirou. Entre de novo.');
      case 'not-found':
        return new ApiError(404, 'not_found', 'Não encontrado.');
      case 'already-exists':
        return new ApiError(409, 'conflict', 'Isso já existe.');
      case 'failed-precondition':
        // Quase sempre: índice composto ainda não criado (npm run deploy:rules).
        console.error(err);
        return new ApiError(500, 'failed_precondition', 'O banco ainda está sendo preparado. Tente de novo em alguns minutos.');
      case 'unavailable':
      case 'deadline-exceeded':
        return new ApiError(0, 'network', 'Não foi possível falar com o servidor. Verifique sua conexão.');
      default:
        console.error(err);
        return new ApiError(500, 'internal', 'Erro inesperado. Tente novamente.');
    }
  }
  return err;
}

/** Roda uma operação de dados e padroniza o erro. */
export async function run<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw toApiError(err);
  }
}
