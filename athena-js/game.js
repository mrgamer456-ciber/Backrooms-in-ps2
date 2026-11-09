// Backrooms PS2 — logica de jogo em JavaScript (sem chamadas graficas).
// Port inicial de game.h/game.cpp. Mantem as regras do projeto original.
(function (root) {
  "use strict";
  const W = 40, H = 40, MAX_ANOMALIES = 4, MAX_ITEMS = 4;
  const WALK = 2.2, RUN = 3.6, TURN = 2.6, PLAYER_R = 0.22;
  const SMILER = 0, STALKER = 1, RUNNER = 2;
  const MSG_NONE = 0, MSG_FIND_DOOR = 1, MSG_ALMOND = 2, MSG_PIPE = 3;

  function makeGame() {
    return {
      map: new Uint8Array(W * H), dist: new Int16Array(W * H),
      px: 3.5, py: 20.5, angle: 0, pitch: 0, dirX: 1, dirY: 0,
      planeX: 0, planeY: 0, stamina: 1, exhausted: false,
      flashlight: false, hiding: false, enemyHiddenTimer: 0, hiddenCabinet: -1,
      jumpHeight: 0, jumpVelocity: 0, cabinets: [], level: 1,
      dead: false, deadTime: 0, survived: 0, anomalies: [], items: [],
      killer: 0, pickups: 0, calmTimer: 0, walkDist: 0, flicker: 1,
      msgId: 0, msgTimer: 0, nearest: 99, bfsTimer: 0, rng: 1,
      exitX: 38.5, exitY: 20.5, onTitle: true, mapRevision: 0
    };
  }
  const at = (x,y) => y * W + x;
  function rnd(g) { g.rng = (Math.imul(g.rng,1664525)+1013904223)>>>0; return g.rng>>>8; }
  function range(g,a,b) { return a + rnd(g) % (b-a+1); }
  function floor(g,x,y) { return x>=0&&y>=0&&x<W&&y<H&&g.map[at(x,y)]===0; }
  function carve(g,x0,y0,x1,y1) {
    for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++)
      if(x>=1&&y>=1&&x<W-1&&y<H-1) g.map[at(x,y)]=0;
  }
  function dirs(g) {
    g.dirX=Math.cos(g.angle); g.dirY=Math.sin(g.angle);
    g.planeX=-g.dirY*0.66; g.planeY=g.dirX*0.66;
  }
  function distances(g) {
    g.dist.fill(-1); const sx=g.px|0, sy=g.py|0;
    if(!floor(g,sx,sy)) return;
    const q=new Int16Array(W*H); let head=0,tail=0;
    g.dist[at(sx,sy)]=0; q[tail++]=at(sx,sy);
    const dx=[1,-1,0,0],dy=[0,0,1,-1];
    while(head<tail) {
      const c=q[head++], x=c%W,y=(c/W)|0;
      for(let k=0;k<4;k++){const nx=x+dx[k],ny=y+dy[k],ni=at(nx,ny);
        if(floor(g,nx,ny)&&g.dist[ni]===-1){g.dist[ni]=g.dist[c]+1;q[tail++]=ni;}
      }
    }
  }
  function generate(g) {
    g.map.fill(1); g.cabinets=[]; g.hiding=false; g.enemyHiddenTimer=0; g.hiddenCabinet=-1;
    if(g.level===2) {
      carve(g,1,20,38,20); carve(g,7,18,8,20); g.map[at(8,19)]=3;
      g.px=3.5;g.py=20.5;g.angle=0;g.cabinets.push({x:8.5,y:19.5,active:true});
      g.exitX=38.5;g.exitY=20.5;g.map[at(38,20)]=2;
    } else {
      let pcx=0,pcy=0;
      for(let i=0;i<22;i++){
        const rw=range(g,3,8),rh=range(g,3,8),x=range(g,1,W-2-rw),y=range(g,1,H-2-rh);
        carve(g,x,y,x+rw-1,y+rh-1);const cx=x+(rw>>1),cy=y+(rh>>1);
        if(i===0){g.px=cx+.5;g.py=cy+.5;}
        else {let xx=pcx,yy=pcy;while(xx!==cx){carve(g,xx,yy,xx+1,yy+1);xx+=cx>xx?1:-1;}
          while(yy!==cy){carve(g,xx,yy,xx+1,yy+1);yy+=cy>yy?1:-1;}}
        pcx=cx;pcy=cy;
      }
      // Pilares aleatorios somente no nivel 1, como no codigo C++ original.
      if(g.level!==2) {
        for(let y=2;y<H-2;y++) for(let x=2;x<W-2;x++) {
          if(g.map[at(x,y)]!==0||rnd(g)%9!==0)continue;
          if(Math.abs(x-(g.px|0))<=1&&Math.abs(y-(g.py|0))<=1)continue;
          let open=true;
          for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)
            if(g.map[at(x+dx,y+dy)]!==0)open=false;
          if(open)g.map[at(x,y)]=1;
        }
      }
      let best=-1,bx=-1,by=-1;
      for(let t=0;t<4000;t++){const x=range(g,1,W-2),y=range(g,1,H-2);
        if(g.map[at(x,y)]!==1)continue;
        if(!(floor(g,x+1,y)||floor(g,x-1,y)||floor(g,x,y+1)||floor(g,x,y-1)))continue;
        const dx=x+.5-g.px,dy=y+.5-g.py,d=dx*dx+dy*dy;
        if(d>best){best=d;bx=x;by=y;}if(d>256)break;
      }
      if(bx>=0){g.map[at(bx,by)]=2;g.exitX=bx+.5;g.exitY=by+.5;}
    }
    g.anomalies=[];
    const count=g.level===2?1:Math.min(MAX_ANOMALIES,1+((g.level-1)/2|0));
    for(let i=0;i<count;i++){
      let x=range(g,1,W-2),y=range(g,1,H-2);
      for(let t=0;t<600;t++){x=range(g,1,W-2);y=range(g,1,H-2);
        const dx=x+.5-g.px,dy=y+.5-g.py;if(floor(g,x,y)&&dx*dx+dy*dy>196)break;}
      if(g.level===2){x=29;y=20;}
      g.anomalies.push({x:x+.5,y:y+.5,type:i===0&&g.level===1?SMILER:rnd(g)%3,timer:0,running:false,seen:false});
    }
    g.items=[];
    for(let i=0;i<2;i++){let x=g.px|0,y=g.py|0;
      for(let t=0;t<600;t++){x=range(g,1,W-2);y=range(g,1,H-2);
        const dx=x+.5-g.px,dy=y+.5-g.py;if(floor(g,x,y)&&dx*dx+dy*dy>25)break;}
      g.items.push({x:x+.5,y:y+.5,active:true});
    }
  }
  function startLevel(g) {
    generate(g);g.mapRevision++;g.bfsTimer=0;g.nearest=99;g.calmTimer=0;g.flicker=1;
    g.msgId=g.level===1?MSG_FIND_DOOR:(g.level===2?MSG_PIPE:MSG_NONE);
    g.msgTimer=g.level<=2?5:0;dirs(g);distances(g);
  }
  function newGame(g,seed) {
    g.rng=(seed>>>0)||1;g.level=1;g.dead=false;g.deadTime=0;g.killer=0;
    g.walkDist=0;g.pickups=0;g.survived=0;g.stamina=1;g.exhausted=false;
    g.flashlight=false;g.hiding=false;g.enemyHiddenTimer=0;g.jumpHeight=0;g.jumpVelocity=0;
    g.angle=0;g.pitch=0;startLevel(g);
  }
  function solid(g,x,y) {
    const ix=Math.floor(x),iy=Math.floor(y);
    return ix<0||iy<0||ix>=W||iy>=H||g.map[at(ix,iy)]!==0;
  }
  function blocked(g,x,y) {const r=PLAYER_R;return solid(g,x-r,y-r)||solid(g,x+r,y-r)||solid(g,x-r,y+r)||solid(g,x+r,y+r);}
  function sees(g,a) {
    const dx=a.x-g.px,dy=a.y-g.py,depth=dx*g.dirX+dy*g.dirY;
    if(depth<.1)return false;const side=dx*(-g.dirY)+dy*g.dirX;
    if(Math.abs(side)>depth*.8)return false;
    const d=Math.hypot(dx,dy),steps=(d/.15|0)+1;
    for(let i=1;i<steps;i++){const t=i/steps;if(solid(g,g.px+dx*t,g.py+dy*t))return false;}
    return true;
  }
  function update(g,input,dt) {
    const i=input||{};
    if(g.dead){g.deadTime+=dt;if(i.restart&&g.deadTime>1.5)newGame(g,g.rng^0x9E3779B9);return;}
    g.survived+=dt;if(i.toggleFlashlight)g.flashlight=!g.flashlight;
    if(i.jump&&g.jumpHeight<=.001&&!g.hiding)g.jumpVelocity=4.5;
    if(g.jumpVelocity!==0||g.jumpHeight>0){g.jumpHeight+=g.jumpVelocity*dt;g.jumpVelocity-=8.5*dt;
      if(g.jumpHeight<=0){g.jumpHeight=0;g.jumpVelocity=0;}}
    if(i.interact&&g.level===2){
      if(g.hiding){g.hiding=false;g.hiddenCabinet=-1;}
      else for(let n=0;n<g.cabinets.length;n++){const c=g.cabinets[n],dx=c.x-g.px,dy=c.y-g.py;
        if(dx*dx+dy*dy<4){g.hiding=true;g.hiddenCabinet=n;g.enemyHiddenTimer=10;
          g.jumpHeight=0;g.jumpVelocity=0;break;}}
    }
    if(g.enemyHiddenTimer>0)g.enemyHiddenTimer=Math.max(0,g.enemyHiddenTimer-dt);
    if(g.hiding){g.msgTimer=Math.max(0,g.msgTimer-dt);return;}
    g.angle+= (i.turn||0)*TURN*dt;g.pitch=Math.max(-.38,Math.min(.38,g.pitch+(i.lookY||0)*1.35*dt));dirs(g);
    const intent=Math.abs(i.moveX||0)+Math.abs(i.moveY||0),run=!!i.sprint&&!g.exhausted&&intent>.1;
    if(run){g.stamina=Math.max(0,g.stamina-.30*dt);if(g.stamina===0)g.exhausted=true;}
    else{g.stamina=Math.min(1,g.stamina+.15*dt);if(g.exhausted&&g.stamina>.3)g.exhausted=false;}
    let mx=g.dirX*(i.moveY||0)-g.dirY*(i.moveX||0),my=g.dirY*(i.moveY||0)+g.dirX*(i.moveX||0);
    const len=Math.hypot(mx,my);if(len>1){mx/=len;my/=len;}
    const speed=run?RUN:WALK,ox=g.px,oy=g.py,nx=g.px+mx*speed*dt;
    if(!blocked(g,nx,g.py))g.px=nx;const ny=g.py+my*speed*dt;if(!blocked(g,g.px,ny))g.py=ny;
    g.walkDist+=Math.hypot(g.px-ox,g.py-oy);
    g.calmTimer=Math.max(0,g.calmTimer-dt);g.msgTimer=Math.max(0,g.msgTimer-dt);
    for(const item of g.items)if(item.active&&Math.hypot(item.x-g.px,item.y-g.py)<.6){
      item.active=false;g.stamina=1;g.exhausted=false;g.calmTimer=5;g.pickups++;g.msgId=MSG_ALMOND;g.msgTimer=2.5;}
    if(--g.bfsTimer<=0){distances(g);g.bfsTimer=12;}
    const baseSpeed=Math.min(3.4,1.9+.25*(g.level-1)),dxs=[1,-1,0,0],dys=[0,0,1,-1];g.nearest=99;
    for(const a of g.anomalies){if(g.enemyHiddenTimer>0)break;
      const dx=g.px-a.x,dy=g.py-a.y,d=Math.hypot(dx,dy);g.nearest=Math.min(g.nearest,d);
      let spd=baseSpeed;
      if(a.type===STALKER){a.seen=sees(g,a);spd=a.seen?0:baseSpeed*1.45;}
      else if(a.type===RUNNER){a.timer-=dt;if(a.timer<=0){a.running=!a.running;a.timer=a.running?1.3:.9;}spd=a.running?baseSpeed*1.7:baseSpeed*.25;}
      let cx=a.x|0,cy=a.y|0,tx=g.px,ty=g.py;
      if(!(cx===(g.px|0)&&cy===(g.py|0))){let best=g.dist[at(cx,cy)];if(best<0)best=1<<20;let bx=cx,by=cy;
        for(let k=0;k<4;k++){const nx2=cx+dxs[k],ny2=cy+dys[k];if(!floor(g,nx2,ny2))continue;
          const dd=g.dist[at(nx2,ny2)];if(dd>=0&&dd<best){best=dd;bx=nx2;by=ny2;}}
        if(bx!==cx||by!==cy){tx=bx+.5;ty=by+.5;}}
      if(g.calmTimer>0&&spd>0)spd*=.55;const vx=tx-a.x,vy=ty-a.y,vl=Math.hypot(vx,vy);
      if(vl>.001){const step=Math.min(spd*dt,vl);a.x+=vx/vl*step;a.y+=vy/vl*step;}
      if(d<.5){g.dead=true;g.deadTime=0;g.killer=a.type;return;}
    }
    const r1=(rnd(g)&65535)/65535,r2=(rnd(g)&65535)/65535;g.flicker=.93+.07*r1;
    if(g.nearest<6&&r2<(6-g.nearest)/10)g.flicker*=.35;
    const ex=g.exitX-g.px,ey=g.exitY-g.py;if(ex*ex+ey*ey<1.69){g.level++;g.stamina=1;g.exhausted=false;startLevel(g);}
  }
  root.BackroomsGame={makeGame,newGame,update,constants:{W,H,SMILER,STALKER,RUNNER,MSG_NONE,MSG_FIND_DOOR,MSG_ALMOND,MSG_PIPE}};
})(globalThis);
