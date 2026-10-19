# Первая оболочка

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
