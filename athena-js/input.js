// Entrada real do DualShock no AthenaEnv.
// Eixos fisicos -127..128 sao normalizados e entregues a logica do jogo.
(function(root) {
  "use strict";
  const edgeState={l1:false,x:false,square:false};
  function clamp(v){return Math.max(-128,Math.min(128,v||0));}
  function axis(v,dead) {
    const n=Math.max(-1,Math.min(1,(v||0)/128));
    return Math.abs(n)<(dead===undefined?0.22:dead)?0:n;
  }
  function edge(now,key) {
    const was=edgeState[key];edgeState[key]=now;return now&&!was;
  }
  function fromAxes(a) {
    a=a||{};
    const l1=!!a.l1,x=!!a.x,square=!!a.square;
    return {
      moveX:axis(a.moveX),moveY:axis(a.moveY),
      turn:axis(a.turn),lookY:axis(a.lookY),
      sprint:!!a.r1,jump:edge(x,"x"),
      toggleFlashlight:edge(l1,"l1"),
      interact:edge(square,"square"),
      restart:!!a.start||!!a.r2
    };
  }
  function readPad(pad) {
    if(typeof Pads==="undefined"||!pad)return fromAxes({});
    pad.update();
    const down=(button)=>pad.pressed(button);
    let moveY=-pad.ly,turn=pad.rx;
    if(down(Pads.UP))moveY+=128;
    if(down(Pads.DOWN))moveY-=128;
    if(down(Pads.LEFT))turn-=128;
    if(down(Pads.RIGHT))turn+=128;
    return fromAxes({
      moveX:pad.lx,moveY:clamp(moveY),turn:clamp(turn),
      lookY:-pad.ry,r1:down(Pads.R1),
      l1:down(Pads.L1),x:down(Pads.CROSS),
      square:down(Pads.SQUARE),
      start:down(Pads.START),r2:down(Pads.R2)
    });
  }
  root.BackroomsInput={fromAxes,readPad,resetEdges(){
    edgeState.l1=false;edgeState.x=false;edgeState.square=false;
  }};
})(globalThis);
