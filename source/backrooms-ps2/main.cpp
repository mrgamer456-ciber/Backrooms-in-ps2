// Backrooms PS2 - camada de plataforma (gsKit + libpad + audsrv).
// Toda a logica esta em game.cpp, o som em audio.cpp, texturas em textures.cpp.
//
// Chaves de compilacao (veja o Makefile): USE_AUDIO e USE_WALL_TEXTURE (1 = ligado, 0 = desligado).
// Se o build falhar numa dessas partes, compile com "make USE_AUDIO=0" ou "make USE_WALL_TEXTURE=0".
#include <kernel.h>
#include <sifrpc.h>
#include <loadfile.h>
#include <gsKit.h>
#include <dmaKit.h>
#include <libpad.h>
#include <malloc.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <math.h>
#include "game.h"
#include "audio.h"
#include "textures.h"
#include "font.h"

#ifndef USE_AUDIO
#define USE_AUDIO 1
#endif
#ifndef USE_WALL_TEXTURE
#define USE_WALL_TEXTURE 1
#endif

#if USE_AUDIO
extern "C" {
#include <audsrv.h>
extern unsigned char audsrv_irx[];
extern unsigned int size_audsrv_irx;
}
#endif

static char padBuf[256] __attribute__((aligned(64)));
static bk::Game g;

// ======================= inicializacao =======================
static void initModules()
{
    SifInitRpc(0);
    SifLoadModule("rom0:SIO2MAN", 0, NULL);
    SifLoadModule("rom0:PADMAN", 0, NULL);
#if USE_AUDIO
    SifLoadModule("rom0:LIBSD", 0, NULL);
    int ret = 0;
    SifExecModuleBuffer(audsrv_irx, size_audsrv_irx, 0, NULL, &ret);
#endif
}

static void initPad()
{
    padInit(0);
    if (padPortOpen(0, 0, padBuf) == 0) return;

    // Aguarda o controle ser identificado antes de solicitar o modo analogico.
    // FINDCTP1 ainda e uma etapa de deteccao; mudar o modo nesse ponto pode falhar.
    for (int i = 0; i < 300; ++i) {
        if (padGetState(0, 0) == PAD_STATE_STABLE) break;
    }

    if (padGetState(0, 0) != PAD_STATE_STABLE) return;

    // Solicita DualShock/analogico e aguarda o PADMAN concluir a troca de modo.
    padSetMainMode(0, 0, PAD_MMODE_DUALSHOCK, PAD_MMODE_LOCK);
    for (int i = 0; i < 120; ++i) {
        if (padGetState(0, 0) == PAD_STATE_STABLE &&
            padInfoMode(0, 0, PAD_MODECURID, 0) == PAD_TYPE_DUALSHOCK) {
            return;
        }
    }
}

#if USE_AUDIO
static bool audioOk = false;
static int audioCap = 0;
static bk::AudioState aud;
static int16_t audioBuf[4096];

static void initAudio()
{
    bk::audioInit(aud);
    if (audsrv_init() != 0) return;  // sem audio: o jogo segue mudo
    audsrv_fmt_t fmt;
    fmt.bits = 16;
    fmt.freq = bk::AUDIO_RATE;
    fmt.channels = 1;
    if (audsrv_set_format(&fmt) != 0) return;
    audsrv_set_volume(MAX_VOLUME);
    audioOk = true;
}

// Mantem ~4 KB (cerca de 90 ms) de audio na fila: baixa latencia sem estourar o buffer.
static void pumpAudio()
{
    if (!audioOk) return;
    int avail = audsrv_available();
    if (avail > audioCap) audioCap = avail;
    int queued = audioCap - avail;
    const int target = 4096;
    if (queued >= target) return;
    int bytes = target - queued;
    if (bytes > avail) bytes = avail;
    if (bytes > (int)sizeof(audioBuf)) bytes = (int)sizeof(audioBuf);
    bytes &= ~1;
    if (bytes < 64) return;
    int n = bytes / 2;
    bk::audioMix(aud, g, audioBuf, n);
    audsrv_play_audio((const char *)audioBuf, n * 2);
}
#else
static void initAudio() {}
static void pumpAudio() {}
#endif

// ======================= entrada =======================
static float axis(int v)
{
    float f = ((float)v - 128.0f) / 128.0f;
    return (fabsf(f) < 0.22f) ? 0.0f : f;
}

static float clamp1(float v) { return v < -1.0f ? -1.0f : (v > 1.0f ? 1.0f : v); }

