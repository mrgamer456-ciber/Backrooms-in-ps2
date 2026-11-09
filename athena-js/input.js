// Adaptador de controle. A logica do jogo recebe apenas valores normalizados.
// A leitura do hardware sera conectada aos nomes confirmados da API Pads do AthenaEnv.
(function(root) {
  "use strict";
  const state={l1:false,x:false,square:false};
  function edge(now,key){const was=state[key];state[key]=now;return now&&!was;}
  function normalizeAxis(v,dead=.22){
    const n=Math.max(-1,Math.min(1,v||0));return Math.abs(n)<dead?0:n;
  }
  function fromAxes(a) {
    const l1=!!a.l1,x=!!a.x,square=!!a.square;
    return {
      moveX:normalizeAxis(a.moveX),moveY:normalizeAxis(a.moveY),
      turn:normalizeAxis(a.turn),lookY:normalizeAxis(a.lookY),
      sprint:!!a.r1,jump:edge(x,"x"),toggleFlashlight:edge(l1,"l1"),
      interact:edge(square,"square"),restart:!!a.start||!!a.r2
    };
  }
  root.BackroomsInput={fromAxes,resetEdges(){state.l1=state.x=state.square=false;}};
})(this);
