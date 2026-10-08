# Campus em dia — protótipo navegável

Protótipo das telas do aplicativo Android descrito em [F1_Concepcao_Grupo5.md](../F1_Concepcao_Grupo5.md), incluindo os três perfis e os requisitos F1–F13. A implementação no navegador serve para apresentar e testar a experiência; não é uma versão web de produção nem um APK.

## Como visualizar

Abra **http://localhost:5173** no navegador. O aplicativo não exige instalação nem compilação. **O mapa real precisa de conexão com a internet** para carregar a cartografia e as imagens de satélite; fontes, ícones e biblioteca de mapas estão incluídos localmente.

Para usar um endereço local, execute a partir da pasta do projeto:

```bash
python3 -m http.server 5173 --bind 127.0.0.1 --directory prototipo
```

Acesse **http://localhost:5173**. Se a porta estiver ocupada, escolha outra e use o mesmo número no endereço. Para encerrar o servidor, pressione `Ctrl+C` no terminal.

Em computador, os controles à esquerda alternam as contas de demonstração e a área à direita orienta a exploração. Em janela estreita, o aplicativo ocupa a tela e a seleção dos perfis aparece abaixo. Todos os perfis utilizam as mesmas telas de celular.

## Contas de demonstração

| Perfil | Conta | Acesso inicial |
| --- | --- | --- |
| Comunidade | Marina · `marina@exemplo.com` | Mapa, registro, colaboração, acompanhamento, estatísticas e conta |
| Manutenção | João · `joao@exemplo.com` | Funções da comunidade e atendimento de elétrica/equipamentos |
| Administração | Ana · `ana@exemplo.com` | Funções da comunidade e configuração de setores, categorias e vínculos |

Use os botões de demonstração ou entre com os e-mails acima e a senha **`campus123`**. A abertura inicial já apresenta a sessão de demonstração de Marina. Clique em **Ver entrada e cadastro** ou saia pela tela **Conta** para explorar autenticação e cadastro. Novas contas são criadas como membros, sem privilégios administrativos.

## Roteiros para apresentar

1. **Comunidade:** explore o mapa, selecione um marcador, abra seus detalhes, confirme o problema e acrescente uma informação. Confira o histórico e a aba de confirmações em **Acompanhar**.
2. **Registro:** clique em **Registrar ocorrência**, arraste/aproxime o mapa real, toque no local ou escolha um ponto de referência, selecione uma categoria, descreva o problema, adicione uma foto opcional e revise. Latitude e longitude são salvas com o registro, que aparece nos detalhes, no mapa e no acompanhamento.
3. **Manutenção:** escolha João, abra uma demanda de elétrica/equipamentos e avance de **Registrada → Em análise → Em andamento → Resolvida**. A resolução exige a descrição da providência. Na análise, também é possível transferir a demanda ou encerrá-la com justificativa.
4. **Administração:** escolha Ana para criar/editar setores e categorias e vincular contas aos setores. Altere um encaminhamento e registre uma nova ocorrência para observar a configuração. Ana não pode atender sem um vínculo de setor.
5. **Panorama:** consulte quantidades por situação, categoria e setor e escolha um intervalo. A média considera a data de resolução, incluindo ocorrências criadas antes do período.
6. **Conta:** altere nome/e-mail, saia e crie uma nova conta com um e-mail comum. Entre novamente para testar o acesso dessa conta.

## Cobertura da concepção

| Requisito | Tela/interação |
| --- | --- |
| F1 — Manter conta | Cadastro e edição de nome/e-mail em Conta |
| F2 — Autenticar usuário | Entrada, atalhos de demonstração e saída |
| F3 — Consultar mapa | Marcadores, resumo, busca, mapa/lista e filtros combinados |
| F4 — Registrar ocorrência | Localização manual, categoria, descrição, foto e revisão |
| F5 — Confirmar ocorrência | Confirmação única por conta e quantidade de confirmações |
| F6 — Acrescentar informação | Contribuições textuais nos detalhes |
| F7 — Analisar e encaminhar | Início de análise, transferência e encerramento justificado |
| F8 — Registrar atendimento | Início do atendimento e resolução com providência |
| F9 — Registrar histórico | Eventos automáticos com autor e data, sem edição |
| F10 — Consultar acompanhamento | Detalhes, situação, histórico e registros da conta |
| F11 — Configurar manutenção | Setores, categorias, associações e vínculos de responsáveis |
| F12 — Consultar estatísticas | Período, quantidades e tempo médio de resolução |
| F13 — Consultar demandas do setor | Fila restrita aos setores vinculados |

## Dados e limites da simulação

