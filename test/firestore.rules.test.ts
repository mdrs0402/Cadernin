import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Sem servidor, estas regras são a única barreira. Os testes tentam fazer o que um usuário
// mal-intencionado faria direto pelo SDK (sem passar pelas telas do app).

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-rules',
    firestore: { rules: readFileSync(resolve(import.meta.dirname, '../firestore.rules'), 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});

afterAll(async () => {
  await env?.clearFirestore();
  await env?.cleanup();
});

const now = Timestamp.fromDate(new Date('2026-10-10T15:00:00Z'));

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    await setDoc(doc(db, 'users/lojista1'), { role: 'merchant', name: 'Lojista 1' });
    await setDoc(doc(db, 'users/lojista2'), { role: 'merchant', name: 'Lojista 2' });
    await setDoc(doc(db, 'users/ana'), { role: 'customer', name: 'Ana' });
    await setDoc(doc(db, 'users/bia'), { role: 'customer', name: 'Bia' });
    await setDoc(doc(db, 'users/caio'), { role: 'customer', name: 'Caio' });
    await setDoc(doc(db, 'users/dani'), { role: 'customer', name: 'Dani' });
    await setDoc(doc(db, 'stores/s1'), { name: 'Padaria', ownerUid: 'lojista1' });
    await setDoc(doc(db, 'stores/s2'), { name: 'Mercado', ownerUid: 'lojista2' });
    // Ana: vinculada, deve R$ 10,00 de limite R$ 50,00
    await setDoc(doc(db, 'stores/s1/customers/c1'), {
      name: 'Ana', phone: '11987654321', userUid: 'ana', balanceDue: 1000, creditLimit: 5000,
      inviteCode: null, lastReminderAt: null, lastTxId: 't1', createdAt: now, createdBy: 'lojista1',
    });
    // Caio: ainda não vinculado, com convite K7MQ2P
    await setDoc(doc(db, 'stores/s1/customers/c2'), {
      name: 'Caio', phone: '11912345678', userUid: null, balanceDue: 0, creditLimit: 5000,
      inviteCode: 'K7MQ2P', lastReminderAt: null, lastTxId: null, createdAt: now, createdBy: 'lojista1',
    });
    await setDoc(doc(db, 'invites/K7MQ2P'), { storeId: 's1', customerId: 'c2', createdAt: now });
    await setDoc(doc(db, 'users/ana/links/s1'), { storeId: 's1', customerId: 'c1', linkedAt: now });
    await setDoc(doc(db, 'stores/s1/transactions/t1'), {
      customerId: 'c1', type: 'purchase', amountCents: 1000, description: 'Pão', dueDate: null, createdAt: now,
      createdBy: 'lojista1', reversesId: null, reversesType: null, reversedById: null,
    });
    await setDoc(doc(db, 'stores/s1/transactions/t2'), {
      customerId: 'c2', type: 'purchase', amountCents: 500, description: 'Leite', dueDate: null, createdAt: now,
      createdBy: 'lojista1', reversesId: null, reversesType: null, reversedById: null,
    });
    await setDoc(doc(db, 'stores/s1/reminders/r1'), { customerId: 'c1', message: 'Olá, Ana!', createdAt: now });
    await setDoc(doc(db, 'stores/s1/reminders/r2'), { customerId: 'c2', message: 'Olá, Caio!', createdAt: now });
    // vínculo forjado: a Bia tem um link apontando para o cadastro da Ana
    await setDoc(doc(db, 'users/bia/links/s1'), { storeId: 's1', customerId: 'c1', linkedAt: now });
  });
});

const as = (uid: string, email?: string) =>
  env.authenticatedContext(uid, email ? { email } : undefined).firestore() as unknown as Firestore;
const anon = () => env.unauthenticatedContext().firestore() as unknown as Firestore;

const tx = (over: Record<string, unknown> = {}) => ({
  customerId: 'c1', type: 'purchase', amountCents: 500, description: 'Café', dueDate: null,
  createdAt: serverTimestamp(), createdBy: 'lojista1', reversesId: null, reversesType: null, reversedById: null,
  ...over,
});

