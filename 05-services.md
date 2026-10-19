# Часть V. Встроенные сервисы

Amane включает сервисы для данных, которые обычно показывает бар: батарея, процессор, память, яркость, звук, сеть, Bluetooth, медиаплееры, уведомления, рабочие столы, приложения и цвета обоев. Плюс `Pam` для интерактивной аутентификации.

Все они используются как собственные сервисы: `Service::read()` в представлении, окно обновляется при изменении значения. Первое чтение запускает сервис.

## Обзор

| Сервис | Источник | Как получает данные | Как часто |
|---|---|---|---|
| `Battery` | `/sys/class/power_supply` | опрос | 5 секунд |
| `Cpu` | `/proc/stat` | опрос | 2 секунды |
| `Memory` | `/proc/meminfo` | опрос | 2 секунды |
| `Brightness` | `/sys/class/backlight`, logind | опрос | 500 миллисекунд |
| `Audio` | PulseAudio/PipeWire | события сервера | мгновенно |
| `Network` | NetworkManager (D-Bus) | опрос | 1 секунда |
| `Bluetooth` | BlueZ (D-Bus) | опрос | 2 секунды |
| `Media` | MPRIS (D-Bus) | опрос | 1 секунда |
| `Notifications` | D-Bus | сервер, события | мгновенно |
| `Workspaces` | событийный поток композитора | события | мгновенно |
| `Apps` | `.desktop`-файлы | фоновое сканирование | 30 секунд |
| `Palette` | файл изображения | опрос времени изменения | 500 миллисекунд |
| `Pam` | Linux-PAM | диалог в фоне | по запросу |
| `Lock` | PAM + compositor | по запросу | — |

> **Исправление.** В книге не указан интервал `Brightness`. В `src/services/brightness.rs` он равен 500 миллисекундам. Там же, где книга говорит «опрос», сервис использует обычный `listen` с `interval` и `update`; сервисы с пометкой «события» заменяют `listen` собственным циклом.

---

## Система: батарея, процессор, память, яркость

### Все четыре сразу

```rust
use amane::{App, Battery, Brightness, Cpu, Full, LayerWindow, Memory, Service, Text};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    let battery = Battery::read();
    let cpu = Cpu::read();
    let memory = Memory::read();
    let brightness = Brightness::read();

    let label = format!(
        "battery {}%   cpu {}%   memory {}%   brightness {}%",
        battery.percent(),
        cpu.percent(),
        memory.percent(),
        brightness.percent()
    );

    LayerWindow::new().width(Full).height(30.0).child(Text::new(label))
}
```

`Service` должен быть в `use`, потому что `read()` приходит из этого трейта.

### Battery

Читается из ядра (`/sys/class/power_supply`) каждые 5 секунд.

| Функция | Что даёт |
|---|---|
| `present()` | `false`, если батареи нет |
| `percent()` | заряд, 0–100 |
| `charging()` | `true`, пока идёт зарядка |
| `full()` | `true`, когда батарея подключена и не заряжается |

На настольном компьютере `present()` равно `false`, остальное — 0. Скрывайте виджет батареи там:

```rust
if battery.present() {
    // показать батарею
}
```

> **Уточнение.** `full()` соответствует статусу ядра `Full` или `Not charging`. Обычно это «подключена и не заряжается», но при порогах зарядки и особенностях драйвера возможны нюансы. Отдельного метода «питание подключено» в `Battery` нет.

`Battery` ищет первую батарею, которая питает компьютер; батареи мыши и ИБП с `scope = Device` пропускаются.

### CPU

Читается из `/proc/stat` каждые 2 секунды.

| Функция | Что даёт |
|---|---|
| `percent()` | загрузка по всем ядрам, 0–100 |

Загрузка существует только как разница между двумя измерениями. Самое первое значение — среднее с момента загрузки машины, дальше показывается текущая загрузка.

### Memory

Читается из `/proc/meminfo` каждые 2 секунды.

| Функция | Что даёт |
|---|---|
| `percent()` | занятая память, 0–100 |
| `used_kib()` | занятая память в кибибайтах |
| `total_kib()` | вся память в кибибайтах |

«Занятая» — то, что держат программы. Кэш, который ядро может освободить сразу, не считается, как и в выводе `free`.

### Brightness

Читает подсветку экрана из ядра (`/sys/class/backlight`).

| Функция | Что даёт |
|---|---|
| `present()` | `false`, если у монитора нет подсветки (обычная ситуация для внешних мониторов) |
| `percent()` | яркость, 0–100 |
| `Brightness::set(percent)` | задаёт яркость |

`set` идёт через logind, поэтому пользователь, сидящий за этой машиной, может менять подсветку без root и пароля. Значение никогда не опускается ниже 1%: чёрный экран трудно вернуть, если его не видно.

Прокрутка над виджетом меняет яркость:

