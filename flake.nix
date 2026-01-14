# Nix Flake para Fast Drive - Jabra Headset Monitor
# Este arquivo configura o ambiente de desenvolvimento para o projeto

{
  description = "Fast Drive - Jabra Engage 55 Mono Headset Monitor";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
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
            echo "  npm start      - Iniciar aplicação"
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
        };

        packages.default = pkgs.buildNpmPackage {
          pname = "fast-drive";
          version = "1.0.0";
          src = ./.;
          npmDepsHash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

          buildInputs = with pkgs; [
            libusb1
            hidapi
          ];

          nativeBuildInputs = with pkgs; [
            pkg-config
            python3
          ];
        };
      }
    );
}