/** Lançamento + saldo no mesmo batch, como o app faz. */
function launch(db: Firestore, id: string, data: Record<string, unknown>, newBalance: number, customerId = 'c1') {
  const b = writeBatch(db);
  b.set(doc(db, `stores/s1/transactions/${id}`), data);
  b.update(doc(db, `stores/s1/customers/${customerId}`), { balanceDue: newBalance, lastTxId: id });
  return b.commit();
}

async function balanceOf(customerId: string) {
  let v = -1;
  await env.withSecurityRulesDisabled(async (ctx) => {
    v = (await getDoc(doc(ctx.firestore() as unknown as Firestore, `stores/s1/customers/${customerId}`))).data()!.balanceDue;
  });
  return v;
}

/* ---------------------------------------------------------------- */

describe('sem login', () => {
  it('não lê nem escreve nada', async () => {
    await assertFails(getDoc(doc(anon(), 'stores/s1')));
    await assertFails(getDoc(doc(anon(), 'stores/s1/transactions/t1')));
    await assertFails(getDoc(doc(anon(), 'users/ana')));
    await assertFails(getDoc(doc(anon(), 'invites/K7MQ2P')));
    await assertFails(setDoc(doc(anon(), 'users/x'), { role: 'merchant' }));
  });
});

describe('primeiro acesso (perfil)', () => {
  it('lojista cria perfil + loja (id = uid) no mesmo batch', async () => {
    const db = as('novo', 'novo@x.com');
    const b = writeBatch(db);
    b.set(doc(db, 'users/novo'), { name: 'Novo', email: 'novo@x.com', photoURL: null, role: 'merchant', createdAt: serverTimestamp() });
    b.set(doc(db, 'stores/novo'), { ownerUid: 'novo', name: 'Bazar', createdAt: serverTimestamp() });
    await assertSucceeds(b.commit());
  });

  it('cliente cria só o perfil', async () => {
    const db = as('cli', 'cli@x.com');
    await assertSucceeds(setDoc(doc(db, 'users/cli'), { name: 'Cli', email: 'cli@x.com', photoURL: null, role: 'customer', createdAt: serverTimestamp() }));
  });

  it('não cria perfil de outro, papel inventado, nem e-mail falso', async () => {
    const db = as('novo', 'novo@x.com');
    const base = { name: 'Novo', email: 'novo@x.com', photoURL: null, role: 'merchant', createdAt: serverTimestamp() };
    await assertFails(setDoc(doc(db, 'users/outro'), base));
    await assertFails(setDoc(doc(db, 'users/novo'), { ...base, role: 'admin' }));
    await assertFails(setDoc(doc(db, 'users/novo'), { ...base, email: 'chefe@x.com' }));
    await assertFails(setDoc(doc(db, 'users/novo'), { ...base, extra: true }));
  });

  it('o papel é definitivo', async () => {
    await assertFails(updateDoc(doc(as('ana'), 'users/ana'), { role: 'merchant' }));
    await assertFails(deleteDoc(doc(as('ana'), 'users/ana')));
  });

  it('cliente não cria loja; loja só com id = próprio uid', async () => {
    await assertFails(setDoc(doc(as('ana'), 'stores/ana'), { ownerUid: 'ana', name: 'Loja da Ana', createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(as('lojista1'), 'stores/outra'), { ownerUid: 'lojista1', name: 'Filial', createdAt: serverTimestamp() }));
  });
});

describe('lojista: leitura', () => {
  it('lê a própria loja, clientes, lançamentos e lembretes', async () => {
    const db = as('lojista1');
    await assertSucceeds(getDoc(doc(db, 'stores/s1')));
    await assertSucceeds(getDocs(collection(db, 'stores/s1/customers')));
    await assertSucceeds(getDocs(query(collection(db, 'stores/s1/customers'), where('balanceDue', '>', 0))));
    await assertSucceeds(getDocs(collection(db, 'stores/s1/transactions')));
    await assertSucceeds(getDocs(collection(db, 'stores/s1/reminders')));
    await assertSucceeds(getDocs(query(collection(db, 'stores'), where('ownerUid', '==', 'lojista1'))));
  });

  it('não lê a loja de outro lojista', async () => {
    const db = as('lojista1');
    await assertFails(getDoc(doc(db, 'stores/s2')));
    await assertFails(getDocs(collection(db, 'stores/s2/customers')));
    await assertFails(getDocs(collection(db, 'stores/s2/transactions')));
    await assertFails(getDocs(collection(db, 'stores')));
  });
});

describe('lojista: loja e clientes', () => {
  it('renomeia a loja, mas não troca o dono', async () => {
    const db = as('lojista1');
    await assertSucceeds(updateDoc(doc(db, 'stores/s1'), { name: 'Padaria Nova' }));
    await assertFails(updateDoc(doc(db, 'stores/s1'), { ownerUid: 'lojista2' }));
    await assertFails(updateDoc(doc(as('lojista2'), 'stores/s1'), { name: 'Roubada' }));
  });

  it('cria cliente junto com o convite', async () => {
    const db = as('lojista1');
    const b = writeBatch(db);
    b.set(doc(db, 'stores/s1/customers/c9'), {
      name: 'Duda', phone: '21987654321', creditLimit: 3000, balanceDue: 0, userUid: null, inviteCode: 'ABC234',
      lastReminderAt: null, lastTxId: null, createdAt: serverTimestamp(), createdBy: 'lojista1',
    });
    b.set(doc(db, 'invites/ABC234'), { storeId: 's1', customerId: 'c9', createdAt: serverTimestamp() });
    await assertSucceeds(b.commit());
  });

  it('não cria cliente já com saldo, já vinculado, ou em outra loja', async () => {
    const db = as('lojista1');
    const make = (over: Record<string, unknown>, storeId = 's1') => {
      const b = writeBatch(db);
      b.set(doc(db, `stores/${storeId}/customers/c9`), {
        name: 'Duda', phone: '21987654321', creditLimit: 3000, balanceDue: 0, userUid: null, inviteCode: 'ABC234',
        lastReminderAt: null, lastTxId: null, createdAt: serverTimestamp(), createdBy: 'lojista1', ...over,
      });
      b.set(doc(db, 'invites/ABC234'), { storeId, customerId: 'c9', createdAt: serverTimestamp() });
      return b.commit();
    };
    await assertFails(make({ balanceDue: 100 }));
    await assertFails(make({ userUid: 'ana' }));
    await assertFails(make({ phone: '123' }));
    await assertFails(make({}, 's2'));
  });

  it('edita nome/telefone/limite, mas nunca o saldo direto', async () => {
    const db = as('lojista1');
    await assertSucceeds(updateDoc(doc(db, 'stores/s1/customers/c1'), { creditLimit: 8000, name: 'Ana Souza' }));
    await assertFails(updateDoc(doc(db, 'stores/s1/customers/c1'), { balanceDue: 0 }));
    await assertFails(updateDoc(doc(db, 'stores/s1/customers/c1'), { creditLimit: -1 }));
    await assertFails(updateDoc(doc(db, 'stores/s1/customers/c1'), { userUid: 'bia' }));
    await assertFails(updateDoc(doc(as('lojista2'), 'stores/s1/customers/c1'), { creditLimit: 999999 }));
  });

  it('gera código novo apagando o antigo', async () => {
    const db = as('lojista1');
    const b = writeBatch(db);
    b.delete(doc(db, 'invites/K7MQ2P'));
    b.set(doc(db, 'invites/NEW234'), { storeId: 's1', customerId: 'c2', createdAt: serverTimestamp() });
    b.update(doc(db, 'stores/s1/customers/c2'), { inviteCode: 'NEW234' });
    await assertSucceeds(b.commit());
  });

  it('exclui só cliente sem lançamentos', async () => {
    const db = as('lojista1');
    await assertFails(deleteDoc(doc(db, 'stores/s1/customers/c1'))); // tem lançamento e saldo
    const b = writeBatch(db);
    b.delete(doc(db, 'invites/K7MQ2P'));
    b.delete(doc(db, 'stores/s1/customers/c2'));
    await assertSucceeds(b.commit());
  });
});

describe('lançamentos: a conta tem que fechar', () => {
  it('compra dentro do limite', async () => {
    await assertSucceeds(launch(as('lojista1'), 'n1', tx({ amountCents: 4000 }), 5000));
    expect(await balanceOf('c1')).toBe(5000);
  });

  it('compra acima do limite é recusada', async () => {
    await assertFails(launch(as('lojista1'), 'n1', tx({ amountCents: 4001 }), 5001));
  });

  it('não dá para lançar sem mexer no saldo, nem mexer no saldo sem lançar', async () => {
    const db = as('lojista1');
    await assertFails(setDoc(doc(db, 'stores/s1/transactions/n1'), tx()));
    await assertFails(updateDoc(doc(db, 'stores/s1/customers/c1'), { balanceDue: 0, lastTxId: 'qualquer' }));
  });

  it('saldo tem que bater com o valor lançado', async () => {
    const db = as('lojista1');
    await assertFails(launch(db, 'n1', tx({ amountCents: 500 }), 1000)); // devia ser 1500
    await assertFails(launch(db, 'n1', tx({ type: 'payment', amountCents: 100, description: 'Pagamento' }), 0)); // devia ser 900
  });

  it('um lançamento não pode zerar o saldo de OUTRO cliente', async () => {
    const db = as('lojista1');
    const b = writeBatch(db);
    b.set(doc(db, 'stores/s1/transactions/n1'), tx({ customerId: 'c2', amountCents: 100 }));
    b.update(doc(db, 'stores/s1/customers/c2'), { balanceDue: 100, lastTxId: 'n1' });
    b.update(doc(db, 'stores/s1/customers/c1'), { balanceDue: 0, lastTxId: 'n1' });
    await assertFails(b.commit());
  });

  it('pagamento até o saldo; maior que o saldo é recusado', async () => {
    const db = as('lojista1');
    await assertFails(launch(db, 'n1', tx({ type: 'payment', amountCents: 1001, description: 'Pagamento' }), 0));
    await assertSucceeds(launch(db, 'n2', tx({ type: 'payment', amountCents: 1000, description: 'Pagamento' }), 0));
  });

  it('não dá para lançar em nome de outro, com data falsa ou já estornado', async () => {
    const db = as('lojista1');
    await assertFails(launch(db, 'n1', tx({ createdBy: 'lojista2' }), 1500));
    await assertFails(launch(db, 'n1', tx({ createdAt: Timestamp.fromDate(new Date('2020-01-01')) }), 1500));
    await assertFails(launch(db, 'n1', tx({ reversedById: 'x' }), 1500));
  });

  it('outro lojista e o cliente não lançam', async () => {
    await assertFails(launch(as('lojista2'), 'n1', tx({ createdBy: 'lojista2' }), 1500));
    await assertFails(launch(as('ana'), 'n1', tx({ type: 'payment', amountCents: 1000, description: 'Pagamento', createdBy: 'ana' }), 0));
  });

  it('lançamentos são imutáveis', async () => {
    const db = as('lojista1');
    await assertFails(updateDoc(doc(db, 'stores/s1/transactions/t1'), { amountCents: 1 }));
    await assertFails(deleteDoc(doc(db, 'stores/s1/transactions/t1')));
  });
});

describe('estornos', () => {
  function reverse(db: Firestore, id: string, originalId: string, over: Record<string, unknown>, newBalance: number) {
    const b = writeBatch(db);
    b.set(doc(db, `stores/s1/transactions/${id}`), tx({ type: 'reversal', reversesId: originalId, reversesType: 'purchase', amountCents: 1000, description: 'Estorno: Pão', ...over }));
    b.update(doc(db, `stores/s1/transactions/${originalId}`), { reversedById: id });
    b.update(doc(db, 'stores/s1/customers/c1'), { balanceDue: newBalance, lastTxId: id });
    return b.commit();
  }

  it('estorna uma compra (saldo volta)', async () => {
    await assertSucceeds(reverse(as('lojista1'), 'e1', 't1', {}, 0));
    expect(await balanceOf('c1')).toBe(0);
  });

  it('não estorna duas vezes', async () => {
    const db = as('lojista1');
    await assertSucceeds(reverse(db, 'e1', 't1', {}, 0));
    await assertFails(reverse(db, 'e2', 't1', {}, -1000));
  });

  it('valor do estorno tem que ser o do original', async () => {
    await assertFails(reverse(as('lojista1'), 'e1', 't1', { amountCents: 100 }, 900));
  });

  it('não estorna lançamento de outro cliente', async () => {
    await assertFails(reverse(as('lojista1'), 'e1', 't2', { amountCents: 500 }, 500));
  });

  it('não marca como estornado sem o estorno de verdade', async () => {
    await assertFails(updateDoc(doc(as('lojista1'), 'stores/s1/transactions/t1'), { reversedById: 'fake' }));
  });
});

describe('lembretes: no máximo 1 por cliente por dia', () => {
  const reminder = (over: Record<string, unknown> = {}) => ({
    customerId: 'c1', customerName: 'Ana', phone: '11987654321', kind: 'balance', message: 'Olá, Ana!',
    amountCents: 1000, dueDate: null, channel: 'whatsapp', status: 'simulated', provider: 'simulado',
    providerMessageId: 'sim_1', error: null, createdAt: serverTimestamp(), createdBy: 'lojista1', ...over,
  });
  function send(db: Firestore, id: string) {
    const b = writeBatch(db);
    b.set(doc(db, `stores/s1/reminders/${id}`), reminder());
    b.update(doc(db, 'stores/s1/customers/c1'), { lastReminderAt: serverTimestamp() });
    return b.commit();
  }

  it('o primeiro passa, o segundo no mesmo dia não', async () => {
    const db = as('lojista1');
    await assertSucceeds(send(db, 'x1'));
    await assertFails(send(db, 'x2'));
  });

  it('lembrete de ontem não impede o de hoje', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore() as unknown as Firestore, 'stores/s1/customers/c1'), {
        lastReminderAt: Timestamp.fromMillis(Date.now() - 26 * 3600_000),
      });
    });
    await assertSucceeds(send(as('lojista1'), 'x1'));
  });

  it('não grava lembrete sem marcar o cliente, nem lembrete adulterado', async () => {
    const db = as('lojista1');
    await assertFails(setDoc(doc(db, 'stores/s1/reminders/x1'), reminder()));
    await assertFails(updateDoc(doc(db, 'stores/s1/reminders/r1'), { message: 'outro' }));
    await assertFails(deleteDoc(doc(db, 'stores/s1/reminders/r1')));
  });
});

