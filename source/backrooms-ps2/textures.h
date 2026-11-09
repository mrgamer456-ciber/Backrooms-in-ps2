// Texturas geradas por codigo (nenhum arquivo de imagem necessario).
#pragma once
#include <stdint.h>

namespace bk {

constexpr int WALL_TEX_SIZE = 128;

// Papel de parede amarelado (listras, losangos, manchas, rodape e moldura).
// Escreve size*size pixels no formato do GS (CT32): 0xAABBGGRR, com alpha 0x80 = opaco.
void makeWallpaper(uint32_t* px, int size);
void makePipeDreamsWall(uint32_t* px, int size);

}  // namespace bk
