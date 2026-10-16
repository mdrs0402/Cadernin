import type { NotificationService } from './NotificationService';
import { SimulatedNotificationService } from './SimulatedNotificationService';

export type { DeliveryResult, NotificationService, OutgoingMessage } from './NotificationService';
export { SimulatedNotificationService } from './SimulatedNotificationService';

// MVP: só existe o simulado. Um provedor real entraria aqui (escolhido por variável de ambiente).
let current: NotificationService = new SimulatedNotificationService();

export const notificationService = () => current;

/** Troca a implementação (testes). */
export function setNotificationService(service: NotificationService) {
  current = service;
}