```rust
use amane::{App, Brightness, LayerWindow, Parent, Rectangle, Scroll, Service, Text};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    let brightness = Brightness::read();

    LayerWindow::new().width(200.0).height(30.0).child(
        Rectangle::new()
            .width(Parent)
            .height(Parent)
            .on_scroll(scrolled)
            .child(Text::new(format!("brightness {}%", brightness.percent()))),
    )
}

// каждый шаг колеса меняет яркость на 5
fn scrolled(scroll: Scroll) {
    let current = i32::from(Brightness::read().percent());

    let step = if scroll.y < 0.0 { 5 } else { -5 };

    let changed = (current + step).clamp(1, 100);

    Brightness::set(changed as u8);
}
```

`set` выполняется в фоновом потоке, поэтому медленный ответ не замораживает оболочку.

---

## Audio

`Audio` читает и меняет громкость динамика и микрофона по умолчанию. Он общается с PulseAudio, что покрывает и PipeWire через `pipewire-pulse` — на большинстве дистрибутивов он включён.

`Audio` не опрашивает сервер. Звуковой сервер сам сообщает об изменениях, поэтому бар обновляется сразу после нажатия клавиши громкости.

### Виджет громкости

Прокрутка меняет громкость, клик выключает звук:

```rust
use amane::{App, Audio, Button, LayerWindow, Parent, Rectangle, Scroll, Service, Text};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    let audio = Audio::read();

    let label = if audio.muted() {
        String::from("muted")
    } else {
        format!("volume {}%", audio.volume())
    };

    LayerWindow::new().width(200.0).height(30.0).child(
        Rectangle::new()
            .width(Parent)
            .height(Parent)
            .on_click(clicked)
            .on_scroll(scrolled)
            .child(Text::new(label)),
    )
}

fn clicked(_: Button) {
    Audio::toggle_mute();
}

// каждый шаг колеса меняет громкость на 5
fn scrolled(scroll: Scroll) {
    let volume = i32::from(Audio::read().volume());

    let step = if scroll.y < 0.0 { 5 } else { -5 };

    let changed = (volume + step).clamp(0, 100);

    Audio::set_volume(changed as u8);
}
```

### Справочник

| Функция | Что даёт или делает |
|---|---|
| `volume()` | громкость динамика, 0–100 |
| `muted()` | `true`, если динамик выключен |
| `microphone_volume()` | громкость микрофона, 0–100 |
| `microphone_muted()` | `true`, если микрофон выключен |
| `Audio::set_volume(volume)` | задаёт громкость динамика, 0–100 |
| `Audio::toggle_mute()` | выключает или включает динамик |
| `Audio::set_microphone_volume(volume)` | задаёт громкость микрофона, 0–100 |
| `Audio::toggle_microphone_mute()` | выключает или включает микрофон |

«Динамик» и «микрофон» означают устройства вывода и ввода по умолчанию. При смене устройства, например при подключении наушников, `Audio` следует за ней.

Функции управления выполняются в фоновом потоке, поэтому медленный звуковой сервер не замораживает оболочку. Новое значение появляется, когда сервер о нём сообщит, обычно сразу.

> **Уточнение.** Значения выше 100 не ошибка: `set_volume` и `set_microphone_volume` молча считают их за 100. Прочитанное `volume()` всегда в пределах 0–100.

---

## Network

`Network` показывает текущее соединение и список Wi-Fi сетей, умеет подключаться, отключаться и сканировать. Он общается с NetworkManager через D-Bus, поэтому NetworkManager должен быть запущен. Без него всё читается как offline.

Сервис опрашивается раз в секунду, потому что сила Wi-Fi сигнала меняется постоянно, и никто об этом не сообщает. Опрос, который не нашёл изменений, ничего не перерисовывает.

### Метка соединения

```rust
use amane::{App, Full, LayerWindow, Link, Network, Service, Text};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    let network = Network::read();

    let label = match network.link() {
        Link::Offline => String::from("offline"),
        Link::Wired => String::from("wired"),
        Link::Wifi => format!("{}  {}%", network.ssid(), network.strength()),
        Link::Other => String::from("connected"),
    };

    LayerWindow::new().width(Full).height(30.0).child(Text::new(label))
}
```

`Link::Other` охватывает соединения, которые не проводные и не Wi-Fi: VPN, USB-модем телефона и подобное.

### Чтение соединения

| Функция | Что даёт |
|---|---|
| `connected()` | `true`, если есть любое соединение |
| `link()` | `Link::Offline`, `Wired`, `Wifi` или `Other` |
| `ssid()` | имя Wi-Fi сети, пустое на проводном соединении |
| `strength()` | сигнал Wi-Fi, 0–100; 0 на проводном |
| `wifi_enabled()` | `false`, если радиомодуль Wi-Fi выключен |
| `connecting()` | `true`, пока идёт подключение |
| `access_points()` | сети Wi-Fi в зоне действия; пусто, если нет Wi-Fi устройства или радио выключено |

Каждый `AccessPoint` в `access_points()` имеет:

| Функция | Что даёт |
|---|---|
| `ssid()` | имя сети |
| `strength()` | сигнал, 0–100 |
| `secured()` | `true`, если нужен пароль |
| `active()` | `true` для сети, в которой вы сейчас |
| `saved()` | `true`, если у NetworkManager уже есть профиль этой сети |

