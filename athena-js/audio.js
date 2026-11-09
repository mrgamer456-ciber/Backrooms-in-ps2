// Audio procedural para AthenaEnv. Gera WAVs pequenos na primeira execucao,
// sem precisar baixar arquivos ou manter dados binarios no repositorio.
(function(root) {
  "use strict";
  const RATE=22050;
  const TAU=Math.PI*2;
  function putText(view,offset,value) {
    for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));
  }
  function makeWav(path,seconds,sampleFn) {
    if(std.exists(path))return true;
    const count=(RATE*seconds)|0,buffer=new ArrayBuffer(44+count*2),view=new DataView(buffer);
    putText(view,0,"RIFF");view.setUint32(4,36+count*2,true);
    putText(view,8,"WAVE");putText(view,12,"fmt ");
    view.setUint32(16,16,true);view.setUint16(20,1,true);
    view.setUint16(22,1,true);view.setUint32(24,RATE,true);
    view.setUint32(28,RATE*2,true);view.setUint16(32,2,true);
    view.setUint16(34,16,true);putText(view,36,"data");
    view.setUint32(40,count*2,true);
    for(let i=0;i<count;i++) {
      let s=sampleFn(i/RATE,i,count);
      if(s>1)s=1;if(s< -1)s= -1;
      view.setInt16(44+i*2,(s*30000)|0,true);
    }
    const file=std.open(path,"wb");
    if(!file)return false;
    const written=file.write(buffer,0,buffer.byteLength);
    file.close();
    return written===buffer.byteLength;
  }
  function ensureFiles() {
    makeWav("bk_ambience.wav",4,(t)=>{
      return .050*Math.sin(TAU*55*t)+.024*Math.sin(TAU*110*t)+
        .012*Math.sin(TAU*220*t)+.006*Math.sin(TAU*.5*t);
    });
    makeWav("bk_step.wav",.20,(t)=>{
      const env=Math.exp(-28*t);
      return env*(.32*Math.sin(TAU*72*t)+.18*Math.sin(TAU*145*t));
    });
    makeWav("bk_pickup.wav",.48,(t)=>{
      const env=Math.max(0,1-t/.48),freq=380-480*t;
      return .36*env*Math.sin(TAU*freq*t)*(.65+.35*Math.sin(TAU*22*t));
    });
    makeWav("bk_chime.wav",1.05,(t)=>{
      const a=Math.exp(-5*t),b=t>.15?Math.exp(-5*(t-.15)):0;
      return .22*(a*Math.sin(TAU*660*t)+b*Math.sin(TAU*880*t));
    });
    makeWav("bk_heart.wav",.48,(t)=>{
      const p1=Math.exp(-32*t),p2=t>.17?Math.exp(-32*(t-.17)):0;
      return .42*(p1*Math.sin(TAU*55*t)+.72*p2*Math.sin(TAU*48*t));
    });
    makeWav("bk_scare.wav",1.65,(t)=>{
      const env=Math.exp(-1.8*t),f=1500-550*Math.min(1,t/1.2);
      return env*(.38*Math.sin(TAU*f*t)+.25*Math.sin(TAU*f*1.5*t)+.16*Math.sin(TAU*97*t));
    });
  }
  function create() {
    const state={ready:false,ambient:null,step:null,pickup:null,chime:null,heart:null,scare:null,
      lastWalk:0,lastPickups:0,lastLevel:1,lastDead:false,heartTimer:.2};
    if(typeof Sound==="undefined"||typeof std==="undefined")return state;
    try {
      ensureFiles();
      Sound.setVolume(72);
      state.ambient=Sound.Stream("bk_ambience.wav");
      state.step=Sound.Stream("bk_step.wav");
      state.pickup=Sound.Stream("bk_pickup.wav");
      state.chime=Sound.Stream("bk_chime.wav");
      state.heart=Sound.Stream("bk_heart.wav");
      state.scare=Sound.Stream("bk_scare.wav");
      state.ambient.loop=true;
      state.ready=true;
    } catch(e) {
      state.ready=false;
      if(typeof std!=="undefined")std.err.puts("Backrooms audio: "+e+"\n");
    }
    return state;
  }
  function play(stream) {
    if(!stream)return;
    if(stream.playing())return;
    stream.rewind();
    stream.play();
  }
  function update(state,game,dt) {
    if(!state||!state.ready||game.onTitle)return;
    if(game.dead) {
      if(state.ambient.playing())state.ambient.pause();
    } else if(!state.ambient.playing())state.ambient.play();
    if(game.level!==state.lastLevel){play(state.chime);state.lastLevel=game.level;}
    if(game.pickups>state.lastPickups){play(state.pickup);state.lastPickups=game.pickups;}
    const walk=(game.walkDist/.9)|0;
    if(walk>state.lastWalk)play(state.step);
    state.lastWalk=walk;
    if(game.dead&&!state.lastDead)play(state.scare);
    state.lastDead=game.dead;
    if(!game.dead&&game.nearest<9) {
      const bpm=60+(9-game.nearest)*13;
      state.heartTimer-=dt;
      if(state.heartTimer<=0){play(state.heart);state.heartTimer+=Math.max(0.65,60/bpm);}
    } else state.heartTimer=.2;
  }
  root.BackroomsAudio={create,update};
})(globalThis);
