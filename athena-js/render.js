// Renderizador 2.5D para AthenaEnv usando Draw/Font.
// O mapa continua sendo raycaster, como no jogo original PS2SDK.
(function(root) {
  "use strict";
  function createRenderer() {
    let initialized=false,w=640,h=448,frame=0,wallTexture=null,pipeTexture=null;
    const color=(r,g,b,a)=>Color.new(
      Math.max(0,Math.min(255,r|0)),Math.max(0,Math.min(255,g|0)),
      Math.max(0,Math.min(255,b|0)),a===undefined?128:a);
    const rect=(x,y,rw,rh,c)=>{
      if(rw>0&&rh>0)Draw.rect(x,y,rw,rh,c);
    };
    function text(x,y,s,c,scale) {
      root.BackroomsFont.shadow(x,y,scale||1,c,s);
    }
    function centered(y,s,c,scale) {
      root.BackroomsFont.centered(y,scale||1,c,s,w);
    }
    function centeredPlain(y,s,c,scale) {
      const size=scale||1;
      root.BackroomsFont.draw((w-root.BackroomsFont.width(s,size))/2,y,size,c,s);
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
        if(c.type===1) {
          const tex=(g.level===2)?pipeTexture:wallTexture;
          if(tex) {
            const tsize=128;
            let u=Math.floor(c.u*tsize);
            if(u>tsize-1)u=tsize-1;
            let v1=(c.top-c.fullTop)/c.fullH*tsize;
            let v2=(c.bottom-c.fullTop)/c.fullH*tsize;
            if(v1<0)v1=0;if(v2>tsize)v2=tsize;
            tex.startx=u;tex.starty=v1;tex.endx=u+1;tex.endy=v2;
            tex.width=wallW;tex.height=wallH;
            tex.color=color(128*b,128*b,128*b);
            tex.draw(c.x,c.top);
            continue;
          }
        }
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
      const all=[];
      for(let i=0;i<g.items.length;i++)if(g.items[i].active) {
        const p=projectCenter(g,g.items[i].x,g.items[i].y);
        if(p)all.push({kind:"item",p});
      }
      if(g.enemyHiddenTimer<=0) {
        for(let i=0;i<g.anomalies.length;i++) {
          const a=g.anomalies[i],p=projectCenter(g,a.x,a.y);
          if(p)all.push({kind:"enemy",p,type:a.type});
        }
      }
      all.sort((a,b)=>b.p.depth-a.p.depth);
      const colW=w/scene.columns.length;
      for(const s of all) {
        const p=s.p,lh=p.size,cx=p.x;
        const cm=(cx/colW)|0;
        if(cm<0||cm>=scene.columns.length||p.depth>=scene.columns[cm].depth)continue;
        const floorY=p.horizon+lh*.5;
        if(s.kind==="item") {
          const ch=lh*.14,cw=lh*.055;
          const vis=Math.max(.3,1-p.depth/12)*g.flicker;
          rect(cx-cw*1.6,floorY-ch*1.25,cw*3.2,ch*1.25,color(15*vis,45*vis,90*vis));
          rect(cx-cw,floorY-ch,cw*2,ch,color(60*vis,140*vis,255*vis));
          rect(cx-cw,floorY-ch*.66,cw*2,ch*.30,color(240*vis,240*vis,240*vis));
          rect(cx-cw*.6,floorY-ch*1.12,cw*1.2,ch*.12,color(200*vis,200*vis,210*vis));
          continue;
        }
        const sprH=lh*.92,topY=floorY-sprH,headH=sprH*.20;
        const halfW=lh*.15,headHalf=halfW*.9;
        const vis=Math.max(.15,1-p.depth/12);
        let bodyCol,headCol,eyeCol;
        if(s.type===1) {
          bodyCol=color(190*vis,190*vis,180*vis);
          headCol=color(235*vis,235*vis,225*vis);eyeCol=color(0,0,0);
        } else if(s.type===2) {
          bodyCol=color(55*vis,4,4);headCol=color(170*vis,25,25);eyeCol=color(255,255,255);
        } else {
          bodyCol=color(8,8,8);headCol=color(235*vis,235*vis,225*vis);eyeCol=color(0,0,0);
        }
        let c0=Math.max(0,Math.floor((cx-halfW)/colW));
        let c1=Math.min(scene.columns.length-1,Math.floor((cx+halfW)/colW));
        for(let col=c0;col<=c1;col++) {
          if(p.depth>=scene.columns[col].depth)continue;
          const x0=col*colW,x1=x0+colW,xm=(x0+x1)*.5;
          rect(x0,topY+headH,colW,floorY-(topY+headH),bodyCol);
          if(Math.abs(xm-cx)<headHalf)rect(x0,topY,colW,headH,headCol);
        }
        if(p.depth<scene.columns[cm].depth) {
          const eyeSize=headH*(s.type===1 ? 0.34 : 0.20),eyeY=topY+headH*.30;
          rect(cx-headHalf*.55,eyeY,eyeSize,eyeSize,eyeCol);
          rect(cx+headHalf*.55-eyeSize,eyeY,eyeSize,eyeSize,eyeCol);
          if(s.type!==1)rect(cx-headHalf*.7,topY+headH*.68,headHalf*1.4,headH*.10,color(0,0,0));
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
      text(60,27,"REC",white,3);
      const bx=w-68,by=27;
      rect(bx,by,43,19,white);rect(bx+43,by+5,4,9,white);
      rect(bx+3,by+3,37,13,color(25,28,22));
      for(let i=0;i<3;i++)rect(bx+5+i*11,by+5,9,9,color(190,220,178));
      const sec=Math.max(1,g.survived|0);
      const clock=("0"+((sec/3600)|0)).slice(-2)+":"+("0"+(((sec/60)|0)%60)).slice(-2)+":"+("0"+(sec%60)).slice(-2);
      text(35,h-69,clock,white,3);
      for(let i=0;i<7;i++) {
        const n=(frame*37+i*7919)>>>0;
        const x=(n%Math.max(1,w-45)),y=54+((n>>>8)%(Math.max(1,h-108)));
        if((n&3)!==0)rect(x,y,5+(n%35),1,i%2?dim:white);
      }
    }
    function drawDoor(g,scene) {
      const ex=g.exitX|0,ey=g.exitY|0,det=g.planeX*g.dirY-g.dirX*g.planeY;
      if(Math.abs(det)<.0001)return;
      const invDet=1/det;
      let tx=1,ty=0,nx=0,ny=1;
      const tile=(x,y)=>(x<0||y<0||x>=40||y>=40)?1:g.map[y*40+x];
      if(tile(ex+1,ey)===0){tx=0;ty=1;nx=1;ny=0;}
      else if(tile(ex-1,ey)===0){tx=0;ty=1;nx=-1;ny=0;}
      else if(tile(ex,ey+1)===0){tx=1;ty=0;nx=0;ny=1;}
      else if(tile(ex,ey-1)===0){tx=1;ty=0;nx=0;ny=-1;}
      const point=(along,normal,z)=>({x:g.exitX+tx*along+nx*normal,y:g.exitY+ty*along+ny*normal,z});
      const project=(v)=>{
        const rx=v.x-g.px,ry=v.y-g.py;
        const cameraX=invDet*(g.dirY*rx-g.dirX*ry);
        const depth=invDet*(-g.planeY*rx+g.planeX*ry);
        if(depth<=.18)return null;
        return {x:w*.5*(1+cameraX/depth),y=h*(.5+g.pitch)+(.5-v.z)*h/depth,depth};
      };
      const face=(a,b,c0,d,col)=>{
        const p1=project(a),p2=project(b),p3=project(c0),p4=project(d);
        if(!p1||!p2||!p3||!p4)return;
        if(p1.x< -w||p1.x>w*2||p2.x< -w||p2.x>w*2||p3.x< -w||p3.x>w*2||p4.x< -w||p4.x>w*2)return;
        Draw.quad(p1.x,p1.y,p2.x,p2.y,p3.x,p3.y,p4.x,p4.y,col,col,col,col);
      };
      const center=project(point(0,0,.5));
      if(!center)return;
      const centerCol=(center.x/(w/scene.columns.length))|0;
      if(centerCol<0||centerCol>=scene.columns.length||scene.columns[centerCol].type!==2)return;
      const glow=1.05+.25*g.flicker;
      face(point(-.39,.010,0),point(.39,.010,0),point(.39,.010,.98),point(-.39,.010,.98),color(145*glow,145*glow,155*glow));
      face(point(-.35,.014,.02),point(.35,.014,.02),point(.35,.014,.94),point(-.35,.014,.94),color(205*glow,205*glow,210*glow));
      face(point(-.29,.018,.05),point(.29,.018,.05),point(.29,.018,.90),point(-.29,.018,.90),color(245*glow,245*glow,245*glow));
      face(point(-.15,.024,.08),point(.15,.024,.08),point(.15,.024,.86),point(-.15,.024,.86),color(255,255,255));
      face(point(-.43,.075,0),point(-.33,.075,0),point(-.33,.075,1),point(-.43,.075,1),color(48,29,17));
      face(point(.33,.075,0),point(.43,.075,0),point(.43,.075,1),point(.33,.075,1),color(48,29,17));
      face(point(-.43,.075,.91),point(.43,.075,.91),point(.43,.075,1),point(-.43,.075,1),color(75,47,26));
      face(point(-.43,0,0),point(-.43,.075,0),point(-.43,.075,1),point(-.43,0,1),color(29,18,12));
      face(point(.43,0,0),point(.43,.075,0),point(.43,.075,1),point(.43,0,1),color(29,18,12));
      const hinge=-.33,leafW=.66,ca=.53,sa=.85;
      const leaf=(u,z,offset)=>point(hinge+u*ca,.085+u*sa+offset,z);
      face(leaf(0,.035,0),leaf(leafW,.035,0),leaf(leafW,.91,0),leaf(0,.91,0),color(91,52,27));
      face(leaf(.04,.08,.006),leaf(leafW-.04,.08,.006),leaf(leafW-.04,.43,.006),leaf(.04,.43,.006),color(139,87,44));
      face(leaf(.04,.53,.006),leaf(leafW-.04,.53,.006),leaf(leafW-.04,.86,.006),leaf(.04,.86,.006),color(139,87,44));
      face(leaf(.075,.12,.010),leaf(leafW-.075,.12,.010),leaf(leafW-.075,.39,.010),leaf(.075,.39,.010),color(76,43,24));
      face(leaf(.075,.57,.010),leaf(leafW-.075,.57,.010),leaf(leafW-.075,.82,.010),leaf(.075,.82,.010),color(76,43,24));
      for(let grain=0;grain<5;grain++) {
        const u=.12+grain*.105;
        face(leaf(u,.15,.014),leaf(u+.012,.15,.014),leaf(u+.012,.80,.014),leaf(u,.80,.014),color(158+grain*2,101+grain*2,51));
      }
      face(leaf(leafW-.025,.04,.018),leaf(leafW,.04,.018),leaf(leafW,.90,.018),leaf(leafW-.025,.90,.018),color(39,23,14));
      face(leaf(.10,.43,.020),leaf(.18,.43,.020),leaf(.18,.49,.020),leaf(.10,.49,.020),color(240,184,55));
      face(point(-.43,.02,0),point(.43,.02,0),point(.43,.13,.025),point(-.43,.13,.025),color(84,54,30));
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
      text(20,16,"NIVEL "+g.level,color(240,240,220),2);
      if(g.calmTimer>0) {
        rect(18,h-45,w*.22,7,color(20,20,20));
        rect(20,h-43,w*.18*(g.calmTimer/5),3,color(60,140,255));
      }
      if(g.msgTimer>0) {
        const msg=g.msgId===1?"ENCONTRE A PORTA ABERTA COM A LUZ BRANCA":g.msgId===2?"AGUA DE AMENDOA!":g.msgId===3?"NIVEL 2: PIPE DREAMS":"";
        if(msg)centered(h*.78,msg,color(250,250,240),3);
      }
      if(g.level===2&&Math.hypot(g.px-8.5,g.py-19.5)<2.5)
        centered(h*.72,g.hiding?"APERTE QUADRADO PARA SAIR":"APERTE QUADRADO PARA SE ESCONDER",color(245,245,225),2);
      text(w-92,h-31,g.flashlight?"LANT ON":"LANT OFF",g.flashlight?color(255,235,145):color(115,115,105),2);
    }
    function drawTitle() {
      rect(0,0,w,h,color(30,27,8));
      rect(0,h*.28,w,h*.32,color(205,186,84));
      centeredPlain(h*.34,"BACKROOMS",color(50,40,5),8);
      centeredPlain(h*.50,"NIVEL 0",color(90,75,15),3);
      if((frame/30|0)%2===0)centered(h*.68,"APERTE START OU R2",color(240,240,240),3);
      centered(h*.80,"ANALOGICO DIREITO: OLHAR E VIRAR",color(200,200,190),2);
      centered(h*.86,"R1: CORRER  L1: LANTERNA",color(200,200,190),2);
    }
    function drawDead(g) {
      rect(0,0,w,h,color(0,0,0));
      const size=h*.50,cx=w*.5+Math.sin(frame)*3,top=h*.06;
      const runner=g.killer===2,stalker=g.killer===1;
      rect(cx-size*.5,top,size,size*.9,runner?color(170,25,25):color(225,225,212));
      const eyeW=size*(stalker ? 0.16 : 0.10);
      const eye=runner?color(255,255,255):color(0,0,0);
      rect(cx-size*(.20+(stalker ? 0.16 : 0.10)),top+size*.9*.26,size*.10+eyeW*.25,size*.9*.20,eye);
      rect(cx+size*.10,top+size*.9*.26,size*(.10+eyeW*.25),size*.9*.20,eye);
      if(!stalker)rect(cx-size*.34,top+size*.9*.62,size*.68,size*.9*.10,color(0,0,0));
      const sec=g.survived|0;
      const clock=("0"+((sec/60)|0)).slice(-2)+":"+("0"+(sec%60)).slice(-2);
      centered(h*.74,"VOCE FOI PEGO",color(200,20,20),4);
      centered(h*.84,"NIVEL "+g.level+"  TEMPO "+clock,color(220,220,220),2);
      if(g.deadTime>1.5&&(frame/30|0)%2===0)centered(h*.91,"APERTE START",color(240,240,240),2);
    }
    return {
      init(textures) {
        if(typeof Screen==="undefined"||typeof Draw==="undefined"||typeof Color==="undefined"||!root.BackroomsFont)
          throw new Error("AthenaEnv precisa dos modulos Screen, Draw, Font e Color.");
        Screen.setParam(Screen.DEPTH_TEST_ENABLE,false);
        Screen.setVSync(true);
        const mode=Screen.getMode();w=mode.width;h=mode.height;
        if(textures){wallTexture=textures.wall||null;pipeTexture=textures.pipe||null;}
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
