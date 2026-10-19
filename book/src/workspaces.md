# Рабочие столы

`Workspaces` перечисляет рабочие столы композитора и умеет переключаться между ними. Поддерживаются **niri**, **Hyprland**, **Sway** и **Mango (MangoWC)**. На других композиторах список остаётся пустым.

Сервис не опрашивает: он следует событийному потоку композитора, поэтому бар обновляется в момент переключения.

На Mango каждый тег — рабочий стол. Несколько тегов могут быть активны на одном мониторе одновременно, и у каждого активного тега на мониторе с фокусом `focused() == true`. Теги сообщают номер, монитор, срочность и число окон; имена тегов Mango через IPC не передаются. `Workspaces::focus(id)` выбирает тег на его мониторе. Mango определяется по переменной `MANGO_INSTANCE_SIGNATURE` и опрашивается напрямую через IPC-сокет, поэтому `mmsg` не требуется.

### Кнопки рабочих столов

```rust
use amane::{App, Color, Full, LayerWindow, Parent, Rectangle, Row, Service, Text, Widget, Workspace, Workspaces};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    let workspaces = Workspaces::read();

    let mut buttons: Vec<Box<dyn Widget>> = Vec::new();

    for workspace in workspaces.list() {
        buttons.push(Box::new(button(workspace)));
    }

    LayerWindow::new().width(Full).height(30.0).child(Row::new(buttons))
}

fn button(workspace: &Workspace) -> Rectangle {
    let fill = if workspace.focused() {
        "#89b4fa"
    } else if workspace.urgent() {
        "#f38ba8"
    } else {
        "#313244"
    };

    let id = workspace.id();

    Rectangle::new()
        .width(30.0)
        .height(Parent)
        .fill(fill)
        .on_click(move |_| Workspaces::focus(id))
        .child(Text::new(workspace.index().to_string()).color(Color::WHITE))
}
```

### Справочник

`list()` даёт все рабочие столы, отсортированные по монитору, затем по позиции на нём. Каждый `Workspace` имеет:

| Функция | Что даёт |
|---|---|
| `id()` | идентификатор для `Workspaces::focus`: id композитора или id, который Amane назначает паре монитор/тег на Mango; `i64`, потому что у именованных рабочих столов Hyprland id отрицательные |
| `index()` | позицию на своём мониторе, начиная с 1; на Hyprland и Sway — номер рабочего стола (0 для стола только с именем) |
| `name()` | имя или `None`, если имя не задано |
| `output()` | монитор, например `"DP-1"`, или `None` |
| `active()` | `true`, когда стол показан на своём мониторе, даже если фокус на другом мониторе; на Mango активных тегов может быть несколько |
| `focused()` | `true` для стола с общим фокусом; на Mango — для каждого активного тега на мониторе с фокусом |
| `urgent()` | `true`, когда окно просит внимания; на Hyprland всегда `false` |
| `windows()` | сколько окон на столе |

`Workspaces::focus(id)` переключает рабочий стол. Выполняется в фоновом потоке и возвращается сразу.

> **Исправление.** В книге не сказано, что рабочие столы `special`/`special:*` Hyprland (scratchpad) пропускаются и в список не попадают. На Mango теги нумеруются с 1 до 31: нулевая маска означает особый рабочий стол, а не обычный тег. Имена тегов Mango через IPC недоступны, поэтому `name()` всегда `None`.

### Бары по мониторам

С `window_per_monitor` показывайте каждому бару только его рабочие столы, сравнивая `output()` с именем монитора:

```rust
fn bar(monitor: &Monitor) -> LayerWindow {
    let workspaces = Workspaces::read();

    for workspace in workspaces.list() {
        if workspace.output() != Some(monitor.name.as_str()) {
            continue;
        }

        // добавить кнопку
    }

    // ...
}
```
