# Backrooms PS2 — port para AthenaEnv

Esta pasta inicia a conversao do projeto C++/PS2SDK para JavaScript/AthenaEnv. O codigo original continua intacto em `source/backrooms-ps2/`.

## Arquivos
- `game.js`: logica independente de plataforma (mapa, jogador, pulo, lanterna, armario, itens e anomalia).
- `input.js`: adaptador de controles; a leitura fisica do controle sera ligada aos nomes exatos da API AthenaEnv na etapa de integracao.
- `render.js`: camada de renderizacao; sera integrada ao pipeline Render/SceneNode/Batch do AthenaEnv.
- `main.js`: ponto de entrada e loop principal.

## Estado
**Portabilidade em andamento — nao e um ELF pronto ainda.** A logica esta sendo separada da renderizacao para evitar misturar chamadas antigas do gsKit com a API AthenaEnv. A conversao visual completa (raycaster, texturas, porta, armario, anomalia, mao/lanterna e HUD VHS) e o audio serao integrados nas proximas etapas.

## Controles planejados
- Analógico esquerdo: andar
- Analógico direito: olhar/virar
- R1: correr
- X: pular
- L1: ligar/desligar lanterna
- Quadrado: entrar/sair do armario
- START ou R2: iniciar/reiniciar

A lanterna em primeira pessoa e os elementos ja aprovados do jogo devem ser preservados durante a conversao.
