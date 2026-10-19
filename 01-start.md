# Часть I. Начало работы

## Введение

Amane — библиотека на Rust для создания собственной оболочки рабочего стола Wayland: баров, панелей, лаунчеров, всплывающих уведомлений и экранов блокировки. Вся оболочка пишется как одна программа на Rust. Она подключается напрямую к композитору и рисует на GPU, без браузерного движка, QML и GTK.

Вот полностью готовый бар:

```rust
use amane::{App, Color, Full, Layer, LayerWindow, Parent, Rectangle, Text, Vertical};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    LayerWindow::new()
        .width(Full)
        .height(30.0)
        .anchor_vertical(Vertical::Top)
        .layer(Layer::Top)
        .child(
            Rectangle::new()
                .width(Parent)
                .height(Parent)
                .fill(Color::BLUE)
                .child(Text::new("Amane bar").size(20.0).color(Color::WHITE)),
        )
}
```

Это синяя полоса высотой 30 пикселей во всю ширину экрана с белым текстом.

### Что нужно

- Wayland-композитор с поддержкой **wlr-layer-shell**: niri, Hyprland, Sway, river и другие. GNOME эту возможность не поддерживает.
- GPU с работающим драйвером Vulkan.
- Немного Rust. Глубоко знать язык не обязательно: достаточно понимать функцию, структуру и замыкание вида `|x| ...`. Там, где Amane использует что-то менее очевидное, это объясняется по ходу текста.

> **Уточнение.** Для сборки нужен не только Rust, но и C-компилятор, `pkg-config`, заголовки FreeType и expat. Подробности — в разделе «Установка».

### Как устроена книга

- **Начало работы** — установка и первый бар.
- **Основные понятия** — представления, окна, компоновка, состояние, ввод и анимация. Эти главы лучше читать по порядку.
- **Виджеты** — подробно о каждом строительном блоке.
- **Дополнительные окна** — несколько мониторов, обычные окна и экран блокировки.
- **Встроенные сервисы** — системные данные, которые Amane читает сам: батарея, звук, сеть, медиаплееры, уведомления и другое.
- **Связь с системой** — запуск команд, наблюдение за файлами, IPC и D-Bus.

Каждый пример начинается со строки `use`, чтобы было видно, откуда взято имя. Если не сказано иное, все имена импортируются из `amane`.

Если интересует внутреннее устройство библиотеки, в репозитории есть `ARCHITECTURE.md`.

---

## Шпаргалка

Все основные builder-методы и функции на одной странице. Имена взяты из `amane`; чтобы подключить всё сразу:

```rust
use amane::*;
```

### `App`

| Код | Что делает |
|---|---|
| `App::new()` | начинает сборку оболочки |
| `.window(view)` | добавляет слойное окно; `fn() -> LayerWindow` |
| `.window_per_monitor(view)` | добавляет слойное окно на каждый монитор; `fn(&Monitor) -> LayerWindow` |
| `.normal_window("name", view)` | добавляет обычное окно приложения; `fn() -> Window` |
| `.lock(view)` | задаёт экран блокировки; `fn(&Monitor) -> LayerWindow` |
| `.ipc("name", handler)` | обрабатывает `amane ipc call name`; `fn(&[String]) -> String` |
| `.without_ipc()` | запускает без IPC-сокета, рядом с другой Amane-оболочкой |
| `.font("Inter")` | задаёт семейство шрифта по умолчанию |
| `.scale_factor(1.4)` | масштабирует все окна и виджеты; по умолчанию `1.0` |
| `.run()` | запускает цикл событий |

> **Уточнение.** `.window`, `.window_per_monitor`, `.normal_window`, `.lock` и `.ipc` принимают указатели на функции (`fn`), а не замыкания с захватом. Если нужно состояние, храните его в сервисе.

### `LayerWindow`

