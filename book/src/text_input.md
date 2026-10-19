# TextInput

`TextInput` — однострочное поле ввода: поиск, пароль, командная строка.

### Поле ввода

```rust
use amane::{App, Keyboard, LayerWindow, Rectangle, TextInput};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    LayerWindow::new()
        .width(300.0)
        .height(40.0)
        .keyboard(Keyboard::OnDemand)
        .child(
            Rectangle::new()
                .width(300.0)
                .height(40.0)
                .fill("#ffffff")
                .padding(8.0)
                .child(
                    TextInput::new("name")
                        .placeholder("your name")
                        .on_submit(|text| println!("hello, {text}")),
                ),
        )
}
```

Кликните поле, напечатайте текст и нажмите Enter.

### Фокус и сохранённый текст

- Окно просит фокус клавиатуры через `.keyboard(Keyboard::OnDemand)`. Без этого композитор не отправляет окну клавиши, и поле нельзя набрать.
- Клик по полю даёт ему фокус. Дальше набранные клавиши идут в него.
- Представление перестраивается каждый кадр, поэтому поле не может хранить свой текст. Amane хранит его под именем, переданным в `TextInput::new`, здесь `"name"`. У каждого поля должно быть своё имя.

> **Уточнение.** Имена полей глобальны для процесса. Два поля с одинаковым именем делят текст, курсор и фокус. То же относится к именам `ScrollArea`.

### Параметры

```rust
TextInput::new("search")
    .size(18.0)                       // размер текста, по умолчанию 16
    .color(Color::WHITE)              // цвет текста, по умолчанию чёрный
    .width(240.0)                     // по умолчанию Parent
    .placeholder("search apps")       // показывается, пока поле пустое
    .password()                       // показывает • вместо текста
    .focused()                        // берёт клавиши сразу при отрисовке, без клика
    .on_change(|text| ...)            // после каждого изменения, с полным новым текстом
    .on_submit(|text| ...)            // по Enter
```

`focused` подходит для лаунчера: открыли — сразу печатаете. Используйте его вместе с `Keyboard::Exclusive` у окна.

> **Исправление.** `.focused()` вызывается при каждой отрисовке поля и каждый раз заново назначает фокус. Если таких полей несколько, фокус будет у последнего; поле с `.focused()` может отобрать фокус у поля, выбранного кликом. Используйте `.focused()` только для одного поля.

Текст длиннее поля обрезается по его краю. Поле однострочное: `wrap` и многострочный ввод не поддерживаются.

### Чтение введённого текста

Поле владеет текстом. Чтобы использовать его в другом месте, скопируйте текст в сервис в `on_change`:

```rust
use std::time::Duration;

use amane::{App, Column, Keyboard, LayerWindow, Service, Text, TextInput, children};

struct Search {
    query: String,
}

impl Service for Search {
    fn new() -> Self {
        Self { query: String::new() }
    }

    fn interval() -> Duration {
        Duration::from_secs(3600)
    }
}

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    let search = Search::read();

    LayerWindow::new()
        .width(300.0)
        .height(80.0)
        .keyboard(Keyboard::Exclusive)
        .child(Column::new(children![
            TextInput::new("search")
                .focused()
                .on_change(|text| Search::write().query = text),
            Text::new(format!("searching for: {}", search.query)),
        ]))
}
```

### Установка текста

`TextInput::set_text` заменяет текст поля по имени и ставит курсор в конец:

```rust
TextInput::set_text("search", "");          // очистить, например после Enter
TextInput::set_text("search", "firefox");   // заполнить
```

> **Уточнение.** `set_text` не вызывает `on_change`. Если вы синхронизируете поле с сервисом, обновляйте сервис вручную.

Для обычного поля Enter сам ничего не очищает — вызовите `set_text` в `on_submit`, если это нужно. Для парольного поля действует особое правило, см. ниже.

### Клавиши

Пока поле в фокусе:

- буквы, `Space`, `Backspace`, `Left`, `Right`, `Home` и `End` редактируют текст;
- `Enter` вызывает `on_submit`;
- `Escape` снимает фокус, а затем клавиша доходит до `on_key` окна;
- `Up`, `Down` и `Tab` пропускают поле и идут прямо в `on_key` окна, чтобы можно было двигаться по списку под поиском.

Удержание клавиши пока не вызывает автоповтор. Выделения текста, копирования и вставки в `TextInput` нет.

### Парольные поля

```rust
TextInput::new("password")
    .placeholder("password")
    .password()
    .on_submit(|password| Lock::unlock(&password))
```

`password` меняет только отрисовку: вместо символов рисуется `•`. Текст, переданный в `on_change` и `on_submit`, — настоящий.

> **Исправление.** Оригинал утверждает, что Enter не очищает поле само по себе. Для парольного поля с `on_submit` это не так: `submit` сначала вызывает обработчик, а затем очищает поле. Обработчик получает настоящий пароль, но после его возврата текст уже пуст. Если вызвать `set_text` внутри обработчика, автоматическая очистка всё равно перезапишет результат.
>
> Если `on_submit` не задан, Enter не очищает поле и вообще ничего не делает: клавиша забирается полем и до окна не доходит.
