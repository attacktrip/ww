import os

# Все секреты и настройки через переменные окружения (для Railway и безопасности)
TOKEN = os.environ.get('BOT_TOKEN', '')  # Токен бота — обязательно задайте BOT_TOKEN в Railway!
BOT_USERNAME = os.environ.get('BOT_USERNAME', '')  # Имя пользователя бота без @
admin = int(os.environ.get('ADMIN_CHAT_ID', '0'))  # Chat_id админа 1
admin2 = int(os.environ.get('ADMIN2_CHAT_ID', '0'))  # Chat_id админа 2
chat_bota = os.environ.get('CHAT_BOT_LINK', 'Временно отсутствует')
instruction = os.environ.get('INSTRUCTION_LINK', 'https://telegra.ph/Instrukciya-po-ispolzovaniyu-Telegram-bota-dlya-bezopasnyh-sdelok-02-06')
nicknameadm = os.environ.get('NICKNAME_ADMIN', 'tr2bel')
procent = int(os.environ.get('PROCENT', '5'))
number_qiwi = os.environ.get('NUMBER_QIWI', '+79000000000')
# Путь к БД: на Railway лучше один файл в корне проекта
_db_path = os.environ.get('DATABASE_PATH', 'db.db')
db = os.path.abspath(_db_path) if os.path.isabs(_db_path) else os.path.join(os.path.dirname(os.path.dirname(__file__)), _db_path)
token_qiwi = os.environ.get('TOKEN_QIWI', '')

# Шаблон: {code} подставляется в functions.replenish_balance()
replenish = ('⚠️ Пополнение баланса\n\n'
             '🥝 СБП \n\n'
             '👉 Номер - <b><code>%s</code>\n'
             '👉 Коментарий - <code>{code}</code></b>\n'
             '👉 До 15 000 рублей!') % number_qiwi
