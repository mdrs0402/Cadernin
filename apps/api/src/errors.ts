export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const unauthorized = (msg = 'Não autenticado.') => new HttpError(401, 'unauthorized', msg);
export const forbidden = (msg = 'Sem permissão.') => new HttpError(403, 'forbidden', msg);
export const notFound = (msg = 'Não encontrado.') => new HttpError(404, 'not_found', msg);
export const conflict = (msg: string) => new HttpError(409, 'conflict', msg);
export const unprocessable = (code: string, msg: string) => new HttpError(422, code, msg);
