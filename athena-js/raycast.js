// Backrooms PS2 — projecao 2.5D do mapa para a camera.
// Port fiel do castRays/projectPoint de source/backrooms-ps2/game.cpp.
// Este modulo prepara geometria por coluna; nao depende de gsKit nem de APIs graficas.
(function(root) {
  "use strict";
  const W=40,H=40,MAX_VIEW=12,RAY_COLS=160;
  const at=(x,y)=>y*W+x;
  function cast(game,screenW,screenH,columns) {
    const count=columns||RAY_COLS, out=new Array(count);
    const colW=screenW/count;
    let horizon=screenH*(0.5+game.pitch)+game.jumpHeight*screenH*0.65;
    horizon=Math.max(screenH*0.12,Math.min(screenH*0.90,horizon));
    for(let x=0;x<count;x++) {
      const camX=2*x/count-1;
      const rdx=game.dirX+game.planeX*camX, rdy=game.dirY+game.planeY*camX;
      let mx=game.px|0,my=game.py|0;
      const ddx=rdx===0?1e30:Math.abs(1/rdx),ddy=rdy===0?1e30:Math.abs(1/rdy);
      const stepX=rdx<0?-1:1,stepY=rdy<0?-1:1;
      let sdx=rdx<0?(game.px-mx)*ddx:(mx+1-game.px)*ddx;
      let sdy=rdy<0?(game.py-my)*ddy:(my+1-game.py)*ddy;
      let side=0,hit=0;
      for(let guard=0;guard<64&&!hit;guard++) {
        if(sdx<sdy){sdx+=ddx;mx+=stepX;side=0;}
        else{sdy+=ddy;my+=stepY;side=1;}
        if(mx<0||my<0||mx>=W||my>=H){hit=1;break;}
        hit=game.map[at(mx,my)];
      }
      let depth=side===0?sdx-ddx:sdy-ddy;
      if(depth<0.05)depth=0.05;
      const fullH=screenH/depth,topFull=horizon-fullH*0.5;
      const lineH=fullH|0;
      const top=Math.max(0,(horizon-lineH*0.5)|0);
      const bottom=Math.min(screenH,(horizon+lineH*0.5)|0);
      let bright=Math.max(0,1-depth/MAX_VIEW);
      if(side===1)bright*=0.78;
      const wallX=side===0?game.py+depth*rdy:game.px+depth*rdx;
      const u=wallX-Math.floor(wallX);
      const offset=Math.abs((x+0.5)/count-0.5)*2;
      let light=0;
      if(game.flashlight) {
        const cone=Math.max(0,1-offset);
        const smooth=cone*cone*(3-2*cone);
        light=1.05*smooth*Math.max(0,1-depth/10);
      }
      out[x]={x:x*colW,x2:(x+1)*colW,top,bottom,fullTop:topFull,fullH,
        depth,type:hit||1,side,u,brightness:Math.min(1.75,bright+light),horizon};
    }
    return {columns:out,horizon,width:screenW,height:screenH,columnWidth:colW};
  }
  function project(game,x,y,screenW,screenH) {
    const dx=x-game.px,dy=y-game.py;
    const det=game.planeX*game.dirY-game.dirX*game.planeY;
    if(Math.abs(det)<0.00001)return {visible:false};
    const inv=1/det;
    const tx=inv*(game.dirY*dx-game.dirX*dy);
    const ty=inv*(-game.planeY*dx+game.planeX*dy);
    if(ty<0.2)return {visible:false};
    const lineHeight=screenH/ty;
    return {visible:true,depth:ty,centerX:(screenW/2)*(1+tx/ty),
      lineHeight,top:screenH*0.5-lineHeight*0.5,bottom:screenH*0.5+lineHeight*0.5};
  }
  function sprites(game,screenW,screenH) {
    const list=[];
    for(let i=0;i<game.items.length;i++) {
      const it=game.items[i];if(!it.active)continue;
      const p=project(game,it.x,it.y,screenW,screenH);
      if(p.visible)list.push({kind:"item",index:i,...p});
    }
    for(let i=0;i<game.anomalies.length;i++) {
      const a=game.anomalies[i];
      const p=project(game,a.x,a.y,screenW,screenH);
      if(p.visible)list.push({kind:"anomaly",index:i,type:a.type,...p});
    }
    list.sort((a,b)=>b.depth-a.depth);
    return list;
  }
  root.BackroomsRaycast={cast,project,sprites,RAY_COLS,MAX_VIEW};
})(globalThis);
