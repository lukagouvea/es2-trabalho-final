# Campus em dia — backend e persistência

Data: 15/11/2026. Estado: desenho aprovado; implementação autorizada.

## Objetivo e decisões fornecidas

Transformar as funcionalidades F1–F13 do protótipo em uma aplicação com contas reais, dados compartilhados entre dispositivos e autorização no servidor e no banco.

O usuário escolheu Vercel para frontend e backend e Supabase para banco de dados. Confirmou que a disciplina não exige linguagem ou framework. A entrega passa a incluir a aplicação web; a referência a “somente Android” nos documentos de concepção deverá ser atualizada, preservando o contexto histórico do protótipo.

## Escolhas técnicas propostas

Escolhas técnicas aprovadas para implementação:

- Preservar HTML, CSS, JavaScript, Leaflet e os fluxos do frontend existente. Adicionar Vite para empacotar as dependências e gerar os arquivos estáticos, sem migrar para React ou Next.js.
- Implementar a API HTTP em Node.js e TypeScript, com uma entrada compartilhada em `api/index.ts` e módulos fora de `api/`. Configurar rewrites de `/api/*` para essa função na Vercel.
- Publicar frontend e API no mesmo projeto e domínio da Vercel. O frontend usa URLs relativas `/api/...`.
- Usar Supabase Auth para cadastro, entrada, atualização de e-mail e renovação de sessão. Usar PostgreSQL para dados de negócio e Supabase Storage para fotos.
- Usar `@supabase/supabase-js` para comunicação com Supabase e validação de entrada na API. Migrações SQL versionadas serão a fonte do esquema e das regras transacionais; não adicionar um ORM.
- Consultas e operações de negócio passam pela API na Vercel. Autenticação e upload de fotos usam os serviços do Supabase diretamente, com autorização própria.

O backend não depende de memória de processo nem do sistema de arquivos para persistir dados. O SDK acessa a Data API/RPC do Supabase por HTTPS, sem manter conexões PostgreSQL nas funções da Vercel.

## Escopo funcional

| Requisito | Resultado esperado |
| --- | --- |
| F1 | Cadastrar conta e atualizar o próprio nome/e-mail. |
| F2 | Entrar, manter sessão e sair usando Supabase Auth. |
| F3 | Consultar mapa/lista, busca e filtros combinados de categoria, situação e setor. |
| F4 | Registrar descrição, categoria, coordenadas, nome do local, referência e uma foto opcional. |
| F5 | Confirmar uma ocorrência uma única vez por conta. |
| F6 | Publicar informações complementares textuais. |
| F7 | Iniciar análise, transferir e encerrar com justificativa. |
| F8 | Iniciar atendimento e registrar resolução com providência. |
| F9 | Gerar histórico automaticamente e impedir edição por usuários. |
| F10 | Consultar detalhes, histórico, próprias ocorrências e confirmações. |
| F11 | Criar/editar/desativar setores e categorias e gerenciar vínculos de responsáveis. |
| F12 | Consultar quantidades e tempo médio de resolução por período. |
| F13 | Consultar a fila dos setores aos quais a conta está vinculada. |

Não acrescentar reabertura, retirada de confirmação, edição/exclusão do relato original, autenticação institucional, notificações, funcionamento offline ou APK nesta entrega.

## Regras adotadas a partir do protótipo

O arquivo [Regras_de_Negocio_Pendentes_Grupo5.md](../../entregas/F1-concepcao/Regras_de_Negocio_Pendentes_Grupo5.md) distingue hipóteses de decisões validadas. Para implementar esta versão, propõe-se adotar os comportamentos já presentes no protótipo, sem apresentá-los como decisões de setores reais da UFV:

1. Uma conta pode ser responsável por vários setores e cada setor pode ter vários responsáveis.
2. Cadastro sempre cria membro. Privilégios administrativos ficam separados dos vínculos de atendimento. Administrador só atende se tiver vínculo com o setor atual.
3. A categoria ativa determina o setor inicial ativo, consultado no banco durante o registro. Alterar essa associação só afeta novas ocorrências.
4. Cada ocorrência tem exatamente um setor atual. Transferência exige vínculo com o setor de origem, destino ativo e motivo entre 10 e 1.500 caracteres. Só ocorre nas situações `registrada` e `analise` e preserva a situação.
5. Transições permitidas: `registrada → analise`, `registrada → encerrada`, `analise → andamento`, `analise → encerrada`, `andamento → resolvida`. As demais são recusadas.
6. Resolução e encerramento exigem texto entre 10 e 1.500 caracteres e são finais. Notas de início de análise/atendimento são opcionais, com limite de 1.500 caracteres.
7. Confirmações e contribuições continuam disponíveis em ocorrências finais. O autor não pode confirmar a própria ocorrência; essa restrição é aplicada no banco e na interface, conforme a revisão solicitada em 16/11/2026. Não existe quantidade fictícia de confirmações na aplicação real.
8. Desativação preserva referências. Um setor com categorias ativas ou ocorrências abertas não pode ser desativado. Remover vínculo impede novas ações daquele responsável, sem apagar seu histórico.
9. Nomes de setores e categorias são únicos em seus respectivos conjuntos, sem diferenciar maiúsculas de minúsculas. Setor inativo não recebe novas categorias nem novos vínculos; um vínculo antigo pode ser removido.
10. Toda consulta de negócio exige conta autenticada. A comunidade pode consultar ocorrências de todos os setores; o filtro de fila de atendimento usa exclusivamente os vínculos da conta autenticada.
11. Nome do autor aparece nas ocorrências, contribuições e histórico. E-mails de outros usuários só ficam disponíveis na administração para gerenciar vínculos; a própria conta consulta seu e-mail pelo Auth.

## Dados e integridade

As tabelas de negócio usam UUID, chaves estrangeiras e timestamps `timestamptz` gerados no servidor. Um número sequencial adicional identifica visualmente cada ocorrência; nunca calcular `max + 1` no cliente. O título continua derivado da primeira frase da descrição, com o mesmo limite visual do protótipo.

| Tabela | Conteúdo e restrições principais |
| --- | --- |
| `profiles` | `id` referenciando `auth.users.id`, nome de 3–80 caracteres e datas. Sem senha ou e-mail copiados. Perfil criado por trigger no cadastro, ignorando qualquer perfil privilegiado enviado em metadados. |
| `admin_roles` | `user_id` único; concessão/revogação só por operação administrativa confiável fora da API pública desta versão. |
| `sectors` | Nome de 3–80 caracteres, descrição de até 300 e indicador de ativo. |
| `categories` | Nome de 3–60 caracteres, setor de destino, ativo e ícone em lista permitida. Cor derivada do ícone pelo frontend. |
| `sector_memberships` | Par único `(user_id, sector_id)` e data; alterações apenas por administrador. |
| `occurrences` | Número, autor, categoria, setor atual, situação, descrição de 10–1.500 caracteres, nome do local e referência de até 160, latitude/longitude, origem do nome, metadados opcionais, caminho da foto e datas de criação/resolução/atualização. |
| `confirmations` | Par único `(occurrence_id, user_id)` e data. Repetição não aumenta a quantidade. |
| `contributions` | Ocorrência, autor, texto de 5–1.500 caracteres e data. Sem alteração/exclusão pelo usuário. |
| `occurrence_events` | Ocorrência, autor, tipo, situação anterior/nova, setor anterior/novo, texto e data. Somente inserção por operações internas do banco. |

Índices cobrem chaves estrangeiras, situação/setor/data de criação, autoria, confirmações por usuário e data de resolução. Listagens têm ordenação determinística por data e UUID, tamanho padrão de 50 e máximo de 100, com cursor e indicação de continuação. A busca textual simples pode usar `ILIKE`; otimizações adicionais ficam a cargo do implementador conforme o volume real.

Mapa e lista carregam páginas até completar os resultados do filtro, sem limitar silenciosamente a primeira página. Detalhes, contribuições e histórico são buscados sob demanda; a lista não carrega todas as fotos, e-mails ou eventos do banco. Estatísticas agregam no banco, independentemente da paginação.

O banco valida latitude entre -20.774 e -20.750 e longitude entre -42.879 e -42.853, como a área aproximada atual. Não representa a divisa cadastral da UFV. Nome sugerido pelo Photon pode ser corrigido e não altera as coordenadas. Metadados do geocodificador são informativos, têm tamanho limitado e não concedem confiança adicional ao ponto. Falha no Photon mantém o registro por coordenadas disponível.

## Autenticação, autorização e transações

