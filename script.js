const FORM_SUBMIT_EMAIL = 'aadityadas4000@gmail.com';
const FORM_SUBMIT_URL = `https://formsubmit.co/${FORM_SUBMIT_EMAIL}`;

let currentUser = null;
let isAdmin = false;
let selectedTopup = null;
let paymentScreenshotBase64 = null;

const diamondTopups = [
    { diamonds: 115, price: 120 },{ diamonds: 240, price: 220 },{ diamonds: 355, price: 340 },
    { diamonds: 480, price: 440 },{ diamonds: 610, price: 560 },{ diamonds: 725, price: 650 },
    { diamonds: 850, price: 760 },{ diamonds: 965, price: 880 },{ diamonds: 1090, price: 970 },
    { diamonds: 1240, price: 1080 },{ diamonds: 1355, price: 1200 },{ diamonds: 1480, price: 1300 },
    { diamonds: 1720, price: 1600 },{ diamonds: 2090, price: 1800 },{ diamonds: 2530, price: 2200 }
];
const membershipTopups = [
    { name: 'Weekly Membership', price: 220, icon: '📅' },
    { name: 'Monthly Membership', price: 1100, icon: '📆' },
    { name: 'Weekly + Monthly Combo', price: 1180, icon: '🎁' }
];

// ====== STOCK MANAGEMENT ======
function getStockStatus() {
    const defaultStock = {};
    diamondTopups.forEach((_, i) => defaultStock['diamond_'+i] = true);
    membershipTopups.forEach((_, i) => defaultStock['membership_'+i] = true);
    return JSON.parse(localStorage.getItem('aaditya_stock') || JSON.stringify(defaultStock));
}
function saveStockStatus(stock) { localStorage.setItem('aaditya_stock', JSON.stringify(stock)); }
function isInStock(type, index) { return getStockStatus()[type+'_'+index] !== false; }

// ====== INIT ======
document.addEventListener('DOMContentLoaded', () => {
    ensureAdminAccount();
    renderTopupGrids();
    setupScreenshotUploader();
    checkPersistedSession();
});

function ensureAdminAccount() {
    const users = getUsers();
    if (!users['admin@aadityatopup.com']) {
        users['admin@aadityatopup.com'] = { password: 'Admin@2026', createdAt: new Date().toISOString() };
        saveUsers(users);
    }
}

function renderTopupGrids() {
    const stock = getStockStatus();
    document.getElementById('diamondGrid').innerHTML = diamondTopups.map((item, i) => {
        const inStock = stock['diamond_'+i] !== false;
        const stockLabel = inStock
            ? '<span class="stock-badge in-stock-badge">In Stock</span>'
            : '<span class="stock-badge out-of-stock-badge">Out of Stock</span>';
        return `
            <div class="topup-item ${inStock ? '' : 'out-of-stock'}" 
                 onclick="${inStock ? `selectTopup(this, 'diamond', ${i})` : ''}"
                 title="${inStock ? 'Select this package' : 'Out of stock'}">
                ${(item.diamonds===610||item.diamonds===1240)?'<span class="topup-badge">🔥 HOT</span>':''}
                <div class="topup-diamonds"><span class="diamond-icon">💎</span> ${item.diamonds}</div>
                <div class="topup-price">₹${item.price}</div>
                ${stockLabel}
            </div>`;
    }).join('');

    document.getElementById('membershipGrid').innerHTML = membershipTopups.map((item, i) => {
        const inStock = stock['membership_'+i] !== false;
        const stockLabel = inStock
            ? '<span class="stock-badge in-stock-badge">In Stock</span>'
            : '<span class="stock-badge out-of-stock-badge">Out of Stock</span>';
        return `
            <div class="membership-item ${inStock ? '' : 'out-of-stock'}" 
                 onclick="${inStock ? `selectTopup(this, 'membership', ${i})` : ''}">
                <div>
                    <span class="membership-name">${item.icon} ${item.name}</span>
                    ${stockLabel}
                </div>
                <span class="membership-price">₹${item.price}</span>
            </div>`;
    }).join('');
}