static bk::Input readInput()
{
    bk::Input in;
    struct padButtonStatus pad;
    if (padGetState(0, 0) == PAD_STATE_STABLE && padRead(0, 0, &pad) != 0) {
        u32 b = 0xFFFF ^ pad.btns;
        in.moveX = axis(pad.ljoy_h);
        in.moveY = -axis(pad.ljoy_v);
        in.turn = axis(pad.rjoy_h);
        if (b & PAD_UP)    in.moveY += 1.0f;
        if (b & PAD_DOWN)  in.moveY -= 1.0f;
        if (b & PAD_LEFT)  in.turn -= 1.0f;
        if (b & PAD_RIGHT) in.turn += 1.0f;
        in.moveX = clamp1(in.moveX);
        in.moveY = clamp1(in.moveY);
        in.turn = clamp1(in.turn);
        in.sprint = (b & (PAD_R1 | PAD_CROSS)) != 0;
        in.restart = (b & (PAD_START | PAD_CROSS)) != 0;
    }
    return in;
}

// ======================= desenho =======================
static inline u8 c8(float v) { return (u8)(v < 0 ? 0 : (v > 255 ? 255 : v)); }
static inline u64 rgb(float r, float gr, float b)
{
    return GS_SETREG_RGBAQ(c8(r), c8(gr), c8(b), 0x80, 0x00);
}

static void rect(GSGLOBAL *gs, float x0, float y0, float x1, float y1, u64 col)
{
    gsKit_prim_sprite(gs, x0, y0, x1, y1, 1, col);
}

static float hashf(uint32_t n)
{
    n ^= n >> 15; n *= 2246822519u; n ^= n >> 13; n *= 3266489917u; n ^= n >> 16;
    return (float)(n & 0xFFFF) / 65535.0f;
}

// texto com a fonte bitmap 5x7 (cada glifo = retangulos por trecho horizontal)
static float textWidth(const char *s, float scale) { return (float)strlen(s) * 6.0f * scale - scale; }

static void drawText(GSGLOBAL *gs, float x, float y, float scale, u64 col, const char *s)
{
    for (; *s; s++, x += 6.0f * scale) {
        const uint8_t *rows = bk::glyphRows(*s);
        if (!rows) continue;
        for (int row = 0; row < 7; row++) {
            int start = -1;
            for (int cx = 0; cx <= 5; cx++) {
                bool on = cx < 5 && ((rows[row] >> (4 - cx)) & 1);
                if (on && start < 0) start = cx;
                if (!on && start >= 0) {
                    rect(gs, x + start * scale, y + row * scale, x + cx * scale, y + (row + 1) * scale, col);
                    start = -1;
                }
            }
        }
    }
}

static void drawTextShadow(GSGLOBAL *gs, float x, float y, float scale, u64 col, const char *s)
{
    drawText(gs, x + scale, y + scale, scale, rgb(0, 0, 0), s);
    drawText(gs, x, y, scale, col, s);
}

static void drawTextCentered(GSGLOBAL *gs, float y, float scale, u64 col, const char *s)
{
    drawTextShadow(gs, ((float)gs->Width - textWidth(s, scale)) / 2.0f, y, scale, col, s);
}

#if USE_WALL_TEXTURE
static GSTEXTURE wallTex;

static void initWallTexture(GSGLOBAL *gs)
{
    wallTex.Width = bk::WALL_TEX_SIZE;
    wallTex.Height = bk::WALL_TEX_SIZE;
    wallTex.PSM = GS_PSM_CT32;
    wallTex.Filter = GS_FILTER_NEAREST;
    wallTex.Mem = (u32 *)memalign(128, gsKit_texture_size_ee(wallTex.Width, wallTex.Height, wallTex.PSM));
    bk::makeWallpaper((uint32_t *)wallTex.Mem, bk::WALL_TEX_SIZE);
    wallTex.Vram = gsKit_vram_alloc(gs, gsKit_texture_size(wallTex.Width, wallTex.Height, wallTex.PSM), GSKIT_ALLOC_USERBUFFER);
    gsKit_texture_upload(gs, &wallTex);
}
#endif

