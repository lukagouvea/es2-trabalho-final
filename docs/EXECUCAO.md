# Executar e publicar o Campus em dia

A aplicação conectada implementa os fluxos F1–F13 com uma API na Vercel e serviços Supabase. O protótipo navegável entregue na F2 está arquivado em [`entregas/F2-prototipo-apf/prototipo/`](../entregas/F2-prototipo-apf/prototipo/) e não faz parte da aplicação nem do CI. A versão conectada usa contas reais e não importa os dados do protótipo.

## Desenvolvimento

Requisitos: Node.js 24 (`nvm install && nvm use`), npm, Docker em execução e Python 3 para o teste de concorrência do banco (`test:db`).

```bash
npm ci
npm run db:start
```

O Supabase CLI apresenta a URL e as chaves da instância local. Copie `.env.example` para `.env.local` e preencha `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e as respectivas variáveis `VITE_` com os mesmos valores. A chave `anon` local pode ser usada como chave publicável. Nunca coloque `service_role` ou chave secreta nas variáveis `VITE_`.

```bash
npm run db:reset
npm run dev
```

Abra o endereço informado pelo Vite (por padrão http://127.0.0.1:5173; se estiver ocupado, ele informa outra porta). A API local usa a porta 3001. `db:reset` apaga somente o banco Supabase local e reaplica as migrações; não é um comando para uma base com dados que devam ser preservados.

O cadastro entra imediatamente, sem confirmação inicial de e-mail. Novas contas sempre são membros. Atualização de e-mail pode depender das configurações de confirmação do Supabase Auth; a tela informa quando houver uma confirmação pendente.

## Primeiro administrador

Cadastre a conta normalmente. No SQL Editor do projeto correspondente, consulte o UUID e promova somente a conta desejada:

```sql
select id, email from auth.users order by created_at desc;
insert into public.admin_roles (user_id) values ('UUID-DA-CONTA') on conflict do nothing;
```

Saia e entre novamente. A administração permite configurar setores, categorias e vínculos. O administrador precisa também estar vinculado a um setor para atender suas ocorrências.

## Verificação

```bash
npm run typecheck
npm test
npm run test:db
npm run test:integration
npm run test:e2e
npm run build
```

`test:db` cria um PostgreSQL 17 isolado com schemas mínimos de Auth/Storage e testa SQL/RLS/transações; não testa os serviços HTTP do Supabase. Os testes integrados devem usar a instância Supabase local completa. O teste de navegador usa contratos HTTP simulados para verificar a interface. Os testes de navegador usam o Chrome instalado em `/opt/google/chrome/chrome`; configure `CAMPUS_CHROME` para outro caminho. Tiles e Photon são simulados nos testes.

## Supabase publicado

Crie um projeto dedicado e mantenha ambientes de teste e produção separados. Vincule o CLI ao projeto correto e examine as migrações antes de aplicá-las. Não execute reset em uma base remota.

```bash
npx supabase login
npx supabase link --project-ref REFERENCIA-DO-PROJETO
npx supabase db push --remote --dry-run
npx supabase db push --remote
```

Em Authentication, habilite cadastro por e-mail/senha e desabilite a confirmação inicial de e-mail, conforme a decisão do projeto. Configure Site URL e URLs de redirecionamento com o endereço publicado. As migrações criam o bucket privado `occurrence-photos`, as políticas e a configuração inicial de setores/categorias. Não criam contas ou ocorrências fictícias.

## Vercel

Importe este repositório com a raiz do projeto atual. O projeto usa Node.js 24, build `npm run build`, saída `dist` e configuração de rotas em `vercel.json`.

Configure as quatro variáveis de URL/chave publicável usadas localmente, agora apontando para o projeto Supabase publicado. A URL e a chave publicável podem estar no frontend; permissões são garantidas por RLS e funções de banco. O backend usa a identidade de cada usuário e não precisa de chave administrativa.

Previews devem apontar para um projeto de teste. Depois da publicação, confira entrada, mapa, registro com foto e consulta em outra sessão. A publicação e as migrações remotas não são executadas pelos comandos de teste.

## Fotos sem registro

O comando de limpeza lista objetos com mais de 24 horas sem ocorrência associada. Use uma chave secreta exclusivamente no ambiente do operador:

```bash
npm run uploads:clean
npm run uploads:clean -- --apply
```

A primeira execução só mostra uma prévia. A remoção exige `--apply`. O script usa a API de Storage; não remove diretamente linhas de `storage.objects`.

## Comportamentos de negócio

Ocorrências seguem Registrada → Em análise → Em andamento → Resolvida. Registros em Registrada ou Em análise podem ser encerrados com justificativa ou transferidos com motivo. Resolução e encerramento são finais. Confirmações e contribuições continuam disponíveis. O autor não pode confirmar a própria ocorrência; somente outras contas podem acrescentar uma confirmação.

Mudanças da categoria afetam novos registros. Ocorrências existentes conservam seu setor até uma transferência explícita. Um setor com categorias ativas ou demandas abertas não pode ser desativado. Estatísticas usam o calendário de São Paulo; quantidades consideram criação e a média considera resolução no período.

A área geográfica é a referência aproximada do protótipo, não a divisa cadastral oficial da UFV. O sistema acadêmico não é um serviço oficial da universidade.

## API

`GET /api/bootstrap` reúne perfil e catálogo na inicialização. O frontend mantém contexto e telas por até 30 segundos somente em memória, invalida depois de alterações e limpa tudo ao trocar de conta. A função está configurada em Portland (`pdx1`), junto da região do banco hospedado atual (`us-west-2`); se o projeto de banco mudar de região, ajuste `regions` em `vercel.json`.

Todas as rotas de negócio exigem `Authorization: Bearer <access_token>`. Somente `GET /api/health` é público. Os contratos estão no [desenho do backend](arquitetura/backend-design.md). JSON usa camelCase; listagens retornam `{ items, nextCursor }`. O UUID `id` identifica o registro e `number` é o número exibido da ocorrência.

`GET /api/occurrences` aceita `q`, `categoryId`, `sectorId`, `status`, `scope`, `cursor` e `limit` (padrão 50, máximo 100). `status=ativas` reúne registrada, análise e andamento. `scope` aceita `all`, `authored`, `confirmed` e `assigned`. Estatísticas aceitam `from` e `to` no formato `YYYY-MM-DD`, com dias inclusivos no calendário de São Paulo.

Envios de ocorrências e contribuições usam `requestId` UUID. Repetir a mesma chave e conteúdo retorna o registro persistido. Conteúdo diferente com a mesma chave retorna conflito. Transições e transferências incluem `expectedStatus` e `expectedSectorId`; conflito exige atualizar o detalhe antes de decidir novamente.

Erros seguem `{ error: { code, message, fields? } }`. As respostas privadas não são armazenadas em cache HTTP. A API não aceita autor, privilégios ou datas definidos pelo navegador.

### Configuração desta máquina

O frontend local usa http://127.0.0.1:5197 e a API usa a porta 33101, pois 5173 e 3001 já estavam ocupadas. As portas estão em `.env.local`. O Studio está em http://127.0.0.1:55323. Para iniciar novamente: `npm run db:start` e `npm run dev`, com Node24 ativo.

O armazenamento padrão do Docker está em um filesystem sem permissões Unix. O volume `supabase_db_campus-em-dia` foi configurado como bind para `.local/supabase-postgres` no projeto, em filesystem Linux. Essa pasta contém os dados persistidos, está ignorada pelo Git e deve ser preservada.

Os testes de integração escolhem explicitamente a categoria Iluminação para relatos de luminárias e removem suas próprias contas, ocorrências, contribuições, confirmações e eventos ao terminar, inclusive em falhas. Precisam de acesso PostgreSQL local; a URL padrão é `postgresql://postgres:postgres@127.0.0.1:55322/postgres`, substituível por `CAMPUS_TEST_DATABASE_URL` (somente localhost).