describe('cliente: leitura', () => {
  it('lê o próprio perfil e vínculos, não os de outros', async () => {
    const db = as('ana');
    await assertSucceeds(getDoc(doc(db, 'users/ana')));
    await assertSucceeds(getDocs(collection(db, 'users/ana/links')));
    await assertFails(getDoc(doc(db, 'users/bia')));
    await assertFails(getDocs(collection(db, 'users/bia/links')));
    await assertFails(getDocs(collection(db, 'users')));
  });

  it('lê a loja vinculada e só o próprio cadastro', async () => {
    const db = as('ana');
    await assertSucceeds(getDoc(doc(db, 'stores/s1')));
    await assertSucceeds(getDoc(doc(db, 'stores/s1/customers/c1')));
    await assertFails(getDoc(doc(db, 'stores/s1/customers/c2')));
    await assertFails(getDocs(collection(db, 'stores/s1/customers')));
    await assertFails(getDoc(doc(db, 'stores/s2')));
  });

  it('lê só os próprios lançamentos e lembretes (inclusive pela consulta que o app usa)', async () => {
    const db = as('ana');
    await assertSucceeds(getDoc(doc(db, 'stores/s1/transactions/t1')));
    await assertFails(getDoc(doc(db, 'stores/s1/transactions/t2')));
    await assertFails(getDocs(collection(db, 'stores/s1/transactions')));
    await assertSucceeds(
      getDocs(query(collection(db, 'stores/s1/transactions'), where('customerId', '==', 'c1'), orderBy('createdAt', 'desc'), limit(200))),
    );
    await assertFails(getDocs(query(collection(db, 'stores/s1/transactions'), where('customerId', '==', 'c2'))));
    await assertSucceeds(getDoc(doc(db, 'stores/s1/reminders/r1')));
    await assertFails(getDoc(doc(db, 'stores/s1/reminders/r2')));
    await assertSucceeds(getDocs(query(collection(db, 'stores/s1/reminders'), where('customerId', '==', 'c1'), orderBy('createdAt', 'desc'))));
  });

  it('um link forjado não dá acesso: vale o userUid do cadastro', async () => {
    const db = as('bia');
    await assertFails(getDoc(doc(db, 'stores/s1')));
    await assertFails(getDoc(doc(db, 'stores/s1/customers/c1')));
    await assertFails(getDoc(doc(db, 'stores/s1/transactions/t1')));
  });

  it('não escreve no caderno', async () => {
    const db = as('ana');
    await assertFails(updateDoc(doc(db, 'stores/s1/customers/c1'), { balanceDue: 0 }));
    await assertFails(updateDoc(doc(db, 'stores/s1/customers/c1'), { creditLimit: 999999 }));
    await assertFails(updateDoc(doc(db, 'stores/s1'), { name: 'Outra' }));
  });
});

