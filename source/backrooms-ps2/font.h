// Fonte bitmap 5x7 embutida (sem arquivos nem bibliotecas de fonte).
#pragma once
#include <stdint.h>

namespace bk {

// Retorna 7 linhas de 5 bits (bit 4 = pixel mais a esquerda) ou nullptr se nao houver glifo.
// Suporta A-Z, 0-9, espaco e : - ! . (letras minusculas viram maiusculas).
const uint8_t* glyphRows(char c);

}  // namespace bk
