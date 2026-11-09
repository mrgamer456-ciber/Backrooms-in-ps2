// Ponto de entrada do port Backrooms para AthenaEnv.
// Carregar game.js, input.js e render.js antes deste arquivo.
(function(root) {
  "use strict";
  function startBackroomsAthena() {
    if(!root.BackroomsGame||!root.BackroomsInput||!root.BackroomsRenderer)
      throw new Error("Carregue game.js, input.js e render.js antes de main.js.");
    const game=root.BackroomsGame.makeGame();
    root.BackroomsGame.newGame(game,0x0B4C7200);
    const renderer=root.BackroomsRenderer.createRenderer();
    renderer.init();
    let frame=0;
    const step=()=>{
      // A amostragem do controle AthenaEnv sera ligada no adaptador Pads.
      const input=root.BackroomsInput.fromAxes({});
      root.BackroomsGame.update(game,input,1/60);
      renderer.draw(game,frame++);
    };
    // Mantem o loop explicito para facilitar a troca pelo scheduler/timer do runtime.
    while(true) step();
  }
  root.startBackroomsAthena=startBackroomsAthena;
})(this);
