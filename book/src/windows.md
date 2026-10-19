# Несколько окон и мониторов

Оболочка редко состоит из одного окна. В этой главе: несколько слойных окон, окно на каждом мониторе, обычные окна приложений, а также открытие и закрытие окон во время работы.

### Несколько окон

Вызовите `.window` для каждого окна:

```rust
use amane::{App, Full, Horizontal, LayerWindow, Parent, Rectangle, Vertical};

fn main() {
    App::new().window(bar).window(corner).run();
}

fn bar() -> LayerWindow {
    LayerWindow::new()
        .width(Full)
        .height(30.0)
        .anchor_vertical(Vertical::Top)
        .child(Rectangle::new().width(Parent).height(Parent).fill("#1e1e2e"))
}

fn corner() -> LayerWindow {
    LayerWindow::new()
        .width(200.0)
        .height(60.0)
        .anchor_vertical(Vertical::Bottom)
        .anchor_horizontal(Horizontal::Right)
        .child(Rectangle::new().width(Parent).height(Parent).fill("#313244"))
}
```

У каждого окна своё представление, и каждое перерисовывается только из-за сервисов, которые читает именно его представление. Окна, добавленные через `.window`, композитор размещает на том мониторе, который выберет, обычно на мониторе с фокусом.

### Окно на каждом мониторе

Бар должен быть на каждом мониторе, включая подключённые позже:

```rust
use amane::{App, Color, Full, Layer, LayerWindow, Monitor, Parent, Rectangle, Text, Vertical};

fn main() {
    App::new().window_per_monitor(bar).run();
}

fn bar(monitor: &Monitor) -> LayerWindow {
    let label = format!("{} {}x{}", monitor.name, monitor.width, monitor.height);

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
                .child(Text::new(label).color(Color::WHITE)),
        )
}
```

Представление получает `&Monitor` с полями `name` (например, `"DP-1"`), `width` и `height`. Размеры используют те же единицы, что и виджеты, с учётом масштаба композитора и коэффициента приложения. Amane открывает по окну на каждый монитор при старте, открывает новое при подключении монитора и закрывает при отключении.

Монитор можно использовать, чтобы показывать разное на разных экранах:

```rust
if monitor.name == "eDP-1" {
    // экран ноутбука
}
```

> **Уточнение.** `width` и `height` округлены до целых единиц виджетов. Если нужно точное совпадение с краями монитора, используйте `Full`, а не вычисленный размер.

### Обычные окна

Обычное окно — это обычное окно приложения с заголовком, которое композитор размещает и тайлит, как любое другое. Используйте его для панели настроек или чего-то, что пользователь должен двигать:

```rust
use amane::{App, Center, Color, Parent, Rectangle, Text, Window};

fn main() {
    App::new().normal_window("settings", settings).run();
}

fn settings() -> Window {
    Window::new()
        .title("amane settings")
        .size(480.0, 320.0)
        .resizable(true)
        .child(
            Rectangle::new()
                .width(Parent)
                .height(Parent)
                .fill("#313244")
                .align_child(Center, Center)
                .child(Text::new("settings go here").color(Color::WHITE)),
        )
}
```

- `title` по умолчанию `"amane"`.
- `size` — размер при открытии, по умолчанию 640 на 480. Композитор может дать другой размер, и тайловый композитор обычно так и делает.
- `resizable` разрешает пользователю менять размер. **По умолчанию `true`.**
- `on_key` работает так же, как у слойного окна. Обычное окно получает фокус клавиатуры как любое приложение, поэтому `Keyboard` ему не нужен.

> **Исправление.** В оригинале сказано, что `resizable` по умолчанию `false`. В `src/window.rs` значение по умолчанию — `true`.

Имя, здесь `"settings"`, отличает окна друг от друга. Оно используется, чтобы закрыть окно позже.

> **Уточнение.** `title`, `size` и `resizable` читаются один раз при открытии окна. Если представление вернёт другие значения позже, они не применятся к уже открытому окну. Чтобы изменить размер, пользователь должен сделать это сам или окно нужно закрыть и открыть заново.

### Открытие и закрытие окон позже

Окна, переданные в `App`, открываются при старте оболочки. Чтобы открыть окно позже, например по кнопке, вызовите `open_window` с именем и представлением:

```rust
use amane::{App, Full, LayerWindow, Parent, Pointer, Rectangle, Window, close_window, open_window};

fn main() {
    App::new().window(bar).run();
}

fn bar() -> LayerWindow {
    LayerWindow::new().width(Full).height(30.0).child(
        Rectangle::new()
            .width(Parent)
            .height(Parent)
            .fill("#1e1e2e")
            .cursor(Pointer)
            .on_click(|_| open_window("settings", settings)),
    )
}

fn settings() -> Window {
    Window::new().title("settings").child(
        Rectangle::new()
            .width(120.0)
            .height(40.0)
            .fill("#f38ba8")
            .on_click(|_| close_window("settings")),
    )
}
```

- `open_window(name, view)` открывает обычное окно. Если окно с таким именем уже открыто, ничего не делает, поэтому двойной клик не создаст два окна.
- `close_window(name)` закрывает окно. Закрытие неоткрытого окна ничего не делает.
- Пользователь также может закрыть обычное окно через заголовок или горячей клавишей композитора.

Обе функции работают откуда угодно: из обработчиков ввода, IPC-обработчиков или потока сервиса.

`open_window` открывает только обычные окна. Чтобы показать или скрыть слойное окно, например всплывающее или лаунчер, держите его открытым и используйте `.visible(...)`.

> **Уточнение.** `open_window` и `close_window` принимают `fn`-указатели. Замыкания с захватом переменных сюда не подходят.

### Реальный размер окна

Композитор может дать окну не тот размер, который оно просило. Внутри представления `window_size()` возвращает реальный размер окна в единицах виджетов, до коэффициента приложения:

```rust
let (width, height) = window_size();
```

До того как композитор сообщит размер, возвращается `(0.0, 0.0)`; это может произойти в самом первом кадре. У скрытого слойного окна размер тоже `(0.0, 0.0)`.
