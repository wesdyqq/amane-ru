# Компоновка

В баре обычно несколько элементов слева, часы в центре и несколько справа. При изменении ширины бара середина должна растягиваться, а края оставаться того же размера.

Эта глава объясняет, как виджеты получают размер и позицию: `Size`, `Row`, `Column`, `Stack`, отступы и выравнивание.

### Фиксированные и растягивающиеся виджеты

```rust
use amane::{App, Color, Full, LayerWindow, Parent, Rectangle, Row, children};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    LayerWindow::new()
        .width(Full)
        .height(30.0)
        .child(Row::new(children![
            Rectangle::new().width(100.0).height(Parent).fill(Color::RED),
            Rectangle::new().width(Parent).height(Parent).fill(Color::GREEN),
            Rectangle::new().width(100.0).height(Parent).fill(Color::BLUE),
        ]))
}
```

Красный всегда 100 пикселей, синий всегда 100, зелёный забирает остаток.

### Как `Row` размещает детей

Каждый виджет отвечает на один вопрос для каждого направления: какого размера ты хочешь быть? Ответ — `Size`, и есть два вида:

- **число**, например `100.0`: ровно столько пикселей;
- **`Parent`**: «столько, сколько даст родитель».

`Row` вычисляет позиции в два шага:

1. **Измеряет.** Фиксированным детям нужно 100 + 100 = 200 пикселей. Остаток ширины строки свободен.
2. **Размещает.** Дети ставятся друг за другом. Свободное место делится поровну между `Parent`-детьми. Здесь такой ребёнок один, поэтому зелёный получает всё.

Когда бар становится шире, меняется только свободное место, поэтому растёт только зелёный.

> **Уточнение.** Если фиксированные дети уже не помещаются, свободное место не становится отрицательным: `Parent`-дети получают 0. Переполнение может выйти за границы в зависимости от `justify`.

### Списки виджетов

`Row::new` принимает список виджетов разных типов: прямоугольники, текст, другие строки. Список Rust может хранить только один тип, поэтому каждый виджет упаковывается в `Box<dyn Widget>` — «любой виджет». Макрос `children!` делает это сам:

```rust
Row::new(children![
    Rectangle::new().width(100.0).height(30.0),
    Text::new("hello"),
])
```

Если список строится в цикле, упаковывайте вручную:

```rust
use amane::{App, Column, LayerWindow, Text, Widget};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    let mut rows: Vec<Box<dyn Widget>> = Vec::new();

    for number in 1..=5 {
        rows.push(Box::new(Text::new(format!("row {number}"))));
    }

    LayerWindow::new().width(200.0).height(200.0).child(Column::new(rows))
}
```

### `Row`, `Column` и `Stack`

| Виджет | Размещение детей |
|---|---|
| `Row` | рядом, слева направо |
| `Column` | друг над другом, сверху вниз |
| `Stack` | все в одном месте; поздние рисуются поверх ранних |

`Row` и `Column` работают одинаково, только в разных направлениях. Всё сказанное о `Row` относится и к `Column`, с заменой ширины на высоту.

`Stack` нужен для наложения, например бейджа на карточке. Каждый ребёнок начинает с левого верхнего угла стека. Сдвинуть его можно через `translate`:

```rust
use amane::{App, Center, Color, Full, LayerWindow, Rectangle, Stack, Text, children};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    let card = Rectangle::new()
        .width(200.0)
        .height(120.0)
        .radius(16.0)
        .fill("#1e1e2e");

    let badge = Rectangle::new()
        .width(28.0)
        .height(28.0)
        .radius(Full)
        .fill("#f38ba8")
        .translate(186.0, -14.0)
        .align_child(Center, Center)
        .child(Text::new("3").size(14.0).color(Color::BLACK));

    LayerWindow::new()
        .width(260.0)
        .height(180.0)
        .child(Stack::new(children![card, badge]))
}
```

