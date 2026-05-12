// ── Safe Storage (works in sandbox + real browser) ──
var _memStore = {};
var _store = {
    get: function(k) {
        try { return localStorage.getItem(k); }
        catch(e) { return _memStore[k] || null; }
    },
    set: function(k, v) {
        try { localStorage.setItem(k, v); }
        catch(e) { _memStore[k] = v; }
    },
    remove: function(k) {
        try { localStorage.removeItem(k); }
        catch(e) { delete _memStore[k]; }
    }
};

var FORM_SUBMIT_URL = 'https://formsubmit.co/aadityadas4000@gmail.com';
var currentUser = null;
var isAdmin = false;
var selectedTopup = null;
var paymentScreenshotBase64 = null;

var diamondTopups = [
    { diamonds: 115,  price: 120  }, { diamonds: 240,  price: 220  },
    { diamonds: 355,  price: 340  }, { diamonds: 480,  price: 440  },
    { diamonds: 610,  price: 560  }, { diamonds: 725,  price: 650  },
    { diamonds: 850,  price: 760  }, { diamonds: 965,  price: 880  },
    { diamonds: 1090, price: 970  }, { diamonds: 1240, price: 1080 },
    { diamonds: 1355, price: 1200 }, { diamonds: 1480, price: 1300 },
    { diamonds: 1720, price: 1600 }, { diamonds: 2090, price: 1800 },
    { diamonds: 2530, price: 2200 }
];

var membershipTopups = [
    { name: 'Weekly Membership',       price: 220,  icon: '📅' },
    { name: 'Monthly Membership',      price: 1100, icon: '📆' },
    { name: 'Weekly + Monthly Combo',  price: 1180, icon: '🎁' }
];

// ── Storage Helpers ──
function getUsers()  { return JSON.parse(_store.get('aaditya_users')  || '{}'); }
function saveUsers(u){ _store.set('aaditya_users', JSON.stringify(u)); }
function getOrders() { return JSON.parse(_store.get('aaditya_orders') || '[]'); }
function saveOrders(o){ _store.set('aaditya_orders', JSON.stringify(o)); }

function getStockStatus() {
    var def = {};
    diamondTopups.forEach(function(_, i)    { def['diamond_' + i]    = true; });
    membershipTopups.forEach(function(_, i) { def['membership_' + i] = true; });
    return JSON.parse(_store.get('aaditya_stock') || JSON.stringify(def));
}
function saveStockStatus(s) { _store.set('aaditya_stock', JSON.stringify(s)); }
function isInStock(type, idx) { return getStockStatus()[type + '_' + idx] !== false; }

// ── Email Validation ──
function isAllowedEmail(email) {
    email = email.trim().toLowerCase();
    if (email === 'admin@aadityatopup.com') return true;
    return email.endsWith('@gmail.com') && email.length > '@gmail.com'.length;
}

// ── Toast ──
function showToast(msg, type, duration) {
    duration = duration || 3000;
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast ' + (type || '') + ' show';
    clearTimeout(t._t);
    t._t = setTimeout(function() { t.classList.remove('show'); }, duration);
}

// ── Password Toggle ──
function togglePasswordVisibility() {
    var input = document.getElementById('authPassword');
    var btn   = document.getElementById('authPasswordToggle');
    if (input.type === 'password') { input.type = 'text';     btn.textContent = '🙈'; }
    else                           { input.type = 'password'; btn.textContent = '👁️'; }
}

// ── Sign Up ──
function handleSignUp() {
    var email    = document.getElementById('authEmail').value.trim();
    var password = document.getElementById('authPassword').value.trim();
    if (!email || !password)      return showToast('Enter email and password', 'error');
    if (!isAllowedEmail(email))   return showToast('❌ Use a valid Gmail address', 'error');
    if (password.length < 6)      return showToast('Password must be at least 6 characters', 'error');
    var users = getUsers();
    if (users[email.toLowerCase()]) return showToast('Email already registered', 'error');
    users[email.toLowerCase()] = { password: password, createdAt: new Date().toISOString() };
    saveUsers(users);
    loginUser(email.toLowerCase());
    showToast('✅ Account created!', 'success');
}

