// Telegram WebApp инициализация
let tg = null;
try {
    if (window.Telegram && window.Telegram.WebApp) {
        tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();
    } else {
        // Для тестирования без Telegram
        console.warn('Telegram.WebApp не найден, используется режим тестирования');
        tg = {
            initData: '',
            initDataUnsafe: {
                user: {
                    id: 123456789,
                    username: 'test_user',
                    first_name: 'Test',
                    photo_url: ''
                }
            }
        };
    }
} catch (error) {
    console.error('Ошибка инициализации Telegram.WebApp:', error);
    // Режим тестирования
    tg = {
        initData: '',
        initDataUnsafe: {
            user: {
                id: 123456789,
                username: 'test_user',
                first_name: 'Test',
                photo_url: ''
            }
        }
    };
}

// Конфигурация API: в продакшене тот же хост (Railway), локально — localhost
const API_BASE = (typeof window !== 'undefined' && window.location && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
    ? '' : 'http://localhost:5000';

// Глобальные переменные
let currentUser = null;
let currentDealRole = 'customer';
let currentDealRoleSelector = 'seller';

// Вставляем иконки после загрузки страницы и при динамическом создании элементов
function insertIcons() {
    document.querySelectorAll('[data-icon]').forEach(el => {
        const iconName = el.getAttribute('data-icon');
        if (iconName && typeof getIcon === 'function' && !el.querySelector('svg')) {
            el.innerHTML = getIcon(iconName);
        }
    });
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    // Вставляем иконки при загрузке
    insertIcons();
    
    initTelegramUser();
    setupEventListeners();
    
    // Проверяем параметр auth_user в URL (возврат с бота)
    checkAuthReturn();
    
    // Проверяем наличие username (обязательно для работы бота)
    if (currentUser && !currentUser.username) {
        showModal('Внимание', 'Вам необходимо установить логин для работы с ботом!', `
            <button class="glass-btn" onclick="closeModal()">OK</button>
        `);
    }
    
    // Проверяем сделку через небольшую задержку, чтобы пользователь успел загрузиться
    setTimeout(() => {
        checkDeal();
    }, 500);
});

// Получение данных пользователя из Telegram
function initTelegramUser() {
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
        currentUser = tg.initDataUnsafe.user;
        console.log('Telegram User:', currentUser);
        
        // Автоматически создаем пользователя в БД при первом входе
        checkAndCreateUser();
    } else {
        console.warn('Не удалось получить данные пользователя Telegram, используется режим тестирования');
        // Для тестирования создаем тестового пользователя
        currentUser = {
            id: 123456789,
            username: 'test_user',
            first_name: 'Test User'
        };
    }
}

// Проверка и создание пользователя
async function checkAndCreateUser() {
    const initData = getInitData();
    if (!initData) return;
    try {
        const url = `${API_BASE}/api/profile` + (initData ? '?init_data=' + encodeURIComponent(initData) : '');
        const response = await fetch(url, {
            headers: {
                'X-Telegram-Init-Data': initData,
                'Content-Type': 'application/json'
            }
        });
        if (response.ok) {
            const data = await response.json();
            console.log('User profile:', data);
        }
    } catch (error) {
        console.error('Error checking user:', error);
    }
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Обработка кнопок меню
    document.querySelectorAll('.menu-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = e.currentTarget.getAttribute('data-action');
            handleMenuAction(action);
        });
    });
}

// Обработка действий меню
function handleMenuAction(action) {
    switch(action) {
        case 'profile':
            loadProfile();
            showScreen('profile-screen');
            break;
        case 'deals':
            showScreen('deals-screen');
            loadDeals('seller');
            break;
        case 'about':
            loadAbout();
            showScreen('about-screen');
            break;
        case 'start-deal':
            showScreen('start-deal-screen');
            break;
    }
}

// Переключение экранов
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// Показать/скрыть загрузчик
function showLoader(show = true) {
    const loader = document.getElementById('loader');
    if (show) {
        loader.classList.add('active');
    } else {
        loader.classList.remove('active');
    }
}

