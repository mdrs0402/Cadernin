export const ROLES = ['merchant', 'customer'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  merchant: 'Lojista',
  customer: 'Cliente',
};
