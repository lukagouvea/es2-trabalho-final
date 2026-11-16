# Investigação de desempenho — 16/11/2026

## Medição da versão publicada antes da correção

Origem: https://campus-em-dia.vercel.app/ com conta de demonstração administrativa existente, navegador Chrome em 1280×720, sem alterar registros de negócio. Valores desta sessão, sem simulação de rede; não representam uma garantia de latência para todas as máquinas.

| Operação | Tempo observado |
| --- | --- |
| Mapa inicial pronto | 2479 ms |
| Largest Contentful Paint inicial | 2256 ms |
| Navegar para Conta | 1304 ms |
| Navegar para Panorama | 1799 ms |
| HTML estático em duas consultas HTTP | 21–93 ms |
| `/api/health` | 149–168 ms |
| `/api/me` | 824–833 ms |
| `/api/catalog` | 788–881 ms |
| Listagem de ocorrências | 433–564 ms |
| Estatísticas | 676–803 ms |
| Listagem administrativa de usuários | 852–1073 ms |

Os cabeçalhos mostravam execução da função em `iad1`; o painel autenticado do Supabase confirmou banco em `us-west-2`. As consultas de perfil/catálogo eram repetidas em toda navegação e concluídas antes de começar a consulta da própria tela. As fontes TTF totalizavam 1314400 bytes.

## Correções

- Configuração da função em `pdx1`, região da Vercel correspondente a `us-west-2`, aproximando API e banco. Só entra em vigor após um novo deploy.
- `GET /api/bootstrap` reúne perfil, privilégios, vínculos e catálogo com uma autenticação e cinco leituras paralelas. `/api/me` e `/api/catalog` continuam disponíveis.
- Listagem/detalhe incorporam a confirmação da própria conta por relacionamento filtrado à esquerda. Não fazem uma consulta posterior por lista de IDs e não excluem ocorrências sem confirmação. Campos internos de idempotência/metadados não são baixados pelo backend nessa consulta.
- Contexto e telas reutilizados por até 30 segundos apenas em memória, por sessão, com limite de 50 consultas distintas. Conta, formulário e telas recentes não aguardam consultas repetidas. Bootstrap e consulta da tela começam em paralelo; alterações invalidam o cache, inclusive quando a resposta se perde. Sair ou trocar de conta aborta e limpa os dados; respostas antigas não invalidam a sessão nova.
- Fontes Lato em WOFF2, com subconjunto latino e caracteres portugueses/pontuação verificados: Regular 73376 bytes, Bold 71348 bytes (144724 no total, redução de aproximadamente 89%). Preload permite descobrir as fontes antes da leitura do CSS. Originais e licença permanecem disponíveis no projeto.

Autenticação e RLS continuam aplicadas no servidor em cada requisição. Nenhum cache HTTP público de dados de usuários foi adicionado.

## Validação

A integração real local verifica confirmação de outra conta, listagem sem confirmação, totais independentes da confirmação da própria conta e filtro de confirmadas. O ganho de região precisa de medição depois da publicação; esta investigação não afirma um novo LCP de produção antes desse deploy.

Verificação antes de publicar:27 casos Vitest de API/utilitário,27 testes de navegador (incluindo expiração, chaves de consulta, invalidação e sessão nova),4 casos integrados com Supabase local real, checagem de tipos e build passaram. Uma condição de corrida encontrada na revisão foi reproduzida e corrigida: respostas de alterações da sessão anterior não invalidam o carregamento da nova conta.
