# Cadernin — fiado digital

Monorepo (npm workspaces):

```
apps/web         React + Vite + TS, React Router, TanStack Query, Tailwind
apps/api         Node + Express 5 + TS, Firebase Admin SDK, Zod
packages/shared  tipos, schemas Zod e regras de negócio compartilhadas
firestore.rules  firebase.json  .firebaserc
```

## Pré-requisitos

- Node 20+ (testado com 24) e npm 10+
- Java 21+ (o emulador do Firestore roda em Java). Teste com `java -version`.
- A Firebase CLI vem como dependência do projeto (`npx firebase ...`), não precisa instalar global.

## Rodando localmente (com emuladores, sem precisar de projeto no console)

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
npm run dev
```

`npm run dev` sobe tudo junto:

| Serviço            | URL                           |
| ------------------ | ----------------------------- |
| Web                | http://localhost:5173         |
| API                | http://localhost:3333         |
| Emulator UI        | http://127.0.0.1:4000         |
| Auth / Firestore   | 127.0.0.1:9099 / 127.0.0.1:8080 |

Modo padrão de desenvolvimento: **login Google real** (projeto `cadernin-25dff`) e
**Firestore no emulador** (dados locais em memória).

> ⚠️ Os dados do emulador só vão para `.emulator-data/` quando ele **encerra normalmente** (Ctrl+C).
> Se o processo cair ou o PC desligar, perde-se o que não foi salvo. Com o `npm run dev` rodando,
> salve um retrato a qualquer momento em outro terminal com `npm run emulators:backup`.

Para rodar 100% offline com o login falso do emulador: em `apps/web/.env` use
`VITE_USE_AUTH_EMULATOR=true` e em `apps/api/.env` descomente `FIREBASE_AUTH_EMULATOR_HOST`.

Scripts úteis:

| Script                     | O que faz                                                         |
| -------------------------- | ----------------------------------------------------------------- |
| `npm run typecheck`        | TypeScript em todos os pacotes                                    |
| `npm test`                 | testes unitários (Vitest) de shared, api e web — sem Firebase     |
| `npm run test:rules`       | testes das `firestore.rules` (precisa do emulador rodando)        |
| `npm run emulators:backup` | salva os dados do emulador em `.emulator-data/`                   |
| `npm run build`            | build de produção da API e do front                               |

## Fluxo de autenticação

1. O front faz login com Google (Firebase Auth, popup) e obtém o ID token.
2. Toda chamada à API envia `Authorization: Bearer <idToken>`.
3. `requireAuth` (apps/api/src/middleware/auth.ts) verifica o token com o Admin SDK; a identidade
   vem só do token. `requireRole(...)` checa o custom claim `role`.

## API

Todas as rotas (exceto `/health`) exigem `Authorization: Bearer <idToken>`. Valores em **centavos inteiros**.

| Método | Rota                              | Papel    | O que faz                                                   |
| ------ | --------------------------------- | -------- | ----------------------------------------------------------- |
| GET    | `/me`                             | qualquer | identidade + perfil + loja (corrige claim desatualizado)    |
| POST   | `/me/profile`                     | sem      | escolhe perfil (grava `users/{uid}` + custom claim `role`); lojista cria a loja |
| GET    | `/store`                          | merchant | dados da própria loja                                       |
| PATCH  | `/store`                          | merchant | renomeia a loja                                             |
| GET    | `/store/dashboard`                | merchant | painel: a receber, vencidos, vencem em breve, mês, 7 dias, perto do limite, últimos lançamentos |
| GET    | `/store/customers`                | merchant | lista clientes                                              |
| POST   | `/store/customers`                | merchant | cria cliente (gera código de convite)                       |
| GET    | `/store/customers/:id`            | merchant | detalhe                                                     |
| PATCH  | `/store/customers/:id`            | merchant | edita nome/telefone/limite (`balanceDue` nunca é editável)  |
| DELETE | `/store/customers/:id`            | merchant | exclui **só se não houver lançamentos**                     |
| POST   | `/store/customers/:id/invite`     | merchant | gera novo código (invalida o anterior)                      |
| GET    | `/store/customers/:id/transactions` | merchant | histórico do cliente (mais recente primeiro)              |
| POST   | `/store/customers/:id/transactions` | merchant | lança compra (`purchase`) ou pagamento (`payment`)        |
| POST   | `/store/customers/:id/transactions/:txId/reversal` | merchant | estorna um lançamento (nada é apagado)     |
| GET    | `/store/reminders`                | merchant | quem está devendo, o lembrete que caberia hoje (com prévia do texto) e os últimos enviados |
| POST   | `/store/reminders`                | merchant | envia os sugeridos de hoje (`{}`) ou só para `{ customerIds: [...] }` |
| POST   | `/store/customers/:id/reminder`   | merchant | lembrete para um cliente (409 se já recebeu hoje, 422 se não deve nada) |
| GET    | `/customer/reminders`             | customer | recados recebidos das lojas (`?storeId=` para uma loja)     |
| GET    | `/customer/accounts`              | customer | contas do cliente: limite, saldo, vencido, próximo vencimento, compras do mês |
| GET    | `/customer/transactions`          | customer | histórico de compras/pagamentos (`?storeId=` para uma loja) |
| POST   | `/customer/links`                 | customer | vincula a conta usando o código de convite                  |

Vínculo do cliente: o lojista cadastra o cliente e recebe um código de 6 caracteres
(`invites/{code}`). O cliente entra, escolhe "Sou cliente" e digita o código; a API grava
`customers/{id}.userUid` e `users/{uid}/links/{storeId}` na mesma transação e apaga o convite.

Lançamentos: cada compra, pagamento ou estorno é gravado em `stores/{storeId}/transactions` na
**mesma transação do Firestore** que atualiza `balanceDue`. Compra que passa do limite é recusada
(422 `credit_limit_exceeded`); pagamento maior que a dívida também (422 `payment_exceeds_balance`).
Lançamentos nunca são apagados nem editados: para corrigir, estorne (cria um `reversal` e marca o original).
Vencimentos: pagamentos quitam as compras mais antigas primeiro, então o saldo devedor está nas compras
mais recentes. "Vencido" é a parte ainda em aberto das compras com vencimento passado (cálculo em
`packages/shared/src/dashboard.ts`). Datas de "hoje" e "este mês" usam o fuso `America/Sao_Paulo`.

O histórico e os recados do cliente usam os índices compostos `customerId + createdAt desc`
de `firestore.indexes.json` (coleções `transactions` e `reminders`).

## Lembretes (simulados)

Nesta versão **nenhuma mensagem sai de verdade**. A API fala só com a interface
`NotificationService` (`apps/api/src/notifications/`); a implementação atual,
`SimulatedNotificationService`, escreve a mensagem no log da API (`[lembrete simulado] whatsapp para ...`)
e devolve um id fictício. O lembrete fica gravado em `stores/{storeId}/reminders` e o cliente que usa
o app o vê em **Recados da loja**.

- **Quem é sugerido:** quem tem compra vencida em aberto (`overdue`) ou vencendo hoje / nos próximos
  7 dias (`due_soon`). Quem só tem saldo (`balance`) aparece na lista, mas só recebe se o lojista escolher.
- **Texto:** montado em `packages/shared/src/reminders.ts` (primeiro nome, loja, valor e data).
- **1 por cliente por dia** (fuso de São Paulo), garantido em transação: cliques simultâneos geram um só.
- **Envio em duas fases:** a transação grava o lembrete como `queued` e marca `lastReminderAt`; depois o
  `NotificationService` envia e o status vira `simulated`/`sent`. Se o envio falhar, fica `failed` e o
  cliente volta a poder ser lembrado no mesmo dia.
- **Envio manual:** o lojista dispara pela tela **Lembretes** ou pelo botão **Lembrar** no cliente.
  Não há envio automático agendado no MVP.

Para usar um provedor real no futuro (ex.: WhatsApp Business API), basta outra classe que implemente
`NotificationService.send` e escolhê-la em `apps/api/src/notifications/index.ts`.

## Segurança e regras do Firestore

- Toda **escrita** passa pela API (Admin SDK). As `firestore.rules` bloqueiam qualquer escrita direta
  do front, inclusive do dono da loja: assim o limite de crédito, as transações atômicas, o estorno e o
  limite de lembretes não têm como ser contornados.
- **Leitura** direta (defesa em profundidade; o front atual lê tudo pela API): o lojista lê só a própria
  loja; o cliente lê o próprio perfil e vínculos e, em cada loja vinculada, só o próprio cadastro,
  lançamentos e recados. O vínculo vale pelo `userUid` do cadastro, não pelo link sozinho.
  Convites (`invites`) não são legíveis por ninguém.
- A loja do lojista vem sempre do `uid` do token, nunca de um id enviado pelo front.
- Nenhum segredo no repositório: `.env` e `service-account*.json` estão no `.gitignore`.

## Testes

- `npm test`: regras de dinheiro, telefone, convite, crédito, vencimentos (FIFO), resumo da conta,
  lembretes (quem lembrar e texto), schemas da API, `NotificationService` simulado, middlewares de
  erro/papel, rotas HTTP sem token e CORS, e formatação de datas do front.
- `npm run test:rules`: 11 cenários das `firestore.rules` (lojista × outra loja, cliente × outro cliente,
  link forjado, lançamentos imutáveis, convites fechados). Usa o projeto isolado `demo-rules` no emulador
  e não toca nos seus dados.

## Limites conhecidos do MVP

- Histórico limitado aos 200 lançamentos mais recentes por cliente (sem paginação).
- O painel e a tela de lembretes leem o histórico de cada cliente devedor: bom para uma loja de bairro,
  precisaria de agregados para milhares de clientes.
- O perfil (lojista ou cliente) é definitivo.
- Fora do escopo: análise de risco por IA, geolocalização, pagamento online, WhatsApp real e modo offline.

## Usando o Firebase real (checklist)

1. Acesse https://console.firebase.google.com → **Adicionar projeto** → dê um nome (ex.: `cadernin`).
   Anote o **ID do projeto**.
2. **Criação → Authentication → Vamos começar → Método de login → Google → Ativar**, escolha o
   e-mail de suporte e salve.
3. Em **Authentication → Configurações → Domínios autorizados**, confirme que `localhost` está na lista
   (adicione o domínio de produção quando publicar).
4. **Criação → Firestore Database → Criar banco de dados**, modo **produção**, região
   `southamerica-east1` (São Paulo).
5. **⚙ Configurações do projeto → Geral → Seus apps → ícone Web (`</>`)**, registre o app e copie
   `apiKey`, `authDomain`, `projectId` e `appId` para `apps/web/.env`; coloque `VITE_USE_EMULATORS=false`.
6. **⚙ Configurações do projeto → Contas de serviço → Gerar nova chave privada.** Salve o JSON
   **fora do repositório** e aponte `GOOGLE_APPLICATION_CREDENTIALS` para ele em `apps/api/.env`.
   Nunca faça commit desse arquivo.
7. Em `apps/api/.env`: `FIREBASE_PROJECT_ID=<id do projeto>` e **remova** `FIRESTORE_EMULATOR_HOST`
   e `FIREBASE_AUTH_EMULATOR_HOST`.
8. Publique regras e índices: `npx firebase deploy --only firestore --project <id do projeto>`
   (faça `npx firebase login` antes). Os índices levam alguns minutos para ficar prontos.
