import { describe, expect, it } from 'vitest';
import { SimulatedNotificationService, type OutgoingMessage } from './notifications';

const msg = (text: string): OutgoingMessage => ({
  channel: 'whatsapp',
  to: '11987654321',
  text,
  meta: { storeId: 's1', customerId: 'c1', reminderId: 'r1' },
});

describe('SimulatedNotificationService', () => {
  it('não envia nada: registra no log e devolve um id simulado', async () => {
    const lines: string[] = [];
    const svc = new SimulatedNotificationService((l) => lines.push(l));
    const r = await svc.send(msg('Olá, Ana!'));

    expect(svc.provider).toBe('simulado');
    expect(r.status).toBe('simulated');
    expect(r.status !== 'failed' && r.providerMessageId).toMatch(/^sim_/);
    expect(lines).toEqual(['[lembrete simulado] whatsapp para (11) 98765-4321: Olá, Ana!']);
    expect(svc.outbox).toHaveLength(1);
  });

  it('cada envio tem um id diferente', async () => {
    const svc = new SimulatedNotificationService(() => {});
    const [a, b] = await Promise.all([svc.send(msg('1')), svc.send(msg('2'))]);
    expect(a).not.toEqual(b);
  });

  it('a caixa de saída em memória não cresce sem limite', async () => {
    const svc = new SimulatedNotificationService(() => {}, 3);
    for (const t of ['a', 'b', 'c', 'd', 'e']) await svc.send(msg(t));
    expect(svc.outbox.map((m) => m.text)).toEqual(['c', 'd', 'e']);
  });
});
