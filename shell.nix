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
    python3
    gnumake
    gcc

    # Debug tools
    usbutils
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
    echo "  npm start      - Iniciar aplicação CLI"
    echo "  npm run electron - Iniciar interface gráfica"
    echo "  npm run dev    - Modo desenvolvimento"
    echo "  npm run build  - Build para produção"
    echo ""
    echo "Para permitir acesso USB ao headset Jabra:"
    echo "  sudo cp udev/99-jabra.rules /etc/udev/rules.d/"
    echo "  sudo udevadm control --reload-rules"
    echo ""

    # Configurar variáveis de ambiente
    export LD_LIBRARY_PATH="${pkgs.libusb1}/lib:${pkgs.hidapi}/lib:$LD_LIBRARY_PATH"
    export PKG_CONFIG_PATH="${pkgs.libusb1}/lib/pkgconfig:${pkgs.hidapi}/lib/pkgconfig:$PKG_CONFIG_PATH"
  '';

  # Variáveis de ambiente para Electron
  ELECTRON_SKIP_BINARY_DOWNLOAD = "1";
  ELECTRON_OVERRIDE_DIST_PATH = "${pkgs.electron}/bin";
}
