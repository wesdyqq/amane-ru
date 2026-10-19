# Часть VI. Связь с системой

## Команды и файлы

Эта глава про запуск других программ и наблюдение за файлами: клей для всего, что Amane не читает сам.

| Функция | Что делает | Ждёт? |
|---|---|---|
| `amane::spawn(command)` | запускает команду и идёт дальше | нет |
| `amane::output(command)` | выполняет команду и возвращает то, что она напечатала | да, до завершения |
| `amane::lines(command)` | запускает долгоживущую команду и выдаёт каждую её строку | да, для каждой строки |
| `amane::watch_file(path)` | выдаёт элемент при каждом изменении файла | да, для каждого изменения |

Все команды выполняются через `sh -c`, поэтому конвейеры, глоб-маски, `~` и `&&` работают как в терминале.

### Запуск программ

```rust
.on_click(|_| amane::spawn("firefox"));
.on_click(|_| amane::spawn("niri msg action focus-workspace-down"));
.on_click(|_| amane::spawn("notify-send amane 'the bar was clicked'"));
```

`spawn` возвращается сразу, поэтому безопасен в обработчиках ввода. Amane держит отдельный поток, который ждёт завершения процесса, чтобы он не остался зомби.

### Чтение вывода команды

`output` ждёт завершения команды, поэтому никогда не вызывайте его в представлении: это заморозит все окна. Вызывайте его в сервисе, в `new()` или `update()`, которые работают в собственном потоке сервиса:

```rust
use std::time::Duration;

use amane::{App, Full, LayerWindow, Service, Text};

struct Kernel {
    version: String,
}

impl Service for Kernel {
    fn new() -> Self {
        Self { version: amane::output("uname -r") }
    }

    // при работе оболочки больше не меняется
    fn interval() -> Duration {
        Duration::from_secs(3600)
    }
}

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    let kernel = Kernel::read();

    LayerWindow::new().width(Full).height(30.0).child(Text::new(&kernel.version))
}
```

`output` убирает завершающие переводы строк.

> **Исправление.** В книге сказано: «команда, которая завершилась ошибкой или ничего не напечатала, даёт пустую строку». На самом деле `output` (`src/process.rs`) забирает **только stdout**, убирает завершающие `\n` и игнорирует код возврата. Поэтому:
>
> - команда с ненулевым кодом, но непустым stdout вернёт этот stdout;
> - команда, печатающая только в stderr, вернёт `""`;
> - команда, печатающая пустоту, вернёт `""`;
> - паника `failed to run command` возможна, только если не удалось запустить сам `sh`, а не если команда внутри вернула ошибку.

> **Уточнение.** `trim_end_matches('\n')` убирает **все** завершающие переводы строк, а не один. Символы `\r` не удаляются.

### Слежение за выводом команды

Некоторые команды печатают строку при каждом событии: `niri msg event-stream`, `pactl subscribe`, `udevadm monitor`. `lines` выдаёт каждую строку по мере появления, в `listen` сервиса:

```rust
use amane::{App, Full, LayerWindow, Service, Text};

struct Events {
    last: String,
}

impl Service for Events {
    fn new() -> Self {
        Self { last: String::from("waiting") }
    }

    fn listen() {
        for line in amane::lines("niri msg event-stream") {
            Self::write().last = line;
        }
    }
}

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    let events = Events::read();

    LayerWindow::new().width(Full).height(30.0).child(Text::new(&events.last))
}
```

Цикл заканчивается, когда команда завершается. Если цикл прервётся раньше, например из-за паники в `listen`, команда будет убита: `Lines` убивает и дожидается процесса в `Drop`. Так ничего не остаётся висеть.

`lines` читает только stdout. stderr команды наследуется процессом: при запуске через `amane run` он уходит в `/dev/null`.

### Наблюдение за файлом

