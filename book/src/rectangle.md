# Rectangle

`Rectangle` — самый используемый виджет. Это прямоугольник, который можно закрасить, скруглить, обвести, оттенить и трансформировать; внутри него может быть один ребёнок. Кнопки, карточки, фоны и иконки — всё это прямоугольники.

### Скруглённый прямоугольник

```rust
use amane::{App, LayerWindow, Rectangle};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    LayerWindow::new()
        .width(200.0)
        .height(100.0)
        .child(Rectangle::new().width(160.0).height(60.0).radius(12.0).fill("#89b4fa"))
}
```

`width` и `height` обязательны и должны идти первыми, именно в таком порядке. Они принимают число пикселей или `Parent`. Остальное необязательно.

### Заливка

`fill` принимает:

| Заливка | Пример |
|---|---|
| hex-строка | `.fill("#1e1e2e")`, также `"#rgb"` и `"#rrggbbaa"` |
| `Color` | `.fill(Color::BLUE)`, `.fill(Color::rgb(30, 30, 46))`, `.fill(Color::rgba(0, 0, 0, 128))` |
| `Gradient` | `.fill(Gradient::linear(90.0, [(0.0, "#89b4fa"), (1.0, "#f5c2e7")]))` |
| `Image` | `.fill(Image::cover("/path/to/wallpaper.png"))` |
| `Mask` | `.fill(Mask)` — отверстие |

Прямоугольник без заливки невидим. Это полезно для отступов и невидимых областей клика. Если у него есть ребёнок, ребёнок всё равно рисуется.

Опечатка в hex-строке, например `"#12345"`, показывает ярко-розовый цвет вместо падения оболочки, чтобы ошибку было легко заметить.

`Color` содержит константы `BLACK`, `WHITE`, `RED`, `GREEN`, `BLUE` и `TRANSPARENT`. `Color::rgb` и `Color::rgba` — `const`, поэтому тему можно хранить в константах:

```rust
const BACKGROUND: Color = Color::rgb(0x1e, 0x1e, 0x2e);
const FOREGROUND: Color = Color::rgb(0xcd, 0xd6, 0xf4);
```

### Градиенты

```rust
Gradient::linear(90.0, [(0.0, "#89b4fa"), (1.0, "#f5c2e7")])
Gradient::radial([(0.0, "#f9e2af"), (0.5, "#fab387"), (1.0, "#1e1e2e")])
```

Каждая остановка — позиция от 0 до 1 и цвет. Линейный градиент также принимает угол в градусах, как в CSS: `0.0` — снизу вверх, `90.0` — слева направо, `180.0` — сверху вниз.

> **Исправление.** В оригинале сказано, что радиальный градиент идёт «до краёв». На самом деле его радиус доходит до углов прямоугольника. На вытянутом прямоугольнике это заметно: у углов цвет уже конечный, а у середины длинной стороны — ещё нет.

### Углы и рамки

```rust
.radius(12.0)            // скругление 12 пикселей
.radius(Full)            // таблетка или круг, если прямоугольник квадратный
.border(2.0, "#cdd6f4")  // обводка 2 пикселя по внутреннему краю
```

`Full` делает радиус равным половине меньшей стороны, поэтому прямоугольник остаётся идеальной таблеткой при любом размере.

Отдельные углы задаются методами `radius_top_left`, `radius_top_right`, `radius_bottom_right`, `radius_bottom_left`. Незаданные углы остаются прямыми.

> **Уточнение.** Нельзя смешивать `.radius(...)` и отдельные углы в одном прямоугольнике: это паникует. Выбирайте один способ.

### Прозрачность, тень и размытие

```rust
.opacity(0.5)
.shadow(Shadow::drop("#000000").opacity(0.3).blur(12.0).offset(0.0, 4.0))
.shadow(Shadow::inner("#000000").opacity(0.3).blur(8.0))
.blur(20.0)
```

- `opacity` делает прозрачным прямоугольник **и всё внутри него**, от 0 (невидимо) до 1.
- `Shadow::drop` отбрасывает тень за прямоугольником. `Shadow::inner` затеняет внутренний край, как будто прямоугольник вдавлен. `blur` смягчает тень, `offset` сдвигает.
- `blur` размывает то, что было нарисовано за прямоугольником, внутри его формы, для эффекта матового стекла. Он может размыть только то, что нарисовало ваше собственное окно. Окна других приложений ему недоступны.

