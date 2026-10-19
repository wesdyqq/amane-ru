# Bluetooth

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
