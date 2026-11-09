# Backrooms PS2 — port JavaScript para AthenaEnv

Esta pasta contem a versao em andamento do jogo para o runtime AthenaEnv. O projeto original C++/PS2SDK continua intacto em `source/backrooms-ps2/`.

## Arquivos

- `main.js`: entrada automatica, importa os modulos e inicia o loop com `os.setInterval`.
- `audio.js`: gera WAVs pequenos no primeiro inicio e toca ambiente, passos, batimento, coleta, transicao de nivel e susto.
- `assets.js`: gera os dois BMPs procedurais de parede, incluindo papel de parede do nivel 0 e tubos do Pipe Dreams.
- `font.js`: porta a fonte bitmap 5x7 original, usada na tela inicial, HUD, VHS e tela de morte.
- `world3d.js`: gera a malha OBJ do mapa e renderiza paredes, piso, teto, porta, armario e luminarias no renderer 3D VU1 do AthenaEnv.
- `game.js`: logica do jogo — mapa, movimento, colisao, pulo, stamina, lanterna, armario, itens e IA das anomalias.
- `input.js`: leitura do DualShock pelo modulo `Pads`, incluindo analogicos, direcional e botoes.
- `raycast.js`: raycaster por coluna, profundidade, iluminacao e projecao de sprites.
- `render.js`: camada 2D de sprites, HUD VHS, fonte bitmap e a mao/lanterna em primeira pessoa.

## Como testar no AthenaEnv

1. Copie os nove arquivos JavaScript desta pasta para a pasta de scripts do AthenaEnv, mantendo todos juntos.
2. Configure o AthenaEnv para iniciar `main.js` (esse e o nome padrao do runtime).
3. Inicie o AthenaEnv no PS2. O jogo abre na tela inicial.
4. Aperte START ou R2 para iniciar.

Nao e necessario compilar um ELF do jogo: o AthenaEnv executa os scripts JavaScript. O ELF do proprio AthenaEnv continua sendo necessario para rodar o runtime.

## Controles

- Analogico esquerdo: andar.
- Analogico direito horizontal: virar.
- Analogico direito vertical: olhar para cima/baixo.
- Direcional: andar/virar.
- R1: correr.
- X: pular.
- L1: ligar/desligar a lanterna.
- Quadrado: entrar/sair do armario no nivel 2.
- START ou R2: iniciar/reiniciar.

## Estado real desta conversao

**Ainda nao e a versao final nem foi validada no AthenaEnv/PS2.** O repositorio tem verificacoes automatizadas de sintaxe, logica, normalizacao dos analogicos e geracao da malha 3D usando mocks; esses testes nao substituem a execucao real no console. O loop de entrada, atualizacao e desenho esta conectado. O cenario e uma malha 3D gerada a partir do mapa e enviada ao renderer VU1: paredes texturizadas, piso, teto, porta, armario e luminarias. O raycaster continua sendo usado para profundidade e projecao dos sprites; HUD VHS, itens, anomalias e a mao/lanterna ficam como camada 2D por cima.

O personagem continua no formato em primeira pessoa ja existente no projeto: camera do jogador e mao/lanterna desenhada. Nao trocar por Steve ou Alex. A logica, a porta e a geometria precisam de validacao visual no AthenaEnv/PS2. O audio procedural tambem precisa de teste no console.

O codigo original em `source/backrooms-ps2/` nao foi alterado por esta conversao.