### Подключение и отключение

| Функция | Что делает |
|---|---|
| `Network::scan()` | ищет сети. Новые появятся в `access_points()` через несколько секунд. |
| `Network::connect(ssid, password)` | подключается к сети |
| `Network::disconnect()` | выходит из текущей Wi-Fi сети |
| `Network::set_wifi(enabled)` | включает или выключает радиомодуль Wi-Fi |

Все они выполняются в фоновом потоке и возвращаются сразу. Результат появится при следующем опросе.

`connect` принимает пароль как `Option`:

- для **сохранённой** сети передайте `None`: NetworkManager уже хранит пароль;
- для **новой защищённой** сети передайте `Some(password)`: NetworkManager создаст новый профиль с ним, и в следующий раз сеть уже будет сохранённой;
- для **новой открытой** сети передайте `None`.

> **Уточнение.** Если профиль уже сохранён, переданный пароль полностью игнорируется: соединение активируется с сохранёнными настройками. Чтобы сменить сохранённый пароль, удалите профиль средствами NetworkManager (`nmcli connection delete <ssid>`), после чего `connect` создаст его заново.

### Список сетей

```rust
use amane::{App, Column, LayerWindow, Network, Parent, Rectangle, Service, Text, Widget};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    let network = Network::read();

    let mut rows: Vec<Box<dyn Widget>> = Vec::new();

    for access_point in network.access_points() {
        let mark = if access_point.active() { "* " } else { "" };

        let label = format!("{mark}{}  {}%", access_point.ssid(), access_point.strength());

        let ssid = String::from(access_point.ssid());

        rows.push(Box::new(
            Rectangle::new()
                .width(Parent)
                .height(30.0)
                .on_click(move |_| Network::connect(&ssid, None))
                .child(Text::new(label)),
        ));
    }

    LayerWindow::new().width(300.0).height(400.0).child(Column::new(rows).width(Parent))
}
```

`ssid` копируется в `String` до замыкания, потому что замыкание живёт дольше, чем `network`.

Для новых защищённых сетей совместите это с парольным `TextInput`.

---

## Bluetooth

`Bluetooth` показывает адаптер и его устройства, умеет включать адаптер, сканировать, спаривать, подключать и забывать устройства. Он общается с BlueZ через D-Bus, поэтому служба `bluetooth` должна быть запущена.

Опрос идёт каждые 2 секунды.

### Список устройств

```rust
use amane::{App, Bluetooth, BluetoothDevice, Column, LayerWindow, Parent, Rectangle, Service, Text, Widget};

fn main() {
    Bluetooth::start_scan();

    App::new().window(view).run();
}

fn view() -> LayerWindow {
    let bluetooth = Bluetooth::read();

    let mut rows: Vec<Box<dyn Widget>> = Vec::new();

    for device in bluetooth.devices() {
        rows.push(Box::new(device_row(device)));
    }

    LayerWindow::new().width(360.0).height(400.0).child(Column::new(rows))
}

fn device_row(device: &BluetoothDevice) -> Rectangle {
    let state = if device.connected() {
        "connected"
    } else if device.paired() {
        "paired"
    } else {
        "new"
    };

    let path = String::from(device.path());
    let connected = device.connected();
    let paired = device.paired();

    Rectangle::new()
        .width(Parent)
        .height(30.0)
        .on_click(move |_| {
            if connected {
                Bluetooth::disconnect(&path);
            } else if paired {
                Bluetooth::connect(&path);
            } else {
                Bluetooth::pair(&path);
            }
        })
        .child(Text::new(format!("{}  {state}", device.name())))
}
```

### Чтение состояния

| Функция | Что даёт |
|---|---|
| `available()` | `false`, если нет адаптера или BlueZ не запущен |
| `powered()` | `true`, если адаптер включён |
| `scanning()` | `true`, пока идёт поиск новых устройств |
| `devices()` | известные и найденные устройства: сначала подключённые, затем спаренные, затем по имени |

Каждый `BluetoothDevice` имеет:

| Функция | Что даёт |
|---|---|
| `name()` | имя, например `"WH-1000XM4"` |
| `address()` | аппаратный адрес |
| `path()` | путь BlueZ, который принимают функции управления |
| `icon()` | имя иконки BlueZ для типа устройства, например `"audio-headphones"` |
| `paired()` | `true`, если устройство спарено |
| `connected()` | `true`, пока устройство подключено |
| `battery()` | заряд устройства, 0–100, если устройство его сообщает; иначе `None` |

### Управление

| Функция | Что делает |
|---|---|
| `Bluetooth::set_powered(on)` | включает или выключает адаптер |
| `Bluetooth::start_scan()` | начинает поиск новых устройств. Они появляются в `devices()` по мере обнаружения. |
| `Bluetooth::stop_scan()` | останавливает поиск |
| `Bluetooth::pair(path)` | спаривает устройство, затем подключает, как другие Bluetooth-меню |
| `Bluetooth::connect(path)` | подключает спаренное устройство |
| `Bluetooth::disconnect(path)` | отключает устройство |
| `Bluetooth::forget(path)` | убирает спаривание и удаляет устройство. Оно вернётся только после нового сканирования. |