| Код | Что делает |
|---|---|
| `LayerWindow::new().width(w).height(h)` | обязательны и должны идти первыми. Число пикселей или `Full`. |
| `.anchor_vertical(Vertical::Top)` | `Top`, `Middle` (по умолчанию), `Bottom` |
| `.anchor_horizontal(Horizontal::Left)` | `Left`, `Middle` (по умолчанию), `Right` |
| `.margin(Margin { top, right, bottom, left })` | отступ от закреплённых краёв в пикселях (`i32`) |
| `.layer(Layer::Top)` | `Background`, `Bottom`, `Top`, `Overlay` (по умолчанию) |
| `.space(Zone::Reserve)` | `Reserve`, `Respect` (по умолчанию), `Ignore` |
| `.keyboard(Keyboard::OnDemand)` | `None` (по умолчанию), `OnDemand`, `Exclusive` |
| `.on_key(handler)` | обработка клавиш; `Fn(Key)` |
| `.visible(bool)` | скрывает или показывает окно, не останавливая его |
| `.input_region(vec![InputArea { x, y, width, height }])` | только эти области принимают мышь |
| `.click_through()` | ни одна часть окна не принимает мышь |
| `.namespace("bar")` | имя для правил композитора; читается один раз при открытии |
| `.child(widget)` | содержимое окна |

### `Window`

| Код | Что делает |
|---|---|
| `Window::new()` | обычное окно приложения |
| `.title("Settings")` | заголовок; по умолчанию `"amane"` |
| `.size(480.0, 320.0)` | размер при открытии; по умолчанию 640 × 480 |
| `.resizable(true)` | разрешает менять размер; **по умолчанию `true`** |
| `.on_key(handler)` | обработка клавиш; `Fn(Key)` |
| `.child(widget)` | содержимое окна |
| `open_window("name", view)` | открывает обычное окно позже; ничего не делает, если имя уже открыто |
| `close_window("name")` | закрывает окно |
| `window_size()` | реальный размер текущего окна, `(f32, f32)` |

> **Исправление.** В оригинале шпаргалки и главе об окнах сказано, что `resizable` по умолчанию `false`. В `src/window.rs` значение по умолчанию — `true`.

### Размеры

| Код | Значение |
|---|---|
| `100.0` | ровно 100 пикселей |
| `Parent` | столько, сколько даёт родитель; несколько `Parent`-детей делят свободное место поровну |
| `Full` | целая сторона монитора; только для размеров `LayerWindow` и `.radius(Full)` |

### `Row`, `Column`, `Stack`

| Код | Что делает |
|---|---|
| `Row::new(children![a, b])` | рядом по горизонтали |
| `Column::new(children![a, b])` | сверху вниз |
| `Stack::new(children![a, b])` | друг на друге; поздние рисуются поверх ранних |
| `.width(size)`, `.height(size)` | необязательны; по умолчанию вычисляются по детям |
| `.gap(12.0)` | промежуток между детьми (`Row`, `Column`) |
| `.justify(SpaceBetween)` | вдоль строки: `Start`, `Center`, `End`, `SpaceBetween`, `SpaceAround`, `SpaceEvenly` |
| `.align(Center)` | поперёк строки: `Start`, `Center`, `End` |
| `children![...]` | упаковывает список разнотипных виджетов |
| `Vec<Box<dyn Widget>>` | список, собранный в цикле через `Box::new(widget)` |

### `Rectangle`

