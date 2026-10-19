# Canvas и фигуры

`Canvas` рисует формы, которые не умеет прямоугольник: кольца прогресса, шкалы, графики и собственные иконки.

### Кольцо прогресса

Кольцо на 70%:

```rust
use amane::{App, Arc, Canvas, Cap, LayerWindow, Shape, shapes};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    LayerWindow::new().width(120.0).height(120.0).child(ring(0.7))
}

fn ring(value: f32) -> Canvas {
    Canvas::new().width(120.0).height(120.0).shapes(shapes![
        Arc::new().stroke(10.0, "#45475a"),
        Arc::new().sweep(360.0 * value).stroke(10.0, "#89b4fa").cap(Cap::Round),
    ])
}
```

### Координаты и порядок отрисовки

- `Canvas` — виджет с размером, как прямоугольник. Внутри фигуры размещаются в собственных координатах холста: `(0, 0)` — левый верхний угол, `x` и `y` растут вправо и вниз.
- `shapes!` создаёт список фигур, как `children!` для виджетов. Поздние фигуры рисуются поверх ранних, поэтому синяя дуга лежит на серой дорожке.
- `Arc` без центра и радиуса находится в середине холста, максимального размера, и отступает внутрь на половину толщины линии, чтобы линия осталась внутри.
- `stroke`, `fill`, `cap` и `opacity` приходят из трейта `Shape`, поэтому `Shape` должен быть в `use`, иначе Rust не найдёт методы.

### Фигуры

| Фигура | Builder | По умолчанию |
|---|---|---|
| `Circle` | `.center(x, y)`, `.radius(r)` | центр холста, максимальный размер |
| `Arc` | `.center(x, y)`, `.radius(r)`, `.start(degrees)`, `.sweep(degrees)` | центр, максимальный размер, полный оборот |
| `Line` | `.from(x, y)`, `.to(x, y)` | от `(0, 0)` до `(0, 0)` |
| `Path` | `.move_to`, `.line_to`, `.quad_to`, `.cubic_to`, `.arc`, `.close` | пустой |

Углы `Arc` задаются в градусах. `0` направлен вверх, углы растут по часовой стрелке. Отрицательный `sweep` идёт против часовой. `Path::arc` использует те же углы.

### Заливка, обводка и окончания

У каждой фигуры одни и те же четыре метода:

```rust
.fill("#89b4fa")          // заливает внутренность
.stroke(4.0, "#cdd6f4")   // рисует контур толщиной 4 пикселя
.cap(Cap::Round)          // как выглядят открытые концы: Butt (по умолчанию), Round или Square
.opacity(0.5)
```

Новая фигура ничего не рисует, пока не получит `fill` или `stroke`. Можно задать оба.

### Пути и графики

`Path` — это перо, которое вы перемещаете. Каждый вызов добавляет к одному и тому же пути:

```rust
Path::new()
    .move_to(10.0, 50.0)                      // поднять перо и поставить здесь
    .line_to(50.0, 10.0)                      // прямая
    .quad_to(70.0, 0.0, 90.0, 10.0)           // кривая с одной опорной точкой
    .cubic_to(100.0, 30.0, 100.0, 70.0, 90.0, 90.0)  // кривая с двумя
    .close()                                  // прямая назад к последнему move_to
    .stroke(2.0, "#cdd6f4")
```

Пути удобны для графиков. Строьте их в цикле:

```rust
use amane::{App, Canvas, Cap, LayerWindow, Path, Shape, shapes};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    let history = [0.2, 0.5, 0.4, 0.8, 0.6, 0.9, 0.3];

    LayerWindow::new().width(200.0).height(60.0).child(graph(&history))
}

fn graph(history: &[f32]) -> Canvas {
    let width = 200.0;
    let height = 60.0;

    let step = width / (history.len() - 1) as f32;

    let mut line = Path::new().move_to(0.0, height * (1.0 - history[0]));

    for (index, value) in history.iter().enumerate().skip(1) {
        line = line.line_to(index as f32 * step, height * (1.0 - value));
    }

    Canvas::new()
        .width(width)
        .height(height)
        .shapes(shapes![line.stroke(2.0, "#a6e3a1").cap(Cap::Round)])
}
```

`y` растёт вниз, поэтому значение 1 рисуется в `y = 0`, наверху.

### Пример: шкала

Полукруг со стрелкой:

```rust
use amane::{App, Arc, Canvas, Cap, Circle, LayerWindow, Line, Shape, shapes};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    LayerWindow::new().width(120.0).height(80.0).child(gauge(0.4))
}

fn gauge(value: f32) -> Canvas {
    let angle = f32::to_radians(-90.0 + 180.0 * value);

    let needle_x = 60.0 + f32::sin(angle) * 36.0;
    let needle_y = 70.0 - f32::cos(angle) * 36.0;

    Canvas::new().width(120.0).height(80.0).shapes(shapes![
        Arc::new()
            .center(60.0, 70.0)
            .radius(48.0)
            .start(-90.0)
            .sweep(180.0)
            .stroke(8.0, "#45475a")
            .cap(Cap::Round),
        Arc::new()
            .center(60.0, 70.0)
            .radius(48.0)
            .start(-90.0)
            .sweep(180.0 * value)
            .stroke(8.0, "#f9e2af")
            .cap(Cap::Round),
        Line::new().from(60.0, 70.0).to(needle_x, needle_y).stroke(3.0, "#cdd6f4").cap(Cap::Round),
        Circle::new().center(60.0, 70.0).radius(6.0).fill("#cdd6f4"),
    ])
}
```

### Когда использовать Canvas

- Для прямоугольников, таблеток, кругов и всего с тенью используйте `Rectangle`: он проще, может содержать детей и принимать ввод.
- Для дуг, линий, кривых и графиков — `Canvas`.

`Canvas` не может содержать детей и не принимает ввод сам по себе. Чтобы сделать его кликабельным, поместите в прямоугольник с обработчиком:

```rust
use amane::{App, Button, Canvas, LayerWindow, Rectangle};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    LayerWindow::new().width(120.0).height(120.0).child(
        Rectangle::new()
            .width(120.0)
            .height(120.0)
            .on_click(|_: Button| println!("gauge clicked"))
            .child(Canvas::new().width(120.0).height(120.0)),
    )
}
```
