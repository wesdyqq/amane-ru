# Text

`Text` рисует одну или несколько строк текста. В этой главе: размер, цвет, шрифты, насыщенность и поведение, когда текст не помещается.

### Рисование текста

```rust
use amane::{App, Color, LayerWindow, Text};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    LayerWindow::new()
        .width(300.0)
        .height(40.0)
        .child(Text::new("hello").size(20.0).color(Color::WHITE))
}
```

`Text::new` принимает `&str`, `String` или что угодно, что превращается в `String`, поэтому `format!` работает напрямую:

```rust
Text::new(format!("battery {}%", battery.percent()))
```

По умолчанию: размер 16, чёрный цвет, обычная насыщенность и системный шрифт `sans-serif`.

### Цвет

```rust
Text::new("hello").color(Color::WHITE)
Text::new("hello").color(Color::from("#cdd6f4"))
```

`color` принимает `Color`. В отличие от `Rectangle::fill`, hex-строка напрямую не принимается, поэтому оборачивайте её в `Color::from`.

### Шрифты

Шрифты ищутся через fontconfig, поэтому подходит любой установленный шрифт — по имени семейства:

```rust
App::new().font("Inter").window(view).run()   // по умолчанию для всего текста
Text::new("12:00").font("JetBrains Mono")      // только для этого текста
```

Если символа нет в шрифте, например японского текста в латинском шрифте, Amane ищет его в Noto Sans, затем в Noto Sans CJK JP. Символ, которого нет ни в одном установленном шрифте, пропускается.

### Насыщенность

```rust
Text::new("bold").weight(Weight::Bold)
Text::new("light").weight(300)
```

`Weight` содержит `Thin`, `ExtraLight`, `Light`, `Regular`, `Medium`, `SemiBold`, `Bold`, `ExtraBold` и `Black`. Число от 100 до 900 выбирает ближайшее, как в CSS. В шрифте должно быть установлено соответствующее начертание: большинство семейств поставляются отдельными файлами на каждый вес.

> **Уточнение.** Число округляется до сотни: `650` даст `SemiBold`, `700` — `Bold`, значения выше 900 — `Black`. Это выбор именованного начертания, а не произвольная вариативная ось.

### Длинный текст: обрезка и перенос

По умолчанию текст занимает одну строку и ровно столько ширины, сколько нужно буквам. В `Row` он забирает необходимое место, а соседи с `Parent` получают остаток.

Если текст длиннее отведённого места, он выходит за край. Это меняют два параметра:

```rust
Text::new(long).elide()                     // одна строка, обрезка с "…"
Text::new(long).wrap()                      // столько строк, сколько нужно
Text::new(long).wrap().max_lines(2).elide() // до двух строк, затем "…"
```

С `wrap` или `elide` ширина текста становится `Parent`: он занимает всю данную ширину и вписывается в неё. Поэтому размещайте его там, где ширина задана: в прямоугольнике фиксированной ширины или в `Parent`-секции строки.

Высота зависит от правил:

| Правила | Высота |
|---|---|
| ни одного | одна строка |
| `wrap` с `max_lines(n)` | `n` строк |
| `wrap` без ограничения | `Parent`, потому что число строк зависит от ширины, а она известна только после компоновки |

Если нужна высота перенесённого текста, например для карточки уведомления, запросите её с шириной:

```rust
let body = Text::new(notification.body()).wrap();

let height = body.height_in(360.0);
```

> **Уточнение.** `max_lines` без `wrap` не создаёт перенос: текст остаётся одной строкой, а ограничение строк в основном влияет на высоту. Используйте `max_lines` вместе с `wrap`.

### Иконочные шрифты

Обычно текст измеряется по месту, которое буквы занимают при наборе, включая небольшие поля по бокам. У иконочных шрифтов из-за этого иконка выглядит немного смещённой. `tight` измеряет реальные контуры букв:

```rust
Text::new("\u{f240}").font("Symbols Nerd Font").size(18.0).tight()
```

### Пример

```rust
use amane::{App, Column, LayerWindow, Text, Weight, children};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    let long = "the quick brown fox jumps over the lazy dog, then keeps running far past the edge";

    LayerWindow::new()
        .width(260.0)
        .height(400.0)
        .child(Column::new(children![
            Text::new("regular"),
            Text::new("bold").weight(Weight::Bold),
            Text::new("light, picked by number").weight(300),
            Text::new(long).elide(),
            Text::new(long).wrap().max_lines(2).elide(),
            Text::new(long).wrap(),
        ]))
}
```

> **Уточнение.** У `Text` нет автоматического переноса по словам «из коробки»: без `wrap` длинная строка выходит за границы, пока её не обрежет `clip` родителя. Для карточек и уведомлений почти всегда нужен `wrap()`.