| Код | Что делает |
|---|---|
| `Rectangle::new().width(w).height(h)` | обязательны и идут первыми. Число или `Parent`. |
| `.fill("#1e1e2e")` | hex-цвет: `#rgb`, `#rrggbb`, `#rrggbbaa` |
| `.fill(Color::rgb(30, 30, 46))` | цвет; также `Color::rgba`, `Color::BLACK`, `WHITE`, `RED`, `GREEN`, `BLUE`, `TRANSPARENT` |
| `.fill(Gradient::linear(90.0, [(0.0, "#a"), (1.0, "#b")]))` | линейный градиент; угол как в CSS |
| `.fill(Gradient::radial([(0.0, "#a"), (1.0, "#b")]))` | радиальный градиент |
| `.fill(Image::cover(path))` | изображение; также `contain` и `stretch` |
| `.fill(Mask)` | вырезает отверстие в прямоугольнике вокруг себя |
| `.radius(12.0)` | скругление углов |
| `.radius(Full)` | таблетка или круг |
| `.radius_top_left(Full)` | один угол; также `radius_top_right`, `radius_bottom_right`, `radius_bottom_left` |
| `.border(2.0, "#cdd6f4")` | обводка по внутреннему краю |
| `.opacity(0.5)` | прозрачность прямоугольника и его ребёнка |
| `.shadow(Shadow::drop("#000").blur(12.0).offset(0.0, 4.0).opacity(0.3))` | внешняя тень |
| `.shadow(Shadow::inner("#000").blur(8.0))` | внутренняя тень |
| `.blur(20.0)` | размывает то, что окно нарисовало под прямоугольником |
| `.padding(8.0)` | внутренний отступ; или `Padding { top, right, bottom, left }` |
| `.align_child(Center, Center)` | размещение ребёнка: горизонталь, затем вертикаль |
| `.clip()` | обрезает ребёнка по краям и скруглениям |
| `.child(widget)` | один ребёнок |
| `.rotate(30.0)` | градусы, по часовой стрелке, вокруг центра |
| `.scale(0.5)` | вокруг центра |
| `.translate(20.0, -10.0)` | сдвиг без изменения компоновки |
| `.shader(path)` | WGSL- или GLSL-шейдер поверх заливки |
| `.shader_values(vec![[a, b, c, d]])` | до 16 строк чисел для шейдера |
| `.on_drop(\|files\| ...)` | файлы, перетащенные из другой программы |

### Ввод

Всё это методы `Rectangle`:

| Код | Аргумент обработчика |
|---|---|
| `.on_click(\|button\| ...)` | `Button::Left`, `Right`, `Middle` |
| `.on_hover(\|inside\| ...)` | `true` при входе, `false` при выходе |
| `.on_scroll(\|scroll\| ...)` | `Scroll { x, y }` в строках; положительный `y` — вниз |
| `.on_move(\|point\| ...)` | `Point { x, y }` от левого верхнего угла |
| `.on_drag(\|point\| ...)` | `Point` от нажатия левой кнопкой до отпускания |
| `.cursor(Pointer)` | `Default`, `Pointer`, `Text`, `Grab`, `Grabbing`, `Move`, `NotAllowed`, `Wait`, `Crosshair`, `Resize...` |

### `Text`

| Код | Что делает |
|---|---|
| `Text::new("hello")` | принимает `&str`, `String` или `format!(...)` |
| `.size(20.0)` | по умолчанию 16 |
| `.color(Color::WHITE)` | принимает `Color`; hex оборачивайте в `Color::from("#...")` |
| `.font("JetBrains Mono")` | семейство шрифта |
| `.weight(Weight::Bold)` | или число, например `300` |
| `.elide()` | одна строка с обрезкой и `…` |
| `.wrap()` | столько строк, сколько нужно |
| `.max_lines(2)` | вместе с `wrap` |
| `.tight()` | измеряет контуры букв; для иконочных шрифтов |
| `.height_in(width)` | высота перенесённого текста при данной ширине |

### `TextInput`

| Код | Что делает |
|---|---|
| `TextInput::new("id")` | имя, под которым хранится текст |
| `.placeholder("search")` | показывается, пока поле пустое |
| `.password()` | показывает `•` вместо символов |
| `.focused()` | берёт клавиатуру без клика; **каждый кадр** |
| `.on_change(\|text\| ...)` | после каждого изменения текста |
| `.on_submit(\|text\| ...)` | по Enter |
| `.size(18.0)`, `.color(c)`, `.width(w)` | вид и размер |
| `TextInput::set_text("id", "...")` | заменяет текст, курсор в конец |

> **Исправление.** Парольное поле с `.on_submit(...)` автоматически очищается после Enter. Обработчик получает настоящий текст. Если `on_submit` не задан, Enter ничего не делает.

### `ScrollArea`

