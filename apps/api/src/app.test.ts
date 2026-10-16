import type { AddressInfo } from 'node:net';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from './app';
import { conflict, unprocessable } from './errors';
import { requireRole } from './middleware/auth';
import { errorHandler } from './middleware/error';

/* ---------- HTTP de ponta a ponta, sem Firebase (só caminhos que param antes do token) ---------- */

let base = '';
let close = () => {};

beforeAll(async () => {
  const server = createApp().listen(0);
  await new Promise<void>((ok) => server.once('listening', () => ok()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
});
afterAll(() => close());

describe('API', () => {
  it('GET /health', async () => {
    const r = await fetch(`${base}/health`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
  });

  it.each(['/me', '/store', '/store/dashboard', '/store/reminders', '/customer/accounts', '/customer/reminders'])(
    '%s sem token -> 401',
    async (path) => {
      const r = await fetch(base + path);
      expect(r.status).toBe(401);
      expect((await r.json()).error.code).toBe('unauthorized');
    },
  );

  it('Authorization que não é Bearer -> 401', async () => {
    const r = await fetch(`${base}/store`, { headers: { Authorization: 'Basic abc' } });
    expect(r.status).toBe(401);
  });

  it('rota inexistente -> 404 em JSON', async () => {
    const r = await fetch(`${base}/nao-existe`);
    expect(r.status).toBe(404);
    expect((await r.json()).error.code).toBe('not_found');
  });

  it('JSON quebrado -> 400 invalid_json', async () => {
    const r = await fetch(`${base}/health`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{oops' });
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe('invalid_json');
  });

  it('CORS só libera a origem do front', async () => {
    const ok = await fetch(`${base}/health`, { headers: { Origin: 'http://localhost:5173' } });
    expect(ok.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    const bad = await fetch(`${base}/health`, { headers: { Origin: 'https://site-malicioso.example' } });
    // a API responde sempre a origem fixa; o navegador bloqueia porque não bate com a do site
    expect(bad.headers.get('access-control-allow-origin')).not.toBe('https://site-malicioso.example');
  });
});

/* ---------- Middlewares isolados ---------- */

function fakeRes() {
  const res = { statusCode: 0, body: undefined as unknown };
  const r = {
    status: vi.fn((c: number) => ((res.statusCode = c), r)),
    json: vi.fn((b: unknown) => ((res.body = b), r)),
  };
  return { res, r: r as unknown as Response };
}

describe('errorHandler', () => {
  const run = (err: unknown) => {
    const { res, r } = fakeRes();
    errorHandler(err, {} as Request, r, () => {});
    return res;
  };

  it('erro de validação vira 400 com a primeira mensagem e os campos', () => {
    const parsed = z.object({ amountCents: z.number().min(1, 'Informe um valor maior que zero.') }).safeParse({ amountCents: 0 });
    const res = run(parsed.error);
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      error: { code: 'validation_error', message: 'Informe um valor maior que zero.', details: { amountCents: expect.any(Array) } },
    });
  });

  it('regras de negócio mantêm status e código', () => {
    expect(run(unprocessable('credit_limit_exceeded', 'Passa do limite.'))).toEqual({
      statusCode: 422,
      body: { error: { code: 'credit_limit_exceeded', message: 'Passa do limite.' } },
    });
    expect(run(conflict('Já estornado.')).statusCode).toBe(409);
  });

  it('erro inesperado vira 500 sem vazar detalhes', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = run(new Error('senha do banco: 123'));
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('senha');
    spy.mockRestore();
  });
});

describe('requireRole', () => {
  const call = (role: 'merchant' | 'customer' | null) => {
    const req = { user: { uid: 'u1', email: null, name: null, picture: null, role } } as Request;
    let passed = false;
    try {
      requireRole('merchant')(req, {} as Response, () => (passed = true));
      return passed ? 'ok' : 'stopped';
    } catch (e) {
      return (e as { status: number }).status;
    }
  };

  it('deixa passar o papel certo', () => expect(call('merchant')).toBe('ok'));
  it('barra outro papel com 403', () => expect(call('customer')).toBe(403));
  it('barra quem ainda não escolheu perfil', () => expect(call(null)).toBe(403));
});
