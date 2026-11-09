// Fonte bitmap 5x7 original do projeto C++ (font.cpp), portada sem alteracoes.
(function(root) {
  "use strict";
  const GLYPHS={
    " ":[0,0,0,0,0,0,0],
    A:[14,17,17,31,17,17,17],B:[30,17,17,30,17,17,30],
    C:[14,17,16,16,16,17,14],D:[30,17,17,17,17,17,30],
    E:[31,16,16,30,16,16,31],F:[31,16,16,30,16,16,16],
    G:[14,17,16,23,17,17,15],H:[17,17,17,31,17,17,17],
    I:[14,4,4,4,4,4,14],J:[7,2,2,2,2,18,12],
    K:[17,18,20,24,20,18,17],L:[16,16,16,16,16,16,31],
    M:[17,27,21,21,17,17,17],N:[17,25,21,19,17,17,17],
    O:[14,17,17,17,17,17,14],P:[30,17,17,30,16,16,16],
    Q:[14,17,17,17,21,18,13],R:[30,17,17,30,20,18,17],
    S:[15,16,16,14,1,1,30],T:[31,4,4,4,4,4,4],
    U:[17,17,17,17,17,17,14],V:[17,17,17,17,17,10,4],
    W:[17,17,17,21,21,27,17],X:[17,17,10,4,10,17,17],
    Y:[17,17,10,4,4,4,4],Z:[31,1,2,4,8,16,31],
    "0":[14,17,19,21,25,17,14],"1":[4,12,4,4,4,4,14],
    "2":[14,17,1,2,4,8,31],"3":[30,1,1,14,1,1,30],
    "4":[2,6,10,18,31,2,2],"5":[31,16,30,1,1,17,14],
    "6":[6,8,16,30,17,17,14],"7":[31,1,2,4,8,8,8],
    "8":[14,17,17,14,17,17,14],"9":[14,17,17,15,1,2,12],
    ":":[0,4,4,0,4,4,0],"-":[0,0,0,31,0,0,0],
    "!":[4,4,4,4,4,0,4],".":[0,0,0,0,0,12,12]
  };
  function rows(ch) {
    if(ch>="a"&&ch<="z")ch=String.fromCharCode(ch.charCodeAt(0)-32);
    return GLYPHS[ch]||null;
  }
  function draw(x,y,scale,col,str) {
    for(let i=0;i<str.length;i++,x+=6*scale) {
      const glyph=rows(str[i]);
      if(!glyph)continue;
      for(let row=0;row<7;row++) {
        let start=-1;
        for(let cx=0;cx<=5;cx++) {
          const on=cx<5&&((glyph[row]>>(4-cx))&1)!==0;
          if(on&&start<0)start=cx;
          if(!on&&start>=0) {
            Draw.rect(x+start*scale,y+row*scale,(cx-start)*scale,scale,col);
            start=-1;
          }
        }
      }
    }
  }
  function width(str,scale){return str.length*6*scale-scale;}
  function shadow(x,y,scale,col,str) {
    draw(x+scale,y+scale,scale,Color.new(0,0,0,128),str);
    draw(x,y,scale,col,str);
  }
  function centered(y,scale,col,str,screenWidth) {
    const w=screenWidth||Screen.getMode().width;
    shadow((w-width(str,scale))/2,y,scale,col,str);
  }
  root.BackroomsFont={draw,shadow,centered,width};
})(globalThis);
