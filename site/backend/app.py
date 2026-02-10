from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sys
import os
import sqlite3
import threading
import secrets
import time



BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))

sys.path.insert(0, BASE_DIR)

BOT_DIR = os.path.join(BASE_DIR, "bot")
FRONTEND_DIR = os.path.join(BASE_DIR, "site", "frontend")

from bot.main import bot
from bot import functions as func
from bot.config import db, admin, admin2, nicknameadm, chat_bota, instruction, procent, number_qiwi, replenish, BOT_USERNAME

app = Flask(__name__)
@app.route("/")
def landing():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/app")
def webapp():
    return send_from_directory(FRONTEND_DIR, "app.html")


@app.route("/<path:path>")
def frontend_static(path):
    return send_from_directory(FRONTEND_DIR, path)

# Настройка CORS для работы с Telegram Mini Apps
CORS(app, resources={
    r"/api/*": {
        "origins": "*",  # В продакшене укажите конкретные домены
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "X-Telegram-Init-Data"]
    }
})

# Вспомогательная функция для проверки пользователя Telegram
def get_telegram_user():
    """Получает данные пользователя из Telegram.WebApp.initData"""
    # Заголовок может обрезаться прокси; дублируем в query (GET) и body (POST)
    init_data = request.headers.get('X-Telegram-Init-Data') or request.args.get('init_data') or ''
    if not init_data and request.is_json:
        data = request.get_json(silent=True)
        if data and data.get('initData'):
            init_data = data['initData']
    
    if not init_data:
        return None
    
    import urllib.parse
    import json
    # initData от Telegram — query string (user=...&auth_date=...&hash=...)
    params = urllib.parse.parse_qs(init_data)
    user_str = params.get('user', [''])[0]
    if not user_str:
        return None
    try:
        return json.loads(user_str)
    except (json.JSONDecodeError, TypeError):
        return None

def get_user_id():
    """Получает user_id из Telegram"""
    user = get_telegram_user()
    if user:
        user_id = user.get('id')
        if user_id:
            return int(user_id)
    return None

@app.route('/api/profile', methods=['GET'])
def api_profile():
    """Получить профиль пользователя"""
    try:
        user_id = get_user_id()
        if not user_id:
            return jsonify({'error': 'Не авторизован'}), 401
        
        # Проверяем бан
        ban_info = func.check_ban(user_id)
        if ban_info and ban_info[0] == '1':
            return jsonify({'error': 'Вы заблокированы'}), 403
        
        # Проверяем существование пользователя
        info = func.profile(user_id)
        if not info:
            # Автоматически создаем пользователя
            user = get_telegram_user()
            username = user.get('username', '') if user else ''
            # Если username отсутствует, используем first_name или создаем временный
            if not username:
                if user and user.get('first_name'):
                    username = user.get('first_name', 'user_' + str(user_id))
                else:
                    username = 'user_' + str(user_id)
            func.first_join(user_id, username)
            info = func.profile(user_id)
        
        if not info:
            return jsonify({'error': 'Не удалось получить профиль'}), 500
        
        return jsonify({
            'id': info[0],
            'offers': info[1],
            'balance': info[2],
            'qiwi': info[3],
            'ban': info[4],
            'nick': info[5] if len(info) > 5 else ''
        })
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500

@app.route('/api/deals', methods=['GET'])
def api_deals():
    """Получить прошедшие сделки"""
    user_id = get_user_id()
    if not user_id:
        return jsonify({'error': 'Не авторизован'}), 401
    
    role = request.args.get('role')  # 'seller' или 'customer'
    
    if role == 'seller':
        deals = func.last_offers_seller(user_id)
    elif role == 'customer':
        deals = func.last_offers_customer(user_id)
    else:
        return jsonify({'error': 'Неверная роль'}), 400
    
    return jsonify({'deals': deals})

