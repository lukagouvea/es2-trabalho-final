# Campus em dia

Mapa colaborativo de ocorrências de manutenção da UFV, campus Viçosa. A comunidade registra problemas no mapa do campus (iluminação, vazamentos, equipamentos danificados, barreiras de acessibilidade), confirma relatos de outras pessoas e acompanha o atendimento. Cada ocorrência é encaminhada a um setor de manutenção, que analisa, transfere, atende e resolve a demanda.

**Produção:** https://campus-em-dia.vercel.app/

Projeto acadêmico da disciplina Engenharia de Software II, Grupo 5: Lucas Carvalho de Góes, Luka Gouvêa e Gabriel Ferreira. Não é um serviço oficial da universidade.

## Funcionalidades

A aplicação implementa os requisitos F1–F13 definidos na [concepção](entregas/F1-concepcao/F1_Concepcao_Grupo5.md):

| Requisito | Na aplicação |
| --- | --- |
| F1 — Manter conta | Cadastro e edição de nome/e-mail |
| F2 — Autenticar usuário | Entrada e saída com Supabase Auth |
| F3 — Consultar mapa | Marcadores, resumo, busca, mapa/lista e filtros combinados |
| F4 — Registrar ocorrência | Localização manual no mapa, categoria, descrição e foto opcional |
| F5 — Confirmar ocorrência | Confirmação única por conta |
| F6 — Acrescentar informação | Contribuições textuais nos detalhes |
| F7 — Analisar e encaminhar | Análise, transferência entre setores e encerramento justificado |
| F8 — Registrar atendimento | Início do atendimento e resolução com providência |
| F9 — Registrar histórico | Eventos automáticos com autor e data |
| F10 — Consultar acompanhamento | Detalhes, situação, histórico e registros da conta |
| F11 — Configurar manutenção | Setores, categorias e vínculos de responsáveis (administração) |
| F12 — Consultar estatísticas | Quantidades por período e tempo médio de resolução |
| F13 — Consultar demandas do setor | Fila restrita aos setores vinculados |

## Tecnologias

- **Frontend** (`web/`): JavaScript sem framework, empacotado com Vite. Mapa com Leaflet, cartografia OpenStreetMap e Esri World Imagery, e nomes de locais pelo Photon.
- **API** (`server/`, `api/index.ts`): Node.js 24, TypeScript, Hono e Zod, publicada como função da Vercel.
- **Dados** (`supabase/`): Supabase Auth, PostgreSQL 17 com RLS e funções restritas, e Storage privado para fotos.
- **Qualidade**: Vitest, Playwright, testes SQL/RLS/concorrência, Prettier e GitHub Actions (CI/CD).

## Início rápido

Requisitos: Node.js 24, Docker em execução e Python 3.

```bash
npm ci
npm run db:start          # Supabase local; mostra URL e chaves
cp .env.example .env.local # preencha com os valores do passo anterior
npm run db:reset          # aplica as migrações no banco local
npm run dev               # frontend (Vite) + API
```

O guia completo, que inclui o primeiro administrador, a publicação na Vercel e no Supabase, o CI/CD e a API, está em [docs/EXECUCAO.md](docs/EXECUCAO.md). As contas de demonstração estão em [docs/CONTAS_TESTE.md](docs/CONTAS_TESTE.md).

## Testes

```bash
npm run format:check
npm run typecheck
npm test                 # unitários da API (Vitest)
npm run test:db          # SQL, RLS e concorrência em PostgreSQL descartável
npm run test:integration # integração com o Supabase local
npm run test:e2e         # navegador (Playwright)
npm run build
```

## Estrutura do repositório

```
api/         entrada serverless da Vercel
server/      API (Hono): rotas, validação e acesso ao Supabase
web/         frontend (Vite); web/public tem estilos, mapa e assets
supabase/    configuração, migrações e seed do banco
tests/       testes de API, banco, integração e navegador
scripts/     utilitários de operação (limpeza de fotos órfãs)
docs/        documentação técnica do produto
entregas/    entregas da disciplina (proposta, F1, F2…), incluindo o protótipo da F2
```

## Documentação

- [docs/](docs/README.md): execução, publicação, contas de teste, desempenho e arquitetura.
- [entregas/](entregas/README.md): documentos entregues em cada fase da disciplina.