Все они выполняются в фоновом потоке и возвращаются сразу. Результат появится при следующем опросе.

`pair` работает только с устройствами, которые спариваются без кода: наушники, мыши и большинство колонок. Устройства, которые просят подтверждение или ввод кода, например телефоны и некоторые клавиатуры, пока нельзя спарить из Amane. Спарьте их один раз через `bluetoothctl`, после чего `connect` заработает.

---

## Медиаплееры

`Media` показывает, что играет, и управляет воспроизведением в любом плеере с поддержкой MPRIS: Spotify, mpv, вкладках Firefox и Chromium, VLC и большинстве остальных.

Опрос идёт раз в секунду, потому что плееры не сообщают позицию трека постоянно.

### Виджет now playing

```rust
use amane::{App, Button, Full, LayerWindow, Media, Parent, Rectangle, Row, Service, Text, children};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    let media = Media::read();

    let symbol = if media.playing() { "pause" } else { "play" };

    let seconds = media.position().as_secs();
    let total = media.length().as_secs();

    let label = format!(
        "{} - {}  {}:{:02} / {}:{:02}",
        media.artist(),
        media.title(),
        seconds / 60,
        seconds % 60,
        total / 60,
        total % 60,
    );

    LayerWindow::new().width(Full).height(30.0).child(Row::new(children![
        button("prev", |_| Media::previous()),
        button(symbol, |_| Media::play_pause()),
        button("next", |_| Media::next()),
        Rectangle::new().width(Parent).height(Parent).child(Text::new(label)),
    ]))
}

fn button(label: &str, clicked: fn(Button)) -> Rectangle {
    Rectangle::new()
        .width(60.0)
        .height(Parent)
        .on_click(clicked)
        .child(Text::new(label))
}
```

### Активный плеер

Когда открыто несколько плееров, функции самого `Media` показывают и управляют одним из них — **активным**:

1. тем, который играет;
2. либо тем, который показывался последним;
3. либо первым.

| Функция | Что даёт или делает |
|---|---|
| `title()` | название трека, пустое, если плеер не открыт |
| `artist()` | исполнитель трека |
| `art_url()` | ссылка на обложку, обычно `file://...` или `https://...` |
| `playing()` | `true`, пока идёт воспроизведение |
| `position()` | позиция в треке, `Duration` |
| `length()` | длительность трека, `Duration` |
| `Media::play_pause()` | переключает воспроизведение и паузу |
| `Media::next()` | следующий трек |
| `Media::previous()` | предыдущий трек |

`Duration` — это `std::time::Duration`. Используйте `.as_secs()`, чтобы получить целые секунды.

Чтобы показать обложку, отбросьте `file://` из `art_url()` и используйте путь как изображение. Ссылки `https://` показать нельзя: `Image` не скачивает файлы.

> **Уточнение.** Если играющий плеер уже был активным и его поставили на паузу, `Media` не переключается на другой плеер: активным остаётся тот же, пока не появится новый играющий. Так бар не «прыгает» при паузе.

### Все плееры

`players()` перечисляет все открытые плееры в одном и том же порядке при каждом опросе, а `active()` даёт активный или `None`, если плееров нет. У каждого `MediaPlayer` те же функции, что выше, плюс `identity()` (отображаемое имя, например `"Spotify"`), `name()` (имя в D-Bus) и собственные `play_pause()`, `next()`, `previous()`:

```rust
use amane::{App, Column, Full, LayerWindow, Media, MediaPlayer, Parent, Rectangle, Service, Text, Widget};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    let media = Media::read();

    let mut rows: Vec<Box<dyn Widget>> = Vec::new();

    for player in media.players() {
        rows.push(Box::new(player_row(player)));
    }

    LayerWindow::new().width(Full).height(90.0).child(Column::new(rows))
}

fn player_row(player: &MediaPlayer) -> Rectangle {
    let label = format!("{}: {} - {}", player.identity(), player.artist(), player.title());

    // замыкание держит свою копию, поэтому продолжает управлять этим плеером
    let target = player.clone();

    Rectangle::new()
        .width(Parent)
        .height(30.0)
        .on_click(move |_| target.play_pause())
        .child(Text::new(label))
}
```

Функции управления выполняются в фоновом потоке и возвращаются сразу.

---

## Уведомления

`Notifications` делает вашу оболочку сервером уведомлений. Программы отправляют уведомления в Amane так же, как отправляли бы их mako или dunst, а вы решаете, как их показывать.

### Перед началом

Одновременно может работать только один сервер уведомлений. Остановите текущий (mako, dunst, swaync или функцию уведомлений в другом баре) перед запуском оболочки. Если другой демон уже работает, `running()` вернёт `false`, и Amane ничего не получит.

Amane становится демоном при первом чтении `Notifications`, поэтому читайте его в представлении, которое открыто при старте оболочки.

### Список уведомлений