```rust
use std::fs;

use amane::{App, Full, LayerWindow, Service, Text};

const NOTE: &str = "/tmp/amane-note";

struct Note {
    text: String,
}

impl Service for Note {
    fn new() -> Self {
        Self { text: read_note() }
    }

    fn listen() {
        for _ in amane::watch_file(NOTE) {
            Self::write().text = read_note();
        }
    }
}

fn read_note() -> String {
    fs::read_to_string(NOTE).unwrap_or_default().trim_end().to_string()
}

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    let note = Note::read();

    LayerWindow::new().width(Full).height(30.0).child(Text::new(&note.text))
}
```

`std::fs` — из стандартной библиотеки Rust.

Попробуйте `echo hello > /tmp/amane-note` во время работы бара.

`watch_file` выдаёт элемент при каждой записи, создании или замене файла. Редакторы обычно сохраняют так: пишут новый файл и переименовывают его поверх старого, что завершило бы наблюдение за самим файлом. Поэтому Amane следит за папкой и выбирает изменения вашего файла.

Файл не обязан существовать в момент запуска наблюдения, но его папка — обязана.

> **Исправление.** Оригинал говорит, что `watch_file` даёт элемент «каждый раз, когда файл записан, создан или заменён». Это не весь список: маска наблюдения — `MODIFY | MOVED_TO | CREATE`, поэтому удаление (`DELETE`) и перемещение прочь (`MOVED_FROM`) события не дают. Если файл удалить, итератор просто перестанет получать события. Повторное создание файла с тем же именем снова даст `CREATE`.
>
> Папки с именем файла без родительского каталога (`/tmp/note`) нет в маске: `watch_file` следит именно за родительской папкой, поэтому она должна существовать, иначе будет паника `failed to watch file`.

Чтение файла — на вас, в цикле, как выше. Если файл удалён, `fs::read_to_string` вернёт ошибку, а `unwrap_or_default()` даст пустую строку.

---

## IPC

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

---

## D-Bus

D-Bus — способ, которым общаются большинство системных служб Linux: NetworkManager, UPower, BlueZ, logind, медиаплееры, серверы уведомлений. Встроенные сервисы Amane используют его, а вы можете применять ту же обёртку для всего, что они не покрывают.

### Две шины

```rust
let bus = Bus::system();    // общая для всех пользователей: NetworkManager, UPower, logind, BlueZ
let bus = Bus::session();   // ваши программы: медиаплееры, уведомления, трей
```

На всю оболочку приходится по одному соединению на шину, общему для всех потоков. Если шина недоступна, каждый вызов на ней отвечает «ничего» вместо ошибки. Шина пробуется только один раз, поэтому шина, запустившаяся после вашей оболочки, потребует перезапуска оболочки.

> **Уточнение.** Соединение создаётся лениво, при первом обращении к `Bus::system()` или `Bus::session()`, а не при запуске приложения. Результат кэшируется на всё время работы процесса. Если в момент первого обращения шина была недоступна, более поздние попытки не делаются.

### Чтение свойства

```rust
use std::time::Duration;

use amane::{App, Bus, Full, LayerWindow, Service, Text};

struct Wifi {
    enabled: bool,
}

impl Service for Wifi {
    fn new() -> Self {
        Self { enabled: read_enabled() }
    }

    fn interval() -> Duration {
        Duration::from_secs(5)
    }

    fn update(&mut self) -> bool {
        let enabled = read_enabled();

        let changed = enabled != self.enabled;

        self.enabled = enabled;

        changed
    }
}

fn read_enabled() -> bool {
    let bus = Bus::system();

    let enabled = bus.property(
        "org.freedesktop.NetworkManager",    // кого спрашивать
        "/org/freedesktop/NetworkManager",   // какой объект
        "org.freedesktop.NetworkManager",    // какой интерфейс
        "WirelessEnabled",                   // какое свойство
    );

    enabled.bool()
}

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    let wifi = Wifi::read();

    let label = if wifi.enabled { "wifi on" } else { "wifi off" };

    LayerWindow::new().width(Full).height(30.0).child(Text::new(label))
}
```

Чтобы найти имена, исследуйте шину инструментом `busctl`, `qdbusviewer` или D-Spy.

