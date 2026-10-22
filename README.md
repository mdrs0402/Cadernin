# 📒 Cadernin — o fiado, sem o caderno

> Sistema web que **profissionaliza o "fiado"** do pequeno comércio: o lojista troca o caderninho de papel
> por um controle confiável de clientes, limites, compras, pagamentos e cobranças — e o cliente acompanha
> a própria conta pelo celular.

<!-- Quando o site estiver no ar, descomente e preencha:
🔗 **Teste agora:** https://seu-site.vercel.app
-->

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?logo=firebase&logoColor=black)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)

<!-- Capturas de tela: salve as imagens em docs/img/ e descomente.
| Painel do lojista | Conta do cliente |
| :---: | :---: |
| ![Painel do lojista](docs/img/painel-lojista.png) | ![Conta do cliente](docs/img/conta-cliente.png) |
-->

---

## ⚡ Resumo em 30 segundos

| | |
| --- | --- |
| **O que é** | App web completo (front + banco + autenticação + regras de segurança) para controle de vendas a prazo |
| **Para quem** | Mercadinhos, padarias e comércios de bairro — e os clientes deles |
| **Meu papel** | Projeto individual: ideia, modelagem dos dados, front-end, regras de segurança, testes e deploy |
| **Stack principal** | React 19 · TypeScript · Firebase (Auth + Firestore) · Tailwind · Vitest · Vercel |
| **Qualidade** | Mais de 100 testes automatizados, incluindo testes que **tentam burlar** as regras de segurança |
| **Status** | MVP funcional, usado como projeto de estudo e portfólio |

---

## 🎯 O problema

Em muitos comércios de bairro o fiado vive em caderno: página some, o saldo é refeito de cabeça, ninguém
lembra quem passou do combinado e cobrar vira constrangimento. O Cadernin troca isso por um registro
confiável, com regras claras (limite de crédito, vencimento) e lembretes de cobrança.

## ✨ Funcionalidades

**👨‍💼 Lojista**
- Cadastro de clientes com **limite de crédito**
- Convite do cliente por **código de 6 caracteres** (uso único)
- Lançamento de **compras, pagamentos e estornos** — o saldo é sempre calculado pelo sistema, nunca digitado
- **Painel** com visão das contas em aberto, vencidas e a vencer
- **Lembretes de cobrança** sugeridos automaticamente (vencido / vence nos próximos 7 dias)

**🙋 Cliente**
- Entra com a conta Google e se vincula à loja pelo código de convite
- Vê o próprio saldo, o histórico de lançamentos e os recados da loja

**🛡️ Administração**
- Suporte a um painel administrativo (projeto separado) que pode bloquear lojas e corrigir cadastros —
  mas **nunca** mexe em saldo ou lançamentos

---

## 🧠 Decisões técnicas que eu destacaria

1. **Arquitetura sem servidor (serverless).** O React conversa direto com o Firebase e o site é publicado
   como estático na Vercel. Isso elimina custo e manutenção de um back-end para um MVP.

2. **Segurança de verdade no servidor, não só na tela.** Sem API, quem garante as regras são as
   [`firestore.rules`](firestore.rules), executadas nos servidores do Google. Mesmo alguém que abra o console
   do navegador e chame o banco direto não consegue:
   - alterar um saldo sem um lançamento que justifique a mudança;
   - comprar acima do limite ou pagar mais do que deve;
   - estornar duas vezes, editar ou apagar lançamentos;
   - trocar de papel (lojista ↔ cliente) ou ler dados de outra loja/cliente.

3. **Testes que atacam o próprio sistema.** Em [`test/firestore.rules.test.ts`](test/firestore.rules.test.ts)
   cada regra acima é testada no emulador do Firebase tentando *quebrá-la*.

4. **Dinheiro em centavos inteiros.** Nada de `float` para valores (evita erros como `0,1 + 0,2 ≠ 0,3`).
   A conversão de texto como `"R$ 1.234,56"` é feita sem passar por número decimal — ver
   [`src/shared/money.ts`](src/shared/money.ts).

5. **Operações atômicas.** Lançamento + atualização de saldo, convite + vínculo do cliente: tudo vai numa
   **transação** — ou grava tudo, ou nada.

