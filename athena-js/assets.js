// Texturas bitmap procedurais, portadas de source/backrooms-ps2/textures.cpp.
// Sao geradas no PS2 no primeiro inicio, sem baixar imagens externas.
(function(root) {
  "use strict";
  const SIZE=128,PIXELS=SIZE*SIZE*3;
  function hash2(x,y,seed) {
    let h=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(seed|0,2147483647))>>>0;
    h=Math.imul((h^(h>>>13))>>>0,1274126177)>>>0;
    return (h^(h>>>16))>>>0;
  }
  function clamp8(v){return v<0?0:(v>255?255:v|0);}
  function noise(x,y,period,seed) {
    const x0=Math.floor(x),y0=Math.floor(y);
    let fx=x-x0,fy=y-y0;
    fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);
    const val=(ix,iy)=>{
      const px=((ix%period)+period)%period,py=((iy%period)+period)%period;
      return (hash2(px,py,seed)&65535)/65535;
    };
    const a=val(x0,y0),b=val(x0+1,y0),c=val(x0,y0+1),d=val(x0+1,y0+1);
    const top=a+(b-a)*fx,bot=c+(d-c)*fx;
    return top+(bot-top)*fy;
  }
  function makeBmp(path,pipe) {
    if(std.exists(path))return true;
    const dataSize=PIXELS,rowSize=SIZE*3,buffer=new ArrayBuffer(54+dataSize),v=new DataView(buffer);
    v.setUint8(0,66);v.setUint8(1,77);v.setUint32(2,54+dataSize,true);
    v.setUint32(10,54,true);v.setUint32(14,40,true);
    v.setInt32(18,SIZE,true);v.setInt32(22,SIZE,true);
    v.setUint16(26,1,true);v.setUint16(28,24,true);
    v.setUint32(30,0,true);v.setUint32(34,dataSize,true);
    v.setInt32(38,2835,true);v.setInt32(42,2835,true);
    v.setUint32(46,0,true);v.setUint32(50,0,true);
    for(let y=0;y<SIZE;y++) {
      for(let x=0;x<SIZE;x++) {
        let r,g,b;
        if(!pipe) {
          r=205;g=186;b=84;let k=1;
          const cell=SIZE/4,sx=x%cell;
          if(sx<4)k*=.86;else if(sx===4)k*=1.05;
          const row=(y/cell)|0,oy=y%cell;
          const ox=(sx+(row&1)*(cell/2))%cell;
          const diamond=Math.abs(ox-cell/2)+Math.abs(oy-cell/2);
          if(diamond<7)k*=.90;else if(diamond===7)k*=.96;
          const stain=noise(x*8/SIZE,y*8/SIZE,8,3);
          k*=.86+.14*stain;
          const grain=((hash2(x,y,7)&255)/255-.5)*10;
          if(y>=SIZE-10) {
            r=96;g=74;b=42;k=y===SIZE-10?1.2:.92;
          } else if(y<4)k*=.80;
          r=clamp8(r*k+grain);g=clamp8(g*k+grain);b=clamp8(b*k+grain);
        } else {
          const n=(hash2((x/3)|0,(y/3)|0,29)&255)/255;
          const grain=((hash2(x,y,41)&255)/255-.5)*18;
          r=73+n*24+grain;g=69+n*23+grain;b=59+n*19+grain;
          const pipeY=y%64;
          if(pipeY>=17&&pipeY<=29) {
            r=105+n*28;g=20+n*10;b=13+n*8;
            if(pipeY===17||pipeY===29){r*=.42;g*=.42;b*=.42;}
            if(pipeY>=20&&pipeY<=22){r=190;g=48;b=30;}
          }
          const bandX=x%64;
          if(pipeY>=15&&pipeY<=31&&bandX>=29&&bandX<=34) {
            r=105;g=103;b=91;
            if(pipeY===18||pipeY===28){r=175;g=169;b=145;}
          }
          if(((x*13+y*7)%97)<2){r*=.55;g*=.55;b*=.55;}
          if(y>SIZE-9){r=35;g=33;b=29;}
          r=clamp8(r);g=clamp8(g);b=clamp8(b);
        }
        const dst=54+(SIZE-1-y)*rowSize+x*3;
        v.setUint8(dst,b);v.setUint8(dst+1,g);v.setUint8(dst+2,r);
      }
    }
    const file=std.open(path,"wb");
    if(!file)return false;
    const written=file.write(buffer,0,buffer.byteLength);
    file.close();
    return written===buffer.byteLength;
  }
  function create() {
    if(typeof std==="undefined")return false;
    return makeBmp("bk_wallpaper.bmp",false)&&makeBmp("bk_pipedreams.bmp",true);
  }
  function load() {
    if(typeof Image==="undefined")return null;
    const wall=new Image("bk_wallpaper.bmp"),pipe=new Image("bk_pipedreams.bmp");
    wall.lock();pipe.lock();
    return {wall,pipe};
  }
  root.BackroomsAssets={create,load,SIZE};
})(globalThis);
