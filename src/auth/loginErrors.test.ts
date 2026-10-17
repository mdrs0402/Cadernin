import { describe, expect, it } from 'vitest';
import { loginErrorMessage } from './loginErrors';

describe('loginErrorMessage', () => {
  it('fica quieto quando o próprio usuário fechou a janela', () => {
    expect(loginErrorMessage({ code: 'auth/popup-closed-by-user' })).toBeNull();
    expect(loginErrorMessage({ code: 'auth/cancelled-popup-request' })).toBeNull();
  });

  it('explica domínio não autorizado e mostra o código', () => {
    const m = loginErrorMessage({ code: 'auth/unauthorized-domain' })!;
    expect(m).toContain('Domínios autorizados');
    expect(m).toContain('(código: auth/unauthorized-domain)');
  });

  it('erro desconhecido ainda mostra o código', () => {
    expect(loginErrorMessage({ code: 'auth/algo-novo' })).toBe('Não foi possível entrar com o Google. (código: auth/algo-novo)');
    expect(loginErrorMessage(new Error('x'))).toContain('código: desconhecido');
  });
});
