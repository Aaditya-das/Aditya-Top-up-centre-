// FormSubmit email config (sends to your Gmail)
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

// Run on page load
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
    document.getElementById('diamondGrid').innerHTML = diamondTopups.map((item, i) => `
        <div class="topup-item" onclick="selectTopup(this, 'diamond', ${i})">
            ${(item.diamonds===610||item.diamonds===1240)?'<span class="topup-badge">🔥 HOT</span>':''}
            <div class="topup-diamonds"><span class="diamond-icon">💎</span> ${item.diamonds}</div>
            <div class="topup-price">₹${item.price}</div>
        </div>`).join('');
    document.getElementById('membershipGrid').innerHTML = membershipTopups.map((item, i) => `
        <div class="membership-item" onclick="selectTopup(this, 'membership', ${i})">
            <span class="membership-name">${item.icon} ${item.name}</span>
            <span class="membership-price">₹${item.price}</span>
        </div>`).join('');
}

function selectTopup(el, type, index) {
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

function togglePasswordVisibility(inputId, toggleId) {
    const input = document.getElementById(inputId);
    const toggle = document.getElementById(toggleId);
    if (input.type === 'password') {
        input.type = 'text';
        toggle.textContent = '🙈';
    } else {
        input.type = 'password';
        toggle.textContent = '👁️';
    }
}

function getUsers() { return JSON.parse(localStorage.getItem('aaditya_users') || '{}'); }
function saveUsers(users) { localStorage.setItem('aaditya_users', JSON.stringify(users)); }

function handleSignUp() {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value.trim();
    if (!email || !password) return showToast('Please enter email and password', 'error');
    if (password.length < 6) return showToast('Password must be at least 6 characters', 'error');
    const users = getUsers();
    if (users[email]) return showToast('❌ Email already registered.', 'error');
    users[email] = { password, createdAt: new Date().toISOString() };
    saveUsers(users);
    loginUser(email);
    showToast('✅ Account created!', 'success');
}

function handleSignIn() {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value.trim();
    if (!email || !password) return showToast('Please enter email and password', 'error');
    const users = getUsers();
    if (!users[email]) return showToast('❌ No account found.', 'error');
    if (users[email].password !== password) return showToast('❌ Incorrect password.', 'error');
    loginUser(email);
    showToast('✅ Signed in!', 'success');
}

function loginUser(email) {
    currentUser = { email, uid: 'usr_' + Date.now() };
    localStorage.setItem('aaditya_current_session', JSON.stringify({ email, timestamp: Date.now() }));
    isAdmin = (email === 'admin@aadityatopup.com');
    if (isAdmin) { showAdminPanel(); } else { showCustomerDashboard(); }
    loadOrderHistory();
    if (isAdmin) loadAllOrders();
}

function handleLogout() {
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
}

function checkPersistedSession() {
    const session = JSON.parse(localStorage.getItem('aaditya_current_session'));
    if (session) {
        const users = getUsers();
        if (users[session.email]) { loginUser(session.email); }
        else { localStorage.removeItem('aaditya_current_session'); }
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
}

function proceedToPayment() {
    const inGameName = document.getElementById('inGameName').value.trim();
    const uid = document.getElementById('playerUID').value.trim();
    if (!inGameName) return showToast('⚠️ Enter your in‑game name', 'error');
    if (!uid) return showToast('⚠️ Enter your UID', 'error');
    if (uid.length < 6) return showToast('⚠️ Enter a valid UID', 'error');
    if (!selectedTopup) return showToast('⚠️ Select a top‑up', 'error');
    document.getElementById('paymentSection').classList.remove('hidden');
    document.getElementById('paymentSection').scrollIntoView({ behavior:'smooth' });
}
function cancelPayment() {
    document.getElementById('paymentSection').classList.add('hidden');
    document.getElementById('orderSummaryCard').scrollIntoView({ behavior:'smooth' });
}

function setupScreenshotUploader() {
    const area = document.getElementById('uploadArea');
    area.addEventListener('dragover', e => { e.preventDefault(); area.style.borderColor='var(--primary)'; });
    area.addEventListener('dragleave', e => { area.style.borderColor='#cbd5e1'; });
    area.addEventListener('drop', e => {
        e.preventDefault(); area.style.borderColor='#cbd5e1';
        if (e.dataTransfer.files.length) {
            document.getElementById('screenshotInput').files = e.dataTransfer.files;
            handleScreenshotUpload({ target:{ files:e.dataTransfer.files } });
        }
    });
}

function handleScreenshotUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 5*1024*1024) return showToast('⚠️ File too large (max 5MB)', 'error');
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
}

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

