// Mundo 3D real do Backrooms para o renderer VU1 do AthenaEnv.
// O mapa/collision continua em game.js; aqui ele vira malha OBJ com materiais.
(function(root) {
  "use strict";
  const W=40,H=40,WALL_H=2.5;
  function vec(x,y,z){return [x,y,z];}
  function writeText(path,value) {
    const file=std.open(path,"w");
    if(!file)throw new Error("Nao foi possivel criar "+path);
    file.puts(value);file.close();
  }
  function tile(g,x,y) {
    if(x<0||y<0||x>=W||y>=H)return 1;
    return g.map[y*W+x];
  }
  function makeMtl(level) {
    return [
      "newmtl wallpaper","Ka 0.45 0.42 0.30","Kd 1 1 1","Ks 0 0 0","illum 1","map_Kd bk_wallpaper.bmp","",
      "newmtl pipewall","Ka 0.30 0.30 0.30","Kd 1 1 1","Ks 0 0 0","illum 1","map_Kd bk_pipedreams.bmp","",
      "newmtl floor",level===2?"Ka 0.08 0.08 0.07":"Ka 0.30 0.24 0.14",level===2?"Kd 0.17 0.16 0.14":"Kd 0.58 0.46 0.28","Ks 0 0 0","illum 1","",
      "newmtl ceiling",level===2?"Ka 0.12 0.12 0.11":"Ka 0.55 0.52 0.38",level===2?"Kd 0.25 0.24 0.22":"Kd 0.82 0.79 0.63","Ks 0 0 0","illum 1","",
      "newmtl locker","Ka 0.12 0.14 0.15","Kd 0.35 0.40 0.42","Ks 0.15 0.15 0.15","Ns 18","illum 2","",
      "newmtl lockerpanel","Ka 0.08 0.09 0.10","Kd 0.17 0.20 0.22","Ks 0.1 0.1 0.1","Ns 12","illum 2","",
      "newmtl doorframe","Ka 0.12 0.07 0.04","Kd 0.24 0.13 0.07","Ks 0.05 0.05 0.05","illum 2","",
      "newmtl doorleaf","Ka 0.22 0.12 0.05","Kd 0.48 0.27 0.12","Ks 0.05 0.05 0.05","illum 2","",
      "newmtl doorglow","Ka 1 1 1","Kd 1 1 1","Ks 0 0 0","illum 1","",
      "newmtl lamp","Ka 1 1 0.8","Kd 1 0.92 0.65","Ks 0 0 0","illum 1","",
      "newmtl redlamp","Ka 1 0.12 0.08","Kd 0.95 0.18 0.08","Ks 0 0 0","illum 1",""
    ].join("\n");
  }
  function buildObj(g) {
    const out=["mtllib world.mtl","o BackroomsWorld","s off"];
    let vi=1,ti=1,ni=1;
    function quad(mat,p,uv,n) {
      out.push("usemtl "+mat);
      for(let i=0;i<4;i++)out.push("v "+p[i][0].toFixed(4)+" "+p[i][1].toFixed(4)+" "+p[i][2].toFixed(4));
      for(let i=0;i<4;i++)out.push("vt "+uv[i][0].toFixed(4)+" "+uv[i][1].toFixed(4));
      out.push("vn "+n[0]+" "+n[1]+" "+n[2]);
      out.push("f "+vi+"/"+ti+"/"+ni+" "+(vi+1)+"/"+(ti+1)+"/"+ni+" "+(vi+2)+"/"+(ti+2)+"/"+ni+" "+(vi+3)+"/"+(ti+3)+"/"+ni);
      vi+=4;ti+=4;ni++;
    }
    const uvWall=[[0,0],[1,0],[1,1],[0,1]];
    const uvFlat=[[0,0],[1,0],[1,1],[0,1]];
    // Piso e teto em placas por celula livre, com coordenadas UV repetiveis.
    for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(tile(g,x,y)===0||tile(g,x,y)===2||tile(g,x,y)===3) {
      quad("floor",[vec(x,0,y),vec(x,0,y+1),vec(x+1,0,y+1),vec(x+1,0,y)],uvFlat,[0,1,0]);
      quad("ceiling",[vec(x,WALL_H,y),vec(x+1,WALL_H,y),vec(x+1,WALL_H,y+1),vec(x,WALL_H,y+1)],uvFlat,[0,-1,0]);
    }
    // Paredes: so cria as faces que ficam voltadas para celulas transitaveis.
    const wallMat=g.level===2?"pipewall":"wallpaper";
    for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(tile(g,x,y)===1||tile(g,x,y)===2) {
      if(tile(g,x,y-1)===0)quad(wallMat,[vec(x+1,0,y),vec(x,0,y),vec(x,WALL_H,y),vec(x+1,WALL_H,y)],uvWall,[0,0,-1]);
      if(tile(g,x,y+1)===0)quad(wallMat,[vec(x,0,y+1),vec(x+1,0,y+1),vec(x+1,WALL_H,y+1),vec(x,WALL_H,y+1)],uvWall,[0,0,1]);
      if(tile(g,x-1,y)===0)quad(wallMat,[vec(x,0,y),vec(x,0,y+1),vec(x,WALL_H,y+1),vec(x,WALL_H,y)],uvWall,[-1,0,0]);
      if(tile(g,x+1,y)===0)quad(wallMat,[vec(x+1,0,y+1),vec(x+1,0,y),vec(x+1,WALL_H,y),vec(x+1,WALL_H,y+1)],uvWall,[1,0,0]);
    }
    // Porta branca: moldura, folha de madeira inclinada e painel luminoso.
    const ex=g.exitX|0,ey=g.exitY|0;
    let tx=1,ty=0,nx=0,ny=1;
    if(tile(g,ex+1,ey)===0){tx=0;ty=1;nx=1;ny=0;}
    else if(tile(g,ex-1,ey)===0){tx=0;ty=1;nx=-1;ny=0;}
    else if(tile(g,ex,ey+1)===0){tx=1;ty=0;nx=0;ny=1;}
    else if(tile(g,ex,ey-1)===0){tx=1;ty=0;nx=0;ny=-1;}
    const p=(along,normal,z)=>vec(g.exitX+tx*along+nx*normal,z,g.exitY+ty*along+ny*normal);
    const frontUV=[[0,0],[1,0],[1,1],[0,1]],normal=[nx,0,ny];
    quad("doorglow",[p(-.34,.012,.05),p(.34,.012,.05),p(.34,.012,2.15),p(-.34,.012,2.15)],frontUV,normal);
    quad("doorframe",[p(-.44,.07,0),p(-.34,.07,0),p(-.34,.07,2.25),p(-.44,.07,2.25)],frontUV,normal);
    quad("doorframe",[p(.34,.07,0),p(.44,.07,0),p(.44,.07,2.25),p(.34,.07,2.25)],frontUV,normal);
    quad("doorframe",[p(-.44,.07,2.15),p(.44,.07,2.15),p(.44,.07,2.25),p(-.44,.07,2.25)],frontUV,normal);
    const leaf=(u,z,off)=>p(-.33+u*.53,.085+u*.85+off,z);
    quad("doorleaf",[leaf(0,.035,0),leaf(.66,.035,0),leaf(.66,2.10,0),leaf(0,2.10,0)],frontUV,normal);
    quad("doorframe",[leaf(.04,.08,.008),leaf(.62,.08,.008),leaf(.62,.43,.008),leaf(.04,.43,.008)],frontUV,normal);
    quad("doorframe",[leaf(.04,.53,.008),leaf(.62,.53,.008),leaf(.62,.86,.008),leaf(.04,.86,.008)],frontUV,normal);
    quad("doorleaf",[leaf(.075,.12,.012),leaf(.585,.12,.012),leaf(.585,.39,.012),leaf(.075,.39,.012)],frontUV,normal);
    quad("doorleaf",[leaf(.075,.57,.012),leaf(.585,.57,.012),leaf(.585,.82,.012),leaf(.075,.82,.012)],frontUV,normal);
    for(let i=0;i<5;i++){const u=.12+i*.105;quad("doorframe",[leaf(u,.15,.016),leaf(u+.012,.15,.016),leaf(u+.012,.80,.016),leaf(u,.80,.016)],frontUV,normal);}
    quad("doorframe",[leaf(.635,.04,.02),leaf(.66,.04,.02),leaf(.66,.90,.02),leaf(.635,.90,.02)],frontUV,normal);
    quad("lamp",[leaf(.10,.43,.024),leaf(.18,.43,.024),leaf(.18,.49,.024),leaf(.10,.49,.024)],frontUV,normal);
    // Armario metalico no Pipe Dreams, com porta frontal e puxador.
    for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(tile(g,x,y)===3) {
      const x0=x+.12,x1=x+.88,z0=y+.12,z1=y+.88,top=1.78;
      quad("locker",[vec(x0,0,z0),vec(x0,0,z1),vec(x0,top,z1),vec(x0,top,z0)],uvFlat,[-1,0,0]);
      quad("locker",[vec(x1,0,z1),vec(x1,0,z0),vec(x1,top,z0),vec(x1,top,z1)],uvFlat,[1,0,0]);
      quad("locker",[vec(x0,0,z0),vec(x1,0,z0),vec(x1,top,z0),vec(x0,top,z0)],uvFlat,[0,0,-1]);
      quad("locker",[vec(x0,0,z1),vec(x1,0,z1),vec(x1,top,z1),vec(x0,top,z1)],uvFlat,[0,0,1]);
      quad("locker",[vec(x0,top,z0),vec(x1,top,z0),vec(x1,top,z1),vec(x0,top,z1)],uvFlat,[0,1,0]);
      quad("lockerpanel",[vec(x0+.08,.12,z1+.002),vec(x1-.08,.12,z1+.002),vec(x1-.08,1.62,z1+.002),vec(x0+.08,1.62,z1+.002)],uvFlat,[0,0,1]);
      quad("locker",[vec(x0+.46,.75,z1+.018),vec(x0+.54,.75,z1+.018),vec(x0+.54,.95,z1+.018),vec(x0+.46,.95,z1+.018)],uvFlat,[0,0,1]);
    }
    // Luminarias de teto: amarelas no nivel 0 e vermelhas no Pipe Dreams.
    for(let i=0;i<5;i++) {
      let x,z;
      if(g.level===2){x=3.5+i*7;z=20.5;}
      else{x=20.5;z=3.5+i*7;}
      if(tile(g,x|0,z|0)!==0) {
        let found=false;
        for(let r=1;r<5&&!found;r++)for(let dy=-r;dy<=r&&!found;dy++)for(let dx=-r;dx<=r&&!found;dx++)
          if(tile(g,(x|0)+dx,(z|0)+dy)===0){x=(x|0)+dx+.5;z=(z|0)+dy+.5;found=true;}
      }
      const mat=g.level===2?"redlamp":"lamp";
      const x0=x-.42,x1=x+.42,z0=z-.78,z1=z+.78,y0=WALL_H-.08,y1=WALL_H-.025;
      quad(mat,[vec(x0,y0,z0),vec(x1,y0,z0),vec(x1,y0,z1),vec(x0,y0,z1)],uvFlat,[0,-1,0]);
      quad(mat,[vec(x0,y1,z1),vec(x1,y1,z1),vec(x1,y1,z0),vec(x0,y1,z0)],uvFlat,[0,1,0]);
    }
    return out.join("\n");
  }
  function create() {
    let ready=false,revision=-1,batch=null,rootNode=null,data=null,obj=null,light=null;
    function init() {
      const canvas=Screen.getMode();
      canvas.zbuffering=true;
      canvas.psm=Screen.CT32;
      canvas.psmz=Screen.Z16S;
      Screen.setMode(canvas);
      Screen.initBuffers();
      Render.init();
      Render.setView(67,.1,90,canvas.width,canvas.height);
      light=Lights.new();
      batch=new Batch({autoSort:true});
      rootNode=new SceneNode();
      ready=true;
    }
    function rebuild(game) {
      if(!ready)init();
      writeText("world.mtl",makeMtl(game.level));
      writeText("world.obj",buildObj(game));
      // Cria um lote novo ao trocar de fase; evita depender de Batch.clear().
      batch=new Batch({autoSort:true});
      data=new RenderData("world.obj");
      data.pipeline=Render.PL_DEFAULT;
      data.face_culling=Render.CULL_FACE_NONE;
      data.accurate_clipping=true;
      obj=new RenderObject(data);
      obj.position={x:0,y:0,z:0};obj.rotation={x:0,y:0,z:0};obj.scale={x:1,y:1,z:1};
      rootNode=new SceneNode();rootNode.attach(obj);rootNode.update();
      batch.add(obj);
      revision=game.mapRevision;
    }
    function render(game) {
      if(!ready||!batch)return;
      Screen.setParam(Screen.DEPTH_TEST_ENABLE,true);
      const eyeY=1.55+game.jumpHeight;
      Camera.position(game.px,eyeY,game.py);
      Camera.target(game.px+game.dirX,eyeY+game.pitch*2.0,game.py+game.dirY);
      Camera.update();
      Lights.set(light,Lights.AMBIENT,game.level===2 ? 0.16 : 0.24,game.level===2 ? 0.12 : 0.22,game.level===2 ? 0.12 : 0.18);
      Lights.set(light,Lights.DIRECTION,-game.dirX,-.35,-game.dirY);
      const diffuse=game.flashlight ? 0.92 : 0.28;
      Lights.set(light,Lights.DIFFUSE,diffuse,diffuse*.94,diffuse*.82);
      Render.begin();
      rootNode.update();
      batch.render();
      Screen.setParam(Screen.DEPTH_TEST_ENABLE,false);
    }
    return {init,rebuild,render,get ready(){return ready;},get revision(){return revision;}};
  }
  root.BackroomsWorld3D={create};
})(globalThis);
