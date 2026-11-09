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

static bool padOpened = false;
static bool padModeRequested = false;

// A deteccao de alguns controles paralelos demora mais que a inicializacao
// do jogo. Por isso, a troca para analogico e tentada durante o jogo tambem.
static void initPad()
{
    padInit(0);
    padOpened = (padPortOpen(0, 0, padBuf) != 0);
}

static void updatePadMode()
{
    if (!padOpened) return;

    int state = padGetState(0, 0);
    if (state != PAD_STATE_STABLE) {
        // Se o controle ainda esta sendo detectado ou foi desconectado,
        // permite uma nova tentativa quando voltar a ficar estavel.
        padModeRequested = false;
        return;
    }

    int mode = padInfoMode(0, 0, PAD_MODECURID, 0);
    if (mode == PAD_TYPE_DUALSHOCK) {
        padModeRequested = true;
        return;
    }

    if (!padModeRequested) {
        padSetMainMode(0, 0, PAD_MMODE_DUALSHOCK, PAD_MMODE_LOCK);
        padModeRequested = true;
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
    updatePadMode();
    bk::Input in;
    struct padButtonStatus pad;
    if (padGetState(0, 0) == PAD_STATE_STABLE && padRead(0, 0, &pad) != 0) {
        u32 b = 0xFFFF ^ pad.btns;
        in.moveX = axis(pad.ljoy_h);
        in.moveY = -axis(pad.ljoy_v);
        in.turn = axis(pad.rjoy_h);
        in.lookY = -axis(pad.rjoy_v);
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
static GSTEXTURE pipeWallTex;

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

    pipeWallTex.Width = bk::WALL_TEX_SIZE;
    pipeWallTex.Height = bk::WALL_TEX_SIZE;
    pipeWallTex.PSM = GS_PSM_CT32;
    pipeWallTex.Filter = GS_FILTER_NEAREST;
    pipeWallTex.Mem = (u32 *)memalign(128, gsKit_texture_size_ee(pipeWallTex.Width, pipeWallTex.Height, pipeWallTex.PSM));
    bk::makePipeDreamsWall((uint32_t *)pipeWallTex.Mem, bk::WALL_TEX_SIZE);
    pipeWallTex.Vram = gsKit_vram_alloc(gs, gsKit_texture_size(pipeWallTex.Width, pipeWallTex.Height, pipeWallTex.PSM), GSKIT_ALLOC_USERBUFFER);
    gsKit_texture_upload(gs, &pipeWallTex);
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
    drawTextCentered(gs, H * 0.80f, 2.0f, rgb(200, 200, 190), "ANALOGICO DIREITO: OLHAR E VIRAR");
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

// HUD de filmadora VHS: contador real, REC, bateria, moldura e interferencia.
static void drawVhsOverlay(GSGLOBAL *gs, uint32_t frame)
{
    const float W = (float)gs->Width, H = (float)gs->Height;
    const float s = 2.0f;
    const float pad = 13.0f;
    const u64 white = rgb(232, 235, 218);
    const u64 dim = rgb(150, 157, 139);

    // Moldura de visor nos quatro cantos.
    rect(gs, pad, pad, pad + 54, pad + 3, white);
    rect(gs, pad, pad, pad + 3, pad + 35, white);
    rect(gs, W - pad - 54, pad, W - pad, pad + 3, white);
    rect(gs, W - pad - 3, pad, W - pad, pad + 35, white);
    rect(gs, pad, H - pad - 3, pad + 54, H - pad, white);
    rect(gs, pad, H - pad - 35, pad + 3, H - pad, white);
    rect(gs, W - pad - 54, H - pad - 3, W - pad, H - pad, white);
    rect(gs, W - pad - 3, H - pad - 35, W - pad, H - pad, white);

    // Indicador REC piscando.
    if (((frame / 25u) & 1u) == 0)
        rect(gs, 38, 30, 50, 42, rgb(235, 22, 18));
    drawTextShadow(gs, 60, 27, 3.0f, white, "REC");

    // Indicador de bateria no canto superior direito.
    float bx = W - 68.0f, by = 27.0f;
    rect(gs, bx, by, bx + 43, by + 19, white);
    rect(gs, bx + 43, by + 5, bx + 47, by + 14, white);
    rect(gs, bx + 3, by + 3, bx + 40, by + 16, rgb(25, 28, 22));
    rect(gs, bx + 5, by + 5, bx + 14, by + 14, rgb(190, 220, 178));
    rect(gs, bx + 16, by + 5, bx + 25, by + 14, rgb(190, 220, 178));
    rect(gs, bx + 27, by + 5, bx + 36, by + 14, rgb(190, 220, 178));

    // Contador HH:MM:SS baseado no tempo real sobrevivido na partida.
    int seconds = (int)g.survived + 1;
    if (seconds < 1) seconds = 1;
    char clockText[24];
    snprintf(clockText, sizeof(clockText), "%02d:%02d:%02d",
             seconds / 3600, (seconds / 60) % 60, seconds % 60);
    drawTextShadow(gs, 35, H - 69, 3.0f, white, clockText);

    // Ruido horizontal curto e irregular, sem encobrir a visao do jogador.
    for (int i = 0; i < 9; i++) {
        uint32_t h = frame * 37u + (uint32_t)i * 7919u;
        float y = 54.0f + hashf(h) * (H - 108.0f);
        float x = hashf(h + 17u) * (W - 45.0f);
        float len = 5.0f + hashf(h + 31u) * 38.0f;
        if ((h & 3u) != 0)
            rect(gs, x, y, x + len, y + 1.0f, (i & 1) ? dim : white);
    }

    // Linhas de tracking na parte inferior, aparecendo de forma irregular.
    if ((frame % 47u) < 3u) {
        float y = H - 20.0f - hashf(frame) * 24.0f;
        rect(gs, 18, y, W * (0.18f + 0.55f * hashf(frame + 9u)), y + 1.0f, dim);
    }
}

static void drawWorld(GSGLOBAL *gs, uint32_t frame)
{
    const float W = (float)gs->Width, H = (float)gs->Height;
    const float colW = W / (float)bk::RAY_COLS;
    const float flick = g.flicker;

    // Teto do Level 1: superficie amarelo-creme lisa, diferente do papel de parede.
    // O horizonte acompanha a inclinacao vertical do analógico direito.
    const float horizon = H * (0.5f + g.pitch);
    const int bands = 12;
    for (int i = 0; i < bands; i++) {
        float t = ((float)i + 0.5f) / (float)bands;
        float k = (0.72f * (1.0f - t) + 0.16f) * flick;
        float y0 = horizon * (float)i / bands, y1 = horizon * (float)(i + 1) / bands;
        if (g.level == 2) {
            float industrial = (0.58f * (1.0f - t) + 0.10f) * flick;
            rect(gs, 0, y0, W, y1, rgb(72 * industrial, 76 * industrial, 72 * industrial));
            // Travessas escuras no teto de concreto.
            if ((i % 3) == 0) rect(gs, 0, y0, W, y0 + 2.0f, rgb(28, 29, 27));
        } else {
            rect(gs, 0, y0, W, y1, rgb(218 * k, 211 * k, 166 * k));
        }
        float k2 = (0.50f * (1.0f - t) + 0.08f) * flick;
        float f0 = H - y1, f1 = H - y0;
        if (g.level == 2)
            rect(gs, 0, f0, W, f1, rgb(43 * k2, 42 * k2, 37 * k2));
        else
            rect(gs, 0, f0, W, f1, rgb(120 * k2, 95 * k2, 50 * k2));
    }

    // Luminarias fluorescentes retangulares no teto, em perspectiva.
    // As mais distantes ficam pequenas perto do horizonte; as proximas crescem em direcao ao topo.
    for (int i = 0; i < 5; i++) {
        float t = (float)i / 4.0f;
        float cy = 8.0f + (horizon - 8.0f) * t;
        float halfW = W * (0.025f + 0.105f * (1.0f - t));
        float halfH = H * (0.004f + 0.018f * (1.0f - t));
        float cx = W * 0.5f;
        float glow = (0.72f + 0.28f * flick) * (1.0f - 0.10f * t);
        if (g.level == 2) {
            // Luminarias industriais vermelhas de emergencia.
            rect(gs, cx - halfW * 1.25f, cy - halfH * 1.8f, cx + halfW * 1.25f, cy + halfH * 1.8f, rgb(95 * glow, 18 * glow, 10 * glow));
            rect(gs, cx - halfW, cy - halfH, cx + halfW, cy + halfH, rgb(38, 34, 30));
            rect(gs, cx - halfW * 0.82f, cy - halfH * 0.60f, cx + halfW * 0.82f, cy + halfH * 0.60f, rgb(255 * glow, 72 * glow, 35 * glow));
        } else {
            rect(gs, cx - halfW * 1.30f, cy - halfH * 1.75f, cx + halfW * 1.30f, cy + halfH * 1.75f, rgb(232 * glow, 222 * glow, 166 * glow));
            rect(gs, cx - halfW, cy - halfH, cx + halfW, cy + halfH, rgb(65, 61, 43));
            rect(gs, cx - halfW * 0.88f, cy - halfH * 0.70f, cx + halfW * 0.88f, cy + halfH * 0.70f, rgb(255 * glow, 255 * glow, 238 * glow));
            rect(gs, cx - halfW * 0.88f, cy - halfH * 0.70f, cx + halfW * 0.88f, cy - halfH * 0.48f, rgb(255, 255, 250));
        }
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
            GSTEXTURE *activeWall = (g.level == 2) ? &pipeWallTex : &wallTex;
            gsKit_prim_sprite_texture(gs, activeWall, x * colW, (float)c.top, u, v1,
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
            // A saida agora e branca e mais clara que as paredes do corredor.
            if (b < 1.0f) b = 1.0f;
            r = 255; gr = 255; bl = 255;
        } else if (g.level == 2) {
            r = 87; gr = 78; bl = 63;
        } else {
            r = 205; gr = 186; bl = 84;
        }
        rect(gs, x * colW, (float)c.top, (x + 1) * colW, (float)c.bottom, rgb(r * b, gr * b, bl * b));
    }

    // PORTA DE SAIDA: modelo 3D procedural, projetado a partir do mundo.
    {
        struct DoorVertex { float x, y, z; };
        const float det = g.planeX * g.dirY - g.dirX * g.planeY;
        const float invDet = fabsf(det) > 0.0001f ? 1.0f / det : 0.0f;
        const float W = (float)gs->Width, H = (float)gs->Height;
        const float glow = 1.05f + 0.25f * g.flicker;
        const int ex = (int)g.exitX, ey = (int)g.exitY;

        // A porta fica virada para o corredor livre junto ao bloco de parede.
        float tx = 1.0f, ty = 0.0f, nx = 0.0f, ny = 1.0f;
        if (g.map[ey][ex + 1] == 0) { tx=0; ty=1; nx=1; ny=0; }
        else if (g.map[ey][ex - 1] == 0) { tx=0; ty=1; nx=-1; ny=0; }
        else if (g.map[ey + 1][ex] == 0) { tx=1; ty=0; nx=0; ny=1; }
        else if (g.map[ey - 1][ex] == 0) { tx=1; ty=0; nx=0; ny=-1; }

        auto point = [&](float along, float normal, float z) -> DoorVertex {
            DoorVertex v = { g.exitX + tx*along + nx*normal,
                             g.exitY + ty*along + ny*normal, z };
            return v;
        };
        auto project = [&](const DoorVertex &v, float &sx, float &sy) -> bool {
            float rx=v.x-g.px, ry=v.y-g.py;
            float cameraX=invDet*(g.dirY*rx-g.dirX*ry);
            float depth=invDet*(-g.planeY*rx+g.planeX*ry);
            if (depth <= 0.18f) return false;
            sx=W*0.5f*(1.0f+cameraX/depth);
            sy=H*(0.5f+g.pitch)+(0.5f-v.z)*H/depth;
            return true;
        };
        auto face = [&](const DoorVertex &a, const DoorVertex &b,
                        const DoorVertex &c, const DoorVertex &d, u64 color) {
            float x1,y1,x2,y2,x3,y3,x4,y4;
            if (!project(a,x1,y1) || !project(b,x2,y2) ||
                !project(c,x3,y3) || !project(d,x4,y4)) return;
            if (x1 < -W || x1 > W*2 || x2 < -W || x2 > W*2 ||
                x3 < -W || x3 > W*2 || x4 < -W || x4 > W*2) return;
            gsKit_prim_quad_3d(gs,x1,y1,1,x2,y2,1,x3,y3,1,x4,y4,1,color);
        };

        DoorVertex center=point(0.0f,0.0f,0.5f);
        float centerX=0, centerY=0;
        bool visible=project(center,centerX,centerY);
        int centerCol=(int)(centerX/(W/(float)bk::RAY_COLS));
        if (centerCol<0 || centerCol>=bk::RAY_COLS ||
            g.cols[centerCol].type!=2) visible=false;

        if (visible) {
            // Luz e passagem ao fundo, recuadas em relacao ao batente.
            // Halo branco forte em camadas: brilho suave, luz intensa e nucleo quase branco.
            face(point(-0.39f,0.010f,0.00f),point(0.39f,0.010f,0.00f),
                 point(0.39f,0.010f,0.98f),point(-0.39f,0.010f,0.98f),
                 rgb(145*glow,145*glow,155*glow));
            face(point(-0.35f,0.014f,0.02f),point(0.35f,0.014f,0.02f),
                 point(0.35f,0.014f,0.94f),point(-0.35f,0.014f,0.94f),
                 rgb(205*glow,205*glow,210*glow));
            face(point(-0.29f,0.018f,0.05f),point(0.29f,0.018f,0.05f),
                 point(0.29f,0.018f,0.90f),point(-0.29f,0.018f,0.90f),
                 rgb(245*glow,245*glow,245*glow));
            face(point(-0.15f,0.024f,0.08f),point(0.15f,0.024f,0.08f),
                 point(0.15f,0.024f,0.86f),point(-0.15f,0.024f,0.86f),
                 rgb(255,255,255));

            // Batente: dois montantes, travessa superior e faces de profundidade.
            face(point(-0.43f,0.075f,0),point(-0.33f,0.075f,0),
                 point(-0.33f,0.075f,1),point(-0.43f,0.075f,1),rgb(48,29,17));
            face(point(0.33f,0.075f,0),point(0.43f,0.075f,0),
                 point(0.43f,0.075f,1),point(0.33f,0.075f,1),rgb(48,29,17));
            face(point(-0.43f,0.075f,0.91f),point(0.43f,0.075f,0.91f),
                 point(0.43f,0.075f,1),point(-0.43f,0.075f,1),rgb(75,47,26));
            face(point(-0.43f,0,0),point(-0.43f,0.075f,0),
                 point(-0.43f,0.075f,1),point(-0.43f,0,1),rgb(29,18,12));
            face(point(0.43f,0,0),point(0.43f,0.075f,0),
                 point(0.43f,0.075f,1),point(0.43f,0,1),rgb(29,18,12));

            // Folha articulada: a dobradica fica no lado esquerdo e a porta abre para o corredor.
            const float hinge=-0.33f, leafW=0.66f, ca=0.53f, sa=0.85f;
            auto leaf = [&](float u,float z,float offset) -> DoorVertex {
                return point(hinge+u*ca,0.085f+u*sa+offset,z);
            };
            face(leaf(0,0.035f,0),leaf(leafW,0.035f,0),
                 leaf(leafW,0.91f,0),leaf(0,0.91f,0),rgb(91,52,27));

            // Molduras e paineis em relevo na superficie da folha.
            face(leaf(0.04f,0.08f,0.006f),leaf(leafW-0.04f,0.08f,0.006f),
                 leaf(leafW-0.04f,0.43f,0.006f),leaf(0.04f,0.43f,0.006f),rgb(139,87,44));
            face(leaf(0.04f,0.53f,0.006f),leaf(leafW-0.04f,0.53f,0.006f),
                 leaf(leafW-0.04f,0.86f,0.006f),leaf(0.04f,0.86f,0.006f),rgb(139,87,44));
            face(leaf(0.075f,0.12f,0.010f),leaf(leafW-0.075f,0.12f,0.010f),
                 leaf(leafW-0.075f,0.39f,0.010f),leaf(0.075f,0.39f,0.010f),rgb(76,43,24));
            face(leaf(0.075f,0.57f,0.010f),leaf(leafW-0.075f,0.57f,0.010f),
                 leaf(leafW-0.075f,0.82f,0.010f),leaf(0.075f,0.82f,0.010f),rgb(76,43,24));

            // Veios finos de madeira: textura procedural desenhada sobre a propria folha.
            for (int grain=0; grain<5; grain++) {
                float u=0.12f+grain*0.105f;
                face(leaf(u,0.15f,0.014f),leaf(u+0.012f,0.15f,0.014f),
                     leaf(u+0.012f,0.80f,0.014f),leaf(u,0.80f,0.014f),
                     rgb(158+grain*2,101+grain*2,51));
            }
            // Espessura da borda, dobradica, macaneta e soleira.
            face(leaf(leafW-0.025f,0.04f,0.018f),leaf(leafW,0.04f,0.018f),
                 leaf(leafW,0.90f,0.018f),leaf(leafW-0.025f,0.90f,0.018f),rgb(39,23,14));
            face(leaf(0.10f,0.43f,0.020f),leaf(0.18f,0.43f,0.020f),
                 leaf(0.18f,0.49f,0.020f),leaf(0.10f,0.49f,0.020f),rgb(240,184,55));
            face(point(-0.43f,0.02f,0),point(0.43f,0.02f,0),
                 point(0.43f,0.13f,0.025f),point(-0.43f,0.13f,0.025f),rgb(84,54,30));
        }
    }

    // itens: agua de amendoa
    for (int i = 0; i < g.itemCount; i++) {
        if (!g.items[i].active) continue;
        bk::SpriteView s = bk::projectItem(g, i, gs->Width, gs->Height);
        if (!s.visible) continue;
        int cm = (int)((float)s.centerX / colW);
        if (cm < 0 || cm >= bk::RAY_COLS || s.depth >= g.cols[cm].depth) continue;
        float lh = (float)s.lineHeight, cx = (float)s.centerX;
        float floorY = horizon + lh / 2;
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
        float floorY = horizon + lh / 2;
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
        const char *m = (g.msgId == bk::MSG_FIND_DOOR) ? "ENCONTRE A PORTA ABERTA COM A LUZ BRANCA" :
                        (g.msgId == bk::MSG_PIPE_DREAMS) ? "NIVEL 2: PIPE DREAMS" : "AGUA DE AMENDOA!";
        drawTextCentered(gs, H * 0.78f, 3.0f, rgb(250, 250, 240), m);
    }

    // Camada final da filmadora: fica por cima do mundo e do HUD.
    drawVhsOverlay(gs, frame);
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
                drawWorld(gs, frame);
            }
        }

        pumpAudio();
        gsKit_queue_exec(gs);
        gsKit_sync_flip(gs);
        frame++;
    }
    return 0;
}