### Маски

Прямоугольник с заливкой `Mask` ничего не рисует. Вместо этого он вырезает свою форму из ближайшего прямоугольника вокруг:

```rust
use amane::{App, Center, Full, LayerWindow, Mask, Parent, Rectangle};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    LayerWindow::new().width(200.0).height(120.0).child(
        Rectangle::new()
            .width(Parent)
            .height(Parent)
            .radius(24.0)
            .fill("#1e1e2e")
            .align_child(Center, Center)
            .child(Rectangle::new().width(60.0).height(60.0).radius(Full).fill(Mask)),
    )
}
```

В окне появляется круглая дыра, через которую видно обои. У маски может быть `border`, чтобы обвести отверстие.

> **Уточнение.** Маска вырезает отверстие в ближайшем окружающем прямоугольнике, а не в произвольном окне. Если нужна дыра в другом элементе, вложите маску в него.

### Ребёнок

```rust
Rectangle::new()
    .width(Parent)
    .height(Parent)
    .padding(8.0)
    .align_child(Center, Center)
    .clip()
    .child(Text::new("hello"))
```

- `child` помещает один виджет внутрь. Чтобы разместить несколько, дайте ему `Row`, `Column` или `Stack`.
- `padding` и `align_child` размещают ребёнка.
- `clip` скрывает часть ребёнка, выходящую за края, с учётом скруглений. Используйте для списков и индикаторов прогресса.

### Трансформации

```rust
.rotate(30.0)          // градусы, по часовой стрелке
.scale(0.6)            // 1.0 сохраняет размер
.translate(20.0, -30.0)
```

Поворот и масштаб происходят вокруг центра прямоугольника. Трансформации двигают отрисовку и область клика, но не компоновку: прямоугольник по-прежнему занимает исходное место в строке или столбце, соседи не сдвигаются. Поэтому они хороши для анимации и наложений в `Stack`.

Ребёнок движется вместе с прямоугольником.

### Ввод

`on_click`, `on_hover`, `on_scroll`, `on_move`, `on_drag`, `on_drop` и `cursor` описаны в главе «Ввод».

> **Уточнение.** В книге не был описан `on_drop`, хотя метод есть в API. Он получает файлы, перетащенные из другой программы и отпущенные над прямоугольником:
>
> ```rust
> use std::path::PathBuf;
>
> use amane::{App, Center, LayerWindow, Parent, Rectangle, Text};
>
> fn main() {
>     App::new().window(view).run();
> }
>
> fn view() -> LayerWindow {
>     LayerWindow::new().width(400.0).height(200.0).child(
>         Rectangle::new()
>             .width(Parent)
>             .height(Parent)
>             .fill("#1e1e2e")
>             .align_child(Center, Center)
>             .on_drop(|files: Vec<PathBuf>| {
>                 for file in files {
>                     println!("dropped {}", file.display());
>                 }
>             })
>             .child(Text::new("drop files here")),
>     )
> }
> ```
>
> Поддерживается перетаскивание файлов; текст и другие MIME-типы через этот обработчик не передаются.

### Шейдеры

`.shader("path/to/file.wgsl")` рисует GPU-шейдер поверх заливки. Подробнее — в главе «Шейдеры».

### Пример: кнопка

```rust
use amane::{App, Center, Color, LayerWindow, Pointer, Rectangle, Shadow, Text};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    LayerWindow::new().width(200.0).height(80.0).child(button("Save"))
}

fn button(label: &str) -> Rectangle {
    Rectangle::new()
        .width(120.0)
        .height(36.0)
        .radius(8.0)
        .fill("#89b4fa")
        .shadow(Shadow::drop("#000000").opacity(0.25).blur(8.0).offset(0.0, 2.0))
        .align_child(Center, Center)
        .cursor(Pointer)
        .on_click(|_| println!("saved"))
        .child(Text::new(label).color(Color::from("#1e1e2e")))
}
```