Вызовы D-Bus ждут ответа, поэтому делайте их в потоке сервиса, а не в представлении.

### Значения

Любой ответ — это `Value`:

| Вариант | Как читать |
|---|---|
| `Value::Bool` | `.bool()` |
| `Value::Number` | `.number()` как `f64`, независимо от числового типа D-Bus |
| `Value::Text` | `.text()` |
| `Value::List` | `.list()` |
| `Value::Map` | `.get("key")` |
| `Value::Nothing` | вызов не удался или ответа не было |

Каждый геттер даёт пустой результат для неподходящего типа: `false`, `0.0`, `""`, пустой список или `Value::Nothing`. Поэтому вызов к незапущенной программе даёт `Value::Nothing`, и чтение показывает пустоту вместо падения. Геттеры можно объединять в цепочку:

```rust
let title = metadata.get("xesam:title").text();
let first_artist = metadata.get("xesam:artist").list().first().map(|artist| artist.text());
```

### Вызов методов

```rust
let answer = bus.call(destination, path, interface, method, &arguments![...]);
```

`arguments!` превращает обычные значения Rust в аргументы D-Bus: `bool`, `i32`, `u32`, `i64`, `f64`, `&str`, `String` и `Vec<String>`. Для других типов D-Bus создайте `Argument` напрямую, например `Argument::Path(String::from("/org/..."))` для объектного пути или `Argument::Variant(...)`.

Поставьте Spotify на паузу через MPRIS:

```rust
let bus = Bus::session();

bus.call(
    "org.mpris.MediaPlayer2.spotify",
    "/org/mpris/MediaPlayer2",
    "org.mpris.MediaPlayer2.Player",
    "Pause",
    &[],
);
```

Большинство методов отвечают одним значением, и оно возвращается само. Метод, отвечающий несколькими значениями, даёт `Value::List`.

Чтобы задать свойство:

```rust
bus.set_property(destination, path, interface, "Powered", Argument::from(true));
```

> **Уточнение.** `set_property` ничего не возвращает: результат операции, включая ошибку, вы не увидите. Если нужно знать, применилось ли свойство, прочитайте его обратно или вызывайте метод интерфейса напрямую через `call`.

### Прослушивание сигналов

Программы объявляют изменения сигналами. `signals` ждёт каждый из них, поэтому вызывайте его в `listen` сервиса:

```rust
fn listen() {
    let bus = Bus::system();

    for signal in bus.signals("org.freedesktop.DBus.Properties", "PropertiesChanged") {
        if signal.path() != "/org/freedesktop/NetworkManager" {
            continue;
        }

        let enabled = read_enabled();

        Self::write().enabled = enabled;
    }
}
```

У каждого `Signal` есть `sender()`, `path()` и `arguments()`. `sender()` — уникальное имя отправителя, например `:1.42`, а не известное имя вроде `org.mpris.MediaPlayer2.mpv`.

> **Уточнение.** `signals(interface, name)` фильтрует только по интерфейсу и имени сигнала. Отправителя и путь нужно проверять вручную через `signal.sender()` и `signal.path()`, как в примере. Неверное имя интерфейса или сигнала паникует при создании подписки.

### Ответы на вызовы

Ваша оболочка может предоставить собственный интерфейс D-Bus, чтобы другие программы могли её вызывать:

```rust
use amane::{App, Bus, LayerWindow, Service, Text, arguments};

struct Server;

impl Service for Server {
    fn new() -> Self {
        Server
    }

    fn listen() {
        let bus = Bus::session();

        // сначала подписка, затем захват имени, чтобы не пропустить первые вызовы
        let methods = bus.methods("/org/example/Shell", "org.example.Shell");

        if !bus.own("org.example.Shell") {
            return;
        }

        for method in methods {
            if method.name() == "Ping" {
                method.reply(&arguments!["pong"]);
            }
        }
    }
}

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    // одно чтение сервиса запускает его поток
    let _server = Server::read();

    LayerWindow::new().width(200.0).height(30.0).child(Text::new("serving"))
}
```