```rust
use amane::{
    App, Column, Horizontal, Layer, LayerWindow, Notification, Notifications, Parent, Rectangle,
    Service, Text, Urgency, Vertical, Widget,
};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    let notifications = Notifications::read();

    let mut cards: Vec<Box<dyn Widget>> = Vec::new();

    for notification in notifications.list() {
        cards.push(Box::new(card(notification)));
    }

    LayerWindow::new()
        .width(400.0)
        .height(600.0)
        .anchor_vertical(Vertical::Top)
        .anchor_horizontal(Horizontal::Right)
        .layer(Layer::Overlay)
        .visible(!notifications.list().is_empty())
        .child(Column::new(cards).gap(8.0))
}

// клик по уведомлению выполняет действие по умолчанию или закрывает его
fn card(notification: &Notification) -> Rectangle {
    let fill = match notification.urgency() {
        Urgency::Critical => "#f38ba8",
        _ => "#313244",
    };

    let id = notification.id();

    let label = format!("{}: {}", notification.summary(), notification.body());

    Rectangle::new()
        .width(Parent)
        .height(60.0)
        .radius(12.0)
        .fill(fill)
        .padding(12.0)
        .on_click(move |_| Notifications::click(id))
        .child(Text::new(label).elide())
}
```

Окно скрывает себя, пока уведомлений нет, поэтому пустое место не перехватывает клики у окон под ним.

Проверьте:

```sh
notify-send "hello" "from amane"
```

### Чтение уведомлений

`list()` даёт все уведомления, от старых к новым. Каждый `Notification` имеет:

| Функция | Что даёт |
|---|---|
| `id()` | номер, который принимают функции управления |
| `app_name()` | имя отправившей программы |
| `summary()` | однострочный заголовок |
| `body()` | текст; может быть пустым и может содержать простую разметку вроде `<b>` |
| `icon()` | имя иконки вроде `"firefox"`, путь к файлу или пустую строку |
| `image()` | картинку для уведомления, например аватар: путь к файлу, ссылку `file://` или пустую строку |
| `urgency()` | `Urgency::Low`, `Normal` или `Critical` |
| `actions()` | кнопки, запрошенные отправителем, по порядку |
| `has_default_action()` | делает ли что-то клик по самому уведомлению |
| `received()` | когда оно пришло или когда отправитель заменил его, `SystemTime` |

У каждого `Action` есть `key()` — его передают в `invoke`, и `label()` — текст для кнопки.

> **Исправление.** Утверждение «`body()` может содержать разметку вроде `<b>`» относится к протоколу D-Bus, но не к отрисовке Amane: `Text` не разбирает HTML и не поддерживает rich text. Теги будут нарисованы буквально. Если нужен чистый текст, уберите их самостоятельно. Не интерпретируйте тело уведомления как доверенный HTML.

### Клик, закрытие и действия

| Функция | Что делает |
|---|---|
| `Notifications::click(id)` | выполняет действие по умолчанию или закрывает уведомление, если действия нет. Вызывайте при клике по самому уведомлению. |
| `Notifications::invoke(id, key)` | выполняет одно из действий. Для кнопок действий. |
| `Notifications::dismiss(id)` | закрывает уведомление |
| `Notifications::clear()` | закрывает все |

После выполнения действия уведомление закрывается, если отправитель не попросил оставить его.

### Кнопки действий

```rust
for action in notification.actions() {
    let id = notification.id();
    let key = String::from(action.key());

    buttons.push(Box::new(
        Rectangle::new()
            .width(100.0)
            .height(30.0)
            .on_click(move |_| Notifications::invoke(id, &key))
            .child(Text::new(action.label())),
    ));
}
```

Проверьте:

```sh
notify-send -A yes=Yes -A no=No "question" "pick one"
```

### Тайм-ауты

Уведомления остаются, пока их не закроют. Amane игнорирует тайм-аут, который просит отправитель.

Чтобы скрывать всплывающие карточки через несколько секунд, сравнивайте `received()` с текущим временем в сервисе с опросом раз в секунду и показывайте во всплывающем окне только недавние. Полный список храните для центра уведомлений.

> **Уточнение.** `running()` становится `true` только после того, как Amane успешно займёт имя `org.freedesktop.Notifications`. Первые кадры после старта могут дать `false`. Если имя занято, сервис остаётся доступным, но `running()` навсегда `false`.

---

## Рабочие столы

`Workspaces` перечисляет рабочие столы композитора и умеет переключаться между ними. Поддерживаются **niri**, **Hyprland**, **Sway** и **Mango (MangoWC)**. На других композиторах список остаётся пустым.

Сервис не опрашивает: он следует событийному потоку композитора, поэтому бар обновляется в момент переключения.

На Mango каждый тег — рабочий стол. Несколько тегов могут быть активны на одном мониторе одновременно, и у каждого активного тега на мониторе с фокусом `focused() == true`. Теги сообщают номер, монитор, срочность и число окон; имена тегов Mango через IPC не передаются. `Workspaces::focus(id)` выбирает тег на его мониторе. Mango определяется по переменной `MANGO_INSTANCE_SIGNATURE` и опрашивается напрямую через IPC-сокет, поэтому `mmsg` не требуется.

### Кнопки рабочих столов

