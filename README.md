# Фото-охота

Корпоративный интерактив: ведущий задаёт **5 миссий**, гости грузят фото с телефона, хост модерирует, на экране зала — галерея одобренных кадров.

Рабочее приложение: папка **`next-app/`** (Next.js App Router + Postgres / PGlite).

## Быстрый старт

```bash
cd next-app
npm install
env -u DATABASE_URL npm run dev
```

Откройте http://127.0.0.1:3000

## Сценарий

1. **Главная** — создать охоту: название ивента, опционально лого компании, ровно 5 миссий (текст + опциональный референс).
2. **Ведущий** `/host/{id}` — ключ события, QR на вход гостей, модерация approve/reject, ссылка на экран зала.
3. **Гость** `/join/{id}` — вводит ключ (не в query) и имя, грузит фото на миссию.
4. **Экран зала** `/screen/{id}#s=…` — сетка approved; токен только в hash.

## Безопасность MVP

- Создание события требует `EVENT_CREATE_SECRET` (Cursor Secrets) на проде; локально без него ок.
- Токены ведущего / гостя / экрана в `Authorization: Bearer`, не в GET query.
- Гостевой access key 12 символов (+ hash), ввод вручную / `#k=`; QR только `/join/{id}`.
- Метаданные события не отдаются по id без ключа.
- JPEG data-URL после сжатия; квота на событие; durable rate limit в Postgres.

## Publish (Cursor Cloud Apps)

Публикуйте папку `next-app` (есть `cursor-app.json` → Postgres). Локально без `DATABASE_URL` используется PGlite.

## Бренд

Лого: `brand/logo.png` и `next-app/public/brand/logo.png`.  
Instagram в футере: https://www.instagram.com/st.shmidt?mdxt=emx1MzR3dmN0MmZx&utm_source=qr

## Скриншоты

См. `docs/screenshots/` и медиа в Project store `media/photo-hunt-*.png`.
