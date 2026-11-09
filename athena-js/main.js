import "game.js";
import "input.js";
import "raycast.js";
import "render.js";
import "audio.js";

// Ponto de entrada AthenaEnv. Athena executa main.js automaticamente.
(function(root) {
  "use strict";
  function startBackroomsAthena() {
    if(!root.BackroomsGame||!root.BackroomsInput||!root.BackroomsRenderer||!root.BackroomsRaycast||!root.BackroomsAudio)
      throw new Error("Carregue game.js, input.js, raycast.js e render.js antes de main.js.");
    const game=root.BackroomsGame.makeGame();
    const renderer=root.BackroomsRenderer.createRenderer();
    renderer.init();
    const audio=root.BackroomsAudio.create();
    let pad=null;
    if(typeof Pads!=="undefined")pad=Pads.get(0);
    let lastTime=Date.now();
    let started=false;
    const tick=()=>{
      const now=Date.now();
      let dt=(now-lastTime)/1000;lastTime=now;
      if(dt<=0||dt>0.1)dt=1/60;
      const input=pad?root.BackroomsInput.readPad(pad):root.BackroomsInput.fromAxes({});
      if(game.onTitle) {
        if(input.restart) {
          game.onTitle=false;
          root.BackroomsGame.newGame(game,0x0B4C7200);
        }
      } else {
        root.BackroomsGame.update(game,input,dt);
      }
      root.BackroomsAudio.update(audio,game,dt);
      renderer.draw(game);
    };
    // AthenaEnv usa os.setInterval no loop principal; nao bloqueia o runtime.
    if(typeof os==="undefined"||typeof os.setInterval!=="function")
      throw new Error("Scheduler os.setInterval nao encontrado no AthenaEnv.");
    os.setInterval(tick,0);
    started=true;
    return started;
  }
  root.startBackroomsAthena=startBackroomsAthena;
  startBackroomsAthena();
})(globalThis);
