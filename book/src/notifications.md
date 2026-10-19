# Уведомления

`Notifications` делает вашу оболочку сервером уведомлений. Программы отправляют уведомления в Amane так же, как отправляли бы их mako или dunst, а вы решаете, как их показывать.

### Перед началом

Одновременно может работать только один сервер уведомлений. Остановите текущий (mako, dunst, swaync или функцию уведомлений в другом баре) перед запуском оболочки. Если другой демон уже работает, `running()` вернёт `false`, и Amane ничего не получит.

Amane становится демоном при первом чтении `Notifications`, поэтому читайте его в представлении, которое открыто при старте оболочки.

### Список уведомлений

```rust
use amane::{
    App, Column, Horizontal, Layer, LayerWindow, Notification, Notifications, Parent, Rectangle,
    Service, Text, Urgency, Vertical, Widget,
};

fn main() {
    App::new().window(view).run();
}

fn view() -> LayerWindow {
    let notifications = Notifications::read();

    let mut cards: Vec<Box<dyn Widget>> = Vec::new();

    for notification in notifications.list() {
        cards.push(Box::new(card(notification)));
    }

    LayerWindow::new()
        .width(400.0)
        .height(600.0)
        .anchor_vertical(Vertical::Top)
        .anchor_horizontal(Horizontal::Right)
        .layer(Layer::Overlay)
        .visible(!notifications.list().is_empty())
        .child(Column::new(cards).gap(8.0))
}

// клик по уведомлению выполняет действие по умолчанию или закрывает его
fn card(notification: &Notification) -> Rectangle {
    let fill = match notification.urgency() {
        Urgency::Critical => "#f38ba8",
        _ => "#313244",
    };

    let id = notification.id();

    let label = format!("{}: {}", notification.summary(), notification.body());

    Rectangle::new()
        .width(Parent)
        .height(60.0)
        .radius(12.0)
        .fill(fill)
        .padding(12.0)
        .on_click(move |_| Notifications::click(id))
        .child(Text::new(label).elide())
}
```

Окно скрывает себя, пока уведомлений нет, поэтому пустое место не перехватывает клики у окон под ним.

Проверьте:

```sh
notify-send "hello" "from amane"
```

### Чтение уведомлений

`list()` даёт все уведомления, от старых к новым. Каждый `Notification` имеет:

| Функция | Что даёт |
|---|---|
| `id()` | номер, который принимают функции управления |
| `app_name()` | имя отправившей программы |
| `summary()` | однострочный заголовок |
| `body()` | текст; может быть пустым и может содержать простую разметку вроде `<b>` |
| `icon()` | имя иконки вроде `"firefox"`, путь к файлу или пустую строку |
| `image()` | картинку для уведомления, например аватар: путь к файлу, ссылку `file://` или пустую строку |
| `urgency()` | `Urgency::Low`, `Normal` или `Critical` |
| `actions()` | кнопки, запрошенные отправителем, по порядку |
| `has_default_action()` | делает ли что-то клик по самому уведомлению |
| `received()` | когда оно пришло или когда отправитель заменил его, `SystemTime` |

У каждого `Action` есть `key()` — его передают в `invoke`, и `label()` — текст для кнопки.

> **Исправление.** Утверждение «`body()` может содержать разметку вроде `<b>`» относится к протоколу D-Bus, но не к отрисовке Amane: `Text` не разбирает HTML и не поддерживает rich text. Теги будут нарисованы буквально. Если нужен чистый текст, уберите их самостоятельно. Не интерпретируйте тело уведомления как доверенный HTML.

### Клик, закрытие и действия

| Функция | Что делает |
|---|---|
| `Notifications::click(id)` | выполняет действие по умолчанию или закрывает уведомление, если действия нет. Вызывайте при клике по самому уведомлению. |
| `Notifications::invoke(id, key)` | выполняет одно из действий. Для кнопок действий. |
| `Notifications::dismiss(id)` | закрывает уведомление |
| `Notifications::clear()` | закрывает все |

После выполнения действия уведомление закрывается, если отправитель не попросил оставить его.

### Кнопки действий

```rust
for action in notification.actions() {
    let id = notification.id();
    let key = String::from(action.key());

    buttons.push(Box::new(
        Rectangle::new()
            .width(100.0)
            .height(30.0)
            .on_click(move |_| Notifications::invoke(id, &key))
            .child(Text::new(action.label())),
    ));
}
```

Проверьте:

```sh
notify-send -A yes=Yes -A no=No "question" "pick one"
```

### Тайм-ауты

Уведомления остаются, пока их не закроют. Amane игнорирует тайм-аут, который просит отправитель.

Чтобы скрывать всплывающие карточки через несколько секунд, сравнивайте `received()` с текущим временем в сервисе с опросом раз в секунду и показывайте во всплывающем окне только недавние. Полный список храните для центра уведомлений.

> **Уточнение.** `running()` становится `true` только после того, как Amane успешно займёт имя `org.freedesktop.Notifications`. Первые кадры после старта могут дать `false`. Если имя занято, сервис остаётся доступным, но `running()` навсегда `false`.