function selectTopup(el, type, index) {
    if (!isInStock(type, index)) { showToast('⚠️ Out of stock', 'error'); return; }
    document.querySelectorAll('.topup-item.selected, .membership-item.selected').forEach(el => el.classList.remove('selected'));
    el.classList.add('selected');
    if (type === 'diamond') {
        let item = diamondTopups[index];
        selectedTopup = { type:'diamond', label:`${item.diamonds} Diamonds`, diamonds:item.diamonds, price:item.price };
    } else {
        let item = membershipTopups[index];
        selectedTopup = { type:'membership', label:item.name, diamonds:null, price:item.price };
    }
    document.getElementById('gameDetailsCard').classList.remove('hidden');
    document.getElementById('orderSummaryCard').classList.remove('hidden');
    updateOrderSummaryDisplay();
    document.getElementById('gameDetailsCard').scrollIntoView({ behavior:'smooth' });
}

function updateOrderSummaryDisplay() {
    document.getElementById('orderSummaryContent').innerHTML = `
        <div style="background:#f8faff; padding:14px; border-radius:10px; text-align:center;">
            <p style="font-size:1.1rem; font-weight:700;">${selectedTopup.type==='diamond'?'💎':'🏅'} ${selectedTopup.label}</p>
            <p style="font-size:1.5rem; font-weight:800; color:#059669;">₹${selectedTopup.price}</p>
        </div>`;
}

// ====== ADMIN STOCK ACTIONS (globally accessible) ======
window.toggleStock = function(type, index) {
    const stock = getStockStatus();
    stock[type+'_'+index] = !stock[type+'_'+index];
    saveStockStatus(stock);
    renderTopupGrids();
    loadStockManagement();
};

window.setAllOutOfStock = function() {
    if (!confirm('Mark ALL items OUT OF STOCK?')) return;
    const stock = {};
    diamondTopups.forEach((_, i) => stock['diamond_'+i] = false);
    membershipTopups.forEach((_, i) => stock['membership_'+i] = false);
    saveStockStatus(stock);
    renderTopupGrids();
    loadStockManagement();
    showToast('All items set to Out of Stock', 'success');
};

window.resetAllInStock = function() {
    const stock = {};
    diamondTopups.forEach((_, i) => stock['diamond_'+i] = true);
    membershipTopups.forEach((_, i) => stock['membership_'+i] = true);
    saveStockStatus(stock);
    renderTopupGrids();
    loadStockManagement();
    showToast('All items are now In Stock', 'success');
};

function loadStockManagement() {
    const container = document.getElementById('stockManagementContainer');
    if (!container) return;
    const stock = getStockStatus();
    let html = '<h4>Diamonds</h4>';
    diamondTopups.forEach((item, i) => {
        const inStock = stock['diamond_'+i] !== false;
        html += `<div class="stock-item"><span>💎 ${item.diamonds} - ₹${item.price}</span>
                 <button class="btn btn-sm ${inStock?'btn-warning':'btn-success'}" onclick="window.toggleStock('diamond',${i})">${inStock?'Out of Stock':'In Stock'}</button></div>`;
    });
    html += '<h4 style="margin-top:12px;">Memberships</h4>';
    membershipTopups.forEach((item, i) => {
        const inStock = stock['membership_'+i] !== false;
        html += `<div class="stock-item"><span>${item.icon} ${item.name} - ₹${item.price}</span>
                 <button class="btn btn-sm ${inStock?'btn-warning':'btn-success'}" onclick="window.toggleStock('membership',${i})">${inStock?'Out of Stock':'In Stock'}</button></div>`;
    });
    container.innerHTML = html;
}

// ====== PASSWORD TOGGLE ======
window.togglePasswordVisibility = function(inputId, toggleId) {
    const input = document.getElementById(inputId);
    const toggle = document.getElementById(toggleId);
    if (input.type === 'password') { input.type = 'text'; toggle.textContent = '🙈'; }
    else { input.type = 'password'; toggle.textContent = '👁️'; }
};

