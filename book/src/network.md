# Network

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
