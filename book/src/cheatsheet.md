# Шпаргалка

Все основные builder-методы и функции на одной странице. Имена взяты из `amane`; чтобы подключить всё сразу:

```rust
use amane::*;
```

### `App`

| Код | Что делает |
|---|---|
| `App::new()` | начинает сборку оболочки |
| `.window(view)` | добавляет слойное окно; `fn() -> LayerWindow` |
| `.window_per_monitor(view)` | добавляет слойное окно на каждый монитор; `fn(&Monitor) -> LayerWindow` |
| `.normal_window("name", view)` | добавляет обычное окно приложения; `fn() -> Window` |
| `.lock(view)` | задаёт экран блокировки; `fn(&Monitor) -> LayerWindow` |
| `.ipc("name", handler)` | обрабатывает `amane ipc call name`; `fn(&[String]) -> String` |
| `.without_ipc()` | запускает без IPC-сокета, рядом с другой Amane-оболочкой |
| `.font("Inter")` | задаёт семейство шрифта по умолчанию |
| `.scale_factor(1.4)` | масштабирует все окна и виджеты; по умолчанию `1.0` |
| `.run()` | запускает цикл событий |

> **Уточнение.** `.window`, `.window_per_monitor`, `.normal_window`, `.lock` и `.ipc` принимают указатели на функции (`fn`), а не замыкания с захватом. Если нужно состояние, храните его в сервисе.

### `LayerWindow`

| Код | Что делает |
|---|---|
| `LayerWindow::new().width(w).height(h)` | обязательны и должны идти первыми. Число пикселей или `Full`. |
| `.anchor_vertical(Vertical::Top)` | `Top`, `Middle` (по умолчанию), `Bottom` |
| `.anchor_horizontal(Horizontal::Left)` | `Left`, `Middle` (по умолчанию), `Right` |
| `.margin(Margin { top, right, bottom, left })` | отступ от закреплённых краёв в пикселях (`i32`) |
| `.layer(Layer::Top)` | `Background`, `Bottom`, `Top`, `Overlay` (по умолчанию) |
| `.space(Zone::Reserve)` | `Reserve`, `Respect` (по умолчанию), `Ignore` |
| `.keyboard(Keyboard::OnDemand)` | `None` (по умолчанию), `OnDemand`, `Exclusive` |
| `.on_key(handler)` | обработка клавиш; `Fn(Key)` |
| `.visible(bool)` | скрывает или показывает окно, не останавливая его |
| `.input_region(vec![InputArea { x, y, width, height }])` | только эти области принимают мышь |
| `.click_through()` | ни одна часть окна не принимает мышь |
| `.namespace("bar")` | имя для правил композитора; читается один раз при открытии |
| `.child(widget)` | содержимое окна |

### `Window`

| Код | Что делает |
|---|---|
| `Window::new()` | обычное окно приложения |
| `.title("Settings")` | заголовок; по умолчанию `"amane"` |
| `.size(480.0, 320.0)` | размер при открытии; по умолчанию 640 × 480 |
| `.resizable(true)` | разрешает менять размер; **по умолчанию `true`** |
| `.on_key(handler)` | обработка клавиш; `Fn(Key)` |
| `.child(widget)` | содержимое окна |
| `open_window("name", view)` | открывает обычное окно позже; ничего не делает, если имя уже открыто |
| `close_window("name")` | закрывает окно |
| `window_size()` | реальный размер текущего окна, `(f32, f32)` |

> **Исправление.** В оригинале шпаргалки и главе об окнах сказано, что `resizable` по умолчанию `false`. В `src/window.rs` значение по умолчанию — `true`.

### Размеры

| Код | Значение |
|---|---|
| `100.0` | ровно 100 пикселей |
| `Parent` | столько, сколько даёт родитель; несколько `Parent`-детей делят свободное место поровну |
| `Full` | целая сторона монитора; только для размеров `LayerWindow` и `.radius(Full)` |

### `Row`, `Column`, `Stack`

