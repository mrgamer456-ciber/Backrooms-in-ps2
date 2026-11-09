// Sintetizador de audio em C++ puro: gera todo o som do jogo em tempo real (PCM 16-bit mono).
// Nao depende de PS2 nem de arquivos de audio. A plataforma so precisa mandar os samples
// para o audsrv (ver main.cpp).
#pragma once
#include <stdint.h>
#include "game.h"

namespace bk {

constexpr int AUDIO_RATE = 22050;

struct AudioState {
    float table[1024];  // tabela de seno
    uint32_t rng;

    // fases dos osciladores (0..1)
    float humPh1, humPh2, humPh3;
    float stepPh, hbPh1, hbPh2;
    float smPh1, smPh2, smTrem;
    float ringPh, gatePh, sweepPh, growlPh;
    float chPh1, chPh2, glugPh, glugMod, scPh1, scPh2;

    // filtros e envelopes
    float noiseLP, noiseLP2;
    float stepEnv, stepFreq;
    int stepIdx;
    float hbTimer, hbDub, hbEnv1, hbEnv2;
    float sweepF;

    // sons de evento (t < 0 = desligado)
    float chimeT, chimeEnv1, chimeEnv2;
    bool chime2;
    float glugT;
    float scareT, scareEnv, scareScale;

    // ultimo estado visto (deteccao de eventos)
    int lastLevel, lastPickups;
    bool lastDead;

    // decaimentos pre-calculados
    float stepDecay, hbDecay, chDecay, scareDecay;
};

void audioInit(AudioState& a);
// Gera n samples mono 16-bit para o estado atual do jogo.
void audioMix(AudioState& a, const Game& g, int16_t* out, int n);

}  // namespace bk