// ====== EMAIL VALIDATION (Gmail only, except admin) ======
function isAllowedEmail(email) {
    email = email.trim().toLowerCase();
    // Admin account is always allowed, regardless of domain
    if (email === 'admin@aadityatopup.com') return true;
    // Regular customers must use @gmail.com
    return email.endsWith('@gmail.com') && email.length > '@gmail.com'.length;
}

// ====== USERS (localStorage) ======
function getUsers() { return JSON.parse(localStorage.getItem('aaditya_users') || '{}'); }
function saveUsers(users) { localStorage.setItem('aaditya_users', JSON.stringify(users)); }

window.handleSignUp = function() {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value.trim();
    if (!email || !password) return showToast('Enter email and password', 'error');
    if (!isAllowedEmail(email)) return showToast('❌ email is invalid ', 'error');
    if (password.length < 6) return showToast('Password min 6 chars', 'error');
    const users = getUsers();
    if (users[email.toLowerCase()]) return showToast('Email already registered', 'error');
    users[email.toLowerCase()] = { password, createdAt: new Date().toISOString() };
    saveUsers(users);
    loginUser(email.toLowerCase());
    showToast('✅ Account created!', 'success');
};

window.handleSignIn = function() {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value.trim();
    if (!email || !password) return showToast('Enter email and password', 'error');
    if (!isAllowedEmail(email)) return showToast('❌ email is invalid', 'error');
    const users = getUsers();
    const user = users[email.toLowerCase()];
    if (!user) return showToast('No account found', 'error');
    if (user.password !== password) return showToast('Incorrect password', 'error');
    loginUser(email.toLowerCase());
    showToast('✅ Signed in!', 'success');
};

function loginUser(email) {
    currentUser = { email, uid: 'usr_'+Date.now() };
    localStorage.setItem('aaditya_current_session', JSON.stringify({ email, timestamp: Date.now() }));
    isAdmin = (email === 'admin@aadityatopup.com');
    if (isAdmin) { showAdminPanel(); } else { showCustomerDashboard(); }
    loadOrderHistory();
    if (isAdmin) { loadAllOrders(); loadStockManagement(); }
}

window.handleLogout = function() {
    currentUser = null; isAdmin = false; selectedTopup = null; paymentScreenshotBase64 = null;
    localStorage.removeItem('aaditya_current_session');
    document.getElementById('authSection').classList.remove('hidden');
    document.getElementById('customerDashboard').classList.add('hidden');
    document.getElementById('adminPanel').classList.add('hidden');
    document.getElementById('paymentSection').classList.add('hidden');
    document.getElementById('gameDetailsCard').classList.add('hidden');
    document.getElementById('orderSummaryCard').classList.add('hidden');
    document.getElementById('authEmail').value = '';
    document.getElementById('authPassword').value = '';
    document.getElementById('inGameName').value = '';
    document.getElementById('playerUID').value = '';
    document.getElementById('uploadArea').classList.remove('has-file');
    document.getElementById('uploadPreview').classList.remove('show');
    document.getElementById('confirmOrderBtn').disabled = true;
    document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    showToast('👋 Logged out');
};

function checkPersistedSession() {
    const session = JSON.parse(localStorage.getItem('aaditya_current_session'));
    if (session) {
        const users = getUsers();
        if (users[session.email]) loginUser(session.email);
        else localStorage.removeItem('aaditya_current_session');
    }
}

function showCustomerDashboard() {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('customerDashboard').classList.remove('hidden');
    document.getElementById('adminPanel').classList.add('hidden');
}
function showAdminPanel() {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('customerDashboard').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    loadAllOrders();
    loadStockManagement();
}

