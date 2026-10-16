/**
 * Porta de saída das notificações. O resto da API só conhece esta interface:
 * trocar o simulado por um provedor real (ex.: WhatsApp Business API) é implementar `send`
 * e escolher a implementação em `index.ts` — rotas e regras de lembrete não mudam.
 */
export type OutgoingMessage = {
  channel: 'whatsapp';
  /** Telefone de destino, só dígitos com DDD (sem +55). */
  to: string;
  text: string;
  /** Contexto para log/rastreio. */
  meta: { storeId: string; customerId: string; reminderId: string };
};

export type DeliveryResult =
  | { status: 'simulated' | 'sent'; providerMessageId: string }
  | { status: 'failed'; error: string };

export interface NotificationService {
  /** Nome gravado em cada lembrete ('simulado', 'whatsapp-cloud'…). */
  readonly provider: string;
  send(message: OutgoingMessage): Promise<DeliveryResult>;
}