- O mapa mostra o **campus Viçosa real**, usando a referência `-20.760506, -42.869627` enviada no link do Google Maps. Há duas camadas: **Satélite**, com imagens Esri World Imagery, e **Mapa**, com cartografia OpenStreetMap. As atribuições ficam visíveis em cada mapa. Zoom, deslocamento, seleção do local e revisão usam coordenadas geográficas reais.
- Biblioteca Central, RU I, CCE, Pavilhão de Aulas I, Praça do DCE e outros pontos foram localizados nos dados abertos do OpenStreetMap. A origem e as geometrias consultadas estão em `assets/locais-ufv.geojson`.
- **As ocorrências, contas e setores continuam fictícios.** Os marcadores de exemplo foram posicionados próximos aos pontos reais, sem indicar problemas existentes de fato.
- A validação usa uma **área de referência aproximada do campus**, entre `-20.774, -42.879` e `-20.750, -42.853`. Essa área serve ao protótipo e não representa o limite cadastral oficial da universidade. A marcação é manual e não precisa de GPS.
- Registros da versão anterior são migrados sem apagar contas, textos, confirmações ou histórico. Os exemplos recebem pontos de referência reais; relatos antigos criados pelo usuário recebem uma localização aproximada identificada nos detalhes, pois suas posições anteriores eram apenas percentuais do desenho.
- Registros e configurações são salvos no `localStorage` deste navegador; a sessão usa `sessionStorage`. Os três perfis de demonstração compartilham os dados locais. Pessoas em outros dispositivos não recebem essas atualizações: o requisito S4 depende da futura implementação com servidor.
- Falhas ao salvar exibem erro, preservam o formulário e não apresentam a operação como concluída. Fotos muito grandes ou falta de espaço podem impedir o salvamento. O limite ilustrativo é 2 MB por foto.
- Novas contas guardam uma derivação PBKDF2 com salt, sem senha em texto puro. A autenticação e as permissões são simulações no cliente, editáveis por quem controla o navegador; não constituem segurança de um sistema de produção. Os atalhos de perfil pertencem à apresentação do protótipo, não ao fluxo de atribuição de privilégios do aplicativo.
- Sem reabertura, retirada de confirmação, edição do relato original, notificações push, atendimento de emergências ou integração institucional.
- A referência dos intervalos prontos é 07/10/2026. Novas ações recebem a data/hora real do navegador; use **Todo o período** para incluir ações realizadas em outras datas.
- **Restaurar demonstração** solicita confirmação e recupera os exemplos, removendo as alterações e contas locais. A abertura direta de `index.html` continua disponível com a visão Satélite. Para a camada OpenStreetMap, use `localhost`, garantindo o cabeçalho de referência exigido pelo provedor. Dados abertos via `file://` podem ser separados dos dados do endereço `localhost` pelo navegador.

## Hipóteses concretizadas somente para o protótipo

As pendências do documento [Regras_de_Negocio_Pendentes_Grupo5.md](../Regras_de_Negocio_Pendentes_Grupo5.md) continuam sendo questões do projeto. Para permitir navegar, esta demonstração utiliza os seguintes comportamentos:

- Um responsável pode atuar em vários setores. Administração não concede acesso automático ao atendimento.
- Mudar a associação de uma categoria afeta apenas os novos registros. A transferência de ocorrências anteriores é explícita e mantém a situação atual, registrando os setores no histórico.
- Categorias e setores podem ser desativados, preservando referências históricas. Um setor com categorias ativas ou demandas abertas precisa ter essas referências encaminhadas antes de ser desativado.
- A transferência exige motivo; resolução e encerramento são finais. Confirmações e contribuições textuais continuam disponíveis nos registros finais, sem reabertura.
- Nome e e-mail são os dados básicos da conta. O título do registro é derivado da descrição; não acrescenta um campo obrigatório ao escopo.
- As contas administrativas da demonstração já vêm preparadas. O cadastro não permite escolher um perfil privilegiado.

## Arquivos

`index.html` contém a apresentação; `styles.css` define a interface responsiva; `data.js` contém os exemplos; `app.js` implementa navegação e interações; `map-data.js` reúne coordenadas e migração; `map.js` controla os mapas reais; `assets/` contém símbolo, fontes, referências geográficas e Leaflet 1.9.4 com sua licença. Não é necessário instalar dependências.

`verificacao/` contém capturas e a validação de fluxos feita com Playwright. Os scripts são opcionais, não necessários para abrir o protótipo. Para executar a verificação em uma máquina com Playwright e Chrome instalados:

```bash
CAMPUS_PLAYWRIGHT=/caminho/do/pacote/playwright CAMPUS_CHROME=/caminho/do/chrome node prototipo/verificacao/fluxos.cjs
```

O teste usa uma sessão isolada e não altera os dados do seu navegador habitual. Os tiles são simulados nos testes automatizados para não gerar tráfego repetitivo aos provedores. A inspeção visual separada verifica imagens reais em `verificacao/visualizar.cjs`. O relatório é salvo em `verificacao/resultado.json`.

## Referências do mapa

- [Leaflet 1.9.4 — versão estável](https://leafletjs.com/download.html).
- [OpenStreetMap — atribuição e licença](https://www.openstreetmap.org/copyright) e [política de tiles](https://operations.osmfoundation.org/policies/tiles/). O navegador usa o cache HTTP normal; não há download em lote, prefetch nem armazenamento de tiles no pacote ZIP.
- [Esri World Imagery — serviço e créditos](https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer).
- [Biblioteca Central no OpenStreetMap](https://www.openstreetmap.org/way/292666798) e [Restaurante Universitário I](https://www.openstreetmap.org/way/292666797).
