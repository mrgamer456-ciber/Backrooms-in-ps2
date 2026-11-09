#include "textures.h"
#include <math.h>
#include <stdlib.h>

namespace bk {

static uint32_t hash2(int x, int y, int seed) {
    uint32_t h = (uint32_t)x * 374761393u + (uint32_t)y * 668265263u + (uint32_t)seed * 2147483647u;
    h = (h ^ (h >> 13)) * 1274126177u;
    return h ^ (h >> 16);
}

// ruido de valor que se repete (tileable) com 'period' celulas
static float vnoise(float x, float y, int period, int seed) {
    int x0 = (int)floorf(x), y0 = (int)floorf(y);
    float fx = x - (float)x0, fy = y - (float)y0;
    fx = fx * fx * (3.0f - 2.0f * fx);
    fy = fy * fy * (3.0f - 2.0f * fy);
    auto v = [&](int ix, int iy) {
        int px = ((ix % period) + period) % period, py = ((iy % period) + period) % period;
        return (float)(hash2(px, py, seed) & 0xFFFF) / 65535.0f;
    };
    float a = v(x0, y0), b = v(x0 + 1, y0), c = v(x0, y0 + 1), d = v(x0 + 1, y0 + 1);
    return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
}

static uint8_t c8(float v) { return (uint8_t)(v < 0 ? 0 : (v > 255 ? 255 : v)); }

void makeWallpaper(uint32_t* px, int size) {
    const int cell = size / 4;  // 4 listras por unidade de parede
    for (int y = 0; y < size; y++) {
        for (int x = 0; x < size; x++) {
            float r = 205, g = 186, b = 84;
            float k = 1.0f;

            // listras verticais
            int sx = x % cell;
            if (sx < 4) k *= 0.86f;
            else if (sx == 4) k *= 1.05f;

            // losangos alternados (deslocados a cada linha de celulas)
            int row = y / cell, oy = y % cell;
            int ox = (sx + (row & 1) * (cell / 2)) % cell;
            int d = abs(ox - cell / 2) + abs(oy - cell / 2);
            if (d < 7) k *= 0.90f;
            else if (d == 7) k *= 0.96f;

            // manchas de umidade/sujeira
            float stain = vnoise((float)x * 8.0f / (float)size, (float)y * 8.0f / (float)size, 8, 3);
            k *= 0.86f + 0.14f * stain;

            // grao fino
            float grain = ((float)(hash2(x, y, 7) & 255) / 255.0f - 0.5f) * 10.0f;

            // rodape (embaixo) e moldura (em cima)
            if (y >= size - 10) {
                r = 96; g = 74; b = 42;
                k = (y == size - 10) ? 1.2f : 0.92f;
            } else if (y < 4) {
                k *= 0.80f;
            }

            uint32_t R = c8(r * k + grain), G = c8(g * k + grain), B = c8(b * k + grain);
            px[y * size + x] = (0x80u << 24) | (B << 16) | (G << 8) | R;
        }
    }
}

}  // namespace bk