// ====== PAYMENT (unchanged) ======
window.proceedToPayment = function() {
    const inGameName = document.getElementById('inGameName').value.trim();
    const uid = document.getElementById('playerUID').value.trim();
    if (!inGameName) return showToast('Enter in‑game name', 'error');
    if (!uid) return showToast('Enter UID', 'error');
    if (uid.length < 6) return showToast('Valid UID required', 'error');
    if (!selectedTopup) return showToast('Select a top‑up', 'error');
    document.getElementById('paymentSection').classList.remove('hidden');
    document.getElementById('paymentSection').scrollIntoView({ behavior:'smooth' });
};
window.cancelPayment = function() {
    document.getElementById('paymentSection').classList.add('hidden');
    document.getElementById('orderSummaryCard').scrollIntoView({ behavior:'smooth' });
};

function setupScreenshotUploader() {
    const area = document.getElementById('uploadArea');
    area.addEventListener('dragover', e => { e.preventDefault(); area.style.borderColor='var(--primary)'; });
    area.addEventListener('dragleave', e => { area.style.borderColor='#cbd5e1'; });
    area.addEventListener('drop', e => {
        e.preventDefault(); area.style.borderColor='#cbd5e1';
        if (e.dataTransfer.files.length) {
            document.getElementById('screenshotInput').files = e.dataTransfer.files;
            window.handleScreenshotUpload({ target:{ files:e.dataTransfer.files } });
        }
    });
}
window.handleScreenshotUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 5*1024*1024) return showToast('File too large', 'error');
    const reader = new FileReader();
    reader.onload = function(e) {
        compressImage(e.target.result, 800, 0.7, (base64) => {
            paymentScreenshotBase64 = base64;
            document.getElementById('uploadPreview').src = base64;
            document.getElementById('uploadPreview').classList.add('show');
            document.getElementById('uploadArea').classList.add('has-file');
            document.getElementById('confirmOrderBtn').disabled = false;
            showToast('📸 Screenshot uploaded', 'success');
        });
    };
    reader.readAsDataURL(file);
};
function compressImage(dataUrl, maxWidth, quality, callback) {
    const img = new Image();
    img.onload = function() {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = (maxWidth/w)*h; w = maxWidth; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        callback(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
}
window.confirmPlaceOrder = async function() {
    const inGameName = document.getElementById('inGameName').value.trim();
    const uid = document.getElementById('playerUID').value.trim();
    if (!inGameName || !uid || !selectedTopup || !paymentScreenshotBase64) {
        return showToast('Complete all fields', 'error');
    }
    const order = {
        customerEmail: currentUser.email,
        gameName: 'Free Fire',
        inGameName, playerUID: uid,
        topupLabel: selectedTopup.label,
        price: selectedTopup.price,
        screenshot: paymentScreenshotBase64,
        status: 'pending',
        createdAt: new Date().toISOString(),
        orderId: 'ORD-'+Date.now()+'-'+Math.random().toString(36).substr(2,5).toUpperCase()
    };
    const orders = JSON.parse(localStorage.getItem('aaditya_orders') || '[]');
    orders.unshift(order);
    localStorage.setItem('aaditya_orders', JSON.stringify(orders));
    await sendOrderToFormSubmit(order);
    showThankYouModal();
    loadOrderHistory();
    resetPaymentForm();
};
async function sendOrderToFormSubmit(order) {
    const payload = { _subject: `New Top-Up: ${order.topupLabel} | ₹${order.price}`, ...order };
    try {
        await fetch(FORM_SUBMIT_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    } catch(err) { console.error(err); }
}
function showThankYouModal() { document.getElementById('thankYouModal').classList.remove('hidden'); }
function closeThankYou() {
    document.getElementById('thankYouModal').classList.add('hidden');
    document.getElementById('paymentSection').classList.add('hidden');
    document.getElementById('orderSummaryCard').classList.add('hidden');
    document.getElementById('gameDetailsCard').classList.add('hidden');
    document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    selectedTopup = null; paymentScreenshotBase64 = null;
    document.getElementById('inGameName').value = '';
    document.getElementById('playerUID').value = '';
    document.getElementById('uploadArea').classList.remove('has-file');
    document.getElementById('uploadPreview').classList.remove('show');
    document.getElementById('confirmOrderBtn').disabled = true;
}
window.closeThankYou = closeThankYou;
function resetPaymentForm() {}

// ====== ORDER HISTORY ======
function loadOrderHistory() {
    if (!currentUser) return;
    const orders = JSON.parse(localStorage.getItem('aaditya_orders') || '[]');
    const myOrders = orders.filter(o => o.customerEmail === currentUser.email);
    const container = document.getElementById('orderHistoryContainer');
    if (myOrders.length === 0) { container.innerHTML = '<p style="text-align:center;">No orders yet.</p>'; return; }
    container.innerHTML = `<table class="order-table"><thead><tr><th>Status</th><th>Order ID</th><th>In‑Game Name</th><th>UID</th><th>Top‑Up</th><th>Amount</th><th>Date</th></tr></thead><tbody>${myOrders.map(o => `<tr><td><span class="status-badge ${o.status==='complete'?'status-complete':'status-pending'}">${o.status}</span></td><td>${o.orderId}</td><td>${o.inGameName}</td><td>${o.playerUID}</td><td>${o.topupLabel}</td><td>₹${o.price}</td><td>${new Date(o.createdAt).toLocaleDateString('en-IN')}</td></tr>`).join('')}</tbody></table>`;
}
function loadAllOrders() {
    const orders = JSON.parse(localStorage.getItem('aaditya_orders') || '[]');
    const container = document.getElementById('adminOrdersContainer');
    if (!orders.length) { container.innerHTML = '<p>No orders.</p>'; return; }
    container.innerHTML = orders.map((o,i) => `
        <div class="admin-order-card ${o.status==='complete'?'complete':''}">
            <p><strong>🆔</strong> ${o.orderId}</p><p><strong>👤</strong> ${o.customerEmail}</p>
            <p><strong>🧑</strong> ${o.inGameName}</p><p><strong>UID</strong> ${o.playerUID}</p>
            <p><strong>💎</strong> ${o.topupLabel}</p><p><strong>💰</strong> ₹${o.price}</p>
            <p><strong>📅</strong> ${new Date(o.createdAt).toLocaleString('en-IN')}</p>
            <p><strong>📌</strong> <span class="status-badge ${o.status==='complete'?'status-complete':'status-pending'}">${o.status}</span></p>
            ${o.screenshot ? `<details><summary>📸 Screenshot</summary><img src="${o.screenshot}" style="max-width:100%; border-radius:8px; margin-top:6px;"></details>` : ''}
            <div class="admin-actions">
                ${o.status==='pending'?`<button class="btn btn-sm btn-success" onclick="window.markComplete(${i})">✅ Complete</button>`:`<button class="btn btn-sm btn-warning" onclick="window.markPending(${i})">⏳ Pending</button>`}
                <button class="btn btn-sm btn-danger" onclick="window.deleteOrder(${i})">🗑 Delete</button>
            </div>
        </div>`).join('');
}
window.markComplete = function(i) { updateOrderStatus(i, 'complete'); };
window.markPending = function(i) { updateOrderStatus(i, 'pending'); };
function updateOrderStatus(index, status) {
    const orders = JSON.parse(localStorage.getItem('aaditya_orders') || '[]');
    orders[index].status = status;
    localStorage.setItem('aaditya_orders', JSON.stringify(orders));
    loadAllOrders();
    showToast(`Order ${status}`, 'success');
}
window.deleteOrder = function(index) {
    if (!confirm('Delete?')) return;
const orders = JSON.parse(localStorage.getItem('aaditya_orders') || '[]');
    orders.splice(index, 1);
    localStorage.setItem('aaditya_orders', JSON.stringify(orders));
    loadAllOrders();
    showToast('Deleted', 'success');
};

window.refreshAdminOrders = function() { loadAllOrders(); showToast('🔄 Refreshed'); };

function showToast(msg, type='', duration=3000) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast ' + type + ' show';
    clearTimeout(t._timeout);
    t._timeout = setTimeout(() => t.classList.remove('show'), duration);
                   }