static void drawTitle(GSGLOBAL *gs, uint32_t frame)
{
    const float W = (float)gs->Width, H = (float)gs->Height;
    float fl = 0.85f + 0.15f * hashf(frame / 3u);
    rect(gs, 0, 0, W, H, rgb(30, 27, 8));
    rect(gs, 0, H * 0.28f, W, H * 0.60f, rgb(205 * fl, 186 * fl, 84 * fl));
    float s = 8.0f;
    drawText(gs, (W - textWidth("BACKROOMS", s)) / 2.0f, H * 0.34f, s, rgb(50, 40, 5), "BACKROOMS");
    drawText(gs, (W - textWidth("NIVEL 0", 3.0f)) / 2.0f, H * 0.50f, 3.0f, rgb(90, 75, 15), "NIVEL 0");
    if (((frame / 30u) & 1u) == 0)
        drawTextCentered(gs, H * 0.68f, 3.0f, rgb(240, 240, 240), "APERTE START");
    drawTextCentered(gs, H * 0.80f, 2.0f, rgb(200, 200, 190), "ANALOGICOS: ANDAR E OLHAR");
    drawTextCentered(gs, H * 0.86f, 2.0f, rgb(200, 200, 190), "R1 OU X: CORRER");
}

static void drawDead(GSGLOBAL *gs, uint32_t frame)
{
    const float W = (float)gs->Width, H = (float)gs->Height;
    rect(gs, 0, 0, W, H, rgb(0, 0, 0));
    float j = (hashf(frame) - 0.5f) * 10.0f;  // tremida
    float fw = H * 0.50f, cx = W / 2 + j, top = H * 0.06f + j, fh = H * 0.62f;
    u64 faceCol = (g.killer == bk::RUNNER) ? rgb(170, 25, 25) : rgb(225, 225, 212);
    u64 eyeCol = (g.killer == bk::RUNNER) ? rgb(255, 255, 255) : rgb(0, 0, 0);
    float ew = (g.killer == bk::STALKER) ? 0.16f : 0.10f;  // olhos maiores no Stalker
    rect(gs, cx - fw / 2, top, cx + fw / 2, top + fh, faceCol);
    rect(gs, cx - fw * (0.20f + ew), top + fh * 0.26f, cx - fw * 0.10f, top + fh * 0.46f, eyeCol);
    rect(gs, cx + fw * 0.10f, top + fh * 0.26f, cx + fw * (0.20f + ew), top + fh * 0.46f, eyeCol);
    if (g.killer != bk::STALKER)
        rect(gs, cx - fw * 0.34f, top + fh * 0.62f, cx + fw * 0.34f, top + fh * 0.72f, rgb(0, 0, 0));

    char buf[48];
    drawTextCentered(gs, H * 0.74f, 4.0f, rgb(200, 20, 20), "VOCE FOI PEGO");
    int t = (int)g.survived;
    snprintf(buf, sizeof(buf), "NIVEL %d  TEMPO %02d:%02d", g.level, t / 60, t % 60);
    drawTextCentered(gs, H * 0.84f, 2.0f, rgb(220, 220, 220), buf);
    if (g.deadTime > 1.5f && ((frame / 30u) & 1u) == 0)
        drawTextCentered(gs, H * 0.91f, 2.0f, rgb(240, 240, 240), "APERTE START");
}