6. **Regras de negócio isoladas e testadas.** Dinheiro, vencimentos e lembretes ficam em
   [`src/shared/`](src/shared), sem depender do Firebase, com testes unitários e validação com **Zod**.

7. **Evolução de arquitetura.** O projeto começou como monorepo com API em **Express + Firebase Admin**
   (pasta `apps/`) e depois foi migrado para serverless, movendo as regras da API para o Firestore Rules.
   Foi uma decisão consciente de simplificar o deploy sem abrir mão da segurança.

---

## 🧰 Tecnologias

| Camada          | Tecnologias                                                     |
| --------------- | --------------------------------------------------------------- |
| Front-end       | React 19, TypeScript, Vite, React Router, TanStack Query        |
| Estilo / UI     | Tailwind CSS, Lucide Icons                                      |
| Back-end (BaaS) | Firebase Authentication (Google) e Cloud Firestore              |
| Validação       | Zod                                                             |
| Testes          | Vitest, `@firebase/rules-unit-testing` (emulador do Firestore)  |
| Deploy          | Vercel (site estático) + Firebase (regras e índices)            |
| Versão anterior | Node.js, Express 5, Firebase Admin SDK, Helmet, CORS            |

---

## 🔎 Avaliando o código em 5 minutos

| Quer ver…                         | Abra                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------- |
| Regras de segurança               | [`firestore.rules`](firestore.rules)                                              |
| Testes de ataque às regras        | [`test/firestore.rules.test.ts`](test/firestore.rules.test.ts)                    |
| Lógica de dinheiro e lembretes    | [`src/shared/money.ts`](src/shared/money.ts), [`src/shared/reminders.ts`](src/shared/reminders.ts) |
| Lançamentos com transação         | [`src/data/transactions.ts`](src/data/transactions.ts)                            |
| Rotas e controle de acesso        | [`src/main.tsx`](src/main.tsx), [`src/routes/guards.tsx`](src/routes/guards.tsx)  |
| Telas principais                  | [`src/pages/merchant/`](src/pages/merchant), [`src/pages/customer/`](src/pages/customer) |

## 🚀 Rodando localmente

Pré-requisitos: **Node 20+** e **Java 21+** (para o emulador do Firebase).

```bash
npm install
cp .env.example .env      # preencha as VITE_FIREBASE_*
npm run dev               # app + emuladores em http://localhost:5173
```

```bash
npm test                  # testes unitários
npm run test:rules        # testes das regras de segurança (emulador)
npm run typecheck         # checagem de tipos
```

Detalhes de ambiente, modelo de dados, segurança e deploy:
**[📚 documentação técnica](docs/DOCUMENTACAO-TECNICA.md)**.

---

## 🚧 Status e próximos passos

MVP funcional. Os lembretes de cobrança são **simulados** (ficam registrados e aparecem para o cliente,
mas nenhuma mensagem sai de verdade).

- [ ] Envio real de lembretes por WhatsApp (exige uma função no servidor para guardar a chave do provedor)
- [ ] Paginação do histórico (hoje: últimos 200 lançamentos por cliente)
- [ ] Relatórios exportáveis para o lojista

## 📖 O que aprendi

- Pensar em **segurança no servidor**: validação no front ajuda o usuário, mas não protege nada.
- Modelar dados num banco NoSQL pensando nas consultas e nas regras de acesso.
- Escrever testes que tentam **quebrar** o sistema, não só confirmar o caminho feliz.
- Avaliar trade-offs de arquitetura (API própria × serverless) e migrar um projeto que já funcionava.

---

## 👤 Autor

**Alan Medeiros Batista** — estudante de Análise e Desenvolvimento de Sistemas no Centro Universitário
Fametro (Manaus/AM), em busca de **estágio ou vaga júnior** em desenvolvimento de software.

Projeto criado por iniciativa própria, para aprender na prática construindo algo útil do começo ao fim.

- 💼 GitHub: [@mdrs0402](https://github.com/mdrs0402)
- 📧 E-mail: medeirossalan24@gmail.com
<!-- - 🔗 LinkedIn: https://www.linkedin.com/in/seu-perfil -->