// Показать модальное окно
function showModal(title, message, footer = '', persistent = false) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = message;
    
    if (persistent) {
        // Для постоянных модальных окон не добавляем кнопку закрытия по умолчанию
        document.getElementById('modal-footer').innerHTML = footer;
    } else {
        document.getElementById('modal-footer').innerHTML = footer || '<button class="glass-btn" onclick="closeModal()">OK</button>';
    }
    
    document.getElementById('modal').classList.add('active');
    // Вставляем иконки в модальное окно
    setTimeout(insertIcons, 10);
}

// Закрыть модальное окно
function closeModal() {
    document.getElementById('modal').classList.remove('active');
}

// initData для API (в Mini App всегда передаём — и в заголовке, и в query, т.к. прокси может обрезать заголовки)
function getInitData() {
    return (tg && tg.initData) ? tg.initData : '';
}

// API запросы
async function apiRequest(endpoint, options = {}) {
    const initData = getInitData();
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json'
        }
    };

    // POST: initData в body
    const body = options.body ? JSON.parse(options.body) : {};
    if (initData) {
        body.initData = initData;
        options.body = JSON.stringify(body);
    }

    const mergedOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...(options.headers || {})
        }
    };

    if (initData) {
        mergedOptions.headers['X-Telegram-Init-Data'] = initData;
        // GET: дублируем в query, т.к. прокси (Railway и др.) часто обрезают кастомные заголовки
        if (!options.method || options.method === 'GET') {
            const sep = endpoint.indexOf('?') >= 0 ? '&' : '?';
            endpoint = endpoint + sep + 'init_data=' + encodeURIComponent(initData);
        }
    }

    try {
        showLoader(true);
        const response = await fetch(`${API_BASE}${endpoint}`, mergedOptions);
        const data = await response.json();
        showLoader(false);
        
        if (!response.ok) {
            // Обработка ошибки 401 - показываем кнопку входа
            if (response.status === 401) {
                showAuthModal();
                throw new Error('Требуется авторизация');
            }
            throw new Error(data.error || 'Ошибка запроса');
        }
        
        return data;
    } catch (error) {
        showLoader(false);
        throw error;
    }
}

// Загрузка профиля
async function loadProfile() {
    try {
        const data = await apiRequest('/api/profile');
        document.getElementById('profile-id').textContent = data.id;
        document.getElementById('profile-offers').textContent = data.offers;
        document.getElementById('profile-balance').textContent = `${data.balance} ₽`;
        document.getElementById('profile-qiwi').textContent = data.qiwi || 'Не указан';
    } catch (error) {
        showModal('Ошибка', error.message);
    }
}

// Загрузка прошедших сделок
async function loadDeals(role) {
    currentDealRoleSelector = role;
    
    // Обновляем активную кнопку
    document.querySelectorAll('#deals-screen .role-selector .glass-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    if (event && event.target) {
        event.target.classList.add('active');
    } else {
        // Если вызвано программно, активируем нужную кнопку
        const buttons = document.querySelectorAll('#deals-screen .role-selector .glass-btn');
        if (role === 'seller' && buttons[0]) {
            buttons[0].classList.add('active');
        } else if (role === 'customer' && buttons[1]) {
            buttons[1].classList.add('active');
        }
    }
    
    try {
        const data = await apiRequest(`/api/deals?role=${role}`);
        const dealsList = document.getElementById('deals-list');
        
        if (data.deals && data.deals.trim()) {
            const deals = data.deals.split('\n\n').filter(d => d.trim());
            dealsList.innerHTML = deals.map(deal => `
                <div class="deal-item">
                    <p>${deal.replace(/^[💠\s]+/, '')}</p>
                </div>
            `).join('');
        } else {
            dealsList.innerHTML = '<div class="glass-card"><p>Сделок не обнаружено!</p></div>';
        }
    } catch (error) {
        showModal('Ошибка', error.message);
    }
}

// Загрузка информации "О нас"
async function loadAbout() {
    try {
        const data = await apiRequest('/api/about');
        document.getElementById('about-info').innerHTML = `
            <p><strong>По всем вопросам:</strong> ${data.admin}</p>
            <p><strong>Наш чат:</strong> ${data.chat}</p>
            <p><strong>Инструкция:</strong> <a href="${data.instruction}" target="_blank">${data.instruction}</a></p>
        `;
    } catch (error) {
        showModal('Ошибка', error.message);
    }
}

