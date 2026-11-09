#include "audio.h"
#include <math.h>
#include <string.h>

namespace bk {

static const float DT = 1.0f / (float)AUDIO_RATE;

static inline float tsin(const AudioState& a, float ph) {
    return a.table[(int)(ph * 1024.0f) & 1023];
}
// avanca a fase de um oscilador e devolve a nova fase
static inline float adv(float& ph, float freq) {
    ph += freq * DT;
    if (ph >= 1.0f) ph -= 1.0f;
    return ph;
}
static inline float noise(AudioState& a) {
    a.rng = a.rng * 1664525u + 1013904223u;
    return (float)((int32_t)a.rng >> 8) * (1.0f / 8388608.0f);  // -1..1
}
static inline float clampf(float v, float lo, float hi) { return v < lo ? lo : (v > hi ? hi : v); }
static inline float softClip(float x) {
    x = clampf(x * 0.9f, -1.5f, 1.5f);
    return x - (x * x * x) / 6.75f;
}

void audioInit(AudioState& a) {
    memset(&a, 0, sizeof(a));
    for (int i = 0; i < 1024; i++) a.table[i] = sinf(6.2831853f * (float)i / 1024.0f);
    a.rng = 0x1234567u;
    a.sweepF = 1100.0f;
    a.stepFreq = 80.0f;
    a.stepIdx = 0;
    a.chimeT = a.glugT = a.scareT = -1.0f;
    a.lastLevel = 1;
    a.hbTimer = 0.2f;
    a.stepDecay = expf(-35.0f * DT);
    a.hbDecay = expf(-16.0f * DT);
    a.chDecay = expf(-5.0f * DT);
    a.scareDecay = expf(-1.8f * DT);
}

void audioMix(AudioState& a, const Game& g, int16_t* out, int n) {
    // ---------- eventos ----------
    if (g.level > a.lastLevel && !g.dead) {
        a.chimeT = 0; a.chimeEnv1 = 1.0f; a.chimeEnv2 = 0; a.chime2 = false;
    }
    a.lastLevel = g.level;
    if (g.pickups > a.lastPickups) a.glugT = 0;
    a.lastPickups = g.pickups;
    if (g.dead && !a.lastDead) {
        a.scareT = 0;
        a.scareEnv = 1.0f;
        a.scareScale = (g.killer == STALKER) ? 0.7f : (g.killer == RUNNER ? 1.4f : 1.0f);
    }
    if (!g.dead && a.lastDead) a.scareT = -1.0f;  // reiniciou
    a.lastDead = g.dead;

    // passos: um a cada 0.9 unidade andada
    int idx = (int)(g.walkDist / 0.9f);
    if (idx > a.stepIdx) {
        a.stepEnv = 1.0f;
        a.stepFreq = (idx & 1) ? 72.0f : 90.0f;
    }
    a.stepIdx = idx;

    // ---------- ganhos por proximidade ----------
    float gSm = 0, gStSeen = 0, gStMove = 0, gRunRun = 0, gRunPause = 0;
    for (int i = 0; i < g.anCount; i++) {
        float dx = g.an[i].x - g.px, dy = g.an[i].y - g.py;
        float p = 1.0f - sqrtf(dx * dx + dy * dy) / 12.0f;
        if (p <= 0) continue;
        p *= p;
        switch (g.an[i].type) {
            case SMILER:  gSm += p; break;
            case STALKER: if (g.an[i].seen) gStSeen += p; else gStMove += p; break;
            default:      if (g.an[i].running) gRunRun += p; else gRunPause += p; break;
        }
    }
    gSm = clampf(gSm, 0, 1); gStSeen = clampf(gStSeen, 0, 1); gStMove = clampf(gStMove, 0, 1);
    gRunRun = clampf(gRunRun, 0, 1); gRunPause = clampf(gRunPause, 0, 1);

    const bool alive = !g.dead;
    const bool heart = alive && g.nearest < 9.0f;
    float bpm = 60.0f + (9.0f - g.nearest) * 13.0f;
    float hbVol = 0.05f + 0.30f * clampf(1.0f - g.nearest / 9.0f, 0, 1);
    float lightGain = clampf(g.flicker, 0.0f, 1.0f);

    for (int k = 0; k < n; k++) {
        float s = 0;
        float nz = noise(a);
        a.noiseLP += 0.02f * (nz - a.noiseLP);
        a.noiseLP2 += 0.15f * (nz - a.noiseLP2);

        if (alive) {
            // zumbido da luz fluorescente + som ambiente grave
            float hum = 0.075f * tsin(a, adv(a.humPh1, 120.0f)) +
                        0.040f * tsin(a, adv(a.humPh2, 240.0f)) +
                        0.020f * tsin(a, adv(a.humPh3, 360.0f)) + 0.010f * nz;
            s += hum * lightGain + 0.6f * a.noiseLP;

            // passos
            if (a.stepEnv > 0.002f) {
                float thud = tsin(a, adv(a.stepPh, a.stepFreq));
                s += a.stepEnv * (0.32f * thud + 0.55f * a.noiseLP2);
                a.stepEnv *= a.stepDecay;
            }

            // batimento cardiaco (perto de uma anomalia)
            if (heart) {
                a.hbTimer -= DT;
                if (a.hbTimer <= 0) { a.hbEnv1 = 1.0f; a.hbTimer += 60.0f / bpm; a.hbDub = 0.17f; }
                if (a.hbDub > 0) { a.hbDub -= DT; if (a.hbDub <= 0) a.hbEnv2 = 0.75f; }
            }
            if (a.hbEnv1 > 0.002f || a.hbEnv2 > 0.002f) {
                float thump = a.hbEnv1 * tsin(a, adv(a.hbPh1, 55.0f)) + a.hbEnv2 * tsin(a, adv(a.hbPh2, 48.0f));
                s += hbVol * thump;
                a.hbEnv1 *= a.hbDecay; a.hbEnv2 *= a.hbDecay;
            }

            // vozes das anomalias
            if (gSm > 0.001f) {
                float trem = 0.6f + 0.4f * tsin(a, adv(a.smTrem, 0.7f));
                s += 0.16f * gSm * trem * 0.5f * (tsin(a, adv(a.smPh1, 110.0f)) + tsin(a, adv(a.smPh2, 113.5f)));
            }
            if (gStSeen > 0.001f) s += 0.05f * gStSeen * tsin(a, adv(a.ringPh, 2870.0f));
            if (gStMove > 0.001f) {
                float gate = (tsin(a, adv(a.gatePh, 17.0f)) > 0.3f) ? 1.0f : 0.15f;
                s += 0.16f * gStMove * gate * nz;
            }
            if (gRunRun > 0.001f) {
                a.sweepF -= 1800.0f * DT;
                if (a.sweepF < 300.0f) a.sweepF = 1100.0f;
                float saw = 2.0f * adv(a.sweepPh, a.sweepF) - 1.0f;
                s += 0.11f * gRunRun * saw;
            }
            if (gRunPause > 0.001f) s += 0.10f * gRunPause * tsin(a, adv(a.growlPh, 80.0f)) * (0.7f + 0.3f * nz);
        }

        // ---------- sons de evento ----------
        if (a.chimeT >= 0) {
            a.chimeT += DT;
            if (!a.chime2 && a.chimeT >= 0.15f) { a.chime2 = true; a.chimeEnv2 = 1.0f; }
            s += 0.22f * (a.chimeEnv1 * tsin(a, adv(a.chPh1, 660.0f)) + a.chimeEnv2 * tsin(a, adv(a.chPh2, 880.0f)));
            a.chimeEnv1 *= a.chDecay; a.chimeEnv2 *= a.chDecay;
            if (a.chimeT > 1.0f) a.chimeT = -1.0f;
        }
        if (a.glugT >= 0) {
            a.glugT += DT;
            float f = 300.0f - 400.0f * a.glugT;
            float env = 1.0f - a.glugT / 0.35f;
            if (env <= 0 || f < 80.0f) a.glugT = -1.0f;
            else s += 0.28f * env * tsin(a, adv(a.glugPh, f)) * (0.6f + 0.4f * tsin(a, adv(a.glugMod, 22.0f)));
        }
        if (a.scareT >= 0) {
            a.scareT += DT;
            float f = a.scareScale * (1500.0f - 900.0f * clampf(a.scareT / 1.2f, 0, 1));
            s += a.scareEnv * (0.45f * nz + 0.40f * tsin(a, adv(a.scPh1, f)) + 0.25f * tsin(a, adv(a.scPh2, f * 1.5f)));
            a.scareEnv *= a.scareDecay;
            if (a.scareT > 1.8f) a.scareT = -1.0f;
        }

        out[k] = (int16_t)(softClip(s) * 30000.0f);
    }
}

}  // namespace bk
