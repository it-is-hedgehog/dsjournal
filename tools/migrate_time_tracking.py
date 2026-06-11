#!/usr/bin/env python3
# Миграция time_tracking.md → data/journal.json (V1, спека 06.06.2026)
# Данные сверены вручную с time_tracking.md 11.06.2026 — файл со свободной
# структурой, автопарсер ненадёжен; источник истины — этот список.
import json, os
from datetime import datetime, timedelta

# (date, start, net_min, paused_min, solo_min, project, task,
#  diff_s, diff_m, repeat7, status, note)
S = [
    ('2026-05-18', '21:17', 49, 0, 0, 'DSB4 ex03', 'Комментарии к financial.py: json.loads, try/except, docstring',
     2, None, None, 'incomplete', 'Камни: индекс vs срез, split возвращает список'),
    ('2026-05-18', '22:06', 112, 0, 0, 'DSB4 ex04', 'Профилирование cProfile: sleep 64%, requests.get 82%, pstats',
     3, 3, None, 'completed', 'Инсайт: сеть — бутылочное горлышко, не наш код'),
    ('2026-05-19', '11:15', 60, 0, 60, 'Книга Мэтиз', 'Самостоятельное чтение/практика',
     None, None, None, 'completed', None),
    ('2026-05-19', '17:53', 182, 0, 0, 'DSB4 ex05', 'PyTest для financial.py: assert, 3/6 тестов',
     2, 3, None, 'incomplete', None),
    ('2026-05-19', '20:55', 140, 0, 0, 'DSB4 peer-prep', 'Прогон peer-вопросов ex00-ex03',
     None, None, None, 'completed', None),
    ('2026-05-19', '23:15', 60, 0, 60, 'DSB4 peer-review', '2 проверки пройдены',
     None, None, None, 'completed', 'Уроки: спрашивать про графику в задании, исследовать всю структуру данных'),
    ('2026-05-21', '19:36', 134, 0, 0, 'DSB5 ex00', 'timeit: loop vs list comprehension',
     4, 3, None, 'completed', None),
    ('2026-05-22', '19:59', 49, 0, 15, 'DSB5 ex00 финал', 'rename benchmark.py, number=90M, format',
     None, 1, None, 'completed', 'Первые 15 мин самостоятельной работы'),
    ('2026-05-22', '21:14', 138, 0, 0, 'DSB5 ex01', '+map к бенчмарку',
     2, 3, None, 'completed', None),
    ('2026-05-23', '10:31', 111, 0, 0, 'DSB5 ex02', 'filter + sys.argv',
     2, 3, None, 'completed', None),
    ('2026-05-23', '20:08', 74, 0, 0, 'DSB5 ex03', 'reduce («Ридикулус»)',
     2, 2, None, 'completed', 'Студент: «лучше чем вчера» — баланс подтверждён'),
    ('2026-05-24', '12:08', 175, 0, 0, 'DSB5 ex04', 'collections.Counter',
     3, 3, None, 'completed', None),
    ('2026-05-24', '20:24', 103, 0, 0, 'DSB5 ex05', 'Генераторы + memory («ел драники»)',
     3, 4, None, 'completed', None),
    ('2026-05-26', '18:31', 211, 0, 0, 'DSB6 rush', 'class Movies (MovieLens, групповой)',
     3, 4, None, 'completed', 'OOP decay обнаружен: за 3 недели забыл классы'),
    ('2026-05-27', '13:52', 128, 0, 128, 'Книга Мэтиз', 'Глава 6 (словари) — самостоятельно',
     None, None, None, 'completed', 'Нигде не буксовал, усвоено уверенно'),
    ('2026-05-28', '10:54', 254, 7, 0, 'DSB6 тесты', 'PyTest + сборка модуля',
     2, 3, None, 'completed', None),
    ('2026-05-29', '20:25', 210, 0, 0, 'DSB6 бонус', 'DATA_DIR, Jupyter, интеграция тестов команды',
     3.5, 4, None, 'completed', None),
    ('2026-05-31', '13:40', 320, 105, 0, 'DSB6 финал', 'Финальная сборка + 2 peer-review',
     None, 3, None, 'completed', None),
    ('2026-06-02', '11:18', 145, 10, 145, 'Книга Мэтиз', 'Сессия 01–02.06, самостоятельно',
     2, None, None, 'completed', None),
    ('2026-06-03', '19:00', 127, 0, 0, 'DSB7 ex00', 'Философия Pandas + read_csv параметры',
     1, 2.5, 'partial', 'completed', None),
    ('2026-06-04', '17:32', 137, 30, 0, 'DSB7 ex01', 'Подзадачи 1-3: cut, .dt акцессор',
     None, None, None, 'incomplete', 'Перенос: устал, не возобновил (ночью делал PWA)'),
    ('2026-06-05', '18:28', 113, 0, 0, 'DSB7 ex01', 'Подзадачи 4-7: boolean filter',
     2, 3.5, 'no', 'completed', '«Много информации которую нужно запомнить»'),
    ('2026-06-06', '19:39', 146, 0, 0, 'Инфраструктура', 'PWA deploy + Telegram bot + спека Journal',
     3, 4, None, 'completed', '3 инцидента утечки токенов; суббота без учёбы'),
    ('2026-06-07', '20:18', 158, 0, 0, 'DSB7 ex02', 'Preprocessing: dropna, fillna, drop_duplicates',
     3, 4, 'no', 'completed', None),
    ('2026-06-08', '18:27', 165, 67, 0, 'DSB7 ex03', 'groupby (Split-Apply-Combine), agg',
     3, 3.5, 'partial', 'completed', None),
    ('2026-06-10', '20:27', 82, 0, 0, 'DSB7 ex04', 'Enrichment: concat, merge ×4, pivot_table, seed',
     4, 4, 'no', 'completed', '~10 концептов за вечер — антипример плотности; аудит → методика v2.0'),
]