- O frontend usa o SDK oficial para cadastro, entrada e sessão; remove a derivação local de senhas e os atalhos de troca de perfil na versão real.
- O backend recebe `Authorization: Bearer <access_token>`, valida o token com Supabase Auth e cria cliente por requisição com a identidade do usuário. Não aceitar autor, cargo, vínculos, situação inicial ou data enviados pelo navegador como autoridade.
- Habilitar RLS em todas as tabelas expostas e configurar também grants de tabelas/funções. O papel anônimo não acessa os dados de negócio. Acesso com identidade autenticada preserva RLS; não usar chave com bypass de RLS no fluxo normal.
- Escritas de negócio usam funções SQL específicas: registro, confirmação, contribuição, transição, transferência, configuração e vínculos. Revogar escrita direta para impedir a omissão de validações ou histórico. Essas funções verificam `auth.uid()`, perfil e vínculos no banco.
- Funções que precisarem de `security definer` usam `search_path` explícito, referências qualificadas e permissão de execução restrita. Helpers de privilégios ficam em esquema não exposto.
- Alteração e evento de histórico pertencem à mesma transação. Falha no evento reverte a alteração. Histórico registra criação, contribuições, confirmações, transições e transferências, com autor e horário obtidos no banco.
- Transições/transferências recebem situação e setor esperados e bloqueiam a ocorrência durante a alteração. Se outro responsável já modificou o registro, responder conflito e oferecer recarga, sem sobrescrever a decisão.
- Criar ocorrência e desativar/reassociar categorias/setores usam bloqueios consistentes para impedir registro em setor inativo ou desativação concorrente com uma nova demanda.

E-mail é gerenciado pelo Supabase Auth. Cadastro e alteração de e-mail tratam explicitamente confirmação pendente, sem informar sucesso de login antes de existir sessão. Decisão do usuário em 15/11/2026: cadastro com entrada imediata, sem confirmação inicial de e-mail; configurar o Auth local e publicado dessa forma. O nome pode ser salvo separadamente; se a atualização de e-mail falhar ou ficar pendente, a interface informa o estado de cada operação. Recovery de senha fica fora da primeira entrega, pois não existe no protótipo.

## Fotos

Usar bucket privado `occurrence-photos`, com JPG, PNG e WebP e máximo de 2 MB por objeto. Não guardar base64 no PostgreSQL nem encaminhar a imagem como JSON pela função da Vercel.

O frontend envia a foto ao Supabase Storage antes de concluir o registro, em caminho único sob o UUID do usuário. Policies permitem inserir somente no próprio diretório, impedem sobrescrita e impedem apagar imagens já vinculadas. A função de registro aceita apenas um caminho pertencente à conta, verifica existência/metadados/tamanho/tipo do objeto e impede vincular o mesmo objeto a várias ocorrências. Conteúdo deve ser tratado como imagem não confiável; SVG não é aceito.

Após o registro, leitura da imagem requer usuário autenticado com acesso à ocorrência. O backend fornece URL assinada de curta duração para a tela de detalhes. Se a publicação falhar, o frontend mantém o formulário e tenta remover o objeto ainda não vinculado. Disponibilizar comando de limpeza de objetos não vinculados com mais de 24 horas, com prévia e uso explícito do operador; não criar rotina destrutiva automática.

## Contrato HTTP proposto

Além de um endpoint de saúde que não revela segredos, todas as rotas abaixo exigem autenticação:

| Método e caminho | Finalidade |
| --- | --- |
| `GET /api/me` | Próprio perfil, indicador administrativo e vínculos atuais. |
| `PATCH /api/me` | Atualizar o próprio nome; e-mail é alterado pelo SDK de Auth. |
| `GET /api/catalog` | Setores e categorias, inclusive inativos necessários a referências históricas. |
| `GET /api/occurrences` | Busca, filtros, cursor e escopos `all`, `authored`, `confirmed`, `assigned`. |
| `POST /api/occurrences` | Criar ocorrência; suporta UUID de requisição para repetição segura do envio. |
| `GET /api/occurrences/:id` | Detalhes e quantidades; foto assinada quando existir. |
| `GET /api/occurrences/:id/events` | Histórico paginado em ordem cronológica determinística. |
| `GET /api/occurrences/:id/contributions` | Contribuições paginadas. |
| `POST /api/occurrences/:id/confirmations` | Confirmação idempotente da própria conta. |
| `POST /api/occurrences/:id/contributions` | Acrescentar informação; suporta UUID de requisição. |
| `POST /api/occurrences/:id/transitions` | Alterar situação com nota e estado esperado. |
| `POST /api/occurrences/:id/transfers` | Transferir com motivo e setor/situação esperados. |
| `GET /api/statistics` | Agregados por período; intervalos por dia em `America/Sao_Paulo`. |
| `GET /api/admin/users` | Buscar contas e vínculos com paginação; e-mails disponíveis só a administradores. |
| `POST /api/admin/sectors` / `PATCH /api/admin/sectors/:id` | Criar/alterar/desativar setor. |
| `POST /api/admin/categories` / `PATCH /api/admin/categories/:id` | Criar/alterar/desativar categoria. |
| `PUT /api/admin/users/:id/sectors` | Substituir vínculos em uma transação. |

UUID de requisição de criação/contribuição é único por autor/operação; repetir o mesmo pedido devolve o registro existente. Reutilizar UUID com conteúdo diferente retorna conflito. Método incompatível retorna 405 e rota desconhecida retorna 404.