```rust
use amane::{App, Color, Full, LayerWindow, Parent, Rectangle, Row, Service, Text, Widget, Workspace, Workspaces};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    let workspaces = Workspaces::read();

    let mut buttons: Vec<Box<dyn Widget>> = Vec::new();

    for workspace in workspaces.list() {
        buttons.push(Box::new(button(workspace)));
    }

    LayerWindow::new().width(Full).height(30.0).child(Row::new(buttons))
}

fn button(workspace: &Workspace) -> Rectangle {
    let fill = if workspace.focused() {
        "#89b4fa"
    } else if workspace.urgent() {
        "#f38ba8"
    } else {
        "#313244"
    };

    let id = workspace.id();

    Rectangle::new()
        .width(30.0)
        .height(Parent)
        .fill(fill)
        .on_click(move |_| Workspaces::focus(id))
        .child(Text::new(workspace.index().to_string()).color(Color::WHITE))
}
```

### Справочник

`list()` даёт все рабочие столы, отсортированные по монитору, затем по позиции на нём. Каждый `Workspace` имеет:

| Функция | Что даёт |
|---|---|
| `id()` | идентификатор для `Workspaces::focus`: id композитора или id, который Amane назначает паре монитор/тег на Mango; `i64`, потому что у именованных рабочих столов Hyprland id отрицательные |
| `index()` | позицию на своём мониторе, начиная с 1; на Hyprland и Sway — номер рабочего стола (0 для стола только с именем) |
| `name()` | имя или `None`, если имя не задано |
| `output()` | монитор, например `"DP-1"`, или `None` |
| `active()` | `true`, когда стол показан на своём мониторе, даже если фокус на другом мониторе; на Mango активных тегов может быть несколько |
| `focused()` | `true` для стола с общим фокусом; на Mango — для каждого активного тега на мониторе с фокусом |
| `urgent()` | `true`, когда окно просит внимания; на Hyprland всегда `false` |
| `windows()` | сколько окон на столе |

`Workspaces::focus(id)` переключает рабочий стол. Выполняется в фоновом потоке и возвращается сразу.

> **Исправление.** В книге не сказано, что рабочие столы `special`/`special:*` Hyprland (scratchpad) пропускаются и в список не попадают. На Mango теги нумеруются с 1 до 31: нулевая маска означает особый рабочий стол, а не обычный тег. Имена тегов Mango через IPC недоступны, поэтому `name()` всегда `None`.

### Бары по мониторам

С `window_per_monitor` показывайте каждому бару только его рабочие столы, сравнивая `output()` с именем монитора:

```rust
fn bar(monitor: &Monitor) -> LayerWindow {
    let workspaces = Workspaces::read();

    for workspace in workspaces.list() {
        if workspace.output() != Some(monitor.name.as_str()) {
            continue;
        }

        // добавить кнопку
    }

    // ...
}
```

---

## Приложения

`Apps` перечисляет установленные программы из `.desktop`-файлов, с именами и иконками. Используйте его для лаунчера.

### Лаунчер

```rust
use amane::{App, Apps, Color, Column, Image, LayerWindow, Pointer, Rectangle, Row, ScrollArea, Service, Text, Widget, children};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    let apps = Apps::read();

    let mut rows: Vec<Box<dyn Widget>> = Vec::new();

    for app in apps.list() {
        let launched = app.clone();

        let icon = Rectangle::new().width(24.0).height(24.0);

        let icon = match app.icon_path() {
            Some(path) => icon.fill(Image::contain(path)),
            None => icon,
        };

        let row = Rectangle::new()
            .width(300.0)
            .height(32.0)
            .fill("#1e1e2e")
            .cursor(Pointer)
            .on_click(move |_| launched.launch())
            .child(Row::new(children![
                icon,
                Text::new(app.name()).size(16.0).color(Color::WHITE),
            ]));

        rows.push(Box::new(row));
    }

    LayerWindow::new()
        .width(300.0)
        .height(500.0)
        .child(ScrollArea::new("apps", Column::new(rows)))
}
```

`App` (оболочка) и `Apps` (сервис) — разные вещи. `app` в цикле — один `DesktopApp`.

### Справочник

`list()` даёт все программы, отсортированные по имени, без помеченных как скрытые или не показываемые в меню. Каждый `DesktopApp` имеет:

| Функция | Что даёт или делает |
|---|---|
| `name()` | имя, например `"Firefox"` |
| `description()` | комментарий или общее название вроде `"Web Browser"`, либо `None` |
| `exec()` | командную строку без заполнителей вида `%f` |
| `icon()` | имя иконки в теме, например `"firefox"`, или `None` |
| `icon_path()` | файл иконки, PNG, если он есть в теме, или `None` |
| `launch()` | запускает программу, не ожидая её |

### Первая загрузка и повторные сканирования

Поиск иконок обходит все темы иконок в системе и занимает несколько секунд. Поэтому `list()` сначала пуст и заполняется после первого сканирования. Окно само перерисуется, когда это произойдёт.

После этого список сканируется заново каждые 30 секунд, поэтому программы, установленные во время работы оболочки, появляются сами.

