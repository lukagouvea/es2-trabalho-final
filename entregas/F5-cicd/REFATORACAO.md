# F5 — CI/CD e Refatoracao de Code Smell

Engenharia de Software II, Grupo 5: Lucas Carvalho de Goes, Luka Gouvea e Gabriel Ferreira.

## 1. Funcionamento do pipeline

Configuramos o workflow `.github/workflows/f5-pipeline.yml` para rodar a cada commit no repositorio. O pipeline executa tres jobs:

1. **Testes unitarios (`unit-tests`)**: roda `npm test` usando o Vitest nos testes da API (`tests/api/`).
2. **Deteccao de smells (`smell-detection`)**: roda o script `scripts/detect-god-class.mjs`. Se diagnosticar arquivos com o smell, cria uma issue no GitHub com a label `code-smell`. O script verifica se a issue ja existe antes de abrir outra, evitando duplicatas no mesmo arquivo.
3. **Deploy em producao (`deploy`)**: roda apenas se os testes unitarios passarem e o commit estiver no branch `master`. O deploy e validado com `npm run build` e acionado na Vercel.

## 2. Estrategia de deteccao do Code Smell (God Module)

A estrategia implementada em `scripts/detect-god-class.mjs` segue a fundamentacao teorica da disciplina :

- **Regra de composicao (Slide 150)**: metricas nao podem ser usadas sozinhas para diagnostico. Combinamos os sintomas com o operador logico `AND`.
- **Sintoma 1 — Modulo muito grande e complexo**: medido pela metrica `Length of Code (LOC) > 300` (Slide 138).
- **Sintoma 2 — Muitas responsabilidades e baixa coesao**: medido pelo total de funcoes declaradas na raiz do arquivo (`Funcoes > 5`), proxy da falta de coesao em estilo funcional (Slide 147).
- **Sintoma 3 — Muitos dependentes por centralizar responsabilidades**: medido pelo Fan-In (`Fan-In > 0`), confirmando que o modulo e consumido ativamente por outros arquivos (Slide 136 e 152).
- **Limiares adotados**: baseados em semantica geralmente aceita pela literatura tecnica (Lanza e Marinescu, 2006, Slide 153).