// ── Sign In ──
function handleSignIn() {
    var email    = document.getElementById('authEmail').value.trim();
    var password = document.getElementById('authPassword').value.trim();
    if (!email || !password)    return showToast('Enter email and password', 'error');
    if (!isAllowedEmail(email)) return showToast('❌ Use a valid Gmail address', 'error');
    var users = getUsers();
    var user  = users[email.toLowerCase()];
    if (!user)                    return showToast('No account found. Please sign up.', 'error');
    if (user.password !== password) return showToast('Incorrect password', 'error');
    loginUser(email.toLowerCase());
    showToast('✅ Signed in!', 'success');
}

// ── Logout ──
function handleLogout() {
    currentUser = null; isAdmin = false; selectedTopup = null; paymentScreenshotBase64 = null;
    _store.remove('aaditya_current_session');
    document.getElementById('authSection').classList.remove('hidden');
    document.getElementById('customerDashboard').classList.add('hidden');
    document.getElementById('adminPanel').classList.add('hidden');
    document.getElementById('paymentSection').classList.add('hidden');
    document.getElementById('gameDetailsCard').classList.add('hidden');
    document.getElementById('orderSummaryCard').classList.add('hidden');
    document.getElementById('authEmail').value    = '';
    document.getElementById('authPassword').value = '';
    document.getElementById('inGameName').value   = '';
    document.getElementById('playerUID').value    = '';
    document.getElementById('uploadArea').classList.remove('has-file');
    document.getElementById('uploadPreview').classList.remove('show');
    document.getElementById('confirmOrderBtn').disabled = true;
    document.querySelectorAll('.selected').forEach(function(el) { el.classList.remove('selected'); });
    showToast('👋 Logged out');
}

// ── Login User ──
function loginUser(email) {
    currentUser = { email: email };
    _store.set('aaditya_current_session', JSON.stringify({ email: email, timestamp: Date.now() }));
    isAdmin = (email === 'admin@aadityatopup.com');
    if (isAdmin) {
        showAdminPanel();
        loadAllOrders();
        loadStockManagement();
    } else {
        showCustomerDashboard();
        loadOrderHistory();
    }
}

// ── Persist Session ──
function checkPersistedSession() {
    var raw = _store.get('aaditya_current_session');
    if (!raw) return;
    try {
        var session = JSON.parse(raw);
        var users   = getUsers();
        if (users[session.email]) loginUser(session.email);
        else _store.remove('aaditya_current_session');
    } catch(e) { _store.remove('aaditya_current_session'); }
}

// ── Show Panels ──
function showCustomerDashboard() {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('customerDashboard').classList.remove('hidden');
    document.getElementById('adminPanel').classList.add('hidden');
}
function showAdminPanel() {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('customerDashboard').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
}

// ── Render Grids ──
function renderTopupGrids() {
    var stock = getStockStatus();

    document.getElementById('diamondGrid').innerHTML = diamondTopups.map(function(item, i) {
        var inStock = stock['diamond_' + i] !== false;
        var badge   = inStock
            ? '<span class="stock-badge in-stock-badge">In Stock</span>'
            : '<span class="stock-badge out-of-stock-badge">Out of Stock</span>';
        var hot   = (item.diamonds === 610 || item.diamonds === 1240) ? '<span class="topup-badge">🔥 HOT</span>' : '';
        var cls   = 'topup-item' + (inStock ? '' : ' out-of-stock');
        var click = inStock ? 'onclick="selectTopup(this,\'diamond\',' + i + ')"' : '';
        return '<div class="' + cls + '" ' + click + '>' + hot +
               '<div class="topup-diamonds">💎 ' + item.diamonds + '</div>' +
               '<div class="topup-price">₹' + item.price + '</div>' + badge + '</div>';
    }).join('');

    document.getElementById('membershipGrid').innerHTML = membershipTopups.map(function(item, i) {
        var inStock = stock['membership_' + i] !== false;
        var badge   = inStock
            ? '<span class="stock-badge in-stock-badge">In Stock</span>'
            : '<span class="stock-badge out-of-stock-badge">Out of Stock</span>';
        var cls   = 'membership-item' + (inStock ? '' : ' out-of-stock');
        var click = inStock ? 'onclick="selectTopup(this,\'membership\',' + i + ')"' : '';
        return '<div class="' + cls + '" ' + click + '>' +
               '<div><span class="membership-name">' + item.icon + ' ' + item.name + '</span> ' + badge + '</div>' +
               '<span class="membership-price">₹' + item.price + '</span></div>';
    }).join('');
}

