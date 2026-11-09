# Chaves: make USE_AUDIO=0 (sem som) / make USE_WALL_TEXTURE=0 (paredes lisas)
USE_AUDIO ?= 1
USE_WALL_TEXTURE ?= 1

EE_BIN = backrooms.elf
EE_OBJS = main.o game.o audio.o textures.o font.o
EE_INCS += -I$(PS2DEV)/gsKit/include
EE_LDFLAGS += -L$(PS2DEV)/gsKit/lib
EE_LIBS = -lgskit -ldmakit -lpad
EE_CXXFLAGS += -DUSE_AUDIO=$(USE_AUDIO) -DUSE_WALL_TEXTURE=$(USE_WALL_TEXTURE)

ifeq ($(USE_AUDIO),1)
EE_OBJS += audsrv_irx.o
EE_LIBS += -laudsrv
endif

EE_LIBS += -lm -lc -lkernel

all: $(EE_BIN)

# embute o modulo de audio (IOP) dentro do .elf
audsrv_irx.c:
	$(PS2SDK)/bin/bin2c $(PS2SDK)/iop/irx/audsrv.irx audsrv_irx.c audsrv_irx

clean:
	rm -f $(EE_BIN) $(EE_OBJS) audsrv_irx.c

include $(PS2SDK)/samples/Makefile.pref
include $(PS2SDK)/samples/Makefile.eeglobal