describe('convites', () => {
  function redeem(db: Firestore, uid: string, code = 'K7MQ2P', customerId = 'c2') {
    const b = writeBatch(db);
    b.update(doc(db, `stores/s1/customers/${customerId}`), { userUid: uid, inviteCode: null });
    b.delete(doc(db, `invites/${code}`));
    b.set(doc(db, `users/${uid}/links/s1`), { storeId: 's1', customerId, linkedAt: serverTimestamp() });
    return b.commit();
  }

  it('lê só pelo código exato; nunca lista', async () => {
    await assertSucceeds(getDoc(doc(as('bia'), 'invites/K7MQ2P')));
    await assertFails(getDocs(collection(as('bia'), 'invites')));
  });

  it('cliente com o código vincula a conta e passa a ver o cadastro', async () => {
    const db = as('caio');
    await assertSucceeds(redeem(db, 'caio'));
    await assertSucceeds(getDoc(doc(db, 'stores/s1/customers/c2')));
    await assertSucceeds(getDoc(doc(db, 'stores/s1')));
  });

  it('código só vale uma vez', async () => {
    await assertSucceeds(redeem(as('caio'), 'caio'));
    await assertFails(redeem(as('dani'), 'dani'));
  });

  it('sem apagar o convite (sem saber o código) não vincula', async () => {
    const db = as('dani');
    const b = writeBatch(db);
    b.update(doc(db, 'stores/s1/customers/c2'), { userUid: 'dani', inviteCode: null });
    b.set(doc(db, 'users/dani/links/s1'), { storeId: 's1', customerId: 'c2', linkedAt: serverTimestamp() });
    await assertFails(b.commit());
  });

  it('não sequestra cadastro já vinculado nem vincula em nome de outro', async () => {
    const db = as('bia');
    const b = writeBatch(db);
    b.update(doc(db, 'stores/s1/customers/c1'), { userUid: 'bia', inviteCode: null });
    await assertFails(b.commit());
    await assertFails(redeem(as('bia'), 'ana'));
  });

  it('lojista não usa convite como cliente', async () => {
    await assertFails(redeem(as('lojista2'), 'lojista2'));
  });

  it('não cria link solto apontando para cadastro alheio', async () => {
    await assertFails(setDoc(doc(as('ana'), 'users/ana/links/s2'), { storeId: 's2', customerId: 'x', linkedAt: serverTimestamp() }));
  });
});