| Код | Что делает |
|---|---|
| `Row::new(children![a, b])` | рядом по горизонтали |
| `Column::new(children![a, b])` | сверху вниз |
| `Stack::new(children![a, b])` | друг на друге; поздние рисуются поверх ранних |
| `.width(size)`, `.height(size)` | необязательны; по умолчанию вычисляются по детям |
| `.gap(12.0)` | промежуток между детьми (`Row`, `Column`) |
| `.justify(SpaceBetween)` | вдоль строки: `Start`, `Center`, `End`, `SpaceBetween`, `SpaceAround`, `SpaceEvenly` |
| `.align(Center)` | поперёк строки: `Start`, `Center`, `End` |
| `children![...]` | упаковывает список разнотипных виджетов |
| `Vec<Box<dyn Widget>>` | список, собранный в цикле через `Box::new(widget)` |

### `Rectangle`

| Код | Что делает |
|---|---|
| `Rectangle::new().width(w).height(h)` | обязательны и идут первыми. Число или `Parent`. |
| `.fill("#1e1e2e")` | hex-цвет: `#rgb`, `#rrggbb`, `#rrggbbaa` |
| `.fill(Color::rgb(30, 30, 46))` | цвет; также `Color::rgba`, `Color::BLACK`, `WHITE`, `RED`, `GREEN`, `BLUE`, `TRANSPARENT` |
| `.fill(Gradient::linear(90.0, [(0.0, "#a"), (1.0, "#b")]))` | линейный градиент; угол как в CSS |
| `.fill(Gradient::radial([(0.0, "#a"), (1.0, "#b")]))` | радиальный градиент |
| `.fill(Image::cover(path))` | изображение; также `contain` и `stretch` |
| `.fill(Mask)` | вырезает отверстие в прямоугольнике вокруг себя |
| `.radius(12.0)` | скругление углов |
| `.radius(Full)` | таблетка или круг |
| `.radius_top_left(Full)` | один угол; также `radius_top_right`, `radius_bottom_right`, `radius_bottom_left` |
| `.border(2.0, "#cdd6f4")` | обводка по внутреннему краю |
| `.opacity(0.5)` | прозрачность прямоугольника и его ребёнка |
| `.shadow(Shadow::drop("#000").blur(12.0).offset(0.0, 4.0).opacity(0.3))` | внешняя тень |
| `.shadow(Shadow::inner("#000").blur(8.0))` | внутренняя тень |
| `.blur(20.0)` | размывает то, что окно нарисовало под прямоугольником |
| `.padding(8.0)` | внутренний отступ; или `Padding { top, right, bottom, left }` |
| `.align_child(Center, Center)` | размещение ребёнка: горизонталь, затем вертикаль |
| `.clip()` | обрезает ребёнка по краям и скруглениям |
| `.child(widget)` | один ребёнок |
| `.rotate(30.0)` | градусы, по часовой стрелке, вокруг центра |
| `.scale(0.5)` | вокруг центра |
| `.translate(20.0, -10.0)` | сдвиг без изменения компоновки |
| `.shader(path)` | WGSL- или GLSL-шейдер поверх заливки |
| `.shader_values(vec![[a, b, c, d]])` | до 16 строк чисел для шейдера |
| `.on_drop(\|files\| ...)` | файлы, перетащенные из другой программы |

### Ввод

Всё это методы `Rectangle`:

| Код | Аргумент обработчика |
|---|---|
| `.on_click(\|button\| ...)` | `Button::Left`, `Right`, `Middle` |
| `.on_hover(\|inside\| ...)` | `true` при входе, `false` при выходе |
| `.on_scroll(\|scroll\| ...)` | `Scroll { x, y }` в строках; положительный `y` — вниз |
| `.on_move(\|point\| ...)` | `Point { x, y }` от левого верхнего угла |
| `.on_drag(\|point\| ...)` | `Point` от нажатия левой кнопкой до отпускания |
| `.cursor(Pointer)` | `Default`, `Pointer`, `Text`, `Grab`, `Grabbing`, `Move`, `NotAllowed`, `Wait`, `Crosshair`, `Resize...` |