async function confirmPlaceOrder() {
    const inGameName = document.getElementById('inGameName').value.trim();
    const uid = document.getElementById('playerUID').value.trim();
    if (!inGameName || !uid || !selectedTopup || !paymentScreenshotBase64) {
        return showToast('⚠️ Complete all fields', 'error');
    }

    const order = {
        customerEmail: currentUser.email,
        gameName: 'Free Fire',
        inGameName: inGameName,
        playerUID: uid,
        topupLabel: selectedTopup.label,
        price: selectedTopup.price,
        screenshot: paymentScreenshotBase64,
        status: 'pending',
        createdAt: new Date().toISOString(),
        orderId: 'ORD-'+Date.now()+'-'+Math.random().toString(36).substr(2,5).toUpperCase()
    };

    const orders = JSON.parse(localStorage.getItem('aaditya_orders') || '[]');
    orders.unshift(order);  // newest first
    localStorage.setItem('aaditya_orders', JSON.stringify(orders));

    await sendOrderToFormSubmit(order);

    showThankYouModal();
    loadOrderHistory();
    resetPaymentForm();
}

async function sendOrderToFormSubmit(order) {
    const payload = {
        _subject: `New Top-Up: ${order.topupLabel} | ₹${order.price}`,
        orderId: order.orderId,
        customerEmail: order.customerEmail,
        inGameName: order.inGameName,
        playerUID: order.playerUID,
        topup: order.topupLabel,
        amount: order.price,
        status: order.status,
        date: order.createdAt,
        screenshotNote: 'Screenshot in admin panel'
    };
    try {
        await fetch(FORM_SUBMIT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (err) { console.error('Email failed:', err); }
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
function resetPaymentForm() {}

function loadOrderHistory() {
    if (!currentUser) return;
    const orders = JSON.parse(localStorage.getItem('aaditya_orders') || '[]');
    const myOrders = orders.filter(o => o.customerEmail === currentUser.email);
    const container = document.getElementById('orderHistoryContainer');
    if (myOrders.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px;">No orders yet. 🎮</p>';
        return;
    }
    container.innerHTML = `
        <table class="order-table">
            <thead><tr><th>Status</th><th>Order ID</th><th>In‑Game Name</th><th>UID</th><th>Top‑Up</th><th>Amount</th><th>Date</th></tr></thead>
            <tbody>${myOrders.map(o => `
                <tr>
                    <td><span class="status-badge ${o.status==='complete'?'status-complete':'status-pending'}">${o.status}</span></td>
                    <td>${o.orderId}</td><td>${o.inGameName || '-'}</td><td>${o.playerUID}</td>
                    <td>${o.topupLabel}</td><td style="font-weight:700; color:#059669;">₹${o.price}</td>
                    <td>${new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
                </tr>`).join('')}</tbody>
        </table>`;
}

function loadAllOrders() {
    const orders = JSON.parse(localStorage.getItem('aaditya_orders') || '[]');
    const container = document.getElementById('adminOrdersContainer');
    if (!orders.length) { container.innerHTML = '<p style="text-align:center;">No orders yet.</p>'; return; }
    container.innerHTML = orders.map((o,i) => `
        <div class="admin-order-card ${o.status==='complete'?'complete':''}">
            <p><strong>🆔</strong> ${o.orderId}</p><p><strong>👤</strong> ${o.customerEmail}</p>
            <p><strong>🧑 In‑Game</strong> ${o.inGameName || '-'}</p><p><strong>UID</strong> ${o.playerUID}</p>
            <p><strong>💎</strong> ${o.topupLabel}</p><p><strong>💰</strong> ₹${o.price}</p>
            <p><strong>📅</strong> ${new Date(o.createdAt).toLocaleString('en-IN')}</p>
            <p><strong>📌</strong> <span class="status-badge ${o.status==='complete'?'status-complete':'status-pending'}">${o.status}</span></p>
            ${o.screenshot ? `<details><summary>📸 Screenshot</summary><img src="${o.screenshot}" style="max-width:100%; border-radius:8px; margin-top:6px;"></details>` : '<p>No screenshot</p>'}
            <div class="admin-actions">
                ${o.status==='pending'?
                    `<button class="btn btn-sm btn-success" onclick="markComplete(${i})">✅ Complete</button>` :
                    `<button class="btn btn-sm btn-warning" onclick="markPending(${i})">⏳ Pending</button>`}
                <button class="btn btn-sm btn-danger" onclick="deleteOrder(${i})">🗑 Delete</button>
            </div>
        </div>`).join('');
}

function markComplete(i) { updateOrderStatus(i, 'complete'); }
function markPending(i) { updateOrderStatus(i, 'pending'); }
function updateOrderStatus(index, status) {
    const orders = JSON.parse(localStorage.getItem('aaditya_orders') || '[]');
    orders[index].status = status;
    localStorage.setItem('aaditya_orders', JSON.stringify(orders));
    loadAllOrders();
    showToast(`Order marked as ${status}`, 'success');
}
function deleteOrder(index) {
    if (!confirm('Delete permanently?')) return;
    const orders = JSON.parse(localStorage.getItem('aaditya_orders') || '[]');
    orders.splice(index, 1);
    localStorage.setItem('aaditya_orders', JSON.stringify(orders));
    loadAllOrders();
    showToast('Deleted', 'success');
}
function refreshAdminOrders() { loadAllOrders(); showToast('🔄 Refreshed'); }

function showToast(msg, type='', duration=3000) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast ' + type + ' show';
    clearTimeout(t._timeout);
    t._timeout = setTimeout(() => t.classList.remove('show'), duration);
}