// Выбор роли для сделки
function selectDealRole(role) {
    currentDealRole = role;
    document.querySelectorAll('#start-deal-screen .role-selector .glass-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    if (event && event.target) {
        event.target.classList.add('active');
    }
}

// Начать сделку
async function startDeal() {
    const username = document.getElementById('partner-username').value.trim();
    
    if (!username) {
        showModal('Ошибка', 'Введите логин пользователя');
        return;
    }
    
    // Убираем @ если пользователь его ввел
    const cleanUsername = username.replace('@', '');
    
    try {
        const data = await apiRequest('/api/start_deal', {
            method: 'POST',
            body: JSON.stringify({
                role: currentDealRole,
                username: cleanUsername
            })
        });
        
        showModal('Успех', `Предложение о проведении сделки отправлено!`, `
            <button class="glass-btn" onclick="closeModal(); showScreen('main-menu'); checkDeal();">OK</button>
        `);
        
        document.getElementById('partner-username').value = '';
    } catch (error) {
        showModal('Ошибка', error.message);
    }
}

// Проверка активной сделки
async function checkDeal() {
    try {
        const data = await apiRequest('/api/deal_info');
        if (data.proposal) {
            // Показываем предложение о сделке
            showProposalScreen(data);
        } else if (data.deal) {
            showDealScreen(data);
        }
    } catch (error) {
        // Нет активной сделки - это нормально
    }
}

// Показать экран предложения о сделке
function showProposalScreen(data) {
    const partner = data.partner;
    const role = data.role;
    
    const roleText = role === 'seller' ? 'продавец' : 'покупатель';
    
    showModal(`Предложение о сделке`, `
        <p>Вам отправлено предложение о сделке!</p>
        <p><strong>ID:</strong> ${partner.id}</p>
        <p><strong>Логин:</strong> @${partner.nickname}</p>
        <p><strong>Проведенных сделок:</strong> ${partner.offers}</p>
        <p><strong>В этой сделке вы ${roleText}!</strong></p>
    `, `
        <button class="glass-btn" onclick="acceptProposal('${role}')">
            <span class="icon" data-icon="check"></span>
            <span>Принять</span>
        </button>
        <button class="glass-btn secondary" onclick="rejectProposal('${role}')">
            <span class="icon" data-icon="cancel"></span>
            <span>Отклонить</span>
        </button>
    `);
}

// Принять предложение
async function acceptProposal(role) {
    closeModal();
    showLoader(true);
    try {
        const data = await apiRequest('/api/accept', {
            method: 'POST',
            body: JSON.stringify({ role })
        });
        
        showLoader(false);
        showDealScreen(data);
    } catch (error) {
        showLoader(false);
        showModal('Ошибка', error.message);
    }
}

// Отклонить предложение
async function rejectProposal(role) {
    closeModal();
    try {
        const data = await apiRequest('/api/cancel', {
            method: 'POST',
            body: JSON.stringify({
                action: 'proposal',
                role
            })
        });
        
        showModal('Успех', data.message || 'Предложение отклонено', `
            <button class="glass-btn" onclick="closeModal(); showScreen('main-menu'); checkDeal();">OK</button>
        `);
    } catch (error) {
        showModal('Ошибка', error.message);
    }
}

// Загрузить информацию о сделке
async function loadDealInfo() {
    try {
        const data = await apiRequest('/api/deal_info');
        if (data.deal || data.proposal) {
            showDealScreen(data);
        } else {
            showScreen('main-menu');
        }
    } catch (error) {
        showScreen('main-menu');
    }
}

