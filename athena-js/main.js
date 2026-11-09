// {"name":"Backrooms","author":"Backrooms PS2","version":"0.1","file":"main.js"}
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
    renderer.init(null,null);
    renderer.drawLoading(5,"INICIANDO MOTOR");
    renderer.drawLoading(15,"CRIANDO TEXTURAS");
    if(!root.BackroomsAssets.create())
      throw new Error("Falha ao gerar as texturas BMP do Backrooms. Verifique o espaco livre e a pasta de scripts.");
    renderer.drawLoading(58,"CARREGANDO TEXTURAS");
    const textures=root.BackroomsAssets.load();
    if(!textures)
      throw new Error("AthenaEnv nao conseguiu carregar as texturas BMP do Backrooms.");
    renderer.setTextures(textures);
    renderer.drawLoading(72,"PREPARANDO AUDIO");
    // Diagnostico temporario: desativa o renderer VU1 nativo.
    // O teste basico de AthenaEnv funciona, mas o VU1 ainda gera EE Exception
    // dentro de draw_vui_with_colors. Mantemos o raycaster 2.5D para testar
    // movimento, colisao, HUD e gameplay sem chamar o caminho 3D nativo.
    const world3d=null;
    const audio=root.BackroomsAudio.create();
    renderer.drawLoading(96,"FINALIZANDO");
    renderer.drawLoading(100,"PRONTO");
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
      // world3d desativado durante o diagnostico do renderer VU1.
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
  try {
    startBackroomsAthena();
  } catch(e) {
    const message=String(e&&e.stack?e.stack:e);
    try {
      if(typeof Screen!=="undefined"&&typeof Draw!=="undefined"&&typeof Color!=="undefined") {
        Screen.setParam(Screen.DEPTH_TEST_ENABLE,false);
        const font=new Font("default");
        const lines=[];
        let line="";
        for(const word of message.split(" ")) {
          if((line+" "+word).length>48){lines.push(line);line=word;}
          else line+=(line?" ":"")+word;
        }
        if(line)lines.push(line);
        os.setInterval(()=>{
          Screen.clear(Color.new(0,0,0,255));
          Draw.rect(12,12,616,54,Color.new(90,0,0,255));
          font.color=Color.new(255,255,255,255);
          font.print(22,24,"BACKROOMS - ERRO AO INICIAR");
          for(let i=0;i<Math.min(lines.length,18);i++)
            font.print(18,82+i*18,lines[i]);
          Screen.flip();
        },0);
      }
    } catch(debugError) {
      if(typeof std!=="undefined"&&std.err)std.err.puts("Backrooms startup error: "+message+" | debug screen: "+debugError+"\\n");
    }
    if(typeof std!=="undefined"&&std.err)std.err.puts("Backrooms startup error: "+message+"\\n");
  }
})(globalThis);
