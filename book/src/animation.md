# Анимация

Когда панель прыгает со 100 пикселей до 400 за один кадр, это выглядит сломанным. Она должна вырастать за долю секунды. Но представление описывает только один кадр и выполняется только при изменениях. Анимации решают обе проблемы.

В этой главе: плавное движение, выезжающие панели, исчезающие всплывающие окна и плавно смешивающиеся цвета.

### Вырастающий прямоугольник

```rust
use std::time::Duration;

use amane::{Animation, App, Button, LayerWindow, Parent, Rectangle, Service};

struct Panel {
    height: Animation,
}

impl Service for Panel {
    fn new() -> Self {
        Self { height: Animation::new(100.0) }
    }

    fn interval() -> Duration {
        Duration::from_secs(3600)
    }
}

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    let panel = Panel::read();

    LayerWindow::new().width(300.0).height(400.0).child(
        Rectangle::new()
            .width(Parent)
            .height(panel.height.value())
            .fill("#89b4fa")
            .on_click(clicked),
    )
}

fn clicked(_: Button) {
    let mut panel = Panel::write();

    let target = if panel.height.value() < 250.0 { 400.0 } else { 100.0 };

    panel.height.to(target);
}
```

Кликните прямоугольник — он плавно вырастет до 400 пикселей. Ещё клик — снова сожмётся.

### Как анимация продолжает рисовать

`Animation` не хранит постоянно меняющееся число. Она хранит начальное значение, цель и время старта. `value()` вычисляет текущее число из часов.

1. `to(400.0)` задаёт новую цель и запоминает время. Так как это происходит внутри `write()`, окно перерисовывается.
2. Представление вызывает `value()`. Анимация только началась, поэтому возвращается около 100.
3. Вызов `value()` у незавершённой анимации также сообщает Amane «я ещё двигаюсь». После отрисовки Amane просит у композитора следующий кадр.
4. На следующем кадре представление снова выполняется, и `value()` возвращает чуть больше.
5. Когда анимация доходит до цели, `value()` перестаёт просить кадры, и окно засыпает.

Так анимация стоит кадров только пока движется. Оболочка с завершёнными анимациями ничего не рисует.

### Скорость и сглаживание

```rust
Animation::new(0.0)
    .duration(Duration::from_millis(400))
    .easing(Easing::InOut)
```

- `duration` по умолчанию 200 миллисекунд.
- `easing` решает, как меняется скорость:

| Сглаживание | Движение |
|---|---|
| `Out` | начинается быстро, замедляется к концу. По умолчанию и подходит для большинства UI. |
| `InOut` | начинается медленно, ускоряется, снова замедляется. Для больших перемещений. |
| `Linear` | одинаковая скорость всё время |

### Смена направления на полпути

Если вызвать `to`, пока анимация ещё движется, она начнёт заново с текущего положения. Скачка не будет. Можно быстро несколько раз нажать переключатель, и панель плавно развернётся.

Вызов `to` с уже текущей целью ничего не делает.

### Анимация цветов

`Animation` работает с `f32` (по умолчанию) и с `Color`:

```rust
struct Tab {
    fill: Animation<Color>,
}

// в new()
fill: Animation::new(Color::from("#1e1e2e")),

// в обработчике наведения
Tab::write().fill.to(Color::from("#45475a"));

// в представлении
.fill(tab.fill.value())
```

Чтобы анимировать собственный тип, реализуйте трейт `Blend`. `blend(from, to, amount)` возвращает значение на `amount` пути от `from` к `to`, где `amount` меняется от 0 до 1.

### Анимация окон

Всё, что возвращает представление, может происходить из анимации, включая размер и margin окна. Панель, выезжающая сверху:

```rust
use std::time::Duration;

use amane::{
    Animation, App, Horizontal, Layer, LayerWindow, Margin, Parent, Rectangle, Service, Vertical,
};

struct Panel {
    open: bool,
    slide: Animation,
}

impl Service for Panel {
    fn new() -> Self {
        Self { open: true, slide: Animation::new(10.0).duration(Duration::from_millis(300)) }
    }

    fn interval() -> Duration {
        Duration::from_secs(3600)
    }
}

fn main() {
    App::new().ipc("toggle", toggle).window(view).run();
}

fn view() -> LayerWindow {
    let panel = Panel::read();

    let margin = Margin { top: panel.slide.value() as i32, right: 10, bottom: 0, left: 0 };

    LayerWindow::new()
        .width(300.0)
        .height(100.0)
        .anchor_vertical(Vertical::Top)
        .anchor_horizontal(Horizontal::Right)
        .layer(Layer::Top)
        .margin(margin)
        .child(Rectangle::new().width(Parent).height(Parent).fill("#89b4fa"))
}

fn toggle(_: &[String]) -> String {
    let mut panel = Panel::write();

    panel.open = !panel.open;

    let target = if panel.open { 10.0 } else { -110.0 };

    panel.slide.to(target);

    String::from("ok")
}
```

`amane ipc call toggle` сдвигает панель вверх за край экрана (отрицательный margin) и возвращает обратно при следующем вызове.

### Движение, которым управляете вы

Некоторое движение никогда не заканчивается: спиннер, пульсирующая точка. Для него вычисляйте позицию из времени сами и вызывайте `request_frame()`, чтобы попросить следующий кадр:

```rust
use std::sync::LazyLock;
use std::time::Instant;

use amane::{App, Full, LayerWindow, Rectangle};

static START: LazyLock<Instant> = LazyLock::new(Instant::now);

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    let seconds = START.elapsed().as_secs_f32();

    let x = 170.0 + (seconds * 3.0).sin() * 150.0;

    // движение никогда не заканчивается, поэтому всегда нужен следующий кадр
    amane::request_frame();

    LayerWindow::new().width(400.0).height(60.0).child(
        Rectangle::new()
            .width(60.0)
            .height(60.0)
            .radius(Full)
            .fill("#89b4fa")
            .translate(x, 0.0),
    )
}
```

`LazyLock` и `Instant` — из стандартной библиотеки Rust.

Перестаньте вызывать `request_frame()`, когда движение закончилось, чтобы окно могло уснуть. Представление, которое вызывает его всегда, будет перерисовываться с частотой монитора бесконечно.

### Термины

- **Сглаживание (easing):** кривая, отображающая прошедшее время в пройденное расстояние.
- **Frame callback:** сигнал композитора, что он готов к следующему кадру. Amane ждёт его, поэтому анимации идут с частотой обновления монитора.
