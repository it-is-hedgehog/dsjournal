# DS Journal — план/факт дневник обучения

PWA для учёта обучения Data Science (School 21). Замена ручного `time_tracking.md`.

## Возможности (v0.1 MVP)
- **Сегодня**: план задач на день (с оценкой минут), таймер сессии (старт/пауза/стоп → форма записи), список сделанного
- **Журнал**: лента по дням, план vs факт (прогресс-бар), часы за 7 дней, % самостоятельности, streak
- **Дедлайны**: список с обратным отсчётом (DSB7 — 16.06, вся программа — 26.07), редактируемый
- **Экспорт**: markdown-запись дня в формате time_tracking.md (копируется в буфер), JSON-бэкап/импорт

Данные — в localStorage телефона. Бэкап делать через "Ещё → Экспорт JSON".

## Деплой
GitHub Pages, как flashcards:
1. Создать репозиторий `dsjournal` на GitHub
2. `git remote add origin https://github.com/it-is-hedgehog/dsjournal.git && git push -u origin main`
3. Settings → Pages → Deploy from branch `main`
4. На iPhone: открыть https://it-is-hedgehog.github.io/dsjournal/ → Поделиться → На экран «Домой»

## Фаза 2 (план)
- Telegram-бот: `/log 45min DSB7 ex05` → коммит в этот репозиторий → PWA подтягивает
- График план/факт за месяц
- Миграция истории из time_tracking.md
