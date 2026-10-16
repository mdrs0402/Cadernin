import { randomUUID } from 'node:crypto';
import { formatPhone } from '@cadernin/shared';
import type { DeliveryResult, NotificationService, OutgoingMessage } from './NotificationService';

/**
 * "Envia" sem sair do servidor: escreve a mensagem no log e devolve um id fictício.
 * O lembrete fica registrado no Firestore normalmente, e o cliente vinculado o vê no app.
 */
export class SimulatedNotificationService implements NotificationService {
  readonly provider = 'simulado';
  /** Últimas mensagens "enviadas" (útil em testes e para depurar). */
  readonly outbox: OutgoingMessage[] = [];

  constructor(
    private readonly log: (line: string) => void = (line) => console.info(line),
    private readonly maxOutbox = 100,
  ) {}

  async send(message: OutgoingMessage): Promise<DeliveryResult> {
    this.outbox.push(message);
    if (this.outbox.length > this.maxOutbox) this.outbox.shift();
    this.log(`[lembrete simulado] ${message.channel} para ${formatPhone(message.to)}: ${message.text}`);
    return { status: 'simulated', providerMessageId: `sim_${randomUUID()}` };
  }
}
