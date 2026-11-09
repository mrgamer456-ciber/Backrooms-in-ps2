# Modelo do personagem

Modelo escolhido: **Minecraft Steve (Rigged)**, de Bully Magraptor — nao usar Alex nem o modelo Slim.

Fonte: https://sketchfab.com/3d-models/minecraft-steve-rigged-fbe1d1fab86d47b09171608103af3b2d

A pagina informa malha com cerca de 3,3 mil triangulos, proporcoes classicas e textura original, sob licenca Creative Commons Attribution. Credito do autor deve acompanhar o jogo.

## Arquivos esperados

- `steve.gltf` ou `steve.glb`: versao com esqueleto, necessaria para animacoes de ossos.
- `steve.obj` + `steve.bmp`: alternativa estatica, conforme a preferencia inicial; OBJ nao guarda esqueleto nem clips de animacao.
- `steve_jump.gltf`: clip de pulo separado, somente se usar o mesmo esqueleto/nome de ossos do Steve.

## Nota tecnica importante

O AthenaEnv carrega modelos OBJ e tambem possui suporte a objetos com esqueleto e colecoes de animacao em glTF. Para tocar uma animacao pronta de pulo nos bracos, pernas e tronco, o modelo em execucao precisa manter o esqueleto. Uma exportacao OBJ+BMP sozinha desenha o Steve em 3D, mas nao consegue receber uma animacao esquelética.

Nenhum modelo foi copiado para esta pasta ainda. O arquivo precisa ser obtido da pagina de origem e colocado aqui antes de ligar o personagem no jogo.
