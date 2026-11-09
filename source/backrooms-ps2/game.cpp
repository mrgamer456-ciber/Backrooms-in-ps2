#include "game.h"
#include <math.h>
#include <string.h>
#include <stdlib.h>

namespace bk {

static const float WALK_SPEED = 2.2f;
static const float RUN_SPEED = 3.6f;
static const float TURN_SPEED = 2.6f;
static const float PLAYER_R = 0.22f;

static uint32_t rnd(Game& g) {
    g.rng = g.rng * 1664525u + 1013904223u;
    return g.rng >> 8;
}
static int rndRange(Game& g, int a, int b) {
    return a + (int)(rnd(g) % (uint32_t)(b - a + 1));
}

static bool isFloor(const Game& g, int x, int y) {
    return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && g.map[y][x] == 0;
}

static void carveRect(Game& g, int x0, int y0, int x1, int y1) {
    for (int y = y0; y <= y1; y++)
        for (int x = x0; x <= x1; x++)
            if (x >= 1 && y >= 1 && x < MAP_W - 1 && y < MAP_H - 1) g.map[y][x] = 0;
}

static void carveCorridor(Game& g, int ax, int ay, int bx, int by) {
    int x = ax, y = ay;
    while (x != bx) { carveRect(g, x, y, x + 1, y + 1); x += (bx > x) ? 1 : -1; }
    while (y != by) { carveRect(g, x, y, x + 1, y + 1); y += (by > y) ? 1 : -1; }
}

// Corredores estreitos de manutencao do Pipe Dreams (uma celula de largura).
static void carvePipeCorridor(Game& g, int ax, int ay, int bx, int by) {
    int x = ax, y = ay;
    while (x != bx) { carveRect(g, x, y, x, y); x += (bx > x) ? 1 : -1; }
    while (y != by) { carveRect(g, x, y, x, y); y += (by > y) ? 1 : -1; }
}

static void updateDir(Game& g) {
    g.dirX = cosf(g.angle);
    g.dirY = sinf(g.angle);
    g.planeX = -g.dirY * 0.66f;  // plano da camera = lado direito do jogador
    g.planeY = g.dirX * 0.66f;
}

static void computeDistances(Game& g) {
    static int queue[MAP_W * MAP_H];
    for (int y = 0; y < MAP_H; y++)
        for (int x = 0; x < MAP_W; x++) g.dist[y][x] = -1;
    int sx = (int)g.px, sy = (int)g.py;
    if (!isFloor(g, sx, sy)) return;
    int head = 0, tail = 0;
    g.dist[sy][sx] = 0;
    queue[tail++] = sy * MAP_W + sx;
    const int dx[4] = {1, -1, 0, 0};
    const int dy[4] = {0, 0, 1, -1};
    while (head < tail) {
        int c = queue[head++];
        int cx = c % MAP_W, cy = c / MAP_W;
        for (int k = 0; k < 4; k++) {
            int nx = cx + dx[k], ny = cy + dy[k];
            if (isFloor(g, nx, ny) && g.dist[ny][nx] == -1) {
                g.dist[ny][nx] = g.dist[cy][cx] + 1;
                queue[tail++] = ny * MAP_W + nx;
            }
        }
    }
}

static void generate(Game& g) {
    memset(g.map, 1, sizeof(g.map));
    g.cabinetCount = 0;
    g.hiding = false;
    g.enemyHiddenTimer = 0.0f;
    g.hiddenCabinet = -1;
    int prevCx = 0, prevCy = 0;
    const bool pipeDreams = (g.level == 2);

    // Pipe Dreams: corredor principal comprido, com alcovas laterais de manutencao.
    // O percurso segue em linha reta ate a porta no extremo oposto.
    if (pipeDreams) {
        // Corredor longo e estreito: apenas uma celula de largura.
        carveRect(g, 1, 20, 38, 20);
        // Reentrancia lateral para o unico armario.
        carveRect(g, 7, 18, 8, 20);
        g.map[19][8] = 3; // bloco especial: armario visivel e solido
        g.px = 3.5f;
        g.py = 20.5f;
        g.angle = 0.0f;
        g.cabinets[0] = {8.5f, 19.5f, true};
        g.cabinetCount = 1;
        g.exitX = 38.5f;
        g.exitY = 20.5f;
        g.map[20][38] = 2;
    } else {
    const int roomCount = 22;
    for (int i = 0; i < roomCount; i++) {
        int w = pipeDreams ? rndRange(g, 3, 5) : rndRange(g, 3, 8);
        int h = pipeDreams ? rndRange(g, 3, 5) : rndRange(g, 3, 8);
        int x = rndRange(g, 1, MAP_W - 2 - w), y = rndRange(g, 1, MAP_H - 2 - h);
        carveRect(g, x, y, x + w - 1, y + h - 1);
        int cx = x + w / 2, cy = y + h / 2;
        if (i == 0) {
            g.px = cx + 0.5f;
            g.py = cy + 0.5f;
        } else if (pipeDreams) {
            // Alterna a ordem dos cotovelos para criar um labirinto industrial.
            if ((i & 1) == 0) {
                carvePipeCorridor(g, prevCx, prevCy, cx, prevCy);
                carvePipeCorridor(g, cx, prevCy, cx, cy);
            } else {
                carvePipeCorridor(g, prevCx, prevCy, prevCx, cy);
                carvePipeCorridor(g, prevCx, cy, cx, cy);
            }
        } else {
            carveCorridor(g, prevCx, prevCy, cx, cy);
        }
        prevCx = cx;
        prevCy = cy;
    }
    }

    // Pilares somente no Nivel 1; no Pipe Dreams os corredores devem permanecer estreitos.
    if (!pipeDreams) {
        for (int y = 2; y < MAP_H - 2; y++)
            for (int x = 2; x < MAP_W - 2; x++) {
                if (g.map[y][x] != 0 || rnd(g) % 9 != 0) continue;
                if (abs(x - (int)g.px) <= 1 && abs(y - (int)g.py) <= 1) continue;
                bool open = true;
                for (int dy = -1; dy <= 1; dy++)
                    for (int dx = -1; dx <= 1; dx++)
                        if (g.map[y + dy][x + dx] != 0) open = false;
                if (open) g.map[y][x] = 1;
            }
    }

    // A saida de Pipe Dreams ja fica no final do corredor principal.
    // No Nivel 1 ela continua sendo escolhida longe do ponto inicial.
    if (!pipeDreams) {
    // porta de saida: parede encostada em chao, longe do jogador
    g.exitX = -100;
    g.exitY = -100;
    float bestD = -1;
    int bestX = -1, bestY = -1;
    for (int tries = 0; tries < 4000; tries++) {
        int x = rndRange(g, 1, MAP_W - 2), y = rndRange(g, 1, MAP_H - 2);
        if (g.map[y][x] != 1) continue;
        if (!(isFloor(g, x + 1, y) || isFloor(g, x - 1, y) ||
              isFloor(g, x, y + 1) || isFloor(g, x, y - 1))) continue;
        float dx = x + 0.5f - g.px, dy = y + 0.5f - g.py;
        float d2 = dx * dx + dy * dy;
        if (d2 > bestD) { bestD = d2; bestX = x; bestY = y; }
        if (d2 > 16.0f * 16.0f) break;
    }
    if (bestX >= 0) {
        g.map[bestY][bestX] = 2;
        g.exitX = bestX + 0.5f;
        g.exitY = bestY + 0.5f;
    }
    }

    // anomalias, longe do jogador
    g.anCount = (g.level == 2) ? 1 : 1 + (g.level - 1) / 2;
    if (g.anCount > MAX_ANOMALIES) g.anCount = MAX_ANOMALIES;
    for (int i = 0; i < g.anCount; i++) {
        int px = 0, py = 0;
        for (int tries = 0; tries < 600; tries++) {
            int x = rndRange(g, 1, MAP_W - 2), y = rndRange(g, 1, MAP_H - 2);
            if (!isFloor(g, x, y)) continue;
            px = x; py = y;
            float dx = x + 0.5f - g.px, dy = y + 0.5f - g.py;
            if (dx * dx + dy * dy > 14.0f * 14.0f) break;
        }
        if (pipeDreams) {
            g.an[i].x = 29.5f;
            g.an[i].y = 20.5f;
        } else {
            g.an[i].x = px + 0.5f;
            g.an[i].y = py + 0.5f;
        }
        g.an[i].type = (i == 0 && g.level == 1) ? (uint8_t)SMILER : (uint8_t)(rnd(g) % 3);
        g.an[i].timer = 0;
        g.an[i].running = false;
        g.an[i].seen = false;
    }

    // agua de amendoa (itens)
    g.itemCount = 2;
    for (int i = 0; i < g.itemCount; i++) {
        int ix = (int)g.px, iy = (int)g.py;
        for (int tries = 0; tries < 600; tries++) {
            int x = rndRange(g, 1, MAP_W - 2), y = rndRange(g, 1, MAP_H - 2);
            if (!isFloor(g, x, y)) continue;
            ix = x; iy = y;
            float dx = x + 0.5f - g.px, dy = y + 0.5f - g.py;
            if (dx * dx + dy * dy > 5.0f * 5.0f) break;
        }
        g.items[i].x = ix + 0.5f;
        g.items[i].y = iy + 0.5f;
        g.items[i].active = true;
    }
}

static void startLevel(Game& g) {
    generate(g);
    g.bfsTimer = 0;
    g.nearest = 99.0f;
    g.calmTimer = 0;
    g.flicker = 1.0f;
    g.msgId = (g.level == 1) ? MSG_FIND_DOOR : ((g.level == 2) ? MSG_PIPE_DREAMS : MSG_NONE);
    g.msgTimer = (g.level <= 2) ? 5.0f : 0.0f;
    updateDir(g);
    computeDistances(g);
}

void newGame(Game& g, uint32_t seed) {
    g.rng = seed ? seed : 1u;
    g.level = 1;
    g.dead = false;
    g.deadTime = 0;
    g.killer = 0;
    g.walkDist = 0;
    g.pickups = 0;
    g.survived = 0;
    g.stamina = 1.0f;
    g.exhausted = false;
    g.flashlight = false;
    g.hiding = false;
    g.enemyHiddenTimer = 0.0f;
    g.hiddenCabinet = -1;
    g.jumpHeight = 0.0f;
    g.jumpVelocity = 0.0f;
    g.angle = 0;
    g.pitch = 0;
    startLevel(g);
}

static bool solidAt(const Game& g, float x, float y) {
    int ix = (int)floorf(x), iy = (int)floorf(y);
    if (ix < 0 || iy < 0 || ix >= MAP_W || iy >= MAP_H) return true;
    return g.map[iy][ix] != 0;
}
static bool blocked(const Game& g, float x, float y) {
    const float r = PLAYER_R;
    return solidAt(g, x - r, y - r) || solidAt(g, x + r, y - r) ||
           solidAt(g, x - r, y + r) || solidAt(g, x + r, y + r);
}

// O jogador esta olhando para a anomalia? (dentro do campo de visao e sem parede no meio)
static bool playerSees(const Game& g, const Anomaly& a) {
    float dx = a.x - g.px, dy = a.y - g.py;
    float depth = dx * g.dirX + dy * g.dirY;
    if (depth < 0.1f) return false;
    float side = dx * (-g.dirY) + dy * g.dirX;
    if (fabsf(side) > depth * 0.8f) return false;  // plano da camera 0.66 + margem
    float dist = sqrtf(dx * dx + dy * dy);
    int steps = (int)(dist / 0.15f) + 1;
    for (int i = 1; i < steps; i++) {
        float t = (float)i / (float)steps;
        if (solidAt(g, g.px + dx * t, g.py + dy * t)) return false;
    }
    return true;
}

void update(Game& g, const Input& in, float dt) {
    if (g.dead) {
        g.deadTime += dt;
        if (in.restart && g.deadTime > 1.5f) newGame(g, g.rng ^ 0x9E3779B9u);
        return;
    }
    g.survived += dt;
    if (in.toggleFlashlight) g.flashlight = !g.flashlight;

    // Pulo com gravidade: X dispara uma vez por pressionamento.
    if (in.jump && g.jumpHeight <= 0.001f && !g.hiding) g.jumpVelocity = 3.25f;
    if (g.jumpVelocity != 0.0f || g.jumpHeight > 0.0f) {
        g.jumpHeight += g.jumpVelocity * dt;
        g.jumpVelocity -= 8.5f * dt;
        if (g.jumpHeight <= 0.0f) { g.jumpHeight = 0.0f; g.jumpVelocity = 0.0f; }
    }

    // Quadrado: entrar no armario mais proximo ou sair dele.
    if (in.interact && g.level == 2) {
        if (g.hiding) {
            g.hiding = false;
            g.hiddenCabinet = -1;
        } else {
            for (int i = 0; i < g.cabinetCount; i++) {
                float dx = g.cabinets[i].x - g.px, dy = g.cabinets[i].y - g.py;
                if (dx*dx + dy*dy < 2.0f*2.0f) {
                    g.hiding = true;
                    g.hiddenCabinet = i;
                    g.enemyHiddenTimer = 10.0f;
                    g.jumpHeight = 0.0f;
                    g.jumpVelocity = 0.0f;
                    break;
                }
            }
        }
    }
    if (g.enemyHiddenTimer > 0.0f) { g.enemyHiddenTimer -= dt; if (g.enemyHiddenTimer < 0.0f) g.enemyHiddenTimer = 0.0f; }
    if (g.hiding) {
        if (g.msgTimer > 0) g.msgTimer -= dt;
        return; // jogador permanece protegido dentro do armario
    }

    g.angle += in.turn * TURN_SPEED * dt;
    g.pitch += in.lookY * 1.35f * dt;
    if (g.pitch > 0.38f) g.pitch = 0.38f;
    if (g.pitch < -0.38f) g.pitch = -0.38f;
    updateDir(g);

    // stamina
    float intent = fabsf(in.moveX) + fabsf(in.moveY);
    bool run = in.sprint && !g.exhausted && intent > 0.1f;
    if (run) {
        g.stamina -= 0.30f * dt;
        if (g.stamina <= 0) { g.stamina = 0; g.exhausted = true; }
    } else {
        g.stamina += 0.15f * dt;
        if (g.stamina > 1.0f) g.stamina = 1.0f;
        if (g.exhausted && g.stamina > 0.3f) g.exhausted = false;
    }

    // movimento
    float mx = g.dirX * in.moveY - g.dirY * in.moveX;
    float my = g.dirY * in.moveY + g.dirX * in.moveX;
    float len = sqrtf(mx * mx + my * my);
    if (len > 1.0f) { mx /= len; my /= len; }
    float speed = run ? RUN_SPEED : WALK_SPEED;
    float ox = g.px, oy = g.py;
    float nx = g.px + mx * speed * dt;
    if (!blocked(g, nx, g.py)) g.px = nx;
    float ny = g.py + my * speed * dt;
    if (!blocked(g, g.px, ny)) g.py = ny;
    float mvx = g.px - ox, mvy = g.py - oy;
    g.walkDist += sqrtf(mvx * mvx + mvy * mvy);

    // timers, mensagens e itens
    if (g.calmTimer > 0) g.calmTimer -= dt;
    if (g.msgTimer > 0) g.msgTimer -= dt;
    for (int i = 0; i < g.itemCount; i++) {
        Item& it = g.items[i];
        if (!it.active) continue;
        float ix = it.x - g.px, iy = it.y - g.py;
        if (ix * ix + iy * iy < 0.6f * 0.6f) {
            it.active = false;
            g.stamina = 1.0f;
            g.exhausted = false;
            g.calmTimer = 5.0f;
            g.pickups++;
            g.msgId = MSG_ALMOND_WATER;
            g.msgTimer = 2.5f;
        }
    }

    // mapa de distancias para a perseguicao
    if (--g.bfsTimer <= 0) {
        computeDistances(g);
        g.bfsTimer = 12;
    }

    // anomalias
    float aspeed = 1.9f + 0.25f * (float)(g.level - 1);
    if (aspeed > 3.4f) aspeed = 3.4f;
    const int ddx[4] = {1, -1, 0, 0};
    const int ddy[4] = {0, 0, 1, -1};
    g.nearest = 99.0f;
    for (int i = 0; i < g.anCount && g.enemyHiddenTimer <= 0.0f; i++) {
        Anomaly& a = g.an[i];
        float dx = g.px - a.x, dy = g.py - a.y;
        float d = sqrtf(dx * dx + dy * dy);
        if (d < g.nearest) g.nearest = d;

        // comportamento por tipo
        float spd = aspeed;
        if (a.type == STALKER) {
            a.seen = playerSees(g, a);
            spd = a.seen ? 0.0f : aspeed * 1.45f;
        } else if (a.type == RUNNER) {
            a.timer -= dt;
            if (a.timer <= 0) {
                a.running = !a.running;
                a.timer = a.running ? 1.3f : 0.9f;
            }
            spd = a.running ? aspeed * 1.7f : aspeed * 0.25f;
        }

        int cx = (int)a.x, cy = (int)a.y;
        float tx = g.px, ty = g.py;
        if (!(cx == (int)g.px && cy == (int)g.py)) {
            int best = g.dist[cy][cx];
            if (best < 0) best = 1 << 20;
            int bx = cx, by = cy;
            for (int k = 0; k < 4; k++) {
                int nx2 = cx + ddx[k], ny2 = cy + ddy[k];
                if (!isFloor(g, nx2, ny2)) continue;
                int dd = g.dist[ny2][nx2];
                if (dd >= 0 && dd < best) { best = dd; bx = nx2; by = ny2; }
            }
            if (bx != cx || by != cy) { tx = bx + 0.5f; ty = by + 0.5f; }
        }
        if (g.calmTimer > 0 && spd > 0) spd *= 0.55f;  // agua de amendoa acalma
        float vx = tx - a.x, vy = ty - a.y;
        float vl = sqrtf(vx * vx + vy * vy);
        if (vl > 0.001f) {
            float step = spd * dt;
            if (step > vl) step = vl;
            a.x += vx / vl * step;
            a.y += vy / vl * step;
        }
        if (d < 0.5f) {
            g.dead = true;
            g.deadTime = 0;
            g.killer = a.type;
            return;
        }
    }

    // piscadas da luz (mais agressivas quando uma anomalia esta perto)
    {
        float r1 = (float)(rnd(g) & 0xFFFF) / 65535.0f;
        float r2 = (float)(rnd(g) & 0xFFFF) / 65535.0f;
        g.flicker = 0.93f + 0.07f * r1;
        if (g.nearest < 6.0f && r2 < (6.0f - g.nearest) / 10.0f) g.flicker *= 0.35f;
    }

    // saida
    float ex = g.exitX - g.px, ey = g.exitY - g.py;
    if (ex * ex + ey * ey < 1.3f * 1.3f) {
        g.level++;
        g.stamina = 1.0f;
        g.exhausted = false;
        startLevel(g);
    }
}

void castRays(Game& g, int screenH) {
    for (int x = 0; x < RAY_COLS; x++) {
        float camX = 2.0f * (float)x / (float)RAY_COLS - 1.0f;
        float rdx = g.dirX + g.planeX * camX;
        float rdy = g.dirY + g.planeY * camX;
        int mx = (int)g.px, my = (int)g.py;
        float ddx = (rdx == 0.0f) ? 1e30f : fabsf(1.0f / rdx);
        float ddy = (rdy == 0.0f) ? 1e30f : fabsf(1.0f / rdy);
        int stepX, stepY;
        float sdx, sdy;
        if (rdx < 0) { stepX = -1; sdx = (g.px - mx) * ddx; }
        else         { stepX = 1;  sdx = (mx + 1.0f - g.px) * ddx; }
        if (rdy < 0) { stepY = -1; sdy = (g.py - my) * ddy; }
        else         { stepY = 1;  sdy = (my + 1.0f - g.py) * ddy; }

        int side = 0;
        uint8_t hit = 0;
        for (int guard = 0; guard < 64 && !hit; guard++) {
            if (sdx < sdy) { sdx += ddx; mx += stepX; side = 0; }
            else           { sdy += ddy; my += stepY; side = 1; }
            if (mx < 0 || my < 0 || mx >= MAP_W || my >= MAP_H) { hit = 1; break; }
            hit = g.map[my][mx];
        }
        float perp = (side == 0) ? (sdx - ddx) : (sdy - ddy);
        if (perp < 0.05f) perp = 0.05f;

        float fullH = (float)screenH / perp;
        float horizon = (float)screenH * (0.5f + g.pitch) + g.jumpHeight * (float)screenH * 0.35f;
        if (horizon < (float)screenH * 0.12f) horizon = (float)screenH * 0.12f;
        if (horizon > (float)screenH * 0.90f) horizon = (float)screenH * 0.90f;
        float fullTop = horizon - fullH * 0.5f;
        int lineH = (int)fullH;
        int top = (int)(horizon - lineH * 0.5f);
        int bottom = (int)(horizon + lineH * 0.5f);
        if (top < 0) top = 0;
        if (bottom > screenH) bottom = screenH;

        float bright = 1.0f - perp / MAX_VIEW;
        if (bright < 0) bright = 0;
        if (side == 1) bright *= 0.78f;

        Column& c = g.cols[x];
        c.top = top;
        c.bottom = bottom;
        c.fullTop = fullTop;
        c.fullH = fullH;
        c.bright = bright;
        c.type = hit ? hit : 1;
        c.depth = perp;
        float wallX = (side == 0) ? (g.py + perp * rdy) : (g.px + perp * rdx);
        c.u = wallX - floorf(wallX);
    }
}

static SpriteView projectPoint(const Game& g, float x, float y, int screenW, int screenH) {
    SpriteView s;
    float dx = x - g.px, dy = y - g.py;
    float invDet = 1.0f / (g.planeX * g.dirY - g.dirX * g.planeY);
    float tx = invDet * (g.dirY * dx - g.dirX * dy);
    float ty = invDet * (-g.planeY * dx + g.planeX * dy);
    if (ty < 0.2f) return s;
    s.visible = true;
    s.depth = ty;
    s.centerX = (int)((screenW / 2.0f) * (1.0f + tx / ty));
    s.lineHeight = (int)((float)screenH / ty);
    return s;
}

SpriteView projectAnomaly(const Game& g, int i, int screenW, int screenH) {
    return projectPoint(g, g.an[i].x, g.an[i].y, screenW, screenH);
}

SpriteView projectItem(const Game& g, int i, int screenW, int screenH) {
    return projectPoint(g, g.items[i].x, g.items[i].y, screenW, screenH);
}

}  // namespace bk
