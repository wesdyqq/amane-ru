# IPC

IPC позволяет другим программам общаться с вашей работающей оболочкой. Главное применение — горячие клавиши: композитор вызывает `amane ipc call toggle-launcher`, и оболочка открывает лаунчер.

### Переключение окна из командной строки

```rust
use std::time::Duration;

use amane::{App, LayerWindow, Parent, Rectangle, Service};

struct Launcher {
    open: bool,
}

impl Service for Launcher {
    fn new() -> Self {
        Self { open: false }
    }

    fn interval() -> Duration {
        Duration::from_secs(3600)
    }
}

fn main() {
    App::new().ipc("toggle-launcher", toggle).window(view).run();
}

fn view() -> LayerWindow {
    let launcher = Launcher::read();

    LayerWindow::new()
        .width(400.0)
        .height(300.0)
        .visible(launcher.open)
        .child(Rectangle::new().width(Parent).height(Parent).fill("#1e1e2e"))
}

fn toggle(_: &[String]) -> String {
    let mut launcher = Launcher::write();

    launcher.open = !launcher.open;

    if launcher.open {
        String::from("opened")
    } else {
        String::from("closed")
    }
}
```

Из терминала:

```sh
amane ipc call toggle-launcher
```

Команда напечатает `opened`, и лаунчер появится. Запустите ещё раз, чтобы закрыть.

### Как вызов доходит до оболочки

- `App::ipc(name, handler)` регистрирует обработчик под именем. Вызывайте один раз на имя. При повторной регистрации того же имени старый обработчик заменяется.
- Оболочка слушает сокет `$XDG_RUNTIME_DIR/amane.sock`. Если `XDG_RUNTIME_DIR` не задан, оболочка паникует с `failed to find socket: XDG_RUNTIME_DIR is not set`.
- `amane ipc call <name> [arguments...]` подключается к сокету, отправляет имя и аргументы и печатает ответ.
- Обработчик получает аргументы и возвращает `String`. То, что он вернул, печатает `amane ipc call`.
- Обработчик пишет в сервис, поэтому все окна, которые его читают, перерисовываются.

Обработчик выполняется в том же потоке, который рисует, поэтому держите его быстрым. Для медленной работы запустите поток или используйте `amane::spawn`.

> **Уточнение.** Регистрация обработчика принимает `fn(&[String]) -> String`. Замыкание без захвата подойдёт (Rust приведёт его к указателю на функцию), а замыкание, которое захватывает переменные, — нет. Состояние держите в сервисе.

### Передача аргументов

Всё после имени передаётся обработчику как список строк:

```rust
fn main() {
    App::new().ipc("say", say).window(view).run();
}

fn say(arguments: &[String]) -> String {
    let words = arguments.join(" ");

    Message::write().text = words.clone();

    format!("showing: {words}")
}
```

```sh
amane ipc call say hello world
```

Обработчик получит `["hello", "world"]`. Аргументы не могут содержать переводы строк: они передаются по одному на строку, и перевод строки превратится в границу аргумента.

Вызов имени без обработчика отвечает `no handler named <name>`.

### Привязка вызовов к клавишам

niri:

```kdl
binds {
    Mod+Space { spawn "amane" "ipc" "call" "toggle-launcher"; }
}
```

Hyprland:

```text
bind = SUPER, SPACE, exec, amane ipc call toggle-launcher
```

Sway:

```text
bindsym $mod+space exec amane ipc call toggle-launcher
```

### Одна оболочка за раз

Сокет один на сессию, поэтому одновременно слушать вызовы может только одно приложение Amane. Второй слушатель сразу останавливается с `failed to listen: amane is already running`. `amane run` проверяет заранее и сообщает об этом в терминале, а `amane restart` останавливает работающую оболочку перед запуском новой.

`amane dev` перезапускает собственную оболочку, не натыкаясь на это, но не может остановить оболочку, запущенную другим способом. Остановите повседневную оболочку (запущенную `amane run`) перед `amane dev`.

Для отдельного окна, которому IPC не нужен, используйте `App::new().without_ipc()`. Оно может работать рядом с оболочкой и не занимает её сокет. IPC включён по умолчанию; `without_ipc()` отключает слушателя, даже если обработчики зарегистрированы.

Если `amane ipc call` говорит `amane is not running`, в этой сессии оболочка не слушает IPC.
