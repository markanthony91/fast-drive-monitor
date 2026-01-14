# Shell.nix - Alternativa para quem não usa Nix Flakes
# Uso: nix-shell

{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    # Node.js e npm
    nodejs_20
    nodePackages.npm
    nodePackages.yarn

    # Electron dependencies
    electron

    # USB/HID dependencies para comunicação com headset
    libusb1
    hidapi
    udev

    # Build tools
    pkg-config
    python311  # Python 3.11 ainda tem distutils (necessário para node-gyp)
    python311Packages.setuptools
    gnumake
    gcc
    nodePackages.node-gyp

    # Debug tools
    usbutils

    # Bibliotecas necessárias para Electron/Chromium
    stdenv.cc.cc.lib  # libstdc++.so.6
    mesa              # OpenGL/Mesa
    libGL
    libglvnd
    xorg.libX11
    xorg.libXcomposite
    xorg.libXdamage
    xorg.libXext
    xorg.libXfixes
    xorg.libXrandr
    xorg.libxcb
    gtk3
    glib
    nss
    nspr
    alsa-lib
    cups
    dbus
    at-spi2-atk
    at-spi2-core
    expat
    libdrm
    libxkbcommon
    pango
    cairo
  ];

  shellHook = ''
    echo "=========================================="
    echo "  Fast Drive - Jabra Headset Monitor"
    echo "=========================================="
    echo ""
    echo "Ambiente de desenvolvimento carregado!"
    echo ""
    echo "Comandos disponíveis:"
    echo "  npm install    - Instalar dependências"
    echo "  npm start      - Iniciar servidor web"
    echo "  npm run electron - Iniciar aplicação desktop"
    echo "  npm run dev    - Modo desenvolvimento"
    echo ""
    echo "Para permitir acesso USB ao headset Jabra:"
    echo "  sudo cp udev/99-jabra.rules /etc/udev/rules.d/"
    echo "  sudo udevadm control --reload-rules"
    echo ""

    # Configurar variáveis de ambiente para bibliotecas
    export LD_LIBRARY_PATH="${pkgs.stdenv.cc.cc.lib}/lib:${pkgs.mesa}/lib:${pkgs.libGL}/lib:${pkgs.libglvnd}/lib:${pkgs.libusb1}/lib:${pkgs.hidapi}/lib:${pkgs.gtk3}/lib:${pkgs.glib.out}/lib:${pkgs.nss}/lib:${pkgs.nspr}/lib:${pkgs.alsa-lib}/lib:${pkgs.cups.lib}/lib:${pkgs.dbus}/lib:${pkgs.at-spi2-atk}/lib:${pkgs.at-spi2-core}/lib:${pkgs.expat}/lib:${pkgs.libdrm}/lib:${pkgs.libxkbcommon}/lib:${pkgs.xorg.libX11}/lib:${pkgs.xorg.libXcomposite}/lib:${pkgs.xorg.libXdamage}/lib:${pkgs.xorg.libXext}/lib:${pkgs.xorg.libXfixes}/lib:${pkgs.xorg.libXrandr}/lib:${pkgs.xorg.libxcb}/lib:${pkgs.pango.out}/lib:${pkgs.cairo}/lib:$LD_LIBRARY_PATH"
    export PKG_CONFIG_PATH="${pkgs.libusb1}/lib/pkgconfig:${pkgs.hidapi}/lib/pkgconfig:$PKG_CONFIG_PATH"
  '';

  # Variáveis de ambiente para Electron
  ELECTRON_SKIP_BINARY_DOWNLOAD = "1";
  ELECTRON_OVERRIDE_DIST_PATH = "${pkgs.electron}/bin";
}
