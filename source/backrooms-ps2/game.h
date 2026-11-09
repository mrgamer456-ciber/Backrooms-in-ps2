// Logica do jogo em C++ puro (sem dependencia de PS2). Da pra testar no PC.
#pragma once
#include <stdint.h>

namespace bk {

constexpr int MAP_W = 40;
constexpr int MAP_H = 40;
constexpr int MAX_ANOMALIES = 4;
constexpr int MAX_ITEMS = 4;
constexpr int RAY_COLS = 320;
constexpr float MAX_VIEW = 14.0f;

struct Input {
    float moveX = 0, moveY = 0, turn = 0;  // -1..1
    bool sprint = false;
    bool restart = false;
};

enum AnomalyType : uint8_t {
    SMILER = 0,   // persegue sempre
    STALKER = 1,  // congela se voce olha pra ele; rapido quando voce nao olha
    RUNNER = 2    // alterna corrida muito rapida e pausas
};

struct Anomaly {
    float x = 0, y = 0;
    uint8_t type = SMILER;
    float timer = 0;
    bool running = false;
    bool seen = false;
};

// Agua de amendoa: restaura stamina e deixa as anomalias mais lentas por alguns segundos
struct Item {
    float x = 0, y = 0;
    bool active = false;
};

enum MessageId : uint8_t { MSG_NONE = 0, MSG_FIND_DOOR = 1, MSG_ALMOND_WATER = 2 };

struct Column {
    int top = 0, bottom = 0;
    float fullTop = 0, fullH = 1;  // parede inteira, sem corte pela tela (para texturas)
    float bright = 0;   // 0..1 (neblina + sombra lateral)
    uint8_t type = 1;   // 1 = parede, 2 = porta de saida
    float depth = 0;    // distancia perpendicular (para ocultar sprites)
    float u = 0;        // posicao 0..1 ao longo da parede
};

struct SpriteView {
    bool visible = false;
    int centerX = 0;
    int lineHeight = 0;
    float depth = 0;
};

struct Game {
    uint8_t map[MAP_H][MAP_W];  // 0 = chao, 1 = parede, 2 = saida
    int dist[MAP_H][MAP_W];     // distancia (BFS) ate o jogador
    float px, py, angle;
    float dirX, dirY, planeX, planeY;
    float stamina;
    bool exhausted;
    int level;
    bool dead;
    float deadTime;
    float survived;
    Anomaly an[MAX_ANOMALIES];
    int anCount;
    uint8_t killer;
    Item items[MAX_ITEMS];
    int itemCount;
    int pickups;        // total coletado (usado pelo audio)
    float calmTimer;    // > 0: anomalias lentas
    float walkDist;     // distancia total andada (passos)
    float flicker;      // brilho da luz, 0..1 (piscadas)
    uint8_t msgId;
    float msgTimer;
    float nearest;
    int bfsTimer;
    uint32_t rng;
    float exitX, exitY;
    Column cols[RAY_COLS];
};

void newGame(Game& g, uint32_t seed);
void update(Game& g, const Input& in, float dt);
void castRays(Game& g, int screenH);
SpriteView projectAnomaly(const Game& g, int i, int screenW, int screenH);
SpriteView projectItem(const Game& g, int i, int screenW, int screenH);

}  // namespace bk