## CI/CD com GitHub Actions

A branch de produção é `master`. O workflow **CI** roda em PRs para essa branch e também é reutilizado pelo **CD** após cada push/merge nela. Os jobs de qualidade/build, banco/integração e navegador executam em paralelo. O check **CI aprovado** exige sucesso de todos eles, inclusive quando algum job falha, é cancelado ou é ignorado. Novos commits cancelam os jobs antigos do mesmo PR.

Os runners usam Ubuntu 24.04, Node.js 24 da `.nvmrc`, `npm ci` e cache do npm. O CI executa formatação, tipos, testes unitários, build, SQL/RLS/concorrência, integração com Supabase local e E2E. A build de validação usa configuração pública fictícia. As suítes de banco usam instâncias descartáveis locais; nenhuma conta hospedada é usada. O Chromium é instalado pelo Playwright e seu caminho é passado por `CAMPUS_CHROME`. Relatórios, screenshots e traces de falha ficam nos artefatos do job Navegador por sete dias.

### Ativação no GitHub e na Vercel

Antes do primeiro merge que habilita o CD, suspenda a promoção automática em produção na Vercel (Production → desativar automatic aliasing). Isso evita publicação antes de cadastrar o check obrigatório. Mantenha a integração Git conectada e a branch de produção como `master`.

