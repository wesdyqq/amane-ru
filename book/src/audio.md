# Audio

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
