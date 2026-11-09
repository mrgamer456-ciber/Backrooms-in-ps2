// Renderizador 2.5D para AthenaEnv usando Draw/Font.
// O mapa continua sendo raycaster, como no jogo original PS2SDK.
(function(root) {
  "use strict";
  function createRenderer() {
    let initialized=false,w=640,h=448,font=null,frame=0;
    const color=(r,g,b,a)=>Color.new(
      Math.max(0,Math.min(255,r|0)),Math.max(0,Math.min(255,g|0)),
      Math.max(0,Math.min(255,b|0)),a===undefined?128:a);
    const rect=(x,y,rw,rh,c)=>{
      if(rw>0&&rh>0)Draw.rect(x,y,rw,rh,c);
    };
    function text(x,y,s,c,scale) {
      if(!font)return;
      font.color=c;font.scale=scale||1;font.print(x,y,s);
    }
    function drawBackground(g,scene) {
      const horizon=scene.horizon;
      const bands=16;
      for(let i=0;i<bands;i++) {
        const t=(i+0.5)/bands;
        const y0=horizon*i/bands,y1=horizon*(i+1)/bands;
        const fy0=horizon+(h-horizon)*i/bands;
        const fy1=horizon+(h-horizon)*(i+1)/bands;
        if(g.level===2) {
          const k=(0.58*(1-t)+0.10)*g.flicker;
          rect(0,y0,w,y1-y0,color(72*k,76*k,72*k));
          rect(0,fy0,w,fy1-fy0,color(43*k,42*k,37*k));
          if(i%3===0)rect(0,y0,w,2,color(28,29,27));
        } else {
          const k=(0.72*(1-t)+0.16)*g.flicker;
          rect(0,y0,w,y1-y0,color(218*k,211*k,166*k));
          const fk=(0.50*(1-t)+0.08)*g.flicker;
          rect(0,fy0,w,fy1-fy0,color(120*fk,95*fk,50*fk));
        }
      }
      for(let i=0;i<5;i++) {
        const t=i/4,cy=8+(horizon-8)*t;
        const hw=w*(0.025+0.105*(1-t)),hh=h*(0.004+0.018*(1-t));
        const glow=(0.72+0.28*g.flicker)*(1-0.10*t);
        if(g.level===2) {
          rect(w/2-hw*1.25,cy-hh*1.8,hw*2.5,hh*3.6,color(95*glow,18*glow,10*glow));
          rect(w/2-hw,cy-hh,hw*2,hh*2,color(38,34,30));
          rect(w/2-hw*.82,cy-hh*.6,hw*1.64,hh*1.2,color(255*glow,72*glow,35*glow));
        } else {
          rect(w/2-hw*1.3,cy-hh*1.75,hw*2.6,hh*3.5,color(232*glow,222*glow,166*glow));
          rect(w/2-hw,cy-hh,hw*2,hh*2,color(65,61,43));
          rect(w/2-hw*.88,cy-hh*.7,hw*1.76,hh*1.4,color(255*glow,255*glow,238*glow));
        }
      }
    }
    function drawWalls(g,scene) {
      for(let i=0;i<scene.columns.length;i++) {
        const c=scene.columns[i];if(c.bottom<=c.top)continue;
        let b=c.brightness*g.flicker;
        let r,gr,bl;
        if(c.type===2) {r=255;gr=255;bl=255;b=Math.max(1,b);}
        else if(g.level===2){r=87;gr=78;bl=63;}
        else {r=205;gr=186;bl=84;}
        const wallW=c.x2-c.x,wallH=c.bottom-c.top;
        if(c.type!==2&&g.level===1) {
          const texX=(c.u*128)|0,sx=texX%32;
          const stain=0.90+(((texX*17+((c.depth*13)|0)*29)&15)/150);
          b*=stain;
          if(sx<4)b*=0.86;
          else if(sx===4)b*=1.05;
        }
        rect(c.x,c.top,wallW,wallH,color(r*b,gr*b,bl*b));
        if(c.type===1&&g.level===1) {
          // Relevo repetido do papel de parede: costuras e losangos discretos.
          const texX=(c.u*128)|0,sx=texX%32;
          if(sx<4)rect(c.x,c.top,wallW,wallH,color(r*b*.86,gr*b*.86,bl*b*.86));
          const center=(c.top+c.bottom)*.5;
          const diamond=(texX%32)-16;
          const markY=center+diamond*1.8;
          if(Math.abs(diamond)<7&&markY>c.top&&markY<c.bottom)
            rect(c.x,markY,wallW,Math.max(1,wallH*.018),color(r*b*.88,gr*b*.88,bl*b*.88));
          if(c.bottom-c.top>30) {
            rect(c.x,c.top,wallW,Math.max(1,wallH*.012),color(r*b*.78,gr*b*.78,bl*b*.78));
            rect(c.x,c.bottom-Math.max(1,wallH*.012),wallW,Math.max(1,wallH*.012),color(r*b*.82,gr*b*.82,bl*b*.82));
          }
        } else if(c.type===1&&g.level===2) {
          // Cano vermelho, flange metalica e suporte repetidos no corredor Pipe Dreams.
          const pipeY=(c.top+wallH*.19);
          rect(c.x,pipeY,wallW,Math.max(2,wallH*.10),color(105*b,20*b,13*b));
          rect(c.x,pipeY+Math.max(2,wallH*.025),wallW,Math.max(1,wallH*.018),color(190*b,48*b,30*b));
          rect(c.x,pipeY+Math.max(2,wallH*.095),wallW,Math.max(2,wallH*.035),color(105*b,103*b,91*b));
        }
      }
    }
    function projectCenter(g,x,y) {
      const dx=x-g.px,dy=y-g.py;
      const det=g.planeX*g.dirY-g.dirX*g.planeY;
      if(Math.abs(det)<.0001)return null;
      const inv=1/det;
      const tx=inv*(g.dirY*dx-g.dirX*dy);
      const ty=inv*(-g.planeY*dx+g.planeX*dy);
      if(ty<.2)return null;
      const horizon=Math.max(h*.12,Math.min(h*.90,h*(.5+g.pitch)+g.jumpHeight*h*.55));
      return {x:w*.5*(1+tx/ty),size:h/ty,depth:ty,horizon};
    }
    function drawSprites(g,scene) {
      // Desenha primeiro os objetos distantes para manter a ordem de profundidade.
      const all=[];
      for(let i=0;i<g.items.length;i++)if(g.items[i].active) {
        const p=projectCenter(g,g.items[i].x,g.items[i].y);
        if(p)all.push({kind:"item",p});
      }
      for(let i=0;i<g.anomalies.length;i++) {
        const a=g.anomalies[i],p=projectCenter(g,a.x,a.y);
        if(p)all.push({kind:"enemy",p,type:a.type,seen:a.seen});
      }
      all.sort((a,b)=>b.p.depth-a.p.depth);
      for(const s of all) {
        const centerCol=Math.max(0,Math.min(scene.columns.length-1,(s.p.x/(w/scene.columns.length))|0));
        if(s.p.depth>=scene.columns[centerCol].depth)continue;
        if(s.kind==="enemy"&&g.enemyHiddenTimer>0)continue;
        const size=Math.max(3,Math.min(h*1.2,s.p.size*.72));
        const x=s.p.x-size*.5,y=s.p.horizon-size*.5;
        if(s.kind==="item") {
          rect(x+size*.36,y+size*.35,size*.28,size*.42,color(170,190,130));
          rect(x+size*.30,y+size*.30,size*.40,size*.10,color(210,220,180));
        } else {
          const red=s.type===2;
          const face=red?color(145,20,20):color(215,215,200);
          rect(x+size*.22,y+size*.12,size*.56,size*.78,face);
          rect(x+size*.30,y+size*.34,size*.12,size*.10,color(5,5,5));
          rect(x+size*.58,y+size*.34,size*.12,size*.10,color(5,5,5));
          if(s.type!==1)rect(x+size*.35,y+size*.66,size*.30,size*.06,color(0,0,0));
        }
      }
    }
    function drawHand(g) {
      // Mesmas proporcoes e pontos do modelo de mao/lanterna aprovado no C++.
      const bob=Math.sin(g.walkDist*9)*2,x=w-8,y=h+8+bob;
      Draw.quad(x-70,y-5,x+8,y-82,x+8,y+8,x-48,y+16,color(38,39,34),color(38,39,34),color(38,39,34),color(38,39,34));
      rect(x-67,y-14,19,16,color(76,73,62));
      Draw.quad(x-111,y-105,x-55,y-119,x-29,y-76,x-77,y-59,color(164,112,78),color(164,112,78),color(164,112,78),color(164,112,78));
      rect(x-83,y-91,38,15,color(190,137,99));
      rect(x-101,y-103,18,14,color(205,151,111));
      Draw.quad(x-151,y-145,x-126,y-161,x-54,y-91,x-77,y-69,color(42,46,48),color(42,46,48),color(42,46,48),color(42,46,48));
      Draw.quad(x-145,y-149,x-135,y-155,x-63,y-87,x-73,y-78,color(112,119,116),color(112,119,116),color(112,119,116),color(112,119,116));
      Draw.quad(x-158,y-139,x-142,y-154,x-128,y-140,x-143,y-125,color(24,27,28),color(24,27,28),color(24,27,28),color(24,27,28));
      if(g.flashlight) {
        rect(x-177,y-161,58,58,color(160,132,70));
        rect(x-169,y-153,43,42,color(255,226,133));
        rect(x-164,y-148,32,32,color(255,255,220));
      } else {
        rect(x-164,y-148,32,32,color(49,55,55));
        rect(x-158,y-142,20,20,color(20,24,25));
      }
    }
    function drawVhs(g) {
      const white=color(232,235,218),dim=color(150,157,139),pad=13;
      rect(pad,pad,54,3,white);rect(pad,pad,3,35,white);
      rect(w-pad-54,pad,54,3,white);rect(w-pad-3,pad,3,35,white);
      rect(pad,h-pad-3,54,3,white);rect(pad,h-pad-35,3,35,white);
      rect(w-pad-54,h-pad-3,54,3,white);rect(w-pad-3,h-pad-35,3,35,white);
      if((frame/25|0)%2===0)rect(38,30,12,12,color(235,22,18));
      text(60,25,"REC",white,1.5);
      const bx=w-68,by=27;
      rect(bx,by,43,19,white);rect(bx+43,by+5,4,9,white);
      rect(bx+3,by+3,37,13,color(25,28,22));
      for(let i=0;i<3;i++)rect(bx+5+i*11,by+5,9,9,color(190,220,178));
      const sec=Math.max(1,g.survived|0);
      const clock=("0"+((sec/3600)|0)).slice(-2)+":"+("0"+(((sec/60)|0)%60)).slice(-2)+":"+("0"+(sec%60)).slice(-2);
      text(35,h-70,clock,white,1.5);
      for(let i=0;i<7;i++) {
        const n=(frame*37+i*7919)>>>0;
        const x=(n%Math.max(1,w-45)),y=54+((n>>>8)%(Math.max(1,h-108)));
        if((n&3)!==0)rect(x,y,5+(n%35),1,i%2?dim:white);
      }
    }
    function drawDoor(g,scene) {
      const p=projectCenter(g,g.exitX,g.exitY);
      if(!p)return;
      const col=Math.max(0,Math.min(scene.columns.length-1,(p.x/(w/scene.columns.length))|0));
      if(scene.columns[col].type!==2||p.depth>scene.columns[col].depth+0.8)return;
      const dh=Math.min(h*1.5,p.size*.92),dw=dh*.55;
      const x=p.x-dw*.5,y=p.horizon-dh*.50;
      rect(x-dw*.10,y-dh*.04,dw*1.20,dh*1.08,color(150,150,160));
      rect(x-dw*.06,y-dh*.02,dw*1.12,dh*1.04,color(55,34,20));
      rect(x,y,dw,dh,color(255,255,255));
      rect(x+dw*.13,y+dh*.08,dw*.74,dh*.84,color(245,245,245));
      rect(x+dw*.28,y+dh*.12,dw*.44,dh*.76,color(255,255,255));
      rect(x-dw*.08,y-dh*.05,dw*1.16,dh*.035,color(255,255,255));
    }
    function drawCabinet(g,scene) {
      if(g.level!==2||!g.cabinets.length)return;
      const cab=g.cabinets[0],p=projectCenter(g,cab.x,cab.y);
      if(!p)return;
      const col=Math.max(0,Math.min(scene.columns.length-1,(p.x/(w/scene.columns.length))|0));
      if(p.depth>=scene.columns[col].depth+0.6)return;
      const hh=Math.min(h*1.2,p.size*.78),ww=hh*.48;
      const x=p.x-ww*.5,y=p.horizon-hh*.5;
      rect(x-ww*.05,y-hh*.02,ww*1.10,hh*1.04,color(22,25,27));
      rect(x,y,ww,hh,color(82,91,94));
      rect(x+ww*.08,y+hh*.08,ww*.84,hh*.82,color(48,56,59));
      rect(x+ww*.48,y+hh*.12,ww*.07,hh*.76,color(125,133,132));
      rect(x+ww*.78,y+hh*.45,ww*.07,hh*.12,color(190,145,55));
    }
    function drawHud(g) {
      if(g.nearest<5) {
        const danger=(5-g.nearest)*14;
        rect(0,0,danger,h,color(120,0,0));
        rect(w-danger,0,danger,h,color(120,0,0));
      }
      rect(18,h-28,w*.22,8,color(25,25,20));
      rect(20,h-26,w*.18*Math.max(0,g.stamina),4,color(g.stamina<.25?210:190,g.stamina<.25?45:180,100));
      text(18,h-48,"NIVEL "+g.level,color(230,230,215),1);
      if(g.calmTimer>0) {
        rect(18,h-45,w*.22,7,color(20,20,20));
        rect(20,h-43,w*.18*(g.calmTimer/5),3,color(60,140,255));
      }
      if(g.msgTimer>0) {
        const msg=g.msgId===1?"ENCONTRE A PORTA ABERTA COM A LUZ BRANCA":g.msgId===2?"AGUA DE AMENDOA!":g.msgId===3?"NIVEL 2: PIPE DREAMS":"";
        if(msg)text(w*.5-105,h*.78,msg,color(250,250,240),.8);
      }
      if(g.level===2&&Math.hypot(g.px-8.5,g.py-19.5)<2.5)
        text(w*.5-75,h*.72,g.hiding?"APERTE QUADRADO PARA SAIR":"APERTE QUADRADO PARA SE ESCONDER",color(245,245,225),.7);
      text(w-105,h-31,g.flashlight?"LANT ON":"LANT OFF",g.flashlight?color(255,235,145):color(115,115,105),.8);
    }
    function drawTitle() {
      rect(0,0,w,h,color(30,27,8));
      rect(0,h*.28,w,h*.32,color(205,186,84));
      text(w*.5-82,h*.35,"BACKROOMS",color(50,40,5),2);
      text(w*.5-34,h*.51,"NIVEL 0",color(90,75,15),1.3);
      if((frame/30|0)%2===0)text(w*.5-80,h*.69,"APERTE START OU R2",color(240,240,240),1);
      text(w*.5-115,h*.82,"ANALOGICO DIREITO: OLHAR E VIRAR",color(200,200,190),.7);
      text(w*.5-88,h*.88,"R1: CORRER  L1: LANTERNA",color(200,200,190),.8);
    }
    function drawDead(g) {
      rect(0,0,w,h,color(0,0,0));
      const size=h*.50,cx=w*.5+Math.sin(frame)*3,top=h*.06;
      const runner=g.killer===2,stalker=g.killer===1;
      rect(cx-size*.5,top,size,size*.9,runner?color(170,25,25):color(225,225,212));
      const eyeW=size*(stalker?.16:.10);
      const eye=runner?color(255,255,255):color(0,0,0);
      rect(cx-size*(.20+(stalker?.16:.10)),top+size*.9*.26,size*.10+eyeW*.25,size*.9*.20,eye);
      rect(cx+size*.10,top+size*.9*.26,size*(.10+eyeW*.25),size*.9*.20,eye);
      if(!stalker)rect(cx-size*.34,top+size*.9*.62,size*.68,size*.9*.10,color(0,0,0));
      const sec=g.survived|0;
      const clock=("0"+((sec/60)|0)).slice(-2)+":"+("0"+(sec%60)).slice(-2);
      text(w*.5-75,h*.74,"VOCE FOI PEGO",color(200,20,20),1.5);
      text(w*.5-85,h*.84,"NIVEL "+g.level+"  TEMPO "+clock,color(220,220,220),1);
      if(g.deadTime>1.5&&(frame/30|0)%2===0)text(w*.5-55,h*.92,"APERTE START",color(240,240,240),1);
    }
    return {
      init() {
        if(typeof Screen==="undefined"||typeof Draw==="undefined"||typeof Font==="undefined"||typeof Color==="undefined")
          throw new Error("AthenaEnv precisa dos modulos Screen, Draw, Font e Color.");
        Screen.setParam(Screen.DEPTH_TEST_ENABLE,false);
        Screen.setVSync(true);
        const mode=Screen.getMode();w=mode.width;h=mode.height;
        font=new Font("default");font.scale=1;
        initialized=true;
      },
      draw(game) {
        if(!initialized)throw new Error("Renderer ainda nao inicializado.");
        frame++;Screen.clear(color(0,0,0));
        if(game.onTitle){drawTitle();Screen.flip();return;}
        if(game.dead){drawDead(game);Screen.flip();return;}
        const scene=root.BackroomsRaycast.cast(game,w,h,128);
        drawBackground(game,scene);drawWalls(game,scene);
        drawDoor(game,scene);drawCabinet(game,scene);drawSprites(game,scene);
        drawHand(game);drawHud(game);drawVhs(game);
        Screen.flip();
      }
    };
  }
  root.BackroomsRenderer={createRenderer};
})(globalThis);