// Показать экран сделки
function showDealScreen(data) {
    const deal = data.deal;
    const role = data.role;
    
    if (!deal || !deal.id) {
        // Это предложение, еще не принятое
        if (data.proposal) {
            showProposalScreen(data);
            return;
        }
        showScreen('main-menu');
        return;
    }
    
    document.getElementById('deal-info').innerHTML = `
        <h3>Сделка №${deal.id}</h3>
        <p><strong>Покупатель:</strong> ${deal.customer_id} (@${deal.customer_nick})</p>
        <p><strong>Продавец:</strong> ${deal.seller_id} (@${deal.seller_nick})</p>
        <p><strong>Сумма:</strong> ${deal.sum} рублей</p>
        <p><strong>Статус:</strong> <span class="status ${deal.status}">${getStatusText(deal.status)}</span></p>
    `;
    
    // Панель действий в зависимости от роли и статуса
    const actionsDiv = document.getElementById('deal-actions');
    actionsDiv.innerHTML = '';
    
    if (role === 'seller') {
        if (deal.status === 'dont_open') {
            // Предложение еще не принято
            actionsDiv.innerHTML = `
                <button class="glass-btn" onclick="acceptDeal('seller')">
                    <span class="icon" data-icon="check"></span>
                    <span>Принять</span>
                </button>
                <button class="glass-btn secondary" onclick="rejectProposal('seller')">
                    <span class="icon" data-icon="cancel"></span>
                    <span>Отклонить</span>
                </button>
            `;
        } else {
            actionsDiv.innerHTML = `
                <button class="glass-btn" onclick="openDispute('seller')">Открыть спор</button>
                <button class="glass-btn" onclick="cancelDeal('seller')">Отменить сделку</button>
                ${deal.sum === '0' || !deal.sum ? '<button class="glass-btn" onclick="setPrice()">Указать стоимость</button>' : ''}
            `;
        }
    } else {
        if (deal.status === 'dont_open') {
            // Предложение еще не принято
            actionsDiv.innerHTML = `
                <button class="glass-btn" onclick="acceptDeal('customer')">
                    <span class="icon" data-icon="check"></span>
                    <span>Принять</span>
                </button>
                <button class="glass-btn secondary" onclick="rejectProposal('customer')">
                    <span class="icon" data-icon="cancel"></span>
                    <span>Отклонить</span>
                </button>
            `;
        } else {
            actionsDiv.innerHTML = `
                ${deal.status === 'open' && deal.sum !== '0' && deal.sum ? '<button class="glass-btn" onclick="payDeal()">Оплатить товар</button>' : ''}
                <button class="glass-btn" onclick="cancelDeal('customer')">Отменить сделку</button>
                <button class="glass-btn" onclick="openDispute('customer')">Открыть спор</button>
                ${deal.status === 'success' ? '<button class="glass-btn" onclick="confirmReceipt()">Подтвердить получение</button>' : ''}
            `;
        }
    }
    
    showScreen('deal-screen');
}

// Получить текст статуса
function getStatusText(status) {
    const statusMap = {
        'dont_open': 'Не открыта',
        'open': 'Открыта',
        'success': 'Оплачено',
        'dispute': 'Спор',
        'review': 'Ожидание отзыва'
    };
    return statusMap[status] || status || 'Неизвестно';
}

// Принять сделку
async function acceptDeal(role) {
    try {
        const data = await apiRequest('/api/accept', {
            method: 'POST',
            body: JSON.stringify({ role })
        });
        
        showDealScreen(data);
    } catch (error) {
        showModal('Ошибка', error.message);
    }
}

// Отменить сделку
async function cancelDeal(role) {
    showModal('Подтверждение', 'Вы уверены что хотите отменить сделку?', `
        <button class="glass-btn" onclick="confirmCancelRequest('${role}')">Да</button>
        <button class="glass-btn secondary" onclick="closeModal()">Нет</button>
    `);
}

// Подтвердить запрос на отмену
async function confirmCancelRequest(role) {
    closeModal();
    try {
        const data = await apiRequest('/api/cancel', {
            method: 'POST',
            body: JSON.stringify({
                action: 'deal',
                role
            })
        });
        
        if (data.needs_confirmation) {
            showModal('Запрос отправлен', data.message, `
                <button class="glass-btn" onclick="confirmCancel('${role}')">Подтвердить отмену</button>
                <button class="glass-btn secondary" onclick="closeModal()">Отмена</button>
            `);
        } else {
            showModal('Успех', data.message, `
                <button class="glass-btn" onclick="closeModal(); showScreen('main-menu'); checkDeal();">OK</button>
            `);
        }
    } catch (error) {
        showModal('Ошибка', error.message);
    }
}

