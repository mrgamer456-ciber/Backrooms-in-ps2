import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const load = (path) => vm.runInThisContext(fs.readFileSync(path, "utf8"), { filename: path });


const mainSource = fs.readFileSync("athena-js/main.js", "utf8");
const importedModules = [...mainSource.matchAll(/import\\s+["']([^"']+)["'];/g)].map((match) => match[1]);
assert.deepEqual(importedModules, [
  "game.js", "input.js", "raycast.js", "font.js",
  "render.js", "audio.js", "assets.js", "world3d.js"
], "main.js deve importar todos os modulos na ordem correta");
for (const modulePath of importedModules) {
  assert.ok(fs.existsSync("athena-js/" + modulePath), "modulo importado deve existir: " + modulePath);
}

load("athena-js/game.js");
load("athena-js/input.js");
load("athena-js/raycast.js");

assert.ok(globalThis.BackroomsGame, "game.js deve registrar BackroomsGame");
assert.ok(globalThis.BackroomsInput, "input.js deve registrar BackroomsInput");
assert.ok(globalThis.BackroomsRaycast, "raycast.js deve registrar BackroomsRaycast");

const game = BackroomsGame.makeGame();
assert.equal(game.onTitle, true);
BackroomsGame.newGame(game, 0x12345678);
game.onTitle = false;

assert.equal(game.mapRevision, 1, "novo jogo deve gerar a primeira revisao do mapa");
assert.equal(game.map[(game.py | 0) * 40 + (game.px | 0)], 0, "posicao inicial deve estar em piso livre");
assert.equal(game.map[(game.exitY | 0) * 40 + (game.exitX | 0)], 2, "saida deve ser marcada como porta");

const scene = BackroomsRaycast.cast(game, 640, 448, 160);
assert.equal(scene.columns.length, 160, "raycaster deve produzir 160 colunas");
assert.ok(scene.columns.every((column) => Number.isFinite(column.depth) && column.depth > 0), "todas as colunas devem ter profundidade valida");

let input = BackroomsInput.fromAxes({ l1: true });
assert.equal(input.toggleFlashlight, true, "L1 deve gerar evento ao pressionar");
input = BackroomsInput.fromAxes({ l1: true });
assert.equal(input.toggleFlashlight, false, "L1 segurado nao deve repetir o evento");
BackroomsInput.fromAxes({ l1: false });
input = BackroomsInput.fromAxes({ l1: true });
assert.equal(input.toggleFlashlight, true, "L1 deve gerar novo evento depois de solto");


const fakePad = {
  lx: 128, ly: -128, rx: 64, ry: -64,
  update() {},
  pressed() { return false; }
};
globalThis.Pads = {
  UP: 1, DOWN: 2, LEFT: 3, RIGHT: 4,
  R1: 5, L1: 6, CROSS: 7, SQUARE: 8, START: 9, R2: 10
};
const analog = BackroomsInput.readPad(fakePad);
assert.equal(analog.moveX, 1, "analógico esquerdo deve ser normalizado");
assert.equal(analog.moveY, 1, "eixo vertical esquerdo deve ser normalizado");
assert.equal(analog.turn, 0.5, "analógico direito horizontal deve manter meia intensidade");
assert.equal(analog.lookY, 0.5, "analógico direito vertical deve manter meia intensidade");
delete globalThis.Pads;

// Exercita a criação da malha 3D com mocks das APIs AthenaEnv.
const generatedFiles = new Map();
globalThis.std = {
  open(path) {
    return {
      puts(value) { generatedFiles.set(path, value); },
      close() {}
    };
  }
};
let renderBegins = 0;
globalThis.Screen = {
  CT32: 0, Z16S: 1, DEPTH_TEST_ENABLE: 2,
  getMode() { return { width: 640, height: 448 }; },
  setMode() {},
  setParam() {}
};
globalThis.Render = {
  PL_DEFAULT: 0, CULL_FACE_NONE: 0,
  init() {}, setView() {}, begin() { renderBegins++; }
};
globalThis.Lights = {
  AMBIENT: 0, DIRECTION: 1, DIFFUSE: 2,
  new() { return 3; },
  set(id) { assert.equal(id, 3, "a luz deve usar o identificador retornado por Lights.new()"); }
};
globalThis.Batch = class {
  add() {}
  render() {}
};
globalThis.SceneNode = class {
  attach() {}
  update() {}
};
globalThis.RenderData = class {
  constructor(path) { this.path = path; }
};
globalThis.RenderObject = class {
  constructor(data) { this.data = data; }
};
globalThis.Camera = {
  position() {}, target() {}, update() {}
};

load("athena-js/world3d.js");
const world = BackroomsWorld3D.create();
world.init();
const worldGame = BackroomsGame.makeGame();
BackroomsGame.newGame(worldGame, 0x87654321);
world.rebuild(worldGame);
assert.equal(world.ready, true, "mundo 3D deve inicializar");
assert.equal(world.revision, worldGame.mapRevision, "mundo deve registrar a revisao do mapa");
assert.ok(generatedFiles.get("world.obj").includes("usemtl doorglow"), "malha deve incluir a luz da porta");
assert.ok(generatedFiles.get("world.obj").includes("usemtl wallpaper"), "malha deve incluir as paredes");
assert.ok(generatedFiles.get("world.mtl").includes("newmtl floor"), "materiais devem incluir o piso");
world.render(worldGame);
assert.equal(renderBegins, 1, "renderer deve iniciar um passe 3D por quadro");


const pipeMap = new Uint8Array(40 * 40);
pipeMap.fill(1);
for (let x = 1; x <= 38; x++) pipeMap[20 * 40 + x] = 0;
for (let y = 18; y <= 20; y++) for (let x = 7; x <= 8; x++) pipeMap[y * 40 + x] = 0;
pipeMap[19 * 40 + 8] = 3;
pipeMap[20 * 40 + 38] = 2;
const pipeGame = {
  level: 2, map: pipeMap, mapRevision: 2,
  exitX: 38.5, exitY: 20.5,
  px: 3.5, py: 20.5, dirX: 1, dirY: 0,
  planeX: 0, planeY: 0.66, pitch: 0,
  jumpHeight: 0, flashlight: false
};
world.rebuild(pipeGame);
assert.equal(world.revision, 2, "troca para Pipe Dreams deve reconstruir a malha");
assert.ok(generatedFiles.get("world.obj").includes("usemtl pipewall"), "Pipe Dreams deve usar paredes industriais");
assert.ok(generatedFiles.get("world.obj").includes("usemtl lockerpanel"), "armario deve ter painel frontal");
assert.ok(generatedFiles.get("world.mtl").includes("newmtl redlamp"), "Pipe Dreams deve incluir material de luz vermelha");

console.log("Athena JS smoke tests: OK");
