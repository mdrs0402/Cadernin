import { formatPhone } from '@cadernin/shared';

/**
 * Porta de saída das notificações. O resto do app só conhece esta interface.
 *
 * Sem servidor, o MVP só tem o envio SIMULADO: o lembrete é registrado no Firestore e o cliente
 * vinculado o vê no app. Um envio de verdade (ex.: WhatsApp Business API) precisa de uma chave
 * secreta, e chave secreta não pode ficar no navegador — isso exigiria uma função no servidor.
 */
export type OutgoingMessage = {
  channel: 'whatsapp';
  /** Telefone de destino, só dígitos com DDD (sem +55). */
  to: string;
  text: string;
  meta: { storeId: string; customerId: string; reminderId: string };
};

export type DeliveryResult = { status: 'simulated' | 'sent'; providerMessageId: string } | { status: 'failed'; error: string };

export interface NotificationService {
  /** Nome gravado em cada lembrete. */
  readonly provider: string;
  send(message: OutgoingMessage): Promise<DeliveryResult>;
}

/** "Envia" sem sair do navegador: escreve no console e devolve um id fictício. */
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
    return { status: 'simulated', providerMessageId: `sim_${crypto.randomUUID()}` };
  }
}

export const notificationService: NotificationService = new SimulatedNotificationService();