| Код | Что делает |
|---|---|
| `ScrollArea::new("id", child)` | прокручивает ребёнка по вертикали; имя сохраняет позицию |
| `.width(size)`, `.height(size)` | по умолчанию `Parent` |

### `Canvas` и фигуры

Для методов `.fill`, `.stroke`, `.cap`, `.opacity` нужен трейт `Shape` в `use`.

| Код | Что делает |
|---|---|
| `Canvas::new().width(w).height(h).shapes(shapes![...])` | рисует фигуры в собственных координатах |
| `Circle::new().center(x, y).radius(r)` | по умолчанию центр холста и максимальный радиус |
| `Arc::new().center(x, y).radius(r).start(deg).sweep(deg)` | 0 — вверх, по часовой стрелке |
| `Line::new().from(x, y).to(x, y)` | прямая |
| `Path::new().move_to(x, y).line_to(x, y)` | также `quad_to`, `cubic_to`, `arc`, `close` |
| `.fill(color)` | заливает внутренность |
| `.stroke(4.0, color)` | рисует контур |
| `.cap(Cap::Round)` | `Butt` (по умолчанию), `Round`, `Square` |
| `.opacity(0.5)` | прозрачность фигуры |

### `Image`

| Код | Что делает |
|---|---|
| `Image::cover(path)` | заполняет, обрезая края |
| `Image::contain(path)` | показывает целиком |
| `Image::stretch(path)` | растягивает на весь прямоугольник |
| `.thumbnail(w, h)` | хранит уменьшенную копию |
| `.blurred(radius)` | размывает один раз при загрузке |
| `Image::loaded(path)` | `true`, когда готов вариант полного размера |

> **Уточнение.** `Image::loaded` не проверяет вариант, созданный через `.thumbnail(...)` или `.blurred(...)`. Подробнее — в главе об изображениях.

### `Animation`

| Код | Что делает |
|---|---|
| `Animation::new(0.0)` | анимированный `f32`; `Animation<Color>` для цветов |
| `.duration(Duration::from_millis(400))` | по умолчанию 200 мс |
| `.easing(Easing::InOut)` | `Out` (по умолчанию), `InOut`, `Linear` |
| `animation.to(target)` | начинает движение из текущего положения |
| `animation.value()` | текущее значение; пока движение идёт, кадры запрашиваются сами |
| `amane::request_frame()` | просит ещё один кадр |

### Сервисы

| Код | Что делает |
|---|---|
| `impl Service for T { fn new() -> Self { ... } }` | единственная обязательная функция |
| `fn interval() -> Duration` | как часто вызывать `update`; по умолчанию 1 секунда |
| `fn update(&mut self) -> bool` | опрос; верните `true`, если что-то изменилось |
| `fn listen()` | заменяет опрос собственным циклом |
| `T::read()` | читает; в представлении подписывает окно на изменения |
| `T::write()` | изменяет и перерисовывает все окна, которые читают сервис; **никогда не вызывайте во время отрисовки** |

### Встроенные сервисы

| Сервис | Читает | Управляет |
|---|---|---|
| `Battery` | `present`, `percent`, `charging`, `full` | |
| `Cpu` | `percent` | |
| `Memory` | `percent`, `used_kib`, `total_kib` | |
| `Brightness` | `present`, `percent` | `set` |
| `Audio` | `volume`, `muted`, `microphone_volume`, `microphone_muted` | `set_volume`, `toggle_mute`, `set_microphone_volume`, `toggle_microphone_mute` |
| `Network` | `connected`, `link`, `ssid`, `strength`, `wifi_enabled`, `connecting`, `access_points` | `scan`, `connect`, `disconnect`, `set_wifi` |
| `Bluetooth` | `available`, `powered`, `scanning`, `devices` | `set_powered`, `start_scan`, `stop_scan`, `pair`, `connect`, `disconnect`, `forget` |
| `Media` | `players`, `active`, `title`, `artist`, `art_url`, `playing`, `position`, `length` | `play_pause`, `next`, `previous` |
| `Notifications` | `list`, `running` | `click`, `invoke`, `dismiss`, `clear` |
| `Workspaces` | `list` | `focus` |
| `Apps` | `list` | `launch` у каждого `DesktopApp` |
| `Palette` | `colors`, `dominant`, `accent`, `background`, `foreground`, `on_accent`, `light` | `open` |
| `Pam` | `active`, `messages`, `prompt`, `result` | `start`, `respond`, `abort` |
| `Lock` | `checking`, `failed` | `start`, `unlock`, `authenticate`, `abort` |