// ── Select Topup ──
function selectTopup(el, type, index) {
    if (!isInStock(type, index)) { showToast('⚠️ Out of stock', 'error'); return; }
    document.querySelectorAll('.topup-item.selected, .membership-item.selected')
            .forEach(function(e) { e.classList.remove('selected'); });
    el.classList.add('selected');

    if (type === 'diamond') {
        var item = diamondTopups[index];
        selectedTopup = { type: 'diamond', label: item.diamonds + ' Diamonds', price: item.price };
    } else {
        var item = membershipTopups[index];
        selectedTopup = { type: 'membership', label: item.name, price: item.price };
    }

    document.getElementById('gameDetailsCard').classList.remove('hidden');
    document.getElementById('orderSummaryCard').classList.remove('hidden');
    document.getElementById('orderSummaryContent').innerHTML =
        '<div style="background:#f8faff;padding:14px;border-radius:10px;text-align:center">' +
        '<p style="font-size:1.1rem;font-weight:700">' + (type === 'diamond' ? '💎' : '🏅') + ' ' + selectedTopup.label + '</p>' +
        '<p style="font-size:1.5rem;font-weight:800;color:#059669">₹' + selectedTopup.price + '</p></div>';
    document.getElementById('gameDetailsCard').scrollIntoView({ behavior: 'smooth' });
}

// ── Payment ──
function proceedToPayment() {
    var name = document.getElementById('inGameName').value.trim();
    var uid  = document.getElementById('playerUID').value.trim();
    if (!name)               return showToast('Enter your in-game name', 'error');
    if (!uid || uid.length < 6) return showToast('Enter a valid UID', 'error');
    if (!selectedTopup)      return showToast('Select a top-up package', 'error');
    document.getElementById('paymentSection').classList.remove('hidden');
    document.getElementById('paymentSection').scrollIntoView({ behavior: 'smooth' });
}

function cancelPayment() {
    document.getElementById('paymentSection').classList.add('hidden');
    document.getElementById('orderSummaryCard').scrollIntoView({ behavior: 'smooth' });
}

// ── Screenshot Upload ──
function setupScreenshotUploader() {
    var area = document.getElementById('uploadArea');
    area.addEventListener('dragover',  function(e) { e.preventDefault(); area.style.borderColor = 'var(--primary)'; });
    area.addEventListener('dragleave', function()  { area.style.borderColor = '#cbd5e1'; });
    area.addEventListener('drop', function(e) {
        e.preventDefault();
        area.style.borderColor = '#cbd5e1';
        if (e.dataTransfer.files.length)
            handleScreenshotUpload({ target: { files: e.dataTransfer.files } });
    });
}

function handleScreenshotUpload(event) {
    var file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return showToast('File too large (max 5MB)', 'error');
    var reader = new FileReader();
    reader.onload = function(e) {
        compressImage(e.target.result, 800, 0.7, function(b64) {
            paymentScreenshotBase64 = b64;
            document.getElementById('uploadPreview').src = b64;
            document.getElementById('uploadPreview').classList.add('show');
            document.getElementById('uploadArea').classList.add('has-file');
            document.getElementById('confirmOrderBtn').disabled = false;
            showToast('📸 Screenshot uploaded', 'success');
        });
    };
    reader.readAsDataURL(file);
}

