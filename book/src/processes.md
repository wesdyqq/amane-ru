# Команды и файлы

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