@app.route('/api/start_deal', methods=['POST'])
def api_start_deal():
    """Начать сделку"""
    user_id = get_user_id()
    if not user_id:
        return jsonify({'error': 'Не авторизован'}), 401
    
    data = request.json
    role = data.get('role')  # 'seller' или 'customer'
    username = data.get('username')  # логин пользователя без @
    
    if not role or not username:
        return jsonify({'error': 'Неверные данные'}), 400
    
    # Проверяем блокировку
    block_info = func.search_block(user_id)
    if block_info:
        return jsonify({'error': 'Вы не можете взаимодействовать с ботом, пока не завершите сделку!'}), 400
    
    # Проверяем, что не пытаемся провести сделку с самим собой
    user_info = func.profile(user_id)
    telegram_user = get_telegram_user()
    telegram_username = telegram_user.get('username', '') if telegram_user else ''
    
    if str(username) == telegram_username or (user_info and user_info[5] != telegram_username):
        return jsonify({'error': 'С самим собой провести сделку невозможно, или вы изменили ник. Если это так, то Вам необходимо его обновить в профиле.'}), 400
    
    # Ищем пользователя
    info = func.search(username)
    if info is None:
        return jsonify({'error': 'Пользователь не найден, пожалуйста, убедитесь что он уже взаимодействовал с ботом!'}), 404
    
    # Проверяем, не занят ли пользователь
    deal_check = func.check_deal(username)
    if deal_check is not None:
        return jsonify({'error': 'Человек сейчас проводит сделку, и не может начать одновременно вторую.'}), 400
    
    # Создаем временную сделку
    if role == 'seller':
        func.deal(user_id, info[0])
    else:
        func.deal(info[0], user_id)
    
    return jsonify({
        'success': True,
        'partner': {
            'id': info[0],
            'nickname': info[5] if len(info) > 5 else '',
            'offers': info[1]
        },
        'role': role
    })

