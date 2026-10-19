# Приложения

`Apps` перечисляет установленные программы из `.desktop`-файлов, с именами и иконками. Используйте его для лаунчера.

### Лаунчер

```rust
use amane::{App, Apps, Color, Column, Image, LayerWindow, Pointer, Rectangle, Row, ScrollArea, Service, Text, Widget, children};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    let apps = Apps::read();

    let mut rows: Vec<Box<dyn Widget>> = Vec::new();

    for app in apps.list() {
        let launched = app.clone();

        let icon = Rectangle::new().width(24.0).height(24.0);

        let icon = match app.icon_path() {
            Some(path) => icon.fill(Image::contain(path)),
            None => icon,
        };

        let row = Rectangle::new()
            .width(300.0)
            .height(32.0)
            .fill("#1e1e2e")
            .cursor(Pointer)
            .on_click(move |_| launched.launch())
            .child(Row::new(children![
                icon,
                Text::new(app.name()).size(16.0).color(Color::WHITE),
            ]));

        rows.push(Box::new(row));
    }

    LayerWindow::new()
        .width(300.0)
        .height(500.0)
        .child(ScrollArea::new("apps", Column::new(rows)))
}
```

`App` (оболочка) и `Apps` (сервис) — разные вещи. `app` в цикле — один `DesktopApp`.

### Справочник

`list()` даёт все программы, отсортированные по имени, без помеченных как скрытые или не показываемые в меню. Каждый `DesktopApp` имеет:

| Функция | Что даёт или делает |
|---|---|
| `name()` | имя, например `"Firefox"` |
| `description()` | комментарий или общее название вроде `"Web Browser"`, либо `None` |
| `exec()` | командную строку без заполнителей вида `%f` |
| `icon()` | имя иконки в теме, например `"firefox"`, или `None` |
| `icon_path()` | файл иконки, PNG, если он есть в теме, или `None` |
| `launch()` | запускает программу, не ожидая её |

### Первая загрузка и повторные сканирования

Поиск иконок обходит все темы иконок в системе и занимает несколько секунд. Поэтому `list()` сначала пуст и заполняется после первого сканирования. Окно само перерисуется, когда это произойдёт.

После этого список сканируется заново каждые 30 секунд, поэтому программы, установленные во время работы оболочки, появляются сами.

### Поиск

Фильтруйте список через `TextInput`:

```rust
let query = search.query.to_lowercase();

for app in apps.list() {
    if !app.name().to_lowercase().contains(&query) {
        continue;
    }

    // добавить строку
}
```

> **Уточнение.** Сканирование читает стандартные каталоги XDG `applications` (`~/.local/share`, `/usr/share` и остальные из `XDG_DATA_DIRS`); файл в более раннем каталоге перекрывает одноимённый в более позднем. Учитываются только `Type=Application` без `Hidden=true` и `NoDisplay=true`.