Проверьте:

```sh
busctl --user call org.example.Shell /org/example/Shell org.example.Shell Ping
```

- `own(name)` занимает известное имя и возвращает `false`, если им уже владеет другая программа. Amane никогда не отбирает имя.
- `methods(path, interface)` ждёт каждый вызов к этому объекту и интерфейсу.
- `method.arguments()` даёт аргументы вызова, `method.reply(...)` отвечает на него.
- `bus.emit(path, interface, name, &arguments![...])` отправляет ваш собственный сигнал.

> **Уточнение.** `own` использует флаг `DoNotQueue`: имя не ставится в очередь. Если другая программа освободит его позже, Amane не получит его автоматически — потребуется перезапуск оболочки. `own` возвращает `true` и при `AlreadyOwner`, то есть повторный вызов безопасен.

> **Уточнение.** `methods` фильтрует по точному пути и интерфейсу; метод с другим путём или интерфейсом не придёт. Если вызывающий уходит до ответа, `reply` молча ничего не делает.

---

## Как работает команда `amane`

В главе «Начало работы» описаны команды. Здесь — то, что полезно знать при отладке.

### Пути

| Что | Путь |
|---|---|
| Конфигурация по умолчанию | `~/.config/amane` или `$XDG_CONFIG_HOME/amane` |
| Сохранённая цель | `~/.local/state/amane/config-path` или `$XDG_STATE_HOME/amane/config-path` |
| Кэш | `~/.cache/amane` или `$XDG_CACHE_HOME/amane` |
| Распакованная библиотека | `~/.cache/amane/library/` |
| Сгенерированный проект | `~/.cache/amane/project/` |
| Результаты сборки | `~/.cache/amane/project/target/` |
| Скомпилированная оболочка | `~/.cache/amane/amane-shell` |
| IPC-сокет | `$XDG_RUNTIME_DIR/amane.sock` |

`AMANE_CONFIG` переопределяет папку конфигурации для всех команд, не трогая сохранённую цель.

### Что именно делают команды

- **`amane compile`** запускает `cargo build` без `--release`. Оптимизированы только зависимости; пользовательский код собирается в debug-профиле. Готовый бинарник копируется рядом (`amane-shell.new`) и переименовывается поверх `amane-shell`, потому что запись поверх запущенного файла невозможна.
- **`amane dev`** следит за папкой `src/` опросом каждые 500 миллисекунд (снимок времени изменения всех файлов, рекурсивно). При сохранении пересобирает проект, убивает свой старый процесс и запускает новый. Если сборка не удалась, старый процесс остаётся работать.
- **`amane run`** запускает `~/.cache/amane/amane-shell` в отдельной группе процессов, перенаправляя stdin, stdout и stderr в `/dev/null`. Поэтому вывод оболочки и `AMANE_FRAMES` при `amane run` не виден. Запускайте `~/.cache/amane/amane-shell` напрямую, если нужна отладка.
- **`amane restart`** останавливает процесс только с точным полным путём `~/.cache/amane/amane-shell` (через `pkill -xf`), ждёт освобождения IPC-сокета до 3 секунд и запускает сохранённую оболочку. Оболочку из `amane dev` он не трогает.
- **`amane clean`** удаляет только `~/.cache/amane/project/`. `library/` и `amane-shell` остаются, поэтому `amane run` продолжает работать.

> **Исправление.** Справка CLI называет результат `amane compile` «optimised shell», но это не release-сборка. На поведение это не влияет, однако не стоит ожидать release-производительности от собственного кода оболочки.

---

## Поиск неисправностей

### Оболочка не запускается