static void drawWorld(GSGLOBAL *gs)
{
    const float W = (float)gs->Width, H = (float)gs->Height;
    const float colW = W / (float)bk::RAY_COLS;
    const float flick = g.flicker;

    // teto e chao em faixas (escurecem perto do horizonte = neblina)
    const int bands = 12;
    for (int i = 0; i < bands; i++) {
        float t = ((float)i + 0.5f) / (float)bands;       // 0 = longe do horizonte, 1 = horizonte
        float k = (0.65f * (1.0f - t) + 0.12f) * flick;
        float y0 = (H / 2) * (float)i / bands, y1 = (H / 2) * (float)(i + 1) / bands;
        rect(gs, 0, y0, W, y1, rgb(190 * k, 180 * k, 120 * k));            // teto
        float k2 = (0.50f * (1.0f - t) + 0.08f) * flick;
        float f0 = H - y1, f1 = H - y0;
        rect(gs, 0, f0, W, f1, rgb(120 * k2, 95 * k2, 50 * k2));           // carpete
    }

    // paredes
    for (int x = 0; x < bk::RAY_COLS; x++) {
        const bk::Column &c = g.cols[x];
        if (c.bottom <= c.top) continue;
        float b = c.bright * flick;
#if USE_WALL_TEXTURE
        if (c.type == 1) {
            const float T = (float)bk::WALL_TEX_SIZE;
            float u = floorf(c.u * T);
            if (u > T - 1.0f) u = T - 1.0f;
            float v1 = (c.top - c.fullTop) / c.fullH * T;
            float v2 = (c.bottom - c.fullTop) / c.fullH * T;
            if (v1 < 0) v1 = 0;
            if (v2 > T) v2 = T;
            // MODULATE: 128 = brilho original; abaixo disso escurece (neblina)
            gsKit_prim_sprite_texture(gs, &wallTex, x * colW, (float)c.top, u, v1,
                                      (x + 1) * colW, (float)c.bottom, u + 1.0f, v2, 1,
                                      rgb(128.0f * b, 128.0f * b, 128.0f * b));
            continue;
        }
#else
        if (c.type != 2) {
            float stripe = c.u * 4.0f;
            stripe -= floorf(stripe);
            if (stripe < 0.14f) b *= 0.80f;
        }
#endif
        float r, gr, bl;
        if (c.type == 2) {
            if (b < 0.65f) b = 0.65f;
            r = 30; gr = 230; bl = 90;
        } else {
            r = 205; gr = 186; bl = 84;
        }
        rect(gs, x * colW, (float)c.top, (x + 1) * colW, (float)c.bottom, rgb(r * b, gr * b, bl * b));
    }

    // itens: agua de amendoa
    for (int i = 0; i < g.itemCount; i++) {
        if (!g.items[i].active) continue;
        bk::SpriteView s = bk::projectItem(g, i, gs->Width, gs->Height);
        if (!s.visible) continue;
        int cm = (int)((float)s.centerX / colW);
        if (cm < 0 || cm >= bk::RAY_COLS || s.depth >= g.cols[cm].depth) continue;
        float lh = (float)s.lineHeight, cx = (float)s.centerX;
        float floorY = H / 2 + lh / 2;
        float ch = lh * 0.14f, cw = lh * 0.055f;
        float vis = 1.0f - s.depth / bk::MAX_VIEW;
        if (vis < 0.3f) vis = 0.3f;
        vis *= flick;
        rect(gs, cx - cw * 1.6f, floorY - ch * 1.25f, cx + cw * 1.6f, floorY, rgb(15 * vis, 45 * vis, 90 * vis));  // brilho
        rect(gs, cx - cw, floorY - ch, cx + cw, floorY, rgb(60 * vis, 140 * vis, 255 * vis));                    // lata
        rect(gs, cx - cw, floorY - ch * 0.66f, cx + cw, floorY - ch * 0.36f, rgb(240 * vis, 240 * vis, 240 * vis));  // rotulo
        rect(gs, cx - cw * 0.6f, floorY - ch * 1.12f, cx + cw * 0.6f, floorY - ch, rgb(200 * vis, 200 * vis, 210 * vis));  // tampa
    }

    // anomalias (de tras para frente)
    bk::SpriteView sv[bk::MAX_ANOMALIES];
    int order[bk::MAX_ANOMALIES];
    for (int i = 0; i < g.anCount; i++) {
        sv[i] = bk::projectAnomaly(g, i, gs->Width, gs->Height);
        order[i] = i;
    }
    for (int a = 0; a < g.anCount; a++)
        for (int b2 = a + 1; b2 < g.anCount; b2++)
            if (sv[order[b2]].depth > sv[order[a]].depth) { int t = order[a]; order[a] = order[b2]; order[b2] = t; }

    for (int n = 0; n < g.anCount; n++) {
        const bk::SpriteView &s = sv[order[n]];
        if (!s.visible) continue;
        float lh = (float)s.lineHeight;
        float sprH = lh * 0.92f;
        float floorY = H / 2 + lh / 2;
        float topY = floorY - sprH;
        float headH = sprH * 0.20f;
        float halfW = lh * 0.15f;
        float headHalf = halfW * 0.9f;
        float cx = (float)s.centerX;
        float vis = 1.0f - s.depth / bk::MAX_VIEW;
        if (vis < 0.15f) vis = 0.15f;

        const bk::Anomaly &an = g.an[order[n]];
        u64 bodyCol, headCol, eyeCol;
        if (an.type == bk::STALKER) {
            bodyCol = rgb(190 * vis, 190 * vis, 180 * vis);
            headCol = rgb(235 * vis, 235 * vis, 225 * vis);
            eyeCol = rgb(0, 0, 0);
        } else if (an.type == bk::RUNNER) {
            bodyCol = rgb(55 * vis, 4, 4);
            headCol = rgb(170 * vis, 25, 25);
            eyeCol = rgb(255, 255, 255);
        } else {
            bodyCol = rgb(8, 8, 8);
            headCol = rgb(235 * vis, 235 * vis, 225 * vis);
            eyeCol = rgb(0, 0, 0);
        }

        int c0 = (int)((cx - halfW) / colW), c1 = (int)((cx + halfW) / colW);
        if (c0 < 0) c0 = 0;
        if (c1 >= bk::RAY_COLS) c1 = bk::RAY_COLS - 1;
        for (int c = c0; c <= c1; c++) {
            if (s.depth >= g.cols[c].depth) continue;  // atras de uma parede
            float x0 = c * colW, x1 = x0 + colW;
            float xm = (x0 + x1) / 2;
            rect(gs, x0, topY + headH, x1, floorY, bodyCol);
            if (fabsf(xm - cx) < headHalf)
                rect(gs, x0, topY, x1, topY + headH, headCol);
        }
        int cm = (int)(cx / colW);
        if (cm >= 0 && cm < bk::RAY_COLS && s.depth < g.cols[cm].depth) {
            float es = headH * (an.type == bk::STALKER ? 0.34f : 0.20f);
            float ey = topY + headH * 0.30f;
            rect(gs, cx - headHalf * 0.55f, ey, cx - headHalf * 0.55f + es, ey + es, eyeCol);
            rect(gs, cx + headHalf * 0.55f - es, ey, cx + headHalf * 0.55f, ey + es, eyeCol);
            if (an.type != bk::STALKER)  // o Stalker nao tem boca
                rect(gs, cx - headHalf * 0.7f, topY + headH * 0.68f, cx + headHalf * 0.7f, topY + headH * 0.78f, rgb(0, 0, 0));
        }
    }

    // borda vermelha de perigo
    if (g.nearest < 5.0f) {
        float w = (5.0f - g.nearest) * 14.0f;
        rect(gs, 0, 0, w, H, rgb(120, 0, 0));
        rect(gs, W - w, 0, W, H, rgb(120, 0, 0));
    }

    // HUD
    char buf[32];
    snprintf(buf, sizeof(buf), "NIVEL %d", g.level);
    drawTextShadow(gs, 20, 16, 2.0f, rgb(240, 240, 220), buf);
    rect(gs, 20, H - 30, 144, H - 20, rgb(20, 20, 20));
    rect(gs, 22, H - 28, 22 + 120 * g.stamina, H - 22, g.exhausted ? rgb(200, 40, 40) : rgb(210, 210, 210));
    if (g.calmTimer > 0) {  // efeito da agua de amendoa
        float f = g.calmTimer / 5.0f;
        rect(gs, 20, H - 44, 144, H - 36, rgb(20, 20, 20));
        rect(gs, 22, H - 42, 22 + 120 * f, H - 38, rgb(60, 140, 255));
    }
    if (g.msgTimer > 0 && g.msgId != bk::MSG_NONE) {
        const char *m = (g.msgId == bk::MSG_FIND_DOOR) ? "ENCONTRE A PORTA VERDE" : "AGUA DE AMENDOA!";
        drawTextCentered(gs, H * 0.78f, 3.0f, rgb(250, 250, 240), m);
    }
}

