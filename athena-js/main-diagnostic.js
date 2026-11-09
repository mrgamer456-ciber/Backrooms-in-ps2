// {"name":"Teste AthenaEnv","author":"Backrooms PS2","version":"0.1","file":"main.js"}
"use strict";

// Teste minimo: nao importa nenhum arquivo do jogo e nao usa o renderer 3D.
const font = new Font("default");
Screen.setParam(Screen.DEPTH_TEST_ENABLE, false);
os.setInterval(() => {
  Screen.clear();
  font.color = Color.new(255, 255, 255, 128);
  font.print(40, 80, "ATHENAENV FUNCIONANDO!");
  font.print(40, 112, "TESTE JAVASCRIPT MINIMO");
  Screen.flip();
}, 0);