describe('painel administrativo', () => {
  const ADMIN_EMAIL = 'admin@exemplo.com';
  const withToken = (uid: string, token: Record<string, unknown>) =>
    env.authenticatedContext(uid, token).firestore() as unknown as Firestore;
  const admin = () => withToken('adm', { email: ADMIN_EMAIL, email_verified: true, admin: true });
  const log = (db: Firestore, b: ReturnType<typeof writeBatch>, over: Record<string, unknown> = {}) =>
    b.set(doc(collection(db, 'adminLog')), {
      action: 'store_block', targetPath: 'stores/s1', summary: 'Bloqueou a loja', byUid: 'adm', byEmail: ADMIN_EMAIL,
      createdAt: serverTimestamp(), ...over,
    });

  function block(db: Firestore, blocked: boolean, reason: string | null = 'Fraude suspeita') {
    const b = writeBatch(db);
    b.update(doc(db, 'stores/s1'), { blocked, blockedReason: reason, blockedAt: serverTimestamp(), blockedBy: 'adm' });
    log(db, b, { action: blocked ? 'store_block' : 'store_unblock' });
    return b.commit();
  }

  it('quem é admin: só quem tem a marca admin no token', async () => {
    await assertSucceeds(getDocs(collection(admin(), 'stores')));
    await assertSucceeds(getDocs(collection(withToken('adm2', { email: 'outro@x.com', admin: true }), 'stores')));
    // e-mail verificado, sem a marca, não vale — nem o mesmo e-mail do admin
    await assertFails(getDocs(collection(withToken('adm', { email: ADMIN_EMAIL, email_verified: true }), 'stores')));
    await assertFails(getDocs(collection(withToken('x', { email: 'outro@x.com', email_verified: true }), 'stores')));
    // marca com valor diferente de true não vale
    await assertFails(getDocs(collection(withToken('y', { email: 'outro@x.com', admin: 'true' }), 'stores')));
  });

  it('admin lê tudo, inclusive juntando todas as lojas', async () => {
    const db = admin();
    await assertSucceeds(getDocs(collection(db, 'users')));
    await assertSucceeds(getDoc(doc(db, 'users/ana')));
    await assertSucceeds(getDocs(collectionGroup(db, 'customers')));
    await assertSucceeds(getDocs(collectionGroup(db, 'transactions')));
    await assertSucceeds(getDocs(collectionGroup(db, 'reminders')));
    await assertSucceeds(getDocs(collectionGroup(db, 'links')));
    await assertSucceeds(getDocs(collection(db, 'stores/s2/customers')));
    await assertSucceeds(getDocs(collection(db, 'adminLog')));
  });

  it('quem não é admin não junta lojas nem lê o registro', async () => {
    const db = as('lojista1');
    await assertFails(getDocs(collectionGroup(db, 'customers')));
    await assertFails(getDocs(collectionGroup(db, 'transactions')));
    await assertFails(getDocs(collectionGroup(db, 'links')));
    await assertFails(getDocs(collection(db, 'users')));
    await assertFails(getDocs(collection(db, 'adminLog')));
  });

  it('loja bloqueada: lojista lê, mas não grava nada', async () => {
    await assertSucceeds(block(admin(), true));
    const db = as('lojista1');
    await assertSucceeds(getDoc(doc(db, 'stores/s1')));
    await assertSucceeds(getDocs(collection(db, 'stores/s1/customers')));
    await assertFails(launch(db, 'n1', tx(), 1500));
    await assertFails(updateDoc(doc(db, 'stores/s1'), { name: 'Padaria Nova' }));
    await assertFails(updateDoc(doc(db, 'stores/s1/customers/c1'), { creditLimit: 8000 }));
    const b = writeBatch(db);
    b.set(doc(db, 'stores/s1/customers/c9'), {
      name: 'Duda', phone: '21987654321', creditLimit: 3000, balanceDue: 0, userUid: null, inviteCode: 'ABC234',
      lastReminderAt: null, lastTxId: null, createdAt: serverTimestamp(), createdBy: 'lojista1',
    });
    b.set(doc(db, 'invites/ABC234'), { storeId: 's1', customerId: 'c9', createdAt: serverTimestamp() });
    await assertFails(b.commit());
    // e o lojista não se desbloqueia sozinho
    await assertFails(updateDoc(doc(db, 'stores/s1'), { blocked: false, blockedReason: null, blockedAt: serverTimestamp(), blockedBy: 'lojista1' }));
  });

  it('loja bloqueada não recebe cliente novo pelo convite', async () => {
    await assertSucceeds(block(admin(), true));
    const db = as('caio');
    const b = writeBatch(db);
    b.update(doc(db, 'stores/s1/customers/c2'), { userUid: 'caio', inviteCode: null });
    b.delete(doc(db, 'invites/K7MQ2P'));
    b.set(doc(db, 'users/caio/links/s1'), { storeId: 's1', customerId: 'c2', linkedAt: serverTimestamp() });
    await assertFails(b.commit());
  });

  it('desbloqueada, a loja volta a lançar', async () => {
    await assertSucceeds(block(admin(), true));
    await assertSucceeds(block(admin(), false, null));
    await assertSucceeds(launch(as('lojista1'), 'n1', tx(), 1500));
  });

  it('bloqueio exige motivo e é só do admin', async () => {
    await assertFails(block(admin(), true, ''));
    await assertFails(block(admin(), false, 'sobrou motivo'));
    await assertFails(block(as('lojista2'), true));
  });

  it('admin corrige cadastro, mas nunca mexe no saldo nem lança', async () => {
    const db = admin();
    await assertSucceeds(updateDoc(doc(db, 'stores/s1/customers/c1'), { name: 'Ana Souza', phone: '11911112222', creditLimit: 9000 }));
    await assertFails(updateDoc(doc(db, 'stores/s1/customers/c1'), { phone: '123' }));
    await assertFails(updateDoc(doc(db, 'stores/s1/customers/c1'), { balanceDue: 0 }));
    await assertFails(updateDoc(doc(db, 'stores/s1/customers/c1'), { userUid: null }));
    await assertFails(launch(db, 'n1', tx({ createdBy: 'adm' }), 1500));
    await assertSucceeds(updateDoc(doc(db, 'stores/s1'), { name: 'Padaria Central' }));
    await assertFails(updateDoc(doc(db, 'stores/s1'), { ownerUid: 'lojista2' }));
    await assertSucceeds(updateDoc(doc(db, 'users/ana'), { name: 'Ana Souza' }));
    await assertFails(updateDoc(doc(db, 'users/ana'), { role: 'merchant' }));
    await assertFails(deleteDoc(doc(db, 'stores/s1/transactions/t1')));
  });

  it('registro do admin: só cresce e não aceita autoria falsa', async () => {
    const db = admin();
    await assertSucceeds(setDoc(doc(db, 'adminLog/l1'), {
      action: 'reveal_pii', targetPath: 'stores/s1/customers/c1', summary: 'Revelou telefone', byUid: 'adm',
      byEmail: ADMIN_EMAIL, createdAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(db, 'adminLog/l1'), { summary: 'outro' }));
    await assertFails(deleteDoc(doc(db, 'adminLog/l1')));
    await assertFails(setDoc(doc(db, 'adminLog/l2'), {
      action: 'reveal_pii', targetPath: 'x', summary: 'y', byUid: 'outro', byEmail: ADMIN_EMAIL, createdAt: serverTimestamp(),
    }));
    await assertFails(setDoc(doc(as('lojista1'), 'adminLog/l3'), {
      action: 'reveal_pii', targetPath: 'x', summary: 'y', byUid: 'lojista1', byEmail: null, createdAt: serverTimestamp(),
    }));
  });
});
