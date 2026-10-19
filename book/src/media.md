# Медиаплееры

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