@app.route('/api/accept', methods=['POST'])
def api_accept():
    """Принять сделку"""
    user_id = get_user_id()
    if not user_id:
        return jsonify({'error': 'Не авторизован'}), 401
    
    data = request.json
    role = data.get('role')  # 'seller' или 'customer'
    
    try:
        if role == 'customer':
            func.accept_customer(user_id)
            info = func.info_offers_customer(user_id)
        else:
            func.accept_seller(user_id)
            info = func.info_offers_seller(user_id)
        
        if not info:
            return jsonify({'error': 'Сделка не найдена'}), 404
        
        info_c = func.profile(info[1])
        info_s = func.profile(info[0])
        sum_offer = info[2] if info[2] else '0'
        status = info[4]
        
        return jsonify({
            'success': True,
            'deal': {
                'id': info[3],
                'customer_id': info_c[0],
                'customer_nick': info_c[5] if len(info_c) > 5 else '',
                'seller_id': info_s[0],
                'seller_nick': info_s[5] if len(info_s) > 5 else '',
                'sum': sum_offer,
                'status': status
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/cancel', methods=['POST'])
def api_cancel():
    """Отменить сделку"""
    user_id = get_user_id()
    if not user_id:
        return jsonify({'error': 'Не авторизован'}), 401
    
    data = request.json
    action = data.get('action')  # 'proposal', 'deal', 'confirm'
    role = data.get('role')  # 'seller' или 'customer'
    
    try:
        if action == 'proposal':
            # Отозвать предложение
            if role == 'customer':
                result = func.canel_open_offer(user_id)
            else:
                result = func.canel_open_offer_seller(user_id)
            
            if result[0] == 'OK':
                return jsonify({'success': True, 'message': 'Предложение отозвано'})
            else:
                return jsonify({'error': 'Вы не можете отозвать предложение когда вторая сторона его уже приняла.'}), 400
        
        elif action == 'deal':
            # Отменить сделку (запрос на отмену)
            if role == 'customer':
                info = func.info_offers_customer(user_id)
                if info[4] == 'open':
                    return jsonify({'success': True, 'message': 'Запрос на отмену отправлен продавцу', 'needs_confirmation': True})
                else:
                    return jsonify({'error': 'Сделка уже завершена или над ней проходит спор.'}), 400
            else:
                info = func.info_offers_seller(user_id)
                if info[4] == 'open':
                    return jsonify({'success': True, 'message': 'Запрос на отмену отправлен покупателю', 'needs_confirmation': True})
                else:
                    return jsonify({'error': 'Сделка уже завершена или над ней проходит спор.'}), 400
        
        elif action == 'confirm':
            # Подтвердить отмену
            if role == 'seller':
                info = func.info_offers_seller(user_id)
                if info[4] == 'open':
                    func.yes_canel_seller2(user_id)
                    return jsonify({'success': True, 'message': 'Сделка успешно отменена'})
                else:
                    return jsonify({'error': 'Сделка уже завершена или над ней проходит спор.'}), 400
            else:
                info = func.info_offers_customer(user_id)
                if info[4] == 'open':
                    func.yes_canel_customer2(user_id)
                    return jsonify({'success': True, 'message': 'Сделка успешно отменена'})
                else:
                    return jsonify({'error': 'Сделка уже завершена или над ней проходит спор.'}), 400
        
        else:
            return jsonify({'error': 'Неверное действие'}), 400
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/pay', methods=['POST'])
def api_pay():
    """Оплатить товар"""
    user_id = get_user_id()
    if not user_id:
        return jsonify({'error': 'Не авторизован'}), 401
    
    try:
        info = func.profile(user_id)
        offer = func.info_offers_customer(user_id)
        
        if not offer:
            return jsonify({'error': 'Сделка не найдена'}), 404
        
        if offer[2] is None:
            return jsonify({'error': 'Продавец не указал сумму!'}), 400
        
        if offer[4] == 'success':
            return jsonify({'error': 'Вы уже оплатили товар, продавец обязан вам его передать. Если продавец отказывается передать товар, откройте спор.'}), 400
        
        if float(info[2]) < float(offer[2]):
            return jsonify({
                'error': 'Недостаточно средств',
                'user_balance': info[2],
                'required': offer[2]
            }), 400
        
        bal = float(info[2]) - float(offer[2])
        func.success(user_id, bal)
        
        return jsonify({'success': True, 'message': 'Товар был успешно оплачен'})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/dispute', methods=['POST'])
def api_dispute():
    """Открыть спор"""
    user_id = get_user_id()
    if not user_id:
        return jsonify({'error': 'Не авторизован'}), 401
    
    data = request.json
    role = data.get('role')  # 'seller' или 'customer'
    
    try:
        if role == 'customer':
            info = func.info_offers_customer(user_id)
            if not info:
                return jsonify({'error': 'Сделка не найдена'}), 404
            
            if info[4] == 'dont_open':
                return jsonify({'error': 'Сделка ещё не открыта!'}), 400
            if info[4] == 'open':
                return jsonify({'error': f'Товар ещё не был вам передан. Если вы считаете что продавец хочет вас обмануть, отмените сделку и напишите администратору @{nicknameadm}.'}), 400
            if info[4] == 'dispute':
                return jsonify({'error': 'Спор уже начат.'}), 400
            
            func.dispute_customer(user_id)
            return jsonify({'success': True, 'message': f'Спор начат, продавец оповещён. Если долго ничего не происходит, напишите администратору @{nicknameadm}.'})
        
        else:  # seller
            info = func.info_offers_seller(user_id)
            if not info:
                return jsonify({'error': 'Сделка не найдена'}), 404
            
            if info[4] == 'dont_open':
                return jsonify({'error': 'Сделка ещё не открыта!'}), 400
            if info[4] == 'open':
                return jsonify({'error': f'Товар ещё не был вам передан. Если вы считаете что продавец хочет вам скамнуть, отмените сделку и напишите администратору @{nicknameadm}.'}), 400
            if info[4] == 'dispute':
                return jsonify({'error': 'Спор уже начат.'}), 400
            
            func.dispute_customer(user_id)  # В коде бота используется та же функция
            return jsonify({'success': True, 'message': f'Спор начат, покупатель оповещён. Если долго ничего не происходит, напишите администратору @{nicknameadm}.'})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/review', methods=['POST'])
def api_review():
    """Добавить отзыв"""
    user_id = get_user_id()
    if not user_id:
        return jsonify({'error': 'Не авторизован'}), 401
    
    data = request.json
    review_text = data.get('review')
    action = data.get('action')  # 'add' или 'skip'
    
    try:
        if action == 'skip':
            info = func.info_offers_customer(user_id)
            func.close_offer(user_id)
            return jsonify({'success': True, 'message': 'Отзыв пропущен'})
        
        if not review_text:
            return jsonify({'error': 'Текст отзыва обязателен'}), 400
        
        info = func.info_offer_customer(user_id)
        if info[0] != 'review':
            return jsonify({'error': 'Вы не можете оставить отзыв, так как не завершили сделку.'}), 400
        
        deal_info = func.info_offers_customer(user_id)
        func.add_review(deal_info[0], deal_info[2], user_id, review_text)
        func.close_offer(user_id)
        
        return jsonify({'success': True, 'message': 'Отзыв успешно оставлен'})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/replenish', methods=['POST'])
def api_replenish():
    """Пополнить баланс"""
    user_id = get_user_id()
    if not user_id:
        return jsonify({'error': 'Не авторизован'}), 401
    
    try:
        msg, code = func.replenish_balance(user_id)
        return jsonify({
            'success': True,
            'message': msg,
            'code': code,
            'number': number_qiwi
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/check_payment', methods=['POST'])
def api_check_payment():
    """Проверить оплату"""
    user_id = get_user_id()
    if not user_id:
        return jsonify({'error': 'Не авторизован'}), 401
    
    try:
        check = func.check_payment(user_id)
        if check is None:
            return jsonify({'error': 'Оплата не найдена'}), 404
        
        return jsonify({
            'success': True,
            'amount': check,
            'message': f'Успешное пополнение\nСумма - {check} рублей'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/cancel_payment', methods=['POST'])
def api_cancel_payment():
    """Отменить пополнение"""
    user_id = get_user_id()
    if not user_id:
        return jsonify({'error': 'Не авторизован'}), 401
    
    try:
        func.canel_payment(user_id)
        return jsonify({'success': True, 'message': 'Пополнение отменено'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/output', methods=['POST'])
def api_output():
    """Вывод средств"""
    user_id = get_user_id()
    if not user_id:
        return jsonify({'error': 'Не авторизован'}), 401
    
    data = request.json
    money = data.get('amount')
    
    try:
        info = func.profile(user_id)
        balance = info[2]
        
        if float(money) > float(balance):
            return jsonify({'error': 'На балансе недостаточно средств для вывода!'}), 400
        
        if float(money) < 10:
            return jsonify({'error': 'Минимальная сумма для вывода 10 рублей'}), 400
        
        commission = float(money) * float(procent) / 100
        result = float(money) - float(commission)
        
        func.output_qiwi(user_id, balance, money)
        
        return jsonify({
            'success': True,
            'message': 'Запрос на вывод успешно отправлен!',
            'amount': result,
            'commission': commission
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/update_qiwi', methods=['POST'])
def api_update_qiwi():
    """Обновить номер СБП"""
    user_id = get_user_id()
    if not user_id:
        return jsonify({'error': 'Не авторизован'}), 401
    
    data = request.json
    qiwi_num = data.get('qiwi')
    
    if not qiwi_num or (not qiwi_num.startswith('+7') and not qiwi_num.startswith('+3') and not qiwi_num.startswith('+9')):
        return jsonify({'error': 'Неправильный формат! Используйте формат +70000000000'}), 400
    
    try:
        func.write_qiwi(user_id, qiwi_num)
        return jsonify({'success': True, 'message': 'СБП установлен'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/update_login', methods=['POST'])
def api_update_login():
    """Обновить логин"""
    user_id = get_user_id()
    if not user_id:
        return jsonify({'error': 'Не авторизован'}), 401
    
    user = get_telegram_user()
    username = user.get('username', '') if user else ''
    
    try:
        result = func.up_login(username, user_id)
        if result is None:
            return jsonify({'success': True, 'message': 'Ваш логин обновлён!'})
        else:
            return jsonify({'error': 'Логин, который вы хотите занять уже получил другой пользователь, или вы его уже заняли!'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/confirm_receipt', methods=['POST'])
def api_confirm_receipt():
    """Подтвердить получение товара"""
    user_id = get_user_id()
    if not user_id:
        return jsonify({'error': 'Не авторизован'}), 401
    
    data = request.json
    confirm = data.get('confirm')  # True или False
    
    try:
        info = func.info_offer_customer(user_id)
        if info[0] != 'success':
            return jsonify({'error': 'Вы не оплатили сделку, или над ней ведётся спор.'}), 400
        
        if not confirm:
            return jsonify({'success': True, 'message': 'Вы подтвердили, что товар не получен.'})
        
        # Подтверждаем получение
        deal_info = func.info_offers_customer(user_id)
        if deal_info[4] != 'success':
            return jsonify({'error': 'Вы не оплатили сделку, или над ней ведётся спор.'}), 400
        
        info1 = func.profile(deal_info[0])
        info2 = func.profile(deal_info[1])
        func.ok(user_id, deal_info[0], deal_info[2], deal_info[3], info1[2], info1[5], info2[5], info1[1], info2[1])
        
        return jsonify({
            'success': True,
            'message': 'Сделка успешно завершена!',
            'can_review': True
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/set_price', methods=['POST'])
def api_set_price():
    """Установить цену товара"""
    user_id = get_user_id()
    if not user_id:
        return jsonify({'error': 'Не авторизован'}), 401
    
    data = request.json
    price = data.get('price')
    
    try:
        info = func.info_offers_seller(user_id)
        if not info:
            return jsonify({'error': 'Сделка не найдена'}), 404
        
        if info[2] is not None:
            return jsonify({'error': 'Вы уже ввели сумму товара, и не можете её редактировать!'}), 400
        
        func.edit_price(price, user_id)
        
        return jsonify({'success': True, 'message': 'Сумма сделки успешно изменена'})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/deal_info', methods=['GET'])
def api_deal_info():
    """Получить информацию о текущей сделке"""
    user_id = get_user_id()
    if not user_id:
        return jsonify({'error': 'Не авторизован'}), 401
    
    try:
        # Проверяем как покупатель
        info = func.info_offers_customer(user_id)
        if info:
            info_c = func.profile(info[1])
            info_s = func.profile(info[0])
            sum_offer = info[2] if info[2] else '0'
            return jsonify({
                'role': 'customer',
                'deal': {
                    'id': info[3] if len(info) > 3 else None,
                    'customer_id': info_c[0],
                    'customer_nick': info_c[5] if len(info_c) > 5 else '',
                    'seller_id': info_s[0],
                    'seller_nick': info_s[5] if len(info_s) > 5 else '',
                    'sum': sum_offer,
                    'status': info[4] if len(info) > 4 else 'dont_open'
                }
            })
        
        # Проверяем как продавец
        info = func.info_offers_seller(user_id)
        if info:
            info_c = func.profile(info[1])
            info_s = func.profile(info[0])
            sum_offer = info[2] if info[2] else '0'
            return jsonify({
                'role': 'seller',
                'deal': {
                    'id': info[3] if len(info) > 3 else None,
                    'customer_id': info_c[0],
                    'customer_nick': info_c[5] if len(info_c) > 5 else '',
                    'seller_id': info_s[0],
                    'seller_nick': info_s[5] if len(info_s) > 5 else '',
                    'sum': sum_offer,
                    'status': info[4] if len(info) > 4 else 'dont_open'
                }
            })
        
        # Проверяем предложения о сделке
        info_deal_customer = func.info_deal_customer(user_id)
        if info_deal_customer:
            partner_id = info_deal_customer[0]
            partner_info = func.profile(partner_id)
            return jsonify({
                'proposal': True,
                'role': 'customer',
                'partner': {
                    'id': partner_info[0],
                    'nickname': partner_info[5] if len(partner_info) > 5 else '',
                    'offers': partner_info[1]
                }
            })
        
        info_deal_seller = func.info_deal_seller(user_id)
        if info_deal_seller:
            partner_id = info_deal_seller[0]
            partner_info = func.profile(partner_id)
            return jsonify({
                'proposal': True,
                'role': 'seller',
                'partner': {
                    'id': partner_info[0],
                    'nickname': partner_info[5] if len(partner_info) > 5 else '',
                    'offers': partner_info[1]
                }
            })
        
        return jsonify({'deal': None})
    
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500

@app.route('/api/reviews', methods=['GET'])
def api_reviews():
    """Получить отзывы о пользователе"""
    user_id = get_user_id()
    if not user_id:
        return jsonify({'error': 'Не авторизован'}), 401
    
    partner_id = request.args.get('partner_id')
    if not partner_id:
        # Получаем из текущей сделки
        info = func.info_offers_customer(user_id)
        if info:
            partner_id = info[0]
        else:
            info = func.info_offers_seller(user_id)
            if info:
                partner_id = info[1]
    
    if not partner_id:
        return jsonify({'error': 'Не указан партнер'}), 400
    
    try:
        reviews_text = func.reviews(partner_id)
        return jsonify({'reviews': reviews_text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/about', methods=['GET'])
def api_about():
    """Информация о боте"""
    return jsonify({
        'admin': f'@{nicknameadm}',
        'chat': chat_bota,
        'instruction': instruction
    })

# Хранилище временных токенов для авторизации
auth_tokens = {}

@app.route('/api/auth_link', methods=['POST'])
def api_auth_link():
    """Генерация уникальной авторизационной ссылки"""
    try:
        data = request.json
        user_id = data.get('user_id')
        
        if not user_id:
            return jsonify({'error': 'user_id требуется'}), 400
        
        # Генерируем уникальный токен
        token = secrets.token_urlsafe(16)
        
        # Сохраняем токен с временной меткой (15 минут)
        auth_tokens[token] = {
            'user_id': user_id,
            'created_at': time.time(),
            'expires_at': time.time() + 900  # 15 минут
        }
        
        # Формируем deep link
        bot_username = BOT_USERNAME or os.environ.get('BOT_USERNAME', 'your_bot_username')
        deep_link = f"https://t.me/{bot_username}?start=auth_{token}"
        
        return jsonify({
            'auth_link': deep_link,
            'token': token
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/verify_token/<token>', methods=['GET'])
def api_verify_token(token):
    """Проверка токена авторизации"""
    try:
        if token not in auth_tokens:
            return jsonify({'error': 'Токен не найден'}), 404
        
        token_data = auth_tokens[token]
        
        # Проверяем срок действия
        if time.time() > token_data['expires_at']:
            del auth_tokens[token]
            return jsonify({'error': 'Токен истек'}), 410
        
        return jsonify({
            'user_id': token_data['user_id'],
            'valid': True
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def cleanup_expired_tokens():
    """Очистка истекших токенов"""
    current_time = time.time()
    expired_tokens = [token for token, data in auth_tokens.items() 
                     if current_time > data['expires_at']]
    for token in expired_tokens:
        del auth_tokens[token]

def run_bot():
    from bot.config import TOKEN
    import time
    try:
        from telebot.apihelper import ApiTelegramException
    except ImportError:
        ApiTelegramException = Exception
    if not TOKEN:
        print('BOT_TOKEN не задан — бот не запущен. Задайте BOT_TOKEN в переменных окружения Railway.')
        return
    
    # Запускаем фоновую очистку токенов
    def cleanup_tokens():
        while True:
            try:
                cleanup_expired_tokens()
                time.sleep(300)  # Каждые 5 минут
            except Exception as e:
                print(f'Error cleaning up tokens: {e}')
                time.sleep(60)
    
    threading.Thread(target=cleanup_tokens, daemon=True).start()
    
    while True:
        try:
            bot.infinity_polling(skip_pending=True)
            break
        except ApiTelegramException as e:
            # 409 = уже запущен другой экземпляр бота (локально или на другом сервере)
            if getattr(e, 'error_code', None) == 409 or '409' in str(e) or 'conflict' in str(e).lower():
                print('[Bot] Ошибка 409: другой экземпляр бота уже запущен. Остановите бота на ПК или другом сервере, через 30 сек повтор...')
                time.sleep(30)
            else:
                raise
        except Exception as e:
            raise


if __name__ == '__main__':
    threading.Thread(target=run_bot, daemon=True).start()

    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, use_reloader=False)
