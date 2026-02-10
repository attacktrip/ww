# Инструкция по установке и настройке

## Быстрый старт

### 1. Установка зависимостей

```bash
cd site
pip install -r requirements.txt
```

### 2. Настройка

1. Убедитесь, что файл `bot/db.db` существует
2. Проверьте настройки в `bot/config.py`
3. В файле `frontend/js/app.js` измените `API_BASE`:
   ```javascript
   const API_BASE = 'http://localhost:5000'; // Для локальной разработки
   // или
   const API_BASE = 'https://your-domain.com'; // Для продакшена
   ```

### 3. Запуск

**Windows:**
```bash
start_backend.bat
```

**Linux/Mac:**
```bash
chmod +x start_backend.sh
./start_backend.sh
```

Или вручную:
```bash
cd backend
python app.py
```

### 4. Тестирование

1. Откройте `frontend/test.html` в браузере для тестирования без Telegram
2. Или откройте `frontend/index.html` напрямую (режим тестирования)

### 5. Развертывание в продакшене

1. **Backend:**
   - Разместите на сервере с Python 3.7+
   - Используйте WSGI сервер (gunicorn, uwsgi)
   - Настройте HTTPS
   - Добавьте валидацию initData

2. **Frontend:**
   - Разместите на HTTPS сервере
   - Обновите `API_BASE` в `app.js`
   - Настройте CORS на backend

3. **Telegram Bot:**
   - Откройте @BotFather
   - Выберите вашего бота
   - Команда `/newapp` или `/setmenubutton`
   - Укажите URL: `https://your-domain.com/frontend/index.html`

## Структура файлов

```
site/
├── backend/
│   └── app.py              # Flask API сервер
├── frontend/
│   ├── index.html          # Главная страница
│   ├── test.html           # Страница для тестирования
│   ├── css/
│   │   └── style.css       # Стили
│   └── js/
│       └── app.js          # JavaScript логика
├── requirements.txt        # Python зависимости
├── README.md              # Документация
└── INSTALL.md             # Эта инструкция
```

## Решение проблем

### Backend не запускается
- Проверьте, что Python установлен: `python --version`
- Установите зависимости: `pip install -r requirements.txt`
- Проверьте, что файл `bot/db.db` существует

### Ошибки CORS
- Убедитесь, что backend запущен
- Проверьте `API_BASE` в `app.js`
- В продакшене настройте CORS правильно

### Telegram WebApp не работает
- Убедитесь, что используете HTTPS
- Проверьте настройки бота в @BotFather
- Проверьте консоль браузера на ошибки

### База данных не найдена
- Убедитесь, что `bot/db.db` существует
- Проверьте путь в `bot/config.py`
- Backend должен запускаться из правильной директории

## Безопасность

⚠️ **ВАЖНО для продакшена:**

1. Добавьте валидацию initData от Telegram
2. Используйте HTTPS везде
3. Настройте CORS для конкретных доменов
4. Добавьте rate limiting
5. Используйте переменные окружения для секретов
6. Настройте логирование

## Поддержка

При возникновении проблем проверьте:
1. Логи backend сервера
2. Консоль браузера (F12)
3. Сеть в DevTools (проверьте запросы к API)
