#!/usr/bin/env node
// Estrategia de deteccao de Code Smell: God Module (adaptacao de God Class)
//     Sintoma 1 (LOC >= Alto) AND
//     Sintoma 2 (HS-LCOM / Baixa coesao >= Alto) AND
//     Sintoma 3 (FANIN >= Alto)

import { readFileSync, readdirSync } from "node:fs";
import { resolve, relative, extname, join, basename } from "node:path";

// Limiares por semantica geralmente aceita (Lanza e Marinescu, 2006)
const LIMITE_LOC = 300;
const LIMITE_FUNCOES_COESAO = 5;
const LIMITE_FAN_IN = 0; // fanIn > 0: modulo consumido ativamente no sistema (tem dependentes)

// Varre pastas buscando arquivos js, ts e html do projeto
function buscarArquivos(diretorio) {
  const arquivos = [];
  let itens;
  try {
    itens = readdirSync(diretorio, { withFileTypes: true });
  } catch {
    return arquivos;
  }

  for (const item of itens) {
    const caminhoCompleto = join(diretorio, item.name);
    if (item.isDirectory()) {
      if (
        ["node_modules", "dist", ".git", ".supabase", "migrations"].includes(
          item.name,
        )
      ) {
        continue;
      }
      arquivos.push(...buscarArquivos(caminhoCompleto));
    } else if (item.isFile()) {
      const ext = extname(item.name);
      if ([".js", ".ts", ".mjs", ".cjs", ".html"].includes(ext)) {
        arquivos.push(caminhoCompleto);
      }
    }
  }
  return arquivos;
}

// Metrica para Sintoma 2
// Conta funcoes declaradas na raiz do modulo
function contarFuncoes(codigo) {
  const linhas = codigo.split("\n");
  let total = 0;

  for (const linha of linhas) {
    const trim = linha.trimStart();
    if (linha.startsWith("  ") || linha.startsWith("\t")) {
      continue;
    }

    if (/^(export\s+)?(async\s+)?function\s+\w+\s*\(/.test(trim)) {
      total++;
      continue;
    }

    if (
      /^(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?((\(|\w+)\s*(=>|\())/.test(
        trim,
      )
    ) {
      total++;
    }
  }

  return total;
}

// Metrica para Sintoma 3
// Conta quantos outros arquivos do projeto importam ou referenciam este modulo
function calcularFanIn(caminhoArquivo, todosArquivos) {
  const nomeBase = basename(caminhoArquivo).replace(/\.(js|ts|mjs|cjs)$/, "");
  let dependentes = 0;

  for (const outro of todosArquivos) {
    if (outro === caminhoArquivo) continue;
    try {
      const conteudo = readFileSync(outro, "utf8");
      // Procura instrucoes de import ou tags de script html que referenciam o modulo
      const padrao = new RegExp(
        `(from\\s+['"][^'"]*${nomeBase}(\\.[a-z]+)?['"]|<script[^>]*src=['"][^'"]*${nomeBase}(\\.[a-z]+)?['"])`,
      );
      if (padrao.test(conteudo)) {
        dependentes++;
      }
    } catch {
      // Ignora erro de leitura em arquivo isolado
    }
  }

  return dependentes;
}

const raiz = resolve(process.cwd());

const todosArquivosProjeto = [
  ...buscarArquivos(join(raiz, "web")),
  ...buscarArquivos(join(raiz, "server")),
  ...buscarArquivos(join(raiz, "api")),
];

// Filtra apenas o codigo de aplicacao para analise de smells
const arquivosAlvo = todosArquivosProjeto.filter((arq) => {
  const rel = relative(raiz, arq).replace(/\\/g, "/");
  const ext = extname(arq);
  return (
    [".js", ".ts", ".mjs", ".cjs"].includes(ext) &&
    !rel.startsWith("scripts/") &&
    !rel.startsWith("tests/") &&
    !rel.includes(".test.") &&
    !rel.includes(".spec.")
  );
});

const smells = [];

for (const caminho of arquivosAlvo) {
  let codigo;
  try {
    codigo = readFileSync(caminho, "utf8");
  } catch {
    continue;
  }

  const arquivoRel = relative(raiz, caminho).replace(/\\/g, "/");
  const totalLinhas = codigo.split("\n").length;
  const totalFuncoes = contarFuncoes(codigo);
  const fanIn = calcularFanIn(caminho, todosArquivosProjeto);

  // ESTRATEGIA DE DETECCAO DE GOD MODULE

  // Sintoma 1:
  const sintoma1_loc_alto = totalLinhas > LIMITE_LOC;

  // Sintoma 2:
  const sintoma2_baixa_coesao = totalFuncoes > LIMITE_FUNCOES_COESAO;

  // Sintoma 3:
  const sintoma3_alto_fan_in = fanIn > LIMITE_FAN_IN;

  // Composicao da estrategia com operador logico AND

  const diagnostico_god_module =
    sintoma1_loc_alto && sintoma2_baixa_coesao && sintoma3_alto_fan_in;

  if (diagnostico_god_module) {
    smells.push({
      file: arquivoRel,
      totalLines: totalLinhas,
      topLevelFunctions: totalFuncoes,
      fanIn: fanIn,
      symptom1_loc: sintoma1_loc_alto,
      symptom2_cohesion: sintoma2_baixa_coesao,
      symptom3_fanIn: sintoma3_alto_fan_in,
      reason: `Sintoma 1 (LOC >= Alto): ${totalLinhas} linhas (limite: > ${LIMITE_LOC}) AND Sintoma 2 (Baixa Coesao / Excesso de Funcoes >= Alto): ${totalFuncoes} funcoes (limite: > ${LIMITE_FUNCOES_COESAO}) AND Sintoma 3 (Fan-In >= Alto): ${fanIn} dependente(s) (limite: > ${LIMITE_FAN_IN})`,
    });
  }
}

// Imprime um JSON por linha para facilitar leitura no workflow
for (const smell of smells) {
  process.stdout.write(JSON.stringify(smell) + "\n");
}

if (smells.length > 0) {
  process.stderr.write(
    `[detect-god-class] Encontrado(s) ${smells.length} arquivo(s) com God Module.\n`,
  );
  process.exit(1);
} else {
  process.stderr.write(
    "[detect-god-class] Nenhum God Module encontrado nos arquivos analisados.\n",
  );
  process.exit(0);
}