// Подтвердить отмену
async function confirmCancel(role) {
    try {
        const data = await apiRequest('/api/cancel', {
            method: 'POST',
            body: JSON.stringify({
                action: 'confirm',
                role
            })
        });
        
        showModal('Успех', data.message, `
            <button class="glass-btn" onclick="closeModal(); showScreen('main-menu');">OK</button>
        `);
    } catch (error) {
        showModal('Ошибка', error.message);
    }
}

// Оплатить товар
async function payDeal() {
    try {
        const data = await apiRequest('/api/pay', {
            method: 'POST'
        });
        
        showModal('Успех', data.message, `
            <button class="glass-btn" onclick="closeModal(); loadDealInfo();">OK</button>
        `);
    } catch (error) {
        showModal('Ошибка', error.message);
    }
}

// Открыть спор
async function openDispute(role) {
    showModal('Подтверждение', 'Вы уверены что хотите открыть спор?', `
        <button class="glass-btn" onclick="confirmOpenDispute('${role}')">Да</button>
        <button class="glass-btn secondary" onclick="closeModal()">Нет</button>
    `);
}

// Подтвердить открытие спора
async function confirmOpenDispute(role) {
    closeModal();
    try {
        const data = await apiRequest('/api/dispute', {
            method: 'POST',
            body: JSON.stringify({ role })
        });
        
        showModal('Спор открыт', data.message, `
            <button class="glass-btn" onclick="closeModal(); loadDealInfo();">OK</button>
        `);
    } catch (error) {
        showModal('Ошибка', error.message);
    }
}

// Подтвердить получение
async function confirmReceipt() {
    showModal('Подтверждение', 'Вы уверены что получили товар, и он валидный? Если нет, или условия не соблюдены, то вам необходимо открыть спор.', `
        <button class="glass-btn" onclick="confirmReceiptYes()">Да, подтверждаю</button>
        <button class="glass-btn secondary" onclick="closeModal()">Нет</button>
    `);
}

// Подтвердить получение (да)
async function confirmReceiptYes() {
    closeModal();
    try {
        const data = await apiRequest('/api/confirm_receipt', {
            method: 'POST',
            body: JSON.stringify({ confirm: true })
        });
        
        if (data.can_review) {
            showModal('Сделка завершена', 'Хотите оставить отзыв о продавце?', `
                <button class="glass-btn" onclick="showReviewForm()">Да</button>
                <button class="glass-btn secondary" onclick="skipReview()">Нет</button>
            `);
        } else {
            showModal('Успех', data.message, `
                <button class="glass-btn" onclick="closeModal(); showScreen('main-menu'); checkDeal();">OK</button>
            `);
        }
    } catch (error) {
        showModal('Ошибка', error.message);
    }
}

// Показать форму отзыва
function showReviewForm() {
    closeModal();
    
    // Создаем модальное окно с текстовым полем
    const modalContent = `
        <textarea id="review-text" class="glass-input" placeholder="Напишите отзыв о сделке..." rows="4" style="width: 100%; resize: vertical;"></textarea>
    `;
    
    showModal('Оставить отзыв', modalContent, `
        <button class="glass-btn" onclick="submitReviewFromModal()">Отправить</button>
        <button class="glass-btn secondary" onclick="skipReview()">Пропустить</button>
    `);
}

// Отправить отзыв из модального окна
function submitReviewFromModal() {
    const reviewText = document.getElementById('review-text').value.trim();
    if (reviewText && reviewText !== '-') {
        submitReview(reviewText);
    } else if (reviewText === '-') {
        skipReview();
    } else {
        showModal('Ошибка', 'Введите текст отзыва');
    }
}

