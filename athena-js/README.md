# Backrooms PS2 — port JavaScript para AthenaEnv

Esta pasta contem a versao em andamento do jogo para o runtime AthenaEnv. O projeto original C++/PS2SDK continua intacto em `source/backrooms-ps2/`.

## Arquivos

- `main.js`: entrada automatica, imports e loop com `os.setInterval`.
- `audio.js`: gera WAVs pequenos no primeiro inicio e toca ambiente, passos, batimento, coleta, transicao de nivel e susto.
- `assets.js`: gera os dois BMPs procedurais de parede, incluindo papel de parede do nivel 1 e tubos do Pipe Dreams.
- `font.js`: porta a fonte bitmap 5x7 original, usada na tela inicial, HUD, VHS e tela de morte.
- `game.js`: logica do jogo — mapa, movimento, colisao, pulo, stamina, lanterna, armario, itens e IA das anomalias.
- `input.js`: leitura do DualShock pelo modulo `Pads`, incluindo analogicos, direcional e botoes.
- `raycast.js`: raycaster por coluna, profundidade, iluminacao da lanterna e projecao de sprites.
- `render.js`: renderizacao 2.5D com `Draw`, `Font` e `Color`, porta branca, armario, sprites, HUD VHS e a geometria aprovada da mao/lanterna.

## Como testar no AthenaEnv

1. Copie os oito arquivos JavaScript desta pasta para a pasta de scripts do AthenaEnv, mantendo todos juntos.
2. Configure o AthenaEnv para iniciar `main.js` (esse e o nome padrao do runtime).
3. Inicie o AthenaEnv no PS2. O jogo abre na tela inicial.
4. Aperte START ou R2 para iniciar.

Nao e necessario compilar um ELF do jogo: o AthenaEnv executa os scripts JavaScript. O ELF do proprio AthenaEnv continua sendo necessario para rodar o runtime.

## Controles

- Analógico esquerdo: andar.
- Analógico direito horizontal: virar.
- Analógico direito vertical: olhar para cima/baixo.
- Direcional: andar/virar.
- R1: correr.
- X: pular.
- L1: ligar/desligar a lanterna.
- Quadrado: entrar/sair do armario no nivel 2.
- START ou R2: iniciar/reiniciar.

## Estado real desta conversao

**Ainda nao e a versao final nem foi validada no PS2.** A logica principal, leitura do DualShock e loop do AthenaEnv foram ligados. A primeira renderizacao 2.5D ja desenha o cenario, porta branca, armario, itens, anomalias, HUD VHS e a mao/lanterna com os mesmos pontos geometricos do desenho aprovado. O papel de parede e os canos agora sao gerados como BMPs 128x128 com o padrao portado do gerador C++ original. O audio procedural ja foi ligado usando WAVs gerados pelo proprio script no primeiro inicio; precisa de teste no console. O modelo 3D de Steve ainda precisa ser integrado.

O raycaster foi mantido porque e a tecnologia do jogo C++ atual; o renderer 3D de modelos do AthenaEnv pode ser integrado para personagens/objetos sem transformar o mapa inteiro em um jogo de malha 3D.

O codigo original em `source/backrooms-ps2/` nao foi alterado por esta conversao.
