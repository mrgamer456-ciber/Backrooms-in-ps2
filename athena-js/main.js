import "game.js";
import "input.js";
import "raycast.js";
import "font.js";
import "render.js";
import "audio.js";
import "assets.js";
import "world3d.js";

// Ponto de entrada AthenaEnv. Athena executa main.js automaticamente.
(function(root) {
  "use strict";
  function startBackroomsAthena() {
    if(!root.BackroomsGame||!root.BackroomsInput||!root.BackroomsRenderer||!root.BackroomsRaycast||!root.BackroomsAudio||!root.BackroomsAssets||!root.BackroomsFont||!root.BackroomsWorld3D)
      throw new Error("Carregue game.js, input.js, raycast.js, render.js, audio.js, assets.js, font.js e world3d.js antes de main.js.");
    const game=root.BackroomsGame.makeGame();
    const renderer=root.BackroomsRenderer.createRenderer();
    let textures=null;
    if(root.BackroomsAssets.create())textures=root.BackroomsAssets.load();
    const world3d=root.BackroomsWorld3D.create();
    world3d.init();
    renderer.init(textures,world3d);
    const audio=root.BackroomsAudio.create();
    let pad=null;
    if(typeof Pads!=="undefined")pad=Pads.get(0);
    let lastTime=Date.now();
    const tick=()=>{
      const now=Date.now();
      let dt=(now-lastTime)/1000;lastTime=now;
      if(dt<=0||dt>0.1)dt=1/60;
      const input=(pad&&Pads.isActive(0))?root.BackroomsInput.readPad(pad):root.BackroomsInput.fromAxes({});
      if(game.onTitle) {
        if(input.restart) {
          game.onTitle=false;
          root.BackroomsGame.newGame(game,(Date.now()^0x0B4C7200)>>>0);
        }
      } else {
        root.BackroomsGame.update(game,input,dt);
      }
      if(!game.onTitle&&world3d.revision!==game.mapRevision)world3d.rebuild(game);
      root.BackroomsAudio.update(audio,game,dt);
      renderer.draw(game);
    };
    // AthenaEnv usa os.setInterval no loop principal; nao bloqueia o runtime.
    if(typeof os==="undefined"||typeof os.setInterval!=="function")
      throw new Error("Scheduler os.setInterval nao encontrado no AthenaEnv.");
    os.setInterval(tick,0);
    return true;
  }
  root.startBackroomsAthena=startBackroomsAthena;
  startBackroomsAthena();
})(globalThis);