// Отправить отзыв
async function submitReview(reviewText) {
    try {
        const data = await apiRequest('/api/review', {
            method: 'POST',
            body: JSON.stringify({
                action: 'add',
                review: reviewText
            })
        });
        
        showModal('Успех', data.message, `
            <button class="glass-btn" onclick="closeModal(); showScreen('main-menu');">OK</button>
        `);
    } catch (error) {
        showModal('Ошибка', error.message);
    }
}

// Пропустить отзыв
async function skipReview() {
    try {
        const data = await apiRequest('/api/review', {
            method: 'POST',
            body: JSON.stringify({
                action: 'skip'
            })
        });
        
        showModal('Успех', data.message, `
            <button class="glass-btn" onclick="closeModal(); showScreen('main-menu');">OK</button>
        `);
    } catch (error) {
        showModal('Ошибка', error.message);
    }
}

// Установить цену
async function setPrice() {
    const modalContent = `
        <input type="number" id="price-input" class="glass-input" placeholder="Введите сумму товара" min="1" step="0.01">
    `;
    
    showModal('Указать стоимость', modalContent, `
        <button class="glass-btn" onclick="submitPrice()">Сохранить</button>
        <button class="glass-btn secondary" onclick="closeModal()">Отмена</button>
    `);
}

// Отправить цену
async function submitPrice() {
    const price = document.getElementById('price-input').value.trim();
    if (!price || price === '-') {
        showModal('Ошибка', 'Введите сумму');
        return;
    }
    
    try {
        const data = await apiRequest('/api/set_price', {
            method: 'POST',
            body: JSON.stringify({ price })
        });
        
        closeModal();
        showModal('Успех', data.message, `
            <button class="glass-btn" onclick="closeModal(); loadDealInfo();">OK</button>
        `);
    } catch (error) {
        closeModal();
        showModal('Ошибка', error.message);
    }
}

// Вывод средств
function showOutput() {
    loadProfile();
    showScreen('output-screen');
    
    // Загружаем информацию о счете
    setTimeout(() => {
        const profile = {
            qiwi: document.getElementById('profile-qiwi').textContent,
            balance: document.getElementById('profile-balance').textContent
        };
        
        if (profile.qiwi === 'Не указан') {
            document.getElementById('output-info').innerHTML = 'У Вас не указан счет для вывода(Qiwi)!';
        } else {
            document.getElementById('output-info').innerHTML = `
                <p>Ваш счет - ${profile.qiwi}</p>
                <p>Баланс - ${profile.balance}</p>
                <p>Введите сумму для вывода. (Минимум 10 рублей)</p>
            `;
        }
    }, 100);
}

// Отправить запрос на вывод
async function submitOutput() {
    const amount = document.getElementById('output-amount').value;
    
    if (!amount || parseFloat(amount) < 10) {
        showModal('Ошибка', 'Минимальная сумма для вывода 10 рублей');
        return;
    }
    
    try {
        const data = await apiRequest('/api/output', {
            method: 'POST',
            body: JSON.stringify({ amount })
        });
        
        showModal('Успех', data.message, `
            <button class="glass-btn" onclick="closeModal(); showScreen('profile-screen');">OK</button>
        `);
        document.getElementById('output-amount').value = '';
    } catch (error) {
        showModal('Ошибка', error.message);
    }
}

// Пополнение баланса
async function showReplenish() {
    showScreen('replenish-screen');
    
    try {
        const data = await apiRequest('/api/replenish', {
            method: 'POST'
        });
        
        document.getElementById('replenish-info').innerHTML = `
            <h3>Пополнение баланса</h3>
            <p><strong>СБП</strong></p>
            <p>Номер - <code>${data.number}</code></p>
            <p>Коментарий - <code>${data.code}</code></p>
            <p>До 15 000 рублей!</p>
        `;
    } catch (error) {
        showModal('Ошибка', error.message);
    }
}

// Проверить оплату
async function checkPayment() {
    try {
        const data = await apiRequest('/api/check_payment', {
            method: 'POST'
        });
        
        showModal('Успех', data.message, `
            <button class="glass-btn" onclick="closeModal(); showScreen('profile-screen'); loadProfile();">OK</button>
        `);
    } catch (error) {
        showModal('Ошибка', error.message);
    }
}

