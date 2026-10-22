# 📚 Cadernin — documentação técnica

> Voltar para o [README](../README.md).

Um app só, **sem servidor**: o React fala direto com o Firebase (Auth + Firestore) e é publicado na
Vercel como site estático.

```
src/              app React + Vite + TS (React Router, TanStack Query, Tailwind)
  api/            hooks do React Query que as telas usam (useCustomers, useCreateTransaction…)
  data/           leitura e escrita no Firestore (substitui a antiga API Express)
  shared/         tipos, schemas Zod e regras de negócio puras (dinheiro, vencimentos, lembretes)
  pages/ components/ routes/ auth/ lib/
test/             testes das firestore.rules (rodam no emulador)
firestore.rules   A ÚNICA barreira de segurança — ver "Segurança" abaixo
firestore.indexes.json  firebase.json  .firebaserc  vercel.json
```


### Pré-requisitos

- Node 20+ (testado com 24) e npm 10+
- Java 21+ (só para o emulador do Firestore em desenvolvimento e nos testes das regras).
- A Firebase CLI vem como dependência do projeto (`npx firebase ...`).

### Rodando localmente

```bash
npm install
cp .env.example .env      # e preencha as VITE_FIREBASE_*
npm run dev
```

`npm run dev` sobe o emulador (Auth + Firestore) e o Vite juntos:

| Serviço          | URL                             |
| ---------------- | ------------------------------- |
| App              | http://localhost:5173           |
| Emulator UI      | http://127.0.0.1:4000           |
| Auth / Firestore | 127.0.0.1:9099 / 127.0.0.1:8080 |

Padrão de desenvolvimento: **login Google real** e **Firestore no emulador** (`VITE_USE_FIRESTORE_EMULATOR=true`).
Para 100% offline, use também `VITE_USE_AUTH_EMULATOR=true`.

> ⚠️ Os dados do emulador só vão para `.emulator-data/` quando ele **encerra normalmente** (Ctrl+C).
> Salve um retrato a qualquer momento com `npm run emulators:backup`.

| Script                  | O que faz                                                             |
| ----------------------- | --------------------------------------------------------------------- |
| `npm run typecheck`     | TypeScript                                                            |
| `npm test`              | testes unitários (Vitest), sem Firebase                               |
| `npm run test:rules`    | sobe o emulador e testa as `firestore.rules` (projeto isolado `demo-rules`) |
| `npm run build`         | build de produção em `dist/`                                          |
| `npm run deploy:rules`  | publica `firestore.rules` e `firestore.indexes.json` no Firebase      |

### Como funciona sem servidor

1. Login com Google pelo Firebase Auth (popup). A identidade é o `uid` do Firebase.
2. O app lê e grava no Firestore com o SDK web (`src/data/`). Operações que mexem em mais de um
   documento (lançamento + saldo, convite + cliente, vínculo do cliente) vão numa **transação**.
3. As `firestore.rules` conferem cada escrita no servidor do Google. Mesmo quem abrir o console do
   navegador e chamar o SDK direto não consegue furar as regras.

### Dados

| Caminho                                | O que é                                                    |
| -------------------------------------- | ---------------------------------------------------------- |
| `users/{uid}`                          | perfil e papel (`merchant`/`customer`), gravado uma vez     |
| `users/{uid}/links/{storeId}`          | lojas onde o cliente tem conta                             |
| `stores/{storeId}`                     | loja (lojas novas: `storeId` = uid do dono)                 |
| `stores/{storeId}/customers/{id}`      | cliente: limite, `balanceDue`, `lastTxId`, convite          |
| `stores/{storeId}/transactions/{id}`   | compras, pagamentos e estornos (imutáveis)                  |
| `stores/{storeId}/reminders/{id}`      | lembretes (simulados)                                       |
| `invites/{code}`                       | código de convite de 6 caracteres (uso único)               |

### Segurança (firestore.rules)

Sem API, **as regras são a única barreira**. Elas garantem:

