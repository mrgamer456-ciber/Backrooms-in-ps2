// Renderizador AthenaEnv — camada de apresentacao.
// O renderer antigo gsKit nao e reutilizado. Esta camada e isolada para integrar
// Render/RenderData/RenderObject/SceneNode/Batch sem contaminar a logica do jogo.
(function(root) {
  "use strict";
  function createRenderer() {
    let initialized=false;
    return {
      init() {
        if(typeof Render==="undefined" || typeof Screen==="undefined")
          throw new Error("AthenaEnv Render/Screen API nao encontrada neste runtime.");
        // API de alto nivel do AthenaEnv; geometria e materiais entram na proxima etapa.
        Render.init();
        initialized=true;
      },
      draw(game,frame) {
        if(!initialized) throw new Error("Renderer ainda nao inicializado.");
        // O pipeline 3D e a conversao dos elementos visuais do gsKit serao adicionados
        // em etapas, preservando perspectiva, profundidade e a camera em primeira pessoa.
        // Nao desenha uma falsa tela de jogo enquanto a cena 3D nao estiver pronta.
        if(typeof Screen.setFrameCounter==="function") Screen.setFrameCounter(true);
        if(typeof Screen.flip==="function") Screen.flip();
      }
    };
  }
  root.BackroomsRenderer={createRenderer};
})(this);