1. No GitHub, em Settings → Environments, crie `production`, permita somente `master` como deployment branch e não configure aprovação manual.
2. Nesse environment, adicione os secrets `SUPABASE_ACCESS_TOKEN` (token do operador autorizado) e `SUPABASE_DB_PASSWORD` (senha PostgreSQL do projeto). Adicione a variável `SUPABASE_PROJECT_ID` com a referência do projeto de produção. Nunca coloque essas credenciais no código ou nas variáveis `VITE_`.
3. Antes de habilitar migrações automáticas, execute `supabase migration list --remote` em um checkout vinculado ao projeto correto e confira o histórico contra as migrações versionadas. Se houver divergência ou esquema aplicado manualmente sem histórico, resolva-a antes da ativação; o workflow não executa `migration repair`, reset remoto nem reaplicação forçada.
4. Após uma execução do CI em PR, em Settings → Rules → Rulesets (ou Branch protection), exija PR, branch atualizada e o check **CI aprovado** na `master`. Inclua administradores na proteção. Não exija o check de migração no PR: ele só existe no CD.
5. Após o primeiro CD registrar o check, na Vercel, em Deployment Checks → Add Checks → GitHub, selecione **Produção pronta**, originado do workflow CD. Ative novamente automatic aliasing somente com esse check obrigatório configurado. Crie um novo deployment e confirme que aguarda o check antes da promoção.

A configuração desses painéis e dos secrets é necessária: apenas adicionar os arquivos YAML não impede a integração Git da Vercel de publicar imediatamente. O Actions não precisa de token da Vercel, pois a integração nativa continua responsável pela build e publicação com as variáveis de produção já configuradas nela.

### Ordem da liberação e falhas

O CD valida o commit da `master`, executa `supabase link`, uma prévia `db push --remote --skip-vault --dry-run` e então `db push --remote --skip-vault --yes`. Apenas migrações pendentes são aplicadas; seeds locais, configurações de Auth e segredos do Vault não são enviados por essa etapa. O check **Produção pronta** só passa após validação e migração bem-sucedidas. A Vercel pode construir em paralelo, mas deve aguardar esse check antes de promover.

O CD permite uma execução ativa e uma pendente; novos pushes podem substituir a pendente. Migrações iniciadas não são canceladas. Antes de migrar e antes de liberar, o workflow confere se o commit ainda é o atual da `master`; execuções obsoletas falham e não liberam publicação.

Falhas de testes bloqueiam a migração. Falhas de migração ou credenciais ausentes bloqueiam a promoção. Consulte o job que falhou e reexecute os jobs necessários após corrigir a causa. O CLI mantém o histórico das migrações concluídas. Migrações novas precisam ser compatíveis com a aplicação ainda publicada: uma falha posterior na Vercel não desfaz o banco. Recupere alterações de esquema com nova migração revisada; não faça reset remoto. O rollback da aplicação na Vercel também precisa ser compatível com o esquema atual.

Para validar a ativação, use um PR temporário com falha de teste e confirme bloqueio do merge. Depois, em merge sem mudança funcional, confira testes, migrações, espera pela promoção, SHA publicado e `GET /api/health`. Confirme que uma falha de migração impede a promoção antes de considerar a automação ativa; não introduza migração inválida deliberadamente no banco de produção.
