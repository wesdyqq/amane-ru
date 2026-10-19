# Система: батарея, процессор, память, яркость

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
