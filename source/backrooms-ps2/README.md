# Backrooms PS2 (v0.3)

Backrooms para PS2: corredores amarelos com papel de parede, luz piscando, neblina, som
sintetizado em tempo real e anomalias que perseguem voce. Raycasting (estilo Wolfenstein 3D)
sobre o gsKit. Nenhum arquivo de imagem ou audio: texturas, sons e fonte sao gerados por codigo.

## Controles (DualShock 2)
- Analogico esquerdo: andar / strafe (D-Pad cima/baixo tambem anda)
- Analogico direito ou D-Pad esquerda/direita: virar
- R1 ou X: correr (gasta stamina; se zerar, fica exausto ate recuperar)
- START ou X: comecar na tela de titulo / reiniciar depois de morrer

## Objetivo
Ache a porta VERDE (um bloco de parede verde) e encoste nela para ir ao proximo nivel.
Cada nivel gera um mapa novo; as anomalias ficam mais rapidas e aparecem mais (1 ate 4).
Se uma encostar em voce, acabou.

## Agua de amendoa
Latas azuis espalhadas pelo mapa (2 por nivel). Pegar restaura a stamina e deixa as anomalias
mais lentas por 5 segundos (barra azul no HUD).

## Anomalias (a partir do nivel 2 os tipos sao sorteados)
- **Smiler** (cabeca palida, sorriso): persegue sempre.
- **Stalker** (corpo claro, olhos grandes): CONGELA enquanto voce olha pra ele (com a visao livre);
  quando voce desvia o olhar ou uma parede bloqueia, corre muito rapido. Ande de costas olhando pra ele.
- **Runner** (vermelho, olhos brancos): alterna rajadas de corrida muito rapida com pausas curtas.

## Som (sintetizado, 22 kHz mono)
Zumbido da luz fluorescente (cai quando a luz pisca), passos no carpete, batimento cardiaco que
acelera conforme uma anomalia se aproxima, uma "voz" diferente para cada tipo (drone grave do
Smiler, apito agudo do Stalker parado e estatica quando ele se mexe, varredura do Runner),
som de agua de amendoa, acorde ao passar de nivel e grito ao morrer.

## Estrutura
- `game.h / game.cpp`: logica pura (mapa, BFS, colisao, anomalias, itens, raycast). Sem PS2.
- `audio.h / audio.cpp`: sintetizador de audio puro (gera os samples). Sem PS2.
- `textures.*`: papel de parede gerado por codigo. `font.*`: fonte bitmap 5x7.
- `main.cpp`: plataforma PS2 (gsKit video + texturas, libpad controle, audsrv som).
- `Makefile`: gera `backrooms.elf`.

## Compilar
Com Docker (imagem oficial ps2dev):

    docker run -it --rm -v "$PWD":/src ps2dev/ps2dev:latest sh -c "cd /src && make"

Se alguma parte nova falhar no build, desligue so ela e o resto continua funcionando:

    make USE_AUDIO=0            # sem som (nao precisa de audsrv nem bin2c)
    make USE_WALL_TEXTURE=0     # paredes lisas com listras (sem texturas do gsKit)

(Rode `make clean` antes de trocar de opcao.)

## Se algo ficar estranho no PS2
- Paredes muito escuras/claras: o gsKit usa MODULATE, onde 128 = brilho original. Ajuste o `128.0f`
  em `drawWorld()` (main.cpp).
- Som com estalos: aumente `target` em `pumpAudio()` (main.cpp), por exemplo de 4096 para 6144.
- Jogo lento: reduza `RAY_COLS` em game.h (320 -> 240 ou 160).

## Proximos passos sugeridos
- Salas especiais (piscina, corredor infinito): precisam de piso/teto texturizados
- Mais anomalias (que some e reaparece, que imita um item) e sons espaciais (pan esquerda/direita)
- Chao e teto com textura (raycasting de piso)
- Salvar recorde de nivel no memory card


## Compilacao automatica no GitHub Actions
1. Envie esta pasta para um repositorio GitHub (na raiz devem ficar `Makefile`, `main.cpp` etc.).
2. Abra a aba **Actions** e execute **Build Backrooms PS2 ELF** (ou faca push na branch `main`/`master`).
3. Baixe o artefato **backrooms-ps2-elf** ao terminar.

O workflow tenta primeiro compilar com audio e texturas. Se a parte de audio falhar,
tenta novamente sem audio, mantendo as texturas. O arquivo gerado e `backrooms.elf`.
