# Обзор

| Сервис | Источник | Как получает данные | Как часто |
|---|---|---|---|
| `Battery` | `/sys/class/power_supply` | опрос | 5 секунд |
| `Cpu` | `/proc/stat` | опрос | 2 секунды |
| `Memory` | `/proc/meminfo` | опрос | 2 секунды |
| `Brightness` | `/sys/class/backlight`, logind | опрос | 500 миллисекунд |
| `Audio` | PulseAudio/PipeWire | события сервера | мгновенно |
| `Network` | NetworkManager (D-Bus) | опрос | 1 секунда |
| `Bluetooth` | BlueZ (D-Bus) | опрос | 2 секунды |
| `Media` | MPRIS (D-Bus) | опрос | 1 секунда |
| `Notifications` | D-Bus | сервер, события | мгновенно |
| `Workspaces` | событийный поток композитора | события | мгновенно |
| `Apps` | `.desktop`-файлы | фоновое сканирование | 30 секунд |
| `Palette` | файл изображения | опрос времени изменения | 500 миллисекунд |
| `Pam` | Linux-PAM | диалог в фоне | по запросу |
| `Lock` | PAM + compositor | по запросу | — |

> **Исправление.** В книге не указан интервал `Brightness`. В `src/services/brightness.rs` он равен 500 миллисекундам. Там же, где книга говорит «опрос», сервис использует обычный `listen` с `interval` и `update`; сервисы с пометкой «события» заменяют `listen` собственным циклом.