### Какого размера `Row`

Если не задать размер `Row`, он измеряет детей:

- ширина — сумма ширин детей плюс промежутки;
- высота — высота самого высокого ребёнка;
- если хотя бы один ребёнок в этом направлении `Parent`, то и `Row` становится `Parent` в этом направлении.

Чтобы задать размер явно, используйте `.width(...)` и `.height(...)`. Для `Row`, `Column` и `Stack` оба метода необязательны.

### Промежутки

```rust
Row::new(children![a, b, c]).gap(12.0)
```

`gap` добавляет 12 пикселей между каждой парой детей. Перед первым и после последнего промежутка нет.

### Распределение детей вдоль строки

Когда дети не заполняют строку, `justify` решает, куда уйдёт остаток:

```rust
Row::new(children![a, b, c]).width(Parent).justify(SpaceBetween)
```

| `justify` | Эффект |
|---|---|
| `Start` | прижаты к началу. По умолчанию. |
| `Center` | по центру |
| `End` | прижаты к концу |
| `SpaceBetween` | первый в начале, последний в конце, равные промежутки между |
| `SpaceAround` | равное место вокруг каждого ребёнка |
| `SpaceEvenly` | равные промежутки между детьми и краями |

`justify` имеет значение только при наличии свободного места. `Parent`-ребёнок забирает всё, и распределять нечего.

### Выравнивание поперёк строки

`align` решает, где каждый ребёнок стоит в другом направлении. Для `Row` это вертикаль:

```rust
Row::new(children![a, b, c]).height(40.0).align(Center)
```

Принимает `Start`, `Center`, `End`. По умолчанию `Start`: верх строки или левый край столбца.

### Padding и размещение одного ребёнка

`Rectangle` содержит одного ребёнка. `padding` оставляет место между краями и ребёнком, а `align_child` размещает ребёнка внутри этого пространства:

```rust
use amane::{App, Center, Color, End, LayerWindow, Padding, Parent, Rectangle};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    LayerWindow::new().width(300.0).height(100.0).child(
        Rectangle::new()
            .width(Parent)
            .height(Parent)
            .fill(Color::BLACK)
            .padding(Padding { top: 8.0, right: 16.0, bottom: 8.0, left: 16.0 })
            .align_child(End, Center)
            .child(Rectangle::new().width(40.0).height(40.0).fill(Color::RED)),
    )
}
```

- `padding(16.0)` задаёт одинаковый отступ со всех сторон. `Padding { ... }` задаёт каждую сторону отдельно.
- `align_child(horizontal, vertical)` принимает `Start`, `Center`, `End` для каждого направления. По умолчанию — левый верхний угол.

### Пример: бар из трёх частей

Слева, в центре и справа, причём центр всегда находится посередине бара:

```rust
use amane::{
    Align, App, Center, Color, End, Full, LayerWindow, Parent, Rectangle, Row, Start, Text,
    children,
};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    LayerWindow::new()
        .width(Full)
        .height(30.0)
        .child(Row::new(children![
            section(Text::new("workspaces").color(Color::WHITE), Start),
            section(Text::new("12:00").color(Color::WHITE), Center),
            section(Text::new("battery").color(Color::WHITE), End),
        ]))
}

fn section(content: Text, align: impl Into<Align>) -> Rectangle {
    Rectangle::new()
        .width(Parent)
        .height(Parent)
        .fill("#1e1e2e")
        .align_child(align, Center)
        .child(content)
}
```

Все три секции имеют размер `Parent`, поэтому каждая получает ровно треть бара. Средняя треть всегда центрирована, какой бы длины ни был текст слева и справа.

### Термины

- **Size:** фиксированное число пикселей или `Parent`.
- **Justify:** размещение вдоль направления роста строки или столбца.
- **Align:** размещение поперёк этого направления.
- **Главная и поперечная оси:** обычные названия для «вдоль» и «поперёк».
