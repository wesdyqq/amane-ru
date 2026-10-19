# Установка

Amane поставляется одной командой `amane`. Внутри неё лежит полная копия библиотеки. Команда собирает оболочку из вашей папки конфигурации, поэтому создавать Cargo-проект вручную не нужно.

### NixOS

Репозиторий является flake. Пакет оборачивает `amane` со всем, что нужно для сборки: `cargo`, `rustc`, `pkg-config` и системные библиотеки.

Попробовать без установки:

```sh
nix run github:MystiaFin/amane -- new
```

Установить для пользователя:

```sh
nix profile install github:MystiaFin/amane
```

Установить системно — добавьте flake во входы конфигурации:

```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    amane = {
      url = "github:MystiaFin/amane";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { nixpkgs, amane, ... }: {
    nixosConfigurations.your-host = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [
        ./configuration.nix
        {
          environment.systemPackages = [ amane.packages.x86_64-linux.default ];
        }
      ];
    };
  };
}
```

Замените `your-host` на имя хоста и пересоберите систему.

Строка `follows` заставляет Amane использовать `nixpkgs` вашей системы, чтобы совпадала glibc с графическим драйвером. Без неё оболочка может не найти GPU.

### Другие дистрибутивы

Нужны инструменты Rust, `pkg-config` и библиотеки с заголовками разработки:

| Библиотека | Debian / Ubuntu | Arch |
|---|---|---|
| Wayland | `libwayland-dev` | `wayland` |
| xkbcommon | `libxkbcommon-dev` | `libxkbcommon` |
| fontconfig | `libfontconfig1-dev` | `fontconfig` |
| FreeType | `libfreetype-dev` | `freetype2` |
| expat | `libexpat1-dev` | `expat` |
| Vulkan loader | `libvulkan1` | `vulkan-icd-loader` |
| PulseAudio client | `libpulse-dev` | `libpulse` |
| PAM | `libpam0g-dev` | `pam` |
| C-компилятор | `build-essential` | `gcc` |

Также нужен `pkg-config` (`pkgconf` в Arch). Готовый набор ставит `install.sh` из репозитория.

Сборка и установка команды:

```sh
git clone https://github.com/MystiaFin/amane
cd amane
cargo install --path cli
```

`cargo install` кладёт `amane` в `~/.cargo/bin`. Убедитесь, что эта папка есть в `PATH`.

Команда `amane` запускает `cargo` при каждой сборке вашей оболочки, поэтому toolchain Rust должен оставаться установленным.

> **Исправление.** Оригинальная таблица зависимостей не упоминает C-компилятор, FreeType и expat. Без них сборка завершится ошибкой линковки или `pkg-config`.

### Обновление

Библиотека копируется внутрь команды `amane` при её сборке. Чтобы получить новую версию, обновите саму команду:

- NixOS: `nix profile upgrade amane` или обновите flake-вход и пересоберите систему.
- Другие дистрибутивы: `git pull` в клоне, затем снова `cargo install --path cli`.

Следующий `amane compile` или `amane dev` пересоберёт оболочку с новой библиотекой.
