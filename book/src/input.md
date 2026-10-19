# Ввод

Бару нужны кнопки: клик по рабочему столу переключает его, прокрутка над громкостью меняет звук, клик по часам открывает календарь.

В этой главе: клики, наведение, прокрутка, перетаскивание, вид указателя и клавиши.

### Обработка клика

```rust
use amane::{App, Button, LayerWindow, Parent, Rectangle, Text};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    LayerWindow::new().width(200.0).height(40.0).child(
        Rectangle::new()
            .width(Parent)
            .height(Parent)
            .fill("#1e1e2e")
            .on_click(clicked)
            .child(Text::new("click me")),
    )
}

fn clicked(button: Button) {
    println!("clicked with {button:?}");
}
```

### Как ввод доходит до обработчика

Обработчики ввода задаются у `Rectangle`. Каждый кадр Amane запоминает, где оказался каждый прямоугольник с обработчиком. При клике он находит прямоугольник под указателем и вызывает его обработчик.

Если прямоугольники перекрываются, событие получает нарисованный последним. Это самый внутренний и верхний: кнопка внутри панели получает клик, а не панель.

Обработчик выполняется после исчезновения кадра, поэтому не может менять виджеты напрямую. Он меняет состояние, обычно записывая в сервис, а представление показывает изменение на следующем кадре:

```rust
fn clicked(_: Button) {
    Counter::write().count += 1;
}
```

### Обработчики мыши

Все это методы `Rectangle`:

| Метод | Когда вызывается | Что получает |
|---|---|---|
| `on_click` | кнопка нажата и отпущена над одним и тем же прямоугольником | `Button`: `Left`, `Right` или `Middle` |
| `on_hover` | когда указатель входит и когда выходит | `true` при входе, `false` при выходе |
| `on_scroll` | на каждый шаг колеса или движение тачпада | `Scroll` с `x` и `y` |
| `on_move` | при каждом движении, пока указатель над прямоугольником | `Point` |
| `on_drag` | при нажатии левой кнопкой и при каждом движении до отпускания | `Point` |

`Point` содержит `x` и `y` в пикселях от левого верхнего угла прямоугольника. Во время `on_drag` точка продолжает приходить даже после выхода указателя за прямоугольник, поэтому она может быть отрицательной или больше размеров. Ограничивайте её.

`Scroll` измеряется в строках, поэтому колесо и тачпад двигают на одинаковую величину. Положительный `y` — вниз, положительный `x` — вправо.

### Передача значений в обработчики

Обработчик может быть функцией, как `clicked` выше, или замыканием. Замыкание может перенести значения из представления:

```rust
use amane::{App, Column, LayerWindow, Parent, Rectangle, Text, Widget};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    let mut rows: Vec<Box<dyn Widget>> = Vec::new();

    for number in 1..=3 {
        let row = Rectangle::new()
            .width(Parent)
            .height(30.0)
            .on_click(move |_| println!("clicked row {number}"))
            .child(Text::new(format!("row {number}")));

        rows.push(Box::new(row));
    }

    LayerWindow::new().width(200.0).height(90.0).child(Column::new(rows))
}
```

`move` копирует `number` в замыкание, поэтому каждая строка помнит свой номер. `|_|` игнорирует аргумент `Button`.

Замыкание не может заимствовать данные из `read()` сервиса, потому что обработчик живёт дольше представления. Сначала скопируйте нужное:

```rust
let id = workspace.id();                                   // копия, не заимствование
let name = String::from(device.name());                    // собственная копия текста

Rectangle::new()
    .width(30.0)
    .height(Parent)
    .on_click(move |_| Workspaces::focus(id))
```

### Эффект наведения

Для эффекта наведения нужно состояние: представление должно знать, находится ли указатель внутри:

```rust
use std::time::Duration;

use amane::{App, Color, LayerWindow, Parent, Rectangle, Service};

struct Hover {
    inside: bool,
}

impl Service for Hover {
    fn new() -> Self {
        Self { inside: false }
    }

    fn interval() -> Duration {
        Duration::from_secs(3600)
    }
}

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    let hover = Hover::read();

    let fill = if hover.inside { Color::from("#45475a") } else { Color::from("#1e1e2e") };

    LayerWindow::new().width(200.0).height(40.0).child(
        Rectangle::new()
            .width(Parent)
            .height(Parent)
            .fill(fill)
            .on_hover(|inside| Hover::write().inside = inside),
    )
}
```

### Изменение указателя

```rust
Rectangle::new()
    .width(100.0)
    .height(30.0)
    .cursor(Pointer)
    .on_click(clicked)
```

Пока указатель над прямоугольником, он выглядит соответствующим образом. Имена импортируются из `amane`: `Default`, `Pointer` (рука), `Text`, `Grab`, `Grabbing`, `Move`, `NotAllowed`, `Wait`, `Crosshair` и стрелки изменения размера `ResizeTop`, `ResizeBottom`, `ResizeLeft`, `ResizeRight`, `ResizeTopLeft`, `ResizeTopRight`, `ResizeBottomLeft`, `ResizeBottomRight`, `ResizeHorizontal`, `ResizeVertical`.

`Text`-курсор и `Text`-виджет имеют одинаковое имя, оба из `amane`. Rust различает их по использованию. Если хотите явно — пишите `Cursor::Text`.

`TextInput` сам показывает текстовый курсор.

### Трансформированные прямоугольники

Ввод следует за трансформацией. Повёрнутая кнопка реагирует только внутри повёрнутой формы, а не внутри прямоугольника, который она занимала до поворота.

### Ввод с клавиатуры

Клавиши приходят окну, а не виджету. Сначала окно должно попросить фокус клавиатуры, затем обрабатывает клавиши через `on_key`:

```rust
use std::process;

use amane::{App, Key, Keyboard, LayerWindow, Text};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    LayerWindow::new()
        .width(300.0)
        .height(40.0)
        .keyboard(Keyboard::Exclusive)
        .on_key(key_pressed)
        .child(Text::new("press escape to quit"))
}

fn key_pressed(key: Key) {
    if key == Key::Escape {
        process::exit(0);
    }
}
```

`std::process` — из стандартной библиотеки Rust.

`Key` — это одно из:

- `Character(char)`: клавиша, которая что-то печатает, уже с учётом Shift, например `Character('A')`;
- `Enter`, `Escape`, `Tab`, `Backspace`, `Space`;
- `Up`, `Down`, `Left`, `Right`, `Home`, `End`;
- `Other`: любая клавиша, для которой у Amane пока нет имени.

### Когда фокус у `TextInput`

Сфокусированный `TextInput` получает клавиши раньше окна, потому что печатать нужно в поле:

- буквы, `Space`, `Backspace`, `Enter`, `Left`, `Right`, `Home` и `End` идут только в поле;
- `Up`, `Down`, `Tab` и `Other` пропускают поле и идут в `on_key` окна. Так стрелки могут перемещать по списку, пока вы печатаете в поиске;
- `Escape` снимает фокус с поля и затем также передаётся окну, которое может захотеть закрыться.

> **Уточнение.** `Enter` забирается полем всегда. Если у поля нет `on_submit`, нажатие просто ничего не делает и до `on_key` окна не доходит. `Up`/`Down`/`Tab`/`Other` не передаются полю, поэтому в тексте не появляются.

### Термины

- **Обработчик (handler):** функция, которую Amane вызывает при событии.
- **Цель (target):** область, которую прямоугольник с обработчиками занимал в последнем кадре.
- **Фокус клавиатуры:** окно, которому композитор отправляет клавиши.