### Команды, файлы, IPC, D-Bus

| Код | Что делает |
|---|---|
| `amane::spawn("cmd")` | запускает команду, не ждёт |
| `amane::output("cmd")` | запускает и возвращает stdout; ждёт завершения |
| `amane::lines("cmd")` | выдаёт строки долгоживущей команды |
| `amane::watch_file(path)` | выдаёт элемент при изменении файла |
| `Bus::system()`, `Bus::session()` | соединение с шиной D-Bus |
| `bus.property(dest, path, iface, name)` | читает свойство |
| `bus.call(dest, path, iface, method, &arguments![...])` | вызывает метод |
| `bus.signals(iface, name)` | поток подходящих сигналов |

### Командная строка

| Команда | Что делает |
|---|---|
| `amane new [folder]` | создаёт стартовую оболочку; без папки спрашивает (или берёт `AMANE_CONFIG`) |
| `amane target [folder]` | показывает или задаёт папку оболочки |
| `amane dev` | пересобирает и перезапускает при каждом сохранении |
| `amane compile` | собирает оболочку для `amane run` |
| `amane compile --restart` | собирает и перезапускает запущенную оболочку |
| `amane run` | запускает собранную оболочку в фоне, никогда не собирает |
| `amane restart` | останавливает запущенную оболочку и запускает собранную |
| `amane clean` | удаляет каталог сборки, сохраняя скомпилированную оболочку; спрашивает |
| `amane clean --yes` | то же без вопроса |
| `amane ipc call <name> [args...]` | вызывает IPC-обработчик |
| `AMANE_FRAMES=1` | печатает строку на кадр для поиска медленной или бесконечной перерисовки |

---

## Установка

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

---

## Первая оболочка

Эта глава ставит бар на экран, а затем меняет его на лету.

### 1. Создайте конфигурацию

```sh
amane new
```

Команда спросит, куда положить оболочку. Нажмите Enter, чтобы использовать `~/.config/amane` (или `$XDG_CONFIG_HOME/amane`). В этой главе предполагается путь по умолчанию. Будет создан `src/main.rs` с небольшим баром. Если файл уже существует, `new` остановится и ничего не перезапишет.

> **Уточнение.** Если задана переменная `AMANE_CONFIG`, вопрос не задаётся: оболочка создаётся по указанному в ней пути. Сохранённый `amane target` на выбор папки для `amane new` без аргументов не влияет.

### 2. Запустите режим разработки

```sh
amane dev
```

Первая сборка занимает несколько минут: компилируются Amane и все зависимости. После этого бар появится вверху экрана.

Оставьте `amane dev` запущенным. При каждом сохранении `main.rs` оболочка пересобирается и перезапускается. Если сборка не удалась, старый бар остаётся на экране, пока вы исправляете ошибку.

Одновременно может работать только одна Amane-оболочка. Если оболочка уже запущена через `amane run`, остановите её перед `amane dev`.

### 3. Прочитайте файл

Откройте `~/.config/amane/src/main.rs`:

```rust
use amane::{App, Color, Full, Layer, LayerWindow, Parent, Rectangle, Text, Vertical};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    LayerWindow::new()
        .width(Full)
        .height(30.0)
        .anchor_vertical(Vertical::Top)
        .layer(Layer::Top)
        .child(
            Rectangle::new()
                .width(Parent)
                .height(Parent)
                .fill(Color::BLUE)
                .child(Text::new("hello from amane").size(20.0).color(Color::WHITE)),
        )
}
```

Сверху вниз:

- `use amane::{...}` подключает все имена, которые использует файл.
- `main` создаёт `App`, передаёт ему одно окно и запускает. `run()` не возвращается, пока оболочка открыта.
- `.window(view)` передаёт саму функцию `view`, не вызывая её. Amane вызывает её всякий раз, когда окно нужно перерисовать.
- `view` описывает окно:
  - `.width(Full)` — во всю ширину монитора;
  - `.height(30.0)` — высота 30 пикселей;
  - `.anchor_vertical(Vertical::Top)` — прикрепить к верхнему краю;
  - `.layer(Layer::Top)` — выше обычных окон.
- Внутри окна — `Rectangle`, который заполняет его (`Parent` означает «столько, сколько даёт родитель») и закрашен синим.
- Внутри прямоугольника — `Text`.

### 4. Измените бар

Не останавливая `amane dev`, поменяйте цвет и текст:

```rust
use amane::{App, Color, Full, Layer, LayerWindow, Parent, Rectangle, Text, Vertical};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    LayerWindow::new()
        .width(Full)
        .height(30.0)
        .anchor_vertical(Vertical::Top)
        .layer(Layer::Top)
        .child(
            Rectangle::new()
                .width(Parent)
                .height(Parent)
                .fill("#1e1e2e")
                .child(Text::new("my shell").size(16.0).color(Color::from("#cdd6f4"))),
        )
}
```

Сохраните файл — бар перезапустится с новым видом.

`.fill` принимает hex-строку напрямую. `.color` у `Text` принимает `Color`, поэтому hex нужно обернуть в `Color::from`.

### 5. Запустите по-настоящему

`amane dev` останавливает оболочку, когда вы завершаете команду. Когда результат устраивает, соберите её один раз:

```sh
amane compile
```

Затем запустите:

```sh
amane run
```

`amane run` запускает оболочку в фоне, поэтому терминал можно закрыть. Команда никогда не собирает: она запускает только то, что сохранил `amane compile`. После правок используйте `amane compile --restart`, чтобы собрать и сразу подменить работающую оболочку.

Чтобы оболочка запускалась при входе, вызовите `amane run` из конфигурации автозапуска композитора. Для niri:

```kdl
spawn-at-startup "amane" "run"
```

---

## Команда `amane`

| Команда | Что делает |
|---|---|
| `amane new` | Спрашивает, куда положить оболочку (Enter — `~/.config/amane`), затем создаёт там `src/main.rs` из шаблона и `Cargo.toml` для редактора. Никогда не перезаписывает существующий файл оболочки. |
| `amane new <folder>` | То же в указанной папке, без вопроса. Amane запоминает папку, как `amane target`. |
| `amane new [folder] --example` | Создаёт полноценный пример бара из нескольких файлов, с кнопками рабочих столов для каждого монитора. Никогда не перезаписывает существующие файлы. |
| `amane target <folder>` | Указывает Amane на существующую оболочку, например после переноса или клонирования dotfiles. В папке должен быть `src/main.rs`. |
| `amane target` | Печатает папку, из которой Amane собирает оболочку. |
| `amane dev` | Собирает оболочку, запускает её и пересобирает с перезапуском при каждом сохранении. |
| `amane compile` | Собирает оболочку и сохраняет её как `~/.cache/amane/amane-shell`, не запуская. |
| `amane compile --restart` | То же, затем перезапускает работающую оболочку новой сборкой, как `amane restart`. Если сборка не удалась, ничего не перезапускает. |
| `amane run` | Запускает сохранённую `amane compile` оболочку в фоне и возвращает терминал, поэтому закрытие терминала её не остановит. Никогда не собирает. Завершается с ошибкой, если оболочка уже запущена. |
| `amane restart` | Останавливает оболочку, запущенную `amane run`, и запускает сохранённую `amane compile`. Если ничего не было запущено, всё равно запускает. Оболочку из `amane dev` не трогает. |
| `amane clean` | Удаляет результаты сборки в `~/.cache/amane/project/`. Скомпилированную оболочку оставляет, поэтому `amane run` продолжает работать. Спрашивает подтверждение. |
| `amane clean --yes` | То же без вопроса. |
| `amane ipc call <name> [arguments...]` | Вызывает обработчик в работающей оболочке. |

