# Implementação aprovada — Campus em dia

Referência: ../specs/2026-11-15-backend-supabase-design.md e plano aprovado na conversa.

## Decisões

Aplicação integrada F1–F13. Cadastro imediato sem confirmação inicial. Node24, TypeScript, Hono, Zod, Vite, Supabase SDK. Protótipo preservado; sem deploy remoto nesta execução.

## Etapas

- [x] Estrutura executável e ambiente local.
- [x] Contas e autorização.
- [x] Catálogo e ocorrências.
- [x] Fotos privadas.
- [x] Colaboração e acompanhamento.
- [x] Atendimento e administração.
- [x] Estatísticas e atualização das telas.
- [x] Verificações e documentação de publicação.

## Registro de execução

Ruling: trabalhar no diretório fornecido — .git tem acesso somente leitura e o usuário autorizou a implementação nesta workspace; não criar branches ou commits.
Ruling: decompor banco/API/frontend entre agentes com ownership separado e contratos explícitos, conforme skill subagent-driven-development, para executar o projeto completo.

Ruling: validar banco com assertivas SQL e sessões concorrentes em PostgreSQL17 isolado, em vez de pgTAP, mantendo teste real de RLS/transações.

Verificações: typecheck, build configurado, 21 testes Vitest, SQL/RLS/concorrência e 15 grupos de fluxos +7 de localização do protótipo passaram. Revisão independente sem pendências materiais após correções.

Limitação: integração HTTP real Auth/Storage não executada; imagens da pilha completa esgotaram disco. Artefatos de download da tarefa removidos. Deploy Vercel não realizado. Testes de navegador da versão conectada usam fixtures HTTP.

Verificação final: `format:check`, `typecheck`, `npm test` (21 testes), build com configuração pública de teste e `test:e2e` (9 fluxos com HTTP simulado) passaram. QA visual em desktop/celular; filtros móveis recolhíveis. Revisão independente final confirmou correções sem achados materiais restantes. `test:db` passou com migrações, permissões, fotos e concorrência; `test:prototype` passou com15 grupos de fluxos e7 de localização. Integração HTTP real e roteamento em deploy Vercel continuam sem verificação externa.

## Revisão de 16/11/2026

Nova regra solicitada: autor não confirma a própria ocorrência. Migração `202611160001_prevent_self_confirmation.sql` aplicada ao banco local; interface bloqueia a ação. Contagens antigas de autoconfirmação foram removidas. Cartão selecionado permanece inteiro acima da navegação nos tamanhos testados (1280×720,390×844,390×667); singular/plural corrigidos; média inferior a uma hora exibe minutos.

Dados locais: ocorrência1 preservada, reatribuída à conta comunidade e corrigida para Iluminação/Manutenção elétrica. Duas contas Integration User removidas; permanecem7 contas de demonstração. Integração agora cria autor e testemunha, escolhe categoria explicitamente e remove suas próprias fixtures em afterAll transacional, inclusive em falhas.

Verificação desta revisão:22 testes Vitest,18 cenários de navegador,3 testes integrados com Supabase local real, suíte PostgreSQL isolada, typecheck e build passaram. Confirmado zero contas integration e zero confirmações do próprio autor após rodar os testes. Revisão independente sem achados materiais; orientação horizontal de pouca altura não integra a geometria coberta nesta rodada.