PLAN = [
    {'date': '2026-06-11', 'task': 'Повтор ex01 с нуля (retrieval-first, формат v2.0)', 'planned_minutes': 90,
     'actual_minutes': None, 'status': 'planned'},
    {'date': '2026-06-12', 'task': 'DSB7 ex05 optimizations', 'planned_minutes': 150,
     'actual_minutes': None, 'status': 'planned'},
    {'date': '2026-06-13', 'task': 'Повторы ex02-ex04 с нуля + peer-prep', 'planned_minutes': 150,
     'actual_minutes': None, 'status': 'planned'},
    {'date': '2026-06-15', 'task': 'DSB7 peer-review', 'planned_minutes': 120,
     'actual_minutes': None, 'status': 'planned'},
]

R7 = {None: None}
entries = []
for (date, start, net, paused, solo, project, task, ds, dm, rep, status, note) in S:
    t0 = datetime.strptime(date + ' ' + start, '%Y-%m-%d %H:%M')
    end = (t0 + timedelta(minutes=net + paused)).strftime('%H:%M')
    entries.append({
        'id': date.replace('-', '') + '-' + start.replace(':', ''),
        'date': date, 'start': start, 'end': end,
        'project': project, 'task': task,
        'minutes_total': net, 'minutes_paused': paused,
        'minutes_with_ai': net - solo, 'minutes_solo': solo,
        'source': 'manual' if solo == net and net > 0 else 'claude',
        'self_complexity': ds, 'mentor_complexity': dm,
        'can_repeat_7d': rep, 'notes': note,
        'status': status
    })

data = {
    'version': '1.0',
    'user': 'timos',
    'updated': datetime.now().astimezone().isoformat(timespec='seconds'),
    'entries': entries,
    'plan': PLAN
}
out = os.path.join(os.path.dirname(__file__), '..', 'data', 'journal.json')
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=1)
total = sum(e['minutes_total'] for e in entries)
solo = sum(e['minutes_solo'] for e in entries)
print(f'OK: {len(entries)} entries, {total/60:.1f} ч всего, самост. {solo/total*100:.0f}%')