// ======================= main =======================
int main()
{
    initModules();
    initPad();

    GSGLOBAL *gs = gsKit_init_global();
    gs->PSM = GS_PSM_CT24;
    gs->DoubleBuffering = GS_SETTING_ON;
    gs->ZBuffering = GS_SETTING_OFF;

    dmaKit_init(D_CTRL_RELE_OFF, D_CTRL_MFD_OFF, D_CTRL_STS_UNSPEC,
                D_CTRL_STD_OFF, D_CTRL_RCYC_8, 1 << DMA_CHANNEL_GIF);
    dmaKit_chan_init(DMA_CHANNEL_GIF);

    gsKit_init_screen(gs);
    gsKit_mode_switch(gs, GS_ONESHOT);
#if USE_WALL_TEXTURE
    initWallTexture(gs);
#endif

    initAudio();

    const float dt = (gs->Mode == GS_MODE_PAL) ? (1.0f / 50.0f) : (1.0f / 60.0f);
    bk::newGame(g, 0xB4C7200u);
    bool onTitle = true;
    uint32_t frame = 0;

    while (true) {
        bk::Input in = readInput();

        if (onTitle) {
            if (in.restart) {
                onTitle = false;
                bk::newGame(g, frame * 2654435761u ^ 0xB4C7200u);  // mapa diferente a cada partida
            }
            drawTitle(gs, frame);
        } else {
            bk::update(g, in, dt);
            if (g.dead) {
                drawDead(gs, frame);
            } else {
                bk::castRays(g, gs->Height);
                drawWorld(gs);
            }
        }

        pumpAudio();
        gsKit_queue_exec(gs);
        gsKit_sync_flip(gs);
        frame++;
    }
    return 0;
}