### `Text`

| Код | Что делает |
|---|---|
| `Text::new("hello")` | принимает `&str`, `String` или `format!(...)` |
| `.size(20.0)` | по умолчанию 16 |
| `.color(Color::WHITE)` | принимает `Color`; hex оборачивайте в `Color::from("#...")` |
| `.font("JetBrains Mono")` | семейство шрифта |
| `.weight(Weight::Bold)` | или число, например `300` |
| `.elide()` | одна строка с обрезкой и `…` |
| `.wrap()` | столько строк, сколько нужно |
| `.max_lines(2)` | вместе с `wrap` |
| `.tight()` | измеряет контуры букв; для иконочных шрифтов |
| `.height_in(width)` | высота перенесённого текста при данной ширине |

### `TextInput`

| Код | Что делает |
|---|---|
| `TextInput::new("id")` | имя, под которым хранится текст |
| `.placeholder("search")` | показывается, пока поле пустое |
| `.password()` | показывает `•` вместо символов |
| `.focused()` | берёт клавиатуру без клика; **каждый кадр** |
| `.on_change(\|text\| ...)` | после каждого изменения текста |
| `.on_submit(\|text\| ...)` | по Enter |
| `.size(18.0)`, `.color(c)`, `.width(w)` | вид и размер |
| `TextInput::set_text("id", "...")` | заменяет текст, курсор в конец |

> **Исправление.** Парольное поле с `.on_submit(...)` автоматически очищается после Enter. Обработчик получает настоящий текст. Если `on_submit` не задан, Enter ничего не делает.

### `ScrollArea`

| Код | Что делает |
|---|---|
| `ScrollArea::new("id", child)` | прокручивает ребёнка по вертикали; имя сохраняет позицию |
| `.width(size)`, `.height(size)` | по умолчанию `Parent` |

### `Canvas` и фигуры

Для методов `.fill`, `.stroke`, `.cap`, `.opacity` нужен трейт `Shape` в `use`.

| Код | Что делает |
|---|---|
| `Canvas::new().width(w).height(h).shapes(shapes![...])` | рисует фигуры в собственных координатах |
| `Circle::new().center(x, y).radius(r)` | по умолчанию центр холста и максимальный радиус |
| `Arc::new().center(x, y).radius(r).start(deg).sweep(deg)` | 0 — вверх, по часовой стрелке |
| `Line::new().from(x, y).to(x, y)` | прямая |
| `Path::new().move_to(x, y).line_to(x, y)` | также `quad_to`, `cubic_to`, `arc`, `close` |
| `.fill(color)` | заливает внутренность |
| `.stroke(4.0, color)` | рисует контур |
| `.cap(Cap::Round)` | `Butt` (по умолчанию), `Round`, `Square` |
| `.opacity(0.5)` | прозрачность фигуры |

### `Image`

| Код | Что делает |
|---|---|
| `Image::cover(path)` | заполняет, обрезая края |
| `Image::contain(path)` | показывает целиком |
| `Image::stretch(path)` | растягивает на весь прямоугольник |
| `.thumbnail(w, h)` | хранит уменьшенную копию |
| `.blurred(radius)` | размывает один раз при загрузке |
| `Image::loaded(path)` | `true`, когда готов вариант полного размера |

> **Уточнение.** `Image::loaded` не проверяет вариант, созданный через `.thumbnail(...)` или `.blurred(...)`. Подробнее — в главе об изображениях.

### `Animation`

| Код | Что делает |
|---|---|
| `Animation::new(0.0)` | анимированный `f32`; `Animation<Color>` для цветов |
| `.duration(Duration::from_millis(400))` | по умолчанию 200 мс |
| `.easing(Easing::InOut)` | `Out` (по умолчанию), `InOut`, `Linear` |
| `animation.to(target)` | начинает движение из текущего положения |
| `animation.value()` | текущее значение; пока движение идёт, кадры запрашиваются сами |
| `amane::request_frame()` | просит ещё один кадр |

