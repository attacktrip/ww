# Telegram Mini App - Гарант-Бот

Веб-интерфейс для Telegram-бота-гаранта, выполненный в стиле iOS 26 с эффектом liquid glass и glassmorphism.

## 🚀 Установка и запуск

### Backend

1. Установите зависимости:
```bash
cd site
pip install -r requirements.txt
```

2. Убедитесь, что файл `bot/db.db` существует и доступен.

3. Запустите backend:
   - **Windows**: Запустите `start_backend.bat` или:
     ```bash
     cd backend
     python app.py
     ```
   - **Linux/Mac**: Запустите `start_backend.sh` или:
     ```bash
     cd backend
     python3 app.py
     ```

Backend будет доступен по адресу `http://localhost:5000`

**Важно**: В файле `frontend/js/app.js` измените `API_BASE` на адрес вашего backend сервера:
```javascript
const API_BASE = 'http://your-server.com:5000'; // Для продакшена используйте HTTPS
```

### Frontend

1. Откройте `frontend/index.html` в браузере или разместите на веб-сервере.

2. Для работы как Telegram Mini App:
   - Разместите файлы на HTTPS-сервере (обязательно!)
   - Настройте бота через @BotFather, указав URL вашего сайта как Web App URL
   - Пример: `https://yourdomain.com/frontend/index.html`

## 📁 Структура проекта

```
site/
├── backend/
│   └── app.py          # Flask API сервер
├── frontend/
│   ├── index.html      # Главная страница
│   ├── css/
│   │   └── style.css   # Стили в стиле iOS 26 / liquid glass
│   └── js/
│       └── app.js      # Логика приложения и Telegram.WebApp интеграция
├── requirements.txt    # Python зависимости
└── README.md          # Документация
```

## 🔌 API Endpoints

- `GET /api/profile` - Получить профиль пользователя
- `GET /api/deals?role=seller|customer` - Получить прошедшие сделки
- `POST /api/start_deal` - Начать сделку
- `POST /api/accept` - Принять сделку
- `POST /api/cancel` - Отменить сделку
- `POST /api/pay` - Оплатить товар
- `POST /api/dispute` - Открыть спор
- `POST /api/review` - Добавить отзыв
- `POST /api/replenish` - Пополнить баланс
- `POST /api/check_payment` - Проверить оплату
- `POST /api/output` - Вывод средств
- `POST /api/update_qiwi` - Обновить номер СБП
- `POST /api/update_login` - Обновить логин
- `POST /api/confirm_receipt` - Подтвердить получение товара
- `POST /api/set_price` - Установить цену товара
- `GET /api/deal_info` - Получить информацию о текущей сделке
- `GET /api/reviews?partner_id=ID` - Получить отзывы
- `GET /api/about` - Информация о боте

## 🎨 Дизайн

Сайт выполнен в стиле:
- **iOS 26** - современный минималистичный дизайн
- **Liquid Glass** - эффект жидкого стекла
- **Glassmorphism** - размытие и прозрачность
- **Неоновая атмосфера** - мягкое свечение и градиенты
- **Черно-белая палитра** с розовым акцентом

## ⚙️ Конфигурация

В файле `backend/app.py` можно изменить:
- `API_BASE` в `frontend/js/app.js` - URL backend сервера
- Порт сервера (по умолчанию 5000)

## 🔐 Безопасность

⚠️ **Важно**: В продакшене необходимо:
1. Добавить валидацию `initData` от Telegram (используйте библиотеку `telegram-web-app` или проверяйте подпись)
2. Использовать HTTPS (обязательно для Telegram Mini Apps)
3. Настроить CORS правильно (ограничить домены)
4. Добавить rate limiting
5. Использовать переменные окружения для конфиденциальных данных
6. Добавить логирование и мониторинг

### Пример валидации initData (для продакшена):

```python
import hmac
import hashlib
import urllib.parse

def validate_init_data(init_data, bot_token):
    """Валидация initData от Telegram"""
    try:
        parsed_data = urllib.parse.parse_qs(init_data)
        hash_value = parsed_data.get('hash', [''])[0]
        
        # Удаляем hash из данных для проверки
        data_check_string = '&'.join(
            f'{k}={v[0]}' for k, v in sorted(parsed_data.items()) 
            if k != 'hash'
        )
        
        secret_key = hmac.new(
            "WebAppData".encode(), 
            bot_token.encode(), 
            hashlib.sha256
        ).digest()
        
        calculated_hash = hmac.new(
            secret_key, 
            data_check_string.encode(), 
            hashlib.sha256
        ).hexdigest()
        
        return calculated_hash == hash_value
    except:
        return False
```

## 📝 Примечания

- Сайт использует ту же базу данных `bot/db.db`, что и бот
- Вся бизнес-логика берется из `bot/functions.py`
- Поведение полностью соответствует боту из `bot/main.py`
- Для тестирования без Telegram можно использовать `test.html` (симуляция Telegram.WebApp)

## 🧪 Тестирование

1. **Локальное тестирование**: 
   - Запустите backend
   - Откройте `frontend/test.html` в браузере (симуляция Telegram)
   - Или откройте `frontend/index.html` напрямую (будет использован тестовый режим)

2. **Тестирование через Telegram**:
   - Разместите файлы на HTTPS сервере
   - Настройте Web App URL в @BotFather
   - Откройте бота и нажмите на кнопку Web App

## 📋 Чеклист функций

- ✅ Главное меню
- ✅ Профиль пользователя
- ✅ Прошедшие сделки (продавец/покупатель)
- ✅ Создание сделки
- ✅ Принятие/отклонение предложений
- ✅ Управление сделкой (оплата, отмена, спор)
- ✅ Пополнение баланса
- ✅ Вывод средств
- ✅ Обновление СБП и логина
- ✅ Отзывы
- ✅ Подтверждение получения товара
- ✅ Установка цены товара

## 🎯 Особенности реализации

1. **Автоматическое создание пользователя** при первом входе
2. **Проверка активных сделок** при загрузке приложения
3. **Модальные окна** вместо стандартных alert/prompt
4. **Адаптивный дизайн** для мобильных устройств
5. **Обработка ошибок** на всех уровнях
6. **Режим тестирования** без Telegram
