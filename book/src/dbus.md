# D-Bus

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