### Сервисы

| Код | Что делает |
|---|---|
| `impl Service for T { fn new() -> Self { ... } }` | единственная обязательная функция |
| `fn interval() -> Duration` | как часто вызывать `update`; по умолчанию 1 секунда |
| `fn update(&mut self) -> bool` | опрос; верните `true`, если что-то изменилось |
| `fn listen()` | заменяет опрос собственным циклом |
| `T::read()` | читает; в представлении подписывает окно на изменения |
| `T::write()` | изменяет и перерисовывает все окна, которые читают сервис; **никогда не вызывайте во время отрисовки** |

### Встроенные сервисы

| Сервис | Читает | Управляет |
|---|---|---|
| `Battery` | `present`, `percent`, `charging`, `full` | |
| `Cpu` | `percent` | |
| `Memory` | `percent`, `used_kib`, `total_kib` | |
| `Brightness` | `present`, `percent` | `set` |
| `Audio` | `volume`, `muted`, `microphone_volume`, `microphone_muted` | `set_volume`, `toggle_mute`, `set_microphone_volume`, `toggle_microphone_mute` |
| `Network` | `connected`, `link`, `ssid`, `strength`, `wifi_enabled`, `connecting`, `access_points` | `scan`, `connect`, `disconnect`, `set_wifi` |
| `Bluetooth` | `available`, `powered`, `scanning`, `devices` | `set_powered`, `start_scan`, `stop_scan`, `pair`, `connect`, `disconnect`, `forget` |
| `Media` | `players`, `active`, `title`, `artist`, `art_url`, `playing`, `position`, `length` | `play_pause`, `next`, `previous` |
| `Notifications` | `list`, `running` | `click`, `invoke`, `dismiss`, `clear` |
| `Workspaces` | `list` | `focus` |
| `Apps` | `list` | `launch` у каждого `DesktopApp` |
| `Palette` | `colors`, `dominant`, `accent`, `background`, `foreground`, `on_accent`, `light` | `open` |
| `Pam` | `active`, `messages`, `prompt`, `result` | `start`, `respond`, `abort` |
| `Lock` | `checking`, `failed` | `start`, `unlock`, `authenticate`, `abort` |

### Команды, файлы, IPC, D-Bus

| Код | Что делает |
|---|---|
| `amane::spawn("cmd")` | запускает команду, не ждёт |
| `amane::output("cmd")` | запускает и возвращает stdout; ждёт завершения |
| `amane::lines("cmd")` | выдаёт строки долгоживущей команды |
| `amane::watch_file(path)` | выдаёт элемент при изменении файла |
| `Bus::system()`, `Bus::session()` | соединение с шиной D-Bus |
| `bus.property(dest, path, iface, name)` | читает свойство |
| `bus.call(dest, path, iface, method, &arguments![...])` | вызывает метод |
| `bus.signals(iface, name)` | поток подходящих сигналов |

### Командная строка

| Команда | Что делает |
|---|---|
| `amane new [folder]` | создаёт стартовую оболочку; без папки спрашивает (или берёт `AMANE_CONFIG`) |
| `amane target [folder]` | показывает или задаёт папку оболочки |
| `amane dev` | пересобирает и перезапускает при каждом сохранении |
| `amane compile` | собирает оболочку для `amane run` |
| `amane compile --restart` | собирает и перезапускает запущенную оболочку |
| `amane run` | запускает собранную оболочку в фоне, никогда не собирает |
| `amane restart` | останавливает запущенную оболочку и запускает собранную |
| `amane clean` | удаляет каталог сборки, сохраняя скомпилированную оболочку; спрашивает |
| `amane clean --yes` | то же без вопроса |
| `amane ipc call <name> [args...]` | вызывает IPC-обработчик |
| `AMANE_FRAMES=1` | печатает строку на кадр для поиска медленной или бесконечной перерисовки |
