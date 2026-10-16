import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { afterAll, beforeAll, describe, it } from 'vitest';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-rules',
    firestore: { rules: readFileSync(resolve(import.meta.dirname, '../../../firestore.rules'), 'utf8'), host: '127.0.0.1', port: 8080 },
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/lojista1'), { role: 'merchant', name: 'Lojista 1' });
    await setDoc(doc(db, 'users/ana'), { role: 'customer', name: 'Ana' });
    await setDoc(doc(db, 'users/bia'), { role: 'customer', name: 'Bia' });
    await setDoc(doc(db, 'stores/s1'), { name: 'Padaria', ownerUid: 'lojista1' });
    await setDoc(doc(db, 'stores/s2'), { name: 'Mercado', ownerUid: 'lojista2' });
    await setDoc(doc(db, 'stores/s1/customers/c1'), { name: 'Ana', userUid: 'ana', balanceDue: 1000, creditLimit: 5000 });
    await setDoc(doc(db, 'stores/s1/customers/c2'), { name: 'Caio', userUid: null, balanceDue: 0, creditLimit: 5000 });
    await setDoc(doc(db, 'users/ana/links/s1'), { storeId: 's1', customerId: 'c1' });
    await setDoc(doc(db, 'stores/s1/transactions/t1'), { customerId: 'c1', type: 'purchase', amountCents: 1000 });
    await setDoc(doc(db, 'stores/s1/transactions/t2'), { customerId: 'c2', type: 'purchase', amountCents: 500 });
    await setDoc(doc(db, 'stores/s1/reminders/r1'), { customerId: 'c1', message: 'Olá, Ana!' });
    await setDoc(doc(db, 'stores/s1/reminders/r2'), { customerId: 'c2', message: 'Olá, Caio!' });
    await setDoc(doc(db, 'invites/K7MQ2P'), { storeId: 's1', customerId: 'c2' });
    // vínculo forjado: a Bia tem um link apontando para o cadastro da Ana
    await setDoc(doc(db, 'users/bia/links/s1'), { storeId: 's1', customerId: 'c1' });
  });
});

afterAll(async () => {
  await env?.clearFirestore();
  await env?.cleanup();
});

const as = (uid: string) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();

describe('sem login', () => {
  it('não lê nada', async () => {
    await assertFails(getDoc(doc(anon(), 'stores/s1')));
    await assertFails(getDoc(doc(anon(), 'stores/s1/transactions/t1')));
    await assertFails(getDoc(doc(anon(), 'users/ana')));
  });
});

describe('lojista', () => {
  it('lê a própria loja, clientes, lançamentos e lembretes', async () => {
    const db = as('lojista1');
    await assertSucceeds(getDoc(doc(db, 'stores/s1')));
    await assertSucceeds(getDocs(collection(db, 'stores/s1/customers')));
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

  it('não escreve direto (tudo passa pela API)', async () => {
    const db = as('lojista1');
    await assertFails(setDoc(doc(db, 'stores/s1/transactions/novo'), { customerId: 'c1', type: 'purchase', amountCents: 1 }));
    await assertFails(updateDoc(doc(db, 'stores/s1/customers/c1'), { balanceDue: 0 }));
    await assertFails(updateDoc(doc(db, 'stores/s1/customers/c1'), { creditLimit: 999999 }));
    await assertFails(updateDoc(doc(db, 'stores/s1'), { name: 'Outra' }));
    await assertFails(setDoc(doc(db, 'stores/s1/reminders/novo'), { customerId: 'c1' }));
  });

  it('lançamentos são imutáveis', async () => {
    const db = as('lojista1');
    await assertFails(updateDoc(doc(db, 'stores/s1/transactions/t1'), { amountCents: 1 }));
    await assertFails(deleteDoc(doc(db, 'stores/s1/transactions/t1')));
  });
});

describe('cliente', () => {
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

  it('lê só os próprios lançamentos e lembretes', async () => {
    const db = as('ana');
    await assertSucceeds(getDoc(doc(db, 'stores/s1/transactions/t1')));
    await assertFails(getDoc(doc(db, 'stores/s1/transactions/t2')));
    await assertFails(getDocs(collection(db, 'stores/s1/transactions')));
    await assertSucceeds(getDoc(doc(db, 'stores/s1/reminders/r1')));
    await assertFails(getDoc(doc(db, 'stores/s1/reminders/r2')));
  });

  it('não escreve nada', async () => {
    const db = as('ana');
    await assertFails(updateDoc(doc(db, 'stores/s1/customers/c1'), { balanceDue: 0 }));
    await assertFails(setDoc(doc(db, 'stores/s1/transactions/pago'), { customerId: 'c1', type: 'payment', amountCents: 1000 }));
    await assertFails(updateDoc(doc(db, 'users/ana'), { role: 'merchant' }));
    await assertFails(setDoc(doc(db, 'users/ana/links/s2'), { storeId: 's2', customerId: 'x' }));
  });

  it('um link forjado não dá acesso: vale o userUid do cadastro', async () => {
    const db = as('bia');
    await assertFails(getDoc(doc(db, 'stores/s1')));
    await assertFails(getDoc(doc(db, 'stores/s1/customers/c1')));
    await assertFails(getDoc(doc(db, 'stores/s1/transactions/t1')));
  });
});

describe('convites', () => {
  it('ninguém lê nem lista códigos', async () => {
    await assertFails(getDoc(doc(as('ana'), 'invites/K7MQ2P')));
    await assertFails(getDoc(doc(as('lojista1'), 'invites/K7MQ2P')));
    await assertFails(getDocs(collection(as('bia'), 'invites')));
  });
});
