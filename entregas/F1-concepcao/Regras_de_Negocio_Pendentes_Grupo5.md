# Decisões e regras pendentes — Grupo 5

**Data:** 04/10/2026  
**Referência:** [Concepção inicial](F1_Concepcao_Grupo5.md)

Este registro separa decisões fornecidas pelo grupo de hipóteses propostas para completar a concepção. Não constitui uma lista de funções adicionais obrigatórias.

## Decisões já fornecidas

- Universidade Federal de Viçosa, campus Viçosa.
- Participação da comunidade universitária, com cadastro simples e presunção de vínculo para toda conta criada.
- Setores dinâmicos que representam grupos responsáveis por tipos de manutenção, configurados pelo administrador.
- Aplicativo somente Android, inclusive para responsáveis e administradores.
- Concepção de alto nível, cobrindo os artefatos do slide e a visão do capítulo 2 fornecido.
- Disponibilidade de quatro horas por pessoa por semana para os três integrantes.
- Manutenção de UC1–UC4 como casos de uso nesta versão.
- Apresentação ajustada ao exemplo F1, com identificação de CRUD e consultas no diagrama.
- Marcação manual da localização tratada como parte do requisito funcional F4.

## Questões prioritárias para revisar com o grupo

| ID | Questão | Hipótese utilizada na versão 0.2 | Impacto |
|---|---|---|---|
| P1 | Um responsável poderá atuar em mais de um setor? | Sim; um setor também poderá ter vários responsáveis. | Vínculos e permissões. |
| P2 | Quem define o setor da ocorrência? | A categoria define o setor inicial; o responsável do setor atual pode transferir a demanda. | UC1, UC3 e configuração. |
| P3 | O administrador poderá atender qualquer ocorrência? | Não automaticamente; precisa de vínculo de responsável com o setor para usar as funções de atendimento. | Separação de responsabilidades. |
| P4 | Quem pode concluir uma ocorrência? | Um responsável do setor atual registra a resolução e a providência. | UC4 e ciclo de vida. |
| P5 | A comunidade poderá contestar uma resolução ou pedir reabertura? | Sem reabertura nesta versão; decisão a validar antes de fechar o fluxo. | Estados, histórico e escopo. |
| P6 | Como tratar registros indevidos, fora de escopo ou duplicados? | Encerramento justificado na análise; sem exclusão e sem vínculo formal entre duplicatas. | UC3 e transparência. |
| P7 | Qual é o prazo da disciplina e quando começa o desenvolvimento? | Disponibilidade confirmada de três pessoas com quatro horas semanais cada; horizonte proposto de 12 semanas, sem data inicial definida. | Viabilidade, ciclos e cronograma. |

## Detalhes que podem ser resolvidos na elaboração

| ID | Questão | Tratamento inicial |
|---|---|---|
| P8 | Quais categorias e setores existirão na demonstração? | Definir uma lista pequena com dados fictícios; não tratá-la como estrutura oficial da UFV. |
| P9 | Como delimitar o campus no mapa? | Definir a área de referência e o comportamento da validação de localização. |
| P10 | O autor pode corrigir ou retirar uma ocorrência? | Sem edição genérica ou retirada nesta versão; avaliar a necessidade e seus limites. |
| P11 | O usuário poderá retirar uma confirmação? | A versão inicial prevê inclusão única, sem retirada. |
| P12 | Como desativar categorias, setores ou responsáveis? | Definir o tratamento das demandas abertas e preservar referências históricas. |
| P13 | A alteração da associação categoria–setor afetará ocorrências anteriores? | Definir a política; recomenda-se preservar o setor atual e transferir demandas explicitamente quando necessário. |
| P14 | O responsável definirá prioridade de atendimento? | Sem campo de prioridade no escopo inicial; confirmações não determinam automaticamente a ordem de atendimento. |
| P15 | Quem poderá consultar a autoria das ocorrências e contribuições? | Definir quais dados de identificação aparecem; credenciais nunca são exibidas. |
| P16 | Como serão criadas a primeira conta administrativa e as demais contas com privilégios? | Definir preparação da demonstração e concessão de privilégios, evitando autodeclaração de administrador. |
| P17 | Quais serão as metas técnicas? | Definir versão Android, volume esperado, tempos de resposta e recursos de infraestrutura após avaliação inicial. |
| P18 | Haverá recursos para implementar informações complementares? | F6 é desejável; sua postergação deve retirar o conceito e os elementos correspondentes da entrega implementada, mantendo coerência documental. |

Quando uma pendência for resolvida, atualizar a concepção e registrar aqui a decisão. As hipóteses permitem discutir uma proposta concreta sem apresentá-la como validada por usuários ou setores reais.