// Отменить пополнение
async function cancelPayment() {
    try {
        const data = await apiRequest('/api/cancel_payment', {
            method: 'POST'
        });
        
        showModal('Успех', data.message, `
            <button class="glass-btn" onclick="closeModal(); showScreen('profile-screen');">OK</button>
        `);
    } catch (error) {
        showModal('Ошибка', error.message);
    }
}

// Обновить СБП
function showUpdateQiwi() {
    showScreen('update-qiwi-screen');
}

// Отправить новый номер СБП
async function submitQiwi() {
    const qiwi = document.getElementById('qiwi-number').value.trim();
    
    if (!qiwi) {
        showModal('Ошибка', 'Введите номер');
        return;
    }
    
    try {
        const data = await apiRequest('/api/update_qiwi', {
            method: 'POST',
            body: JSON.stringify({ qiwi })
        });
        
        showModal('Успех', data.message, `
            <button class="glass-btn" onclick="closeModal(); showScreen('profile-screen'); loadProfile();">OK</button>
        `);
        document.getElementById('qiwi-number').value = '';
    } catch (error) {
        showModal('Ошибка', error.message);
    }
}

// Обновить логин
async function updateLogin() {
    try {
        const data = await apiRequest('/api/update_login', {
            method: 'POST'
        });
        
        showModal('Успех', data.message, `
            <button class="glass-btn" onclick="closeModal(); loadProfile();">OK</button>
        `);
    } catch (error) {
        showModal('Ошибка', error.message);
    }
}

// Показать модальное окно авторизации
function showAuthModal() {
    const modalHTML = `
        <div class="modal-content">
            <h3>🔐 Требуется авторизация</h3>
            <p>Для доступа к функциям приложения необходимо авторизоваться через бота.</p>
            <p>Нажмите кнопку ниже, чтобы перейти к боту и получить ссылку для входа.</p>
            <div style="margin-top: 20px;">
                <button class="glass-btn" onclick="generateAuthLink()" id="auth-link-btn">
                    🔄 Генерация ссылки...
                </button>
            </div>
        </div>
    `;
    
    showModal('Авторизация', modalHTML, '', true); // true = не закрывать автоматически
    
    // Автоматически генерируем ссылку
    generateAuthLink();
}

// Генерация авторизационной ссылки
async function generateAuthLink() {
    const btn = document.getElementById('auth-link-btn');
    if (!btn) return;
    
    try {
        btn.textContent = '🔄 Генерация ссылки...';
        btn.disabled = true;
        
        // Получаем user_id из Telegram WebApp
        const user = getTelegramUserFromWebApp();
        const user_id = user ? user.id : null;
        
        if (!user_id) {
            throw new Error('Не удалось определить ID пользователя');
        }
        
        const data = await apiRequest('/api/auth_link', {
            method: 'POST',
            body: JSON.stringify({ user_id })
        });
        
        // Создаем кнопку для перехода к боту
        btn.innerHTML = `🤖 Перейти к боту`;
        btn.onclick = () => {
            window.open(data.auth_link, '_blank');
        };
        btn.disabled = false;
        
    } catch (error) {
        btn.textContent = '❌ Ошибка';
        btn.onclick = () => generateAuthLink(); // Позволить повторить попытку
        btn.disabled = false;
        console.error('Error generating auth link:', error);
    }
}

// Получить данные пользователя из Telegram WebApp
function getTelegramUserFromWebApp() {
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) {
        return window.Telegram.WebApp.initDataUnsafe.user;
    }
    return null;
}

// Проверка возврата с бота после авторизации
function checkAuthReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const authUser = urlParams.get('auth_user');
    
    if (authUser) {
        // Показываем сообщение об успешной авторизации
        showModal('✅ Успешная авторизация', `
            <p>Вы успешно авторизованы! Теперь вы можете использовать все функции приложения.</p>
        `, `
            <button class="glass-btn" onclick="closeModal(); loadProfile();">OK</button>
        `);
        
        // Очищаем URL от параметров авторизации
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Перезагружаем профиль, если пользователь уже определен
        if (currentUser) {
            setTimeout(loadProfile, 1000);
        }
    }
}