Erros seguem `{ error: { code, message, fields? } }`, com 400 para entrada inválida, 401 para sessão ausente/inválida, 403 para acesso proibido, 404 para inexistente e 409 para conflito de regra/concorrência. Não devolver detalhes internos do SQL, tokens ou stack traces. A UI mostra carregamento, preserva formulários em falhas e só confirma alterações persistidas. Sem fallback automático para dados de demonstração se a API estiver indisponível.

## Estatísticas e atualização dos dados

Contagens por situação, categoria e setor consideram ocorrências criadas no período e sua classificação/situação atual, como no protótipo. O tempo médio considera as ocorrências resolvidas no período, inclusive criadas antes dele, calculando `resolved_at - created_at`. Datas de início/fim são inclusivas no calendário de São Paulo, implementadas como intervalo UTC semiaberto; período inválido é recusado. Sem resoluções, a média é nula.

Substituir a data fixa de outubro por períodos relativos à data atual. Atualizar consultas ao abrir uma tela, voltar ao foco e concluir uma operação. A primeira entrega não exige Realtime nem atualização contínua em segundo plano; outra sessão vê as alterações ao renovar a consulta. Não depender de dados globais carregados somente na entrada.

## Transição do protótipo e configuração

Manter o protótipo local para apresentação em caminho separado, sem permitir que seus botões alterem dados remotos. A aplicação real reutiliza seus componentes e fluxos visuais, abre na entrada quando não há sessão e não oferece “Restaurar demonstração” nem login automático. Não migrar automaticamente senhas, contas, fotos ou registros do `localStorage` para a base remota.

Migrações e seed inicial criam apenas os quatro setores e categorias demonstrativos atuais, claramente descritos como configuráveis. O projeto não inicia com usuários ou ocorrências fictícias em produção. Testes usam fixtures isoladas.

Criar a primeira conta pelo cadastro normal e promover seu UUID por SQL executado pelo operador no Supabase. A documentação fornece o comando e explica como verificar a promoção. A API pública não permite concessão de administrador nem permite cadastro com esse privilégio. Gestão de vínculos de atendimento permanece na aplicação.

Fornecer `.env.example` sem credenciais, comandos de instalação/desenvolvimento/build/testes, migrações, documentação das rotas e instruções de configuração de Auth, bucket, primeiro administrador e Vercel. URL e chave publicável do Supabase são configuração pública; eventuais chaves secretas de operação ficam fora do bundle e do controle de versão.

A entrega de código não depende de acesso às contas externas. Criar projeto Supabase, aplicar migrações remotas e publicar na Vercel requerem acesso ao projeto correspondente. Nesta solicitação o usuário expressou intenção de hospedar; preparar o deploy, sem publicar nem alterar um banco remoto ainda não identificado.

## Verificação e critérios de entrega

1. Testes de banco em instância local/isolada validam migrações, RLS, ausência de autoelevação, sigilo de e-mails, confirmação única, restrições de localização, integridade do histórico, transições, transferências, desativação e concorrência.
2. Testes da API validam autenticação, autorização, dados inválidos, paginação, idempotência, conflitos e agregações por período.
3. Verificar Storage com contas diferentes: diretório alheio, objeto inexistente, tamanho/tipo inválidos, imagem vinculada e limpeza de upload sem registro.
4. Fluxos de navegador com contas isoladas percorrem cadastro/entrada, mapa/filtros, registro com foto, colaboração, acompanhamento, manutenção, administração, conta e estatísticas. Uma segunda sessão confirma persistência compartilhada. Não usar o Supabase de produção nos testes.
5. Continuar rodando as verificações atuais de localização no protótipo preservado; tiles e Photon ficam simulados nos testes automatizados.
6. Executar checagem de tipos, testes e build. Verificar a configuração do roteamento estático/API para Vercel. Informar separadamente o que foi testado localmente e o que exige configuração/validação remota.

Fica a cargo do implementador escolher nomes internos dos módulos, biblioteca de testes, mecanismo de fixtures, detalhes de paginação de cursores e versão estável compatível das dependências, com lockfile. Alteração material de escopo ou das regras acima exige atualizar este documento.

## Fontes técnicas

- [Vercel: runtime Node.js, TypeScript e entrada compartilhada de API](https://vercel.com/docs/functions/runtimes/node-js).
- [Supabase: autenticar o token com getUser](https://supabase.com/docs/reference/javascript/auth-getuser).
- [Supabase: RLS, grants e chaves que podem ignorar políticas](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [Supabase: controle de acesso do Storage](https://supabase.com/docs/guides/storage/security/access-control).