| Сообщение | Причина | Что делать |
|---|---|---|
| `failed to bind wlr-layer-shell` | композитор не поддерживает слойные окна | используйте композитор с поддержкой: niri, Hyprland, Sway, river |
| `failed to listen: amane is already running` | в этой сессии уже работает другая оболочка Amane | остановите её, см. главу об IPC |
| `failed to run: no window set` | у `App` нет ни одного окна | добавьте хотя бы `.window`, `.window_per_monitor`, `.normal_window` или `.lock` |
| `failed to read shader` | неверный путь к шейдеру | используйте абсолютный путь, см. главу о шейдерах |
| `failed to find socket: XDG_RUNTIME_DIR is not set` | переменная не задана | запускайте из Wayland-сессии, где `XDG_RUNTIME_DIR` выставлен |
| `failed to start watching files` | не удалось создать inotify | проверьте лимиты inotify или права |

### Окно выглядит неправильно

| Проблема | Решение |
|---|---|
| Обычные окна перекрывают бар | добавьте бару `.space(Zone::Reserve)` |
| Бар перекрывает полноэкранное видео | добавьте `.layer(Layer::Top)`. По умолчанию `Overlay`, который выше всего. |
| Окно в середине экрана | добавьте `anchor_vertical` или `anchor_horizontal`. Оба по умолчанию `Middle`. |
| Цвет показывается ярко-розовым | hex-строка написана с ошибкой. Amane показывает розовый вместо падения. |
| Изображение не показывается | путь должен быть абсолютным, а формат — PNG, JPEG или SVG |
| Текст выходит за границы | добавьте `.elide()` или `.wrap()` |
| Методов вроде `.stroke` нет | добавьте `Shape` в строку `use` |

### Ввод не работает

| Проблема | Решение |
|---|---|
| Печать ничего не делает | дайте окну `.keyboard(Keyboard::OnDemand)` или `Keyboard::Exclusive` |
| `on_key` никогда не вызывается | то же самое. Клавиши приходят только окну с фокусом клавиатуры. |
| Клики проходят сквозь окно | проверьте `.click_through()` и `.input_region(...)`, не исключающие нужную часть |
| Клики не проходят через пустую часть окна | задайте `.input_region(...)` или скройте окно `.visible(false)`, пока оно пусто |

### Оболочка зависает

- **Представление вызывает `write()`.** Представление может ещё держать `read()` того же сервиса, и запись будет ждать вечно. В представлениях только читайте.
- **Представление чего-то ждёт.** `amane::output`, чтение файлов, вызовы D-Bus и `sleep` блокируют поток, который рисует все окна. Перенесите их в сервис.

### Оболочка потребляет много CPU

Запустите её с `AMANE_FRAMES=1`, чтобы печатать строку на каждый кадр:

```sh
AMANE_FRAMES=1 ~/.cache/amane/amane-shell
```

Любое значение переменной включает вывод; именно `1` не обязательно. Каждая строка показывает, какое окно рисовалось, время с его прошлого кадра и сколько заняли представление, отрисовка и GPU. Также печатается, какой сервис разбудил окна. Ищите:

- **Кадры, которые не прекращаются.** Что-то постоянно просит кадры: представление, всегда вызывающее `request_frame()`, или шейдер, в исходнике которого есть слово `time`.
- **Сервис, будящий окна при каждом опросе.** Его `update()` возвращает `true`, хотя ничего не изменилось. Сравнивайте старое и новое значение и возвращайте результат сравнения.
- **Медленное представление.** В представлении выполняется реальная работа. Перенесите её в сервис.

### Оболочка потребляет много памяти

Полноэкранным окнам и маскам нужны буферы GPU, которые на встроенной графике могут занимать системную память. Amane просит графический backend экономить память, но потребление всё равно растёт с размером и числом окон. Некоторые backend-ы эту просьбу игнорируют.

Повёрнутые или растянутые маски и маски не шире и не выше одного физического пикселя могут требовать больше памяти, чем обычные скруглённые маски.

При профилировании смотрите и память процесса, и память GPU. Общие буферы могут попадать в оба счётчика, поэтому их сумма может завышать реальное потребление.

### Экран блокировки не разблокируется

См. раздел «Безопасное тестирование» в главе об экране блокировки, чтобы вернуться в заблокированную сессию.
