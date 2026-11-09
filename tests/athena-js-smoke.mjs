import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const load = (path) => vm.runInThisContext(fs.readFileSync(path, "utf8"), { filename: path });

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
assert.equal(game.map[game.py * 40 + game.px | 0], 0, "posicao inicial deve estar em piso livre");
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

console.log("Athena JS smoke tests: OK");
