# Entregas da disciplina

Engenharia de Software II, Grupo 5: Lucas Carvalho de Góes, Luka Gouvêa e Gabriel Ferreira.

Esta pasta guarda os documentos entregues em cada fase. A documentação técnica do produto fica em [docs/](../docs/README.md).

| Fase | Data | Conteúdo | Arquivos |
| --- | --- | --- | --- |
| Proposta | 06/09/2026 | Definição do tema do projeto | [Proposta_Tema_Grupo5.pdf](00-proposta-tema/Proposta_Tema_Grupo5.pdf) |
| F1 — Concepção | 04/10/2026 | Visão geral, requisitos, casos de uso, modelo conceitual e planejamento | [F1_Concepcao_Grupo5.md](F1-concepcao/F1_Concepcao_Grupo5.md) · [PDF](F1-concepcao/F1_Concepcao_Grupo5.pdf) · [regras de negócio pendentes](F1-concepcao/Regras_de_Negocio_Pendentes_Grupo5.md) · [diagramas](F1-concepcao/diagramas/) |
| F2 — Protótipo e APF | 16/10/2026 | Protótipo navegável, mapeamento de telas e análise de pontos de função | [F2_Documento.pdf](F2-prototipo-apf/F2_Documento.pdf) · [protótipo](F2-prototipo-apf/prototipo/README.md) |
| F5 — CI/CD e Refatoração | 24/11/2026 | Pipeline de CI/CD no GitHub Actions, detecção de God Module, criação de issues e plano de refatoração | [REFATORACAO.md](F5-cicd/REFATORACAO.md) |

Os diagramas da F1 estão em PlantUML (`.puml`) junto com os SVGs gerados a partir deles.

## Protótipo da F2

O protótipo é a versão navegável usada na F2. Usa dados fictícios salvos no navegador e é independente do produto. Ele foi arquivado como entregue: não faz parte do build nem do CI.

O PDF da F2 cita https://campus-em-dia.vercel.app/ como endereço do protótipo. Hoje esse endereço serve o produto. Para abrir o protótipo, execute na raiz do repositório:

```bash
python3 -m http.server 5173 --bind 127.0.0.1 --directory entregas/F2-prototipo-apf/prototipo
```

Depois acesse http://localhost:5173. As contas de demonstração e os roteiros estão no [README do protótipo](F2-prototipo-apf/prototipo/README.md).