> **Уточнение.** `amane startup [--example]` — устаревший псевдоним `amane new`. Он пока работает, печатает предупреждение и не принимает папку аргументом. В книге эта команда не упоминалась.

### Где что лежит

- **Ваша оболочка:** `~/.config/amane/src/` или папка, указанная в `amane new` / `amane target`. Точка входа — `main.rs`. Рядом можно добавлять другие файлы и подключать их через `mod`, как в обычной программе на Rust.
- **Какая папка используется:** `amane target` печатает путь. Папка, отличная от стандартной, сохраняется в `~/.local/state/amane/config-path` — отдельно для каждой машины, чтобы не попадать в dotfiles. На новой машине выполните `amane target` заново.
- **Поддержка редактора:** `Cargo.toml` рядом с `src/`. `amane new` создаёт его, а каждая сборка обновляет, чтобы rust-analyzer находил Amane и подсказывал типы. Не редактируйте этот файл: в нём пути только для текущей машины. Если храните оболочку в git, добавьте в `.gitignore` `Cargo.toml`, `Cargo.lock` и `target/`.
- **Файлы сборки:** `~/.cache/amane/`.
  - `library/` — распакованная копия Amane из команды;
  - `project/` — сгенерированный Cargo-проект вокруг вашего `main.rs`;
  - `project/target/` — результаты сборки;
  - `amane-shell` — сохранённая `amane compile` оболочка, которую запускает `amane run`.

Пути следуют переменным `XDG_CONFIG_HOME`, `XDG_STATE_HOME` и `XDG_CACHE_HOME`, если они заданы.

Ничего в кэше редактировать не нужно. Удалять его безопасно: следующая сборка создаст всё заново.

`project/` — самый большой каталог, часто около 1 ГБ. Он нужен только для быстрых пересборок, оболочка его не читает. `amane clean` удаляет его и спрашивает подтверждение, потому что следующая сборка займёт несколько минут. Собрать и сразу почистить без вопроса:

```sh
amane compile && amane clean --yes
```

> **Уточнение.** `amane clean` удаляет только `project/`, а не `library/` и не `amane-shell`. Поэтому `amane run` после очистки продолжает работать.

### Разделение оболочки на файлы

`main.rs` может подключать другие файлы обычным для Rust способом:

```text
~/.config/amane/src/
├── main.rs
├── bar.rs
└── clock.rs
```

```rust
// main.rs
mod bar;
mod clock;

use amane::App;

fn main() {
    App::new().window(bar::view).run();
}
```

`amane dev` следит за всей папкой `src/`, поэтому сохранение любого из этих файлов запускает пересборку.

### Как собирается оболочка

`amane dev` и `amane compile` используют одну и ту же сборку, поэтому результаты хранятся на диске один раз.

| Что | Оптимизация |
|---|---|
| Ваш код | нет, чтобы сохранение пересобиралось за секунды |
| Amane и зависимости | да |

Amane всегда оптимизирован: неоптимизированная отрисовка слишком медленная для плавной анимации. Ваш код только описывает оболочку, а тяжёлую работу делает библиотека, поэтому неоптимизированный пользовательский код не замедляет готовую оболочку.

> **Уточнение.** В справке CLI результат `amane compile` назван «optimised shell», но фактически используется `cargo build` без `--release`. Ваш код собирается в debug-профиле; оптимизированы только зависимости.

### Зависимости

`Cargo.toml` вашей оболочки генерируется при каждой сборке и зависит только от `amane`. Добавить другие crates в оболочку пока нельзя.

Большая часть нужного уже есть в библиотеке:

- системные данные через встроенные сервисы;
- запуск команд и чтение вывода;
- наблюдение за файлами, D-Bus и IPC.

Для всего остального, например текущего времени, запускайте команду через `amane::output` (`date +%H:%M`).

---

## Дальше

Глава [«Представления»](02-core.md#представления) объясняет, чем на самом деле является `view` и почему это функция. Её стоит прочитать до того, как писать что-то большее.