- **Papel definitivo:** cada um cria só o próprio `users/{uid}`, uma vez; ninguém troca de papel.
- **Uma loja por lojista:** a loja é criada com id = uid do dono, no mesmo batch do perfil de lojista.
- **Saldo nunca é editado direto.** Todo lançamento vai junto com a atualização do cliente
  (`balanceDue` + `lastTxId`), e a regra confere a conta: compra soma e não passa do limite; pagamento
  subtrai e não passa da dívida; estorno usa o valor do original, marca o original e não deixa o saldo
  negativo. Não dá para estornar duas vezes nem mexer no saldo de outro cliente.
- **Lançamentos imutáveis:** sem edição nem exclusão (só a marca de "estornado").
- **Cliente só é excluído** se nunca teve lançamento.
- **1 lembrete por cliente por dia** (fuso de São Paulo), conferido com o horário do servidor.
- **Convite de uso único:** só quem sabe o código consegue apagá-lo, e só apagando ele dá para vincular.
  Convites são lidos só pelo código exato, nunca listados.
- **Leitura:** lojista só a própria loja; cliente só o próprio perfil e, em cada loja vinculada, só o
  próprio cadastro, lançamentos e recados. O vínculo vale pelo `userUid` do cadastro, não pelo link.

Os testes em `test/firestore.rules.test.ts` tentam cada um desses ataques direto pelo SDK.

**Toda mudança em `firestore.rules` precisa de `npm run deploy:rules`** — a Vercel não publica regras.

### Lembretes (simulados)

Nenhuma mensagem sai de verdade. `src/data/notifications.ts` tem a interface `NotificationService` e a
implementação `SimulatedNotificationService`, que só escreve no console. O lembrete fica gravado em
`stores/{storeId}/reminders` e o cliente o vê em **Recados da loja**.

- **Sugeridos:** compra vencida em aberto (`overdue`) ou vencendo hoje / nos próximos 7 dias (`due_soon`).
  Quem só tem saldo (`balance`) aparece, mas só recebe se o lojista escolher.
- **Texto:** `src/shared/reminders.ts`.

Envio real por WhatsApp precisaria de uma chave secreta do provedor, e chave secreta não pode ficar no
navegador: isso exigiria uma função no servidor (ex.: Vercel Function ou Cloud Function).

### Limites conhecidos do MVP

- Histórico limitado aos 200 lançamentos mais recentes por cliente (sem paginação).
- O painel e a tela de lembretes leem o histórico de cada cliente devedor: bom para uma loja de bairro.
- O perfil (lojista ou cliente) é definitivo.
- Telefone repetido na mesma loja é checado pelo app, não pelas regras.

### Publicando (Firebase + Vercel)

#### 1. Firebase (uma vez)

1. **Authentication → Método de login → Google → Ativar.**
2. **Authentication → Configurações → Domínios autorizados:** adicione `localhost` e o domínio do site
   (ex.: `cadernin.vercel.app`, e o seu domínio próprio, se tiver). Sem isso o login com Google é
   recusado com `auth/unauthorized-domain`.
3. **Firestore Database → Criar banco de dados** (modo produção, região `southamerica-east1`), se ainda
   não existir.
4. Publique regras e índices: `npx firebase login` e depois `npm run deploy:rules`.
   Os índices levam alguns minutos para ficar prontos.

#### 2. Vercel

Projeto com **Root Directory** `./` e **Framework Preset** `Vite` (o `vercel.json` já define build e
saída). Variáveis em **Settings → Environment Variables**:

| Variável                    | Valor                                   |
| --------------------------- | --------------------------------------- |
| `VITE_FIREBASE_API_KEY`     | do app Web no console do Firebase       |
| `VITE_FIREBASE_AUTH_DOMAIN` | `<id do projeto>.firebaseapp.com`       |
| `VITE_FIREBASE_PROJECT_ID`  | `<id do projeto>`                       |
| `VITE_FIREBASE_APP_ID`      | do app Web no console do Firebase       |

Não defina `VITE_USE_FIRESTORE_EMULATOR` nem `VITE_USE_AUTH_EMULATOR` na Vercel.
As `VITE_*` entram no site **na hora do build**: depois de mudar alguma, faça um novo deploy.
Não há mais service account, `WEB_ORIGIN` nem `VITE_API_URL`.