function compressImage(dataUrl, maxW, quality, cb) {
    var img = new Image();
    img.onload = function() {
        var canvas = document.createElement('canvas');
        var w = img.width, h = img.height;
        if (w > maxW) { h = (maxW / w) * h; w = maxW; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        cb(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
}

// ── Place Order ──
function confirmPlaceOrder() {
    var name = document.getElementById('inGameName').value.trim();
    var uid  = document.getElementById('playerUID').value.trim();
    if (!name || !uid || !selectedTopup || !paymentScreenshotBase64)
        return showToast('Please complete all fields', 'error');

    var order = {
        orderId:       'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5).toUpperCase(),
        customerEmail: currentUser.email,
        inGameName:    name,
        playerUID:     uid,
        topupLabel:    selectedTopup.label,
        price:         selectedTopup.price,
        screenshot:    paymentScreenshotBase64,
        status:        'pending',
        createdAt:     new Date().toISOString()
    };

    var orders = getOrders();
    orders.unshift(order);
    saveOrders(orders);

    try {
        fetch(FORM_SUBMIT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(order)
        });
    } catch(e) { console.error(e); }

    document.getElementById('thankYouModal').classList.remove('hidden');
    loadOrderHistory();
    resetAfterOrder();
}

function resetAfterOrder() {
    document.getElementById('paymentSection').classList.add('hidden');
    document.getElementById('orderSummaryCard').classList.add('hidden');
    document.getElementById('gameDetailsCard').classList.add('hidden');
    document.querySelectorAll('.selected').forEach(function(el) { el.classList.remove('selected'); });
    selectedTopup = null; paymentScreenshotBase64 = null;
    document.getElementById('inGameName').value = '';
    document.getElementById('playerUID').value  = '';
    document.getElementById('uploadArea').classList.remove('has-file');
    document.getElementById('uploadPreview').classList.remove('show');
    document.getElementById('confirmOrderBtn').disabled = true;
}

function closeThankYou() {
    document.getElementById('thankYouModal').classList.add('hidden');
}

// ── Order History ──
function loadOrderHistory() {
    if (!currentUser) return;
    var orders = getOrders().filter(function(o) { return o.customerEmail === currentUser.email; });
    var c = document.getElementById('orderHistoryContainer');
    if (!orders.length) { c.innerHTML = '<p style="text-align:center">No orders yet.</p>'; return; }
    c.innerHTML = '<table class="order-table"><thead><tr>' +
        '<th>Status</th><th>Order ID</th><th>Name</th><th>UID</th><th>Package</th><th>Amount</th><th>Date</th>' +
        '</tr></thead><tbody>' +
        orders.map(function(o) {
            return '<tr>' +
                '<td><span class="status-badge ' + (o.status === 'complete' ? 'status-complete' : 'status-pending') + '">' + o.status + '</span></td>' +
                '<td>' + o.orderId + '</td><td>' + o.inGameName + '</td><td>' + o.playerUID + '</td>' +
                '<td>' + o.topupLabel + '</td><td>₹' + o.price + '</td>' +
                '<td>' + new Date(o.createdAt).toLocaleDateString('en-IN') + '</td></tr>';
        }).join('') + '</tbody></table>';
}

// ── Admin Orders ──
function loadAllOrders() {
    var orders = getOrders();
    var c = document.getElementById('adminOrdersContainer');
    if (!orders.length) { c.innerHTML = '<p style="padding:12px">No orders yet.</p>'; return; }
    c.innerHTML = orders.map(function(o, i) {
        return '<div class="admin-order-card ' + (o.status === 'complete' ? 'complete' : '') + '">' +
            '<p><strong>🆔</strong> ' + o.orderId + '</p>' +
            '<p><strong>👤</strong> ' + o.customerEmail + '</p>' +
            '<p><strong>🧑</strong> ' + o.inGameName + '</p>' +
            '<p><strong>UID</strong> ' + o.playerUID + '</p>' +
            '<p><strong>💎</strong> ' + o.topupLabel + '</p>' +
            '<p><strong>💰</strong> ₹' + o.price + '</p>' +
            '<p><strong>📅</strong> ' + new Date(o.createdAt).toLocaleString('en-IN') + '</p>' +
            '<p><strong>📌</strong> <span class="status-badge ' + (o.status === 'complete' ? 'status-complete' : 'status-pending') + '">' + o.status + '</span></p>' +
            (o.screenshot ? '<details><summary>📸 Screenshot</summary><img src="' + o.screenshot + '" style="max-width:100%;border-radius:8px;margin-top:6px"></details>' : '') +
            '<div class="admin-actions">' +
            (o.status === 'pending'
                ? '<button class="btn btn-sm btn-success" onclick="markComplete(' + i + ')">✅ Complete</button>'
                : '<button class="btn btn-sm btn-warning" onclick="markPending(' + i + ')">⏳ Pending</button>') +
            '<button class="btn btn-sm btn-danger" onclick="deleteOrder(' + i + ')">🗑 Delete</button>' +
            '</div></div>';
    }).join('');
}

function markComplete(i) { updateOrderStatus(i, 'complete'); }
function markPending(i)  { updateOrderStatus(i, 'pending');  }

function updateOrderStatus(i, status) {
    var orders = getOrders();
    orders[i].status = status;
    saveOrders(orders);
    loadAllOrders();
    showToast('Order marked ' + status, 'success');
}

function deleteOrder(i) {
    if (!confirm('Delete this order?')) return;
    var orders = getOrders();
    orders.splice(i, 1);
    saveOrders(orders);
    loadAllOrders();
    showToast('Deleted', 'success');
}

function refreshAdminOrders() { loadAllOrders(); showToast('🔄 Refreshed'); }

// ── Stock Management ──
function loadStockManagement() {
    var c = document.getElementById('stockManagementContainer');
    if (!c) return;
    var stock = getStockStatus();
    var html  = '<h4 style="margin-bottom:8px">Diamonds</h4>';
    diamondTopups.forEach(function(item, i) {
        var inStock = stock['diamond_' + i] !== false;
        html += '<div class="stock-item"><span>💎 ' + item.diamonds + ' - ₹' + item.price + '</span>' +
                '<button class="btn btn-sm ' + (inStock ? 'btn-warning' : 'btn-success') + '" onclick="toggleStock(\'diamond\',' + i + ')">' +
                (inStock ? 'Mark Out' : 'Mark In') + '</button></div>';
    });
    html += '<h4 style="margin-top:12px;margin-bottom:8px">Memberships</h4>';
    membershipTopups.forEach(function(item, i) {
        var inStock = stock['membership_' + i] !== false;
        html += '<div class="stock-item"><span>' + item.icon + ' ' + item.name + ' - ₹' + item.price + '</span>' +
                '<button class="btn btn-sm ' + (inStock ? 'btn-warning' : 'btn-success') + '" onclick="toggleStock(\'membership\',' + i + ')">' +
                (inStock ? 'Mark Out' : 'Mark In') + '</button></div>';
    });
    c.innerHTML = html;
}

function toggleStock(type, index) {
    var stock = getStockStatus();
    stock[type + '_' + index] = !stock[type + '_' + index];
    saveStockStatus(stock);
    renderTopupGrids();
    loadStockManagement();
}

function setAllOutOfStock() {
    if (!confirm('Mark ALL items out of stock?')) return;
    var stock = {};
    diamondTopups.forEach(function(_, i)    { stock['diamond_' + i]    = false; });
    membershipTopups.forEach(function(_, i) { stock['membership_' + i] = false; });
    saveStockStatus(stock);
    renderTopupGrids();
    loadStockManagement();
    showToast('All items set to Out of Stock', 'success');
}

function resetAllInStock() {
    var stock = {};
    diamondTopups.forEach(function(_, i)    { stock['diamond_' + i]    = true; });
    membershipTopups.forEach(function(_, i) { stock['membership_' + i] = true; });
    saveStockStatus(stock);
    renderTopupGrids();
    loadStockManagement();
    showToast('All items now In Stock', 'success');
}

// ── Admin Account ──
function ensureAdminAccount() {
    var users = getUsers();
    if (!users['admin@aadityatopup.com']) {
        users['admin@aadityatopup.com'] = { password: 'Admin@2026', createdAt: new Date().toISOString() };
        saveUsers(users);
    }
}

// ── Init ──
document.addEventListener('DOMContentLoaded', function() {
    ensureAdminAccount();
    renderTopupGrids();
    setupScreenshotUploader();
    checkPersistedSession();
});