### Поиск

Фильтруйте список через `TextInput`:

```rust
let query = search.query.to_lowercase();

for app in apps.list() {
    if !app.name().to_lowercase().contains(&query) {
        continue;
    }

    // добавить строку
}
```

> **Уточнение.** Сканирование читает стандартные каталоги XDG `applications` (`~/.local/share`, `/usr/share` и остальные из `XDG_DATA_DIRS`); файл в более раннем каталоге перекрывает одноимённый в более позднем. Учитываются только `Type=Application` без `Hidden=true` и `NoDisplay=true`.

---

## Palette

`Palette` извлекает основные цвета изображения, обычно обоев, чтобы цвета оболочки следовали за ними.

### Тематизированный бар

```rust
use amane::{App, Full, LayerWindow, Palette, Parent, Rectangle, Service, Text};

fn main() {
    Palette::write().open("/home/you/Pictures/wall.jpg", 16);

    App::new().window(view).run();
}

fn view() -> LayerWindow {
    let palette = Palette::read();

    LayerWindow::new().width(Full).height(30.0).child(
        Rectangle::new()
            .width(Parent)
            .height(Parent)
            .fill(palette.background())
            .child(Text::new("themed").color(palette.foreground())),
    )
}
```

### Как выбираются и обновляются цвета

- `open(path, count)` читает изображение и выбирает `count` цветов. Изображение читается сразу, поэтому уже первый кадр получает цвета. 16 достаточно для темы всей оболочки.
- `open` меняет `Palette`, поэтому вызывается у `write()`, и все окна, читающие палитру, перерисовываются. Это единственное место, где `write()` уместен вне обработчика ввода: в `main` до запуска оболочки или в IPC-обработчике.
- `Palette` проверяет файл дважды в секунду. Когда изображение меняется или вы вызываете `open` с новым путём, цвета выбираются заново в фоновом потоке, и окна перерисовываются.

Поэтому скрипт обоев, перезаписывающий один и тот же файл, сам перекрашивает оболочку.

### Справочник

| Функция | Что даёт или делает |
|---|---|
| `open(path, count)` | читает изображение и выбирает `count` цветов. Вызывать у `Palette::write()`. |
| `colors()` | все выбранные цвета, самые частые первыми |
| `dominant()` | цвет, которого на изображении больше всего |
| `accent()` | самый яркий цвет, для акцентов и рабочего стола с фокусом |
| `background()` | самый тёмный цвет, чтобы светлый текст всегда читался |
| `foreground()` | цвет, читаемый на `background()`, по возможности подкрашенный изображением |
| `on_accent()` | белый или чёрный, что лучше читается на `accent()` |
| `light()` | `true`, если изображение в целом светлое |

> **Исправление.** Формулировка «до открытия изображения палитра хранит набор цветов по умолчанию» неверна. `colors()` до `open()` возвращает **пустой** список. Значения по умолчанию есть только у отдельных геттеров: `dominant()` и `background()` дают `#11111b`, `accent()` — `#89b4fa`, `light()` — `false`, а `foreground()` и `on_accent()` вычисляются из этих значений. Поэтому `palette.colors()[0]` до `open()` паникует.

> **Уточнение.** Если файл не читается или ещё дописывается, `open` оставляет `colors()` пустым, а геттеры возвращают значения по умолчанию. `Palette` продолжает следить за временем изменения файла и подхватит его, когда он станет целым.

### Смена обоев по горячей клавише

```rust
fn main() {
    App::new()
        .ipc("wallpaper", |arguments| {
            let Some(path) = arguments.first() else {
                return String::from("usage: wallpaper <path>");
            };

            Palette::write().open(path, 16);

            format!("palette from {path}")
        })
        .window(bar)
        .run();
}
```

```sh
amane ipc call wallpaper ~/Pictures/new.jpg
```

Здесь `~` работает, потому что ваша оболочка (`fish`, `bash`, `zsh`) раскрывает её до того, как `amane` её увидит.

`open` читает изображение сразу, а IPC-обработчики выполняются в потоке отрисовки, поэтому на очень большой картинке оболочка на мгновение замрёт. Если это мешает, пусть скрипт обоев копирует новое изображение поверх одного фиксированного пути, а `open` этого пути вызовите один раз в `main`. `Palette` заметит изменение сам и прочитает файл в фоновом потоке.

---

## PAM: интерактивная аутентификация

Сервис `Pam` проводит диалог PAM в фоновом потоке. Он показывает каждый запрос и сообщение, чтобы оболочка могла спросить пароль, код подтверждения или другой ответ. Успешная попытка отдельного `Pam` **не** разблокирует сессию. Для интерактивной разблокировки используйте `Lock::authenticate`.

### Запуск аутентификации

Вызывайте `start` из обработчика ввода или другого потока:

```rust
use amane::{Pam, PamConfig};

let result = Pam::start(PamConfig::new("login"));

if let Err(error) = result {
    // показать error
}
```

Имя сервиса выбирает файл политики в `/etc/pam.d`. Выбирайте политику, подходящую вашей оболочке. Пользователь по умолчанию — `$USER`; отдельная аутентификация может выбрать другого:

```rust
Pam::start(PamConfig::new("my-shell").user("alice"));
```

`PamConfig::config_directory(path)` выбирает другой каталог политик. Имя сервиса по-прежнему остаётся именем файла в этом каталоге. Используется `pam_start_confdir` из Linux-PAM; удобно для политик приложений и изолированных тестов.

Одновременно выполняется только одна попытка, включая попытки, запущенные `Lock`. Если другой обработчик ещё активен, `start` возвращает `PamError::Busy`. Новый запуск очищает предыдущие сообщения и результат.

### Запросы и сообщения

Читайте `Pam` в представлении, как любой другой сервис. У каждого `PamMessage` есть `id()`, `text()` и `kind()`:

| Вид | Значение |
|---|---|
| `PamMessageKind::Info` | информация для пользователя |
| `PamMessageKind::Error` | сообщение от модуля PAM для показа |
| `PamMessageKind::Prompt { visible: true }` | запрос, ответ на который можно показывать при вводе |
| `PamMessageKind::Prompt { visible: false }` | запрос, ответ на который нужно скрывать |

`messages()` хранит историю сообщений диалога. `prompt()` возвращает только текущий неотвеченный запрос. На запросы отвечают по одному, даже если модуль прислал несколько сразу.

Сохраните `id` запроса в обработчике ввода. Это не даст запоздалому ответу попасть в следующий запрос или другую попытку:

```rust
use amane::{Pam, PamMessageKind, Service, TextInput};

let pam = Pam::read();
if let Some(prompt) = pam.prompt() {
    let id = prompt.id();
    let mut input = TextInput::new("pam-response")
        .placeholder(prompt.text())
        .focused()
        .on_submit(move |response| {
            if Pam::respond(id, &response).is_ok() {
                TextInput::set_text("pam-response", "");
            }
        });
    if prompt.kind() == (PamMessageKind::Prompt { visible: false }) {
        input = input.password();
    }
    // Добавьте input в дерево виджетов.
}
```

Ответ принимается один раз. Устаревший `id` или повторный ответ даёт `PamError::NoPrompt`. Ответ с нулевым байтом отклоняется, не расходуя запрос. Ответы не попадают в историю сообщений.

Представления только читают сервисы. Вызывайте `start`, `respond` и `abort` из обработчиков, после того как все guard-ы `Pam::read()` или `Lock::read()` отпущены.

### Результаты и отмена

`result()` равно `None`, пока попытка идёт (если её не отменили). Затем там одно из:

| Результат | Значение |
|---|---|
| `PamResult::Success` | и аутентификация, и проверка аккаунта прошли |
| `PamResult::Rejected(error)` | учётные данные или политика аккаунта отклонили попытку |
| `PamResult::Aborted` | попытка отменена |
| `PamResult::Error(error)` | сбой серверной части PAM или обработчика |

`PamError::Native { code, message }` сохраняет код и текст ошибки PAM. Если модуль меняет аутентифицированного пользователя, возвращается `PamError::UserChanged`. Показ сообщения `Error` от модуля сам по себе не означает, что попытка закончилась; итог смотрите в `result()`.

`Pam::abort()` немедленно отменяет попытку и будит ожидающий запрос. Нативный модуль, уже выполняющий работу вне callback-а диалога, должен вернуться, прежде чем его можно будет очистить. `active()` остаётся `true`, пока очистка не завершится, и до этого новый запуск возвращает `Busy`. Поздний результат отменённой попытки отбрасывается.

Для попытки, запущенной блокировкой, `Lock::abort()` также очищает состояние проверки и ошибки блокировки и оставляет сессию заблокированной. Новая блокировка сессии отменяет старую попытку аутентификации.

### Пример

`cargo run --example pam` открывает обычное окно аутентификации. Она использует политику `login` и не блокирует и не разблокирует сессию. Пример использует `App::without_ipc()`, чтобы работать рядом с оболочкой и не занимать её IPC-сокет. Политику и каталог можно выбрать через `AMANE_PAM_SERVICE` и `AMANE_PAM_CONFIG_DIRECTORY`.

Библиотечные тесты компилируют временный модуль PAM и используют временный каталог политик. Они проверяют диалоги, отказ аккаунта, отмену и устаревшие результаты, не проверяя настоящие учётные данные и не меняя системные настройки аутентификации.

> **Уточнение.** `Pam::start` возвращает `Result<(), PamError>`, а не паникует. Если вызывать его из замыкания `App::ipc`, которое обязано вернуть `String`, обработайте ошибку внутри замыкания, как в примере выше, вместо оператора `?`: сигнатура обработчика этого не позволяет без вспомогательной функции.

---

## Термины

- **MPRIS:** стандартный интерфейс D-Bus для медиаплееров.
- **logind:** системная служба, через которую Amane меняет яркость от имени активного пользователя.
- **PAM:** подключаемая аутентификация Linux; `/etc/pam.d/<имя>` задаёт политику.
- **Системная и сессионная шины:** две шины D-Bus, с которыми работает Amane.
