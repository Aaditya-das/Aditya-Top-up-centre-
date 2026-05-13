// ── Supabase Config ──
const SUPABASE_URL = 'https://wrabhrbvnipnxzeebadm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0iST9QwDsaLU2sKmo4qvhQ_FmXgMFp0';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const ADMIN_EMAIL = 'admin@aadityatopup.com';
let currentUser = null;
let isAdmin = false;
let selectedTopup = null;
let paymentScreenshotBase64 = null;

const diamondTopups = [
    { diamonds: 115,  price: 120  }, { diamonds: 240,  price: 220  },
    { diamonds: 355,  price: 340  }, { diamonds: 480,  price: 440  },
    { diamonds: 610,  price: 560  }, { diamonds: 725,  price: 650  },
    { diamonds: 850,  price: 760  }, { diamonds: 965,  price: 880  },
    { diamonds: 1090, price: 970  }, { diamonds: 1240, price: 1080 },
    { diamonds: 1355, price: 1200 }, { diamonds: 1480, price: 1300 },
    { diamonds: 1720, price: 1600 }, { diamonds: 2090, price: 1800 },
    { diamonds: 2530, price: 2200 }
];
const membershipTopups = [
    { name: 'Weekly Membership',      price: 220,  icon: '📅' },
    { name: 'Monthly Membership',     price: 1100, icon: '📆' },
    { name: 'Weekly + Monthly Combo', price: 1180, icon: '🎁' }
];

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

// ── Email Validation ──
function isAllowedEmail(email) {
    email = email.trim().toLowerCase();
    if (email === ADMIN_EMAIL) return true;
    return email.endsWith('@gmail.com') && email.length > '@gmail.com'.length;
}

// ── Show / Hide Panels ──
function showAuthSection() {
    document.getElementById('authSection').classList.remove('hidden');
    document.getElementById('customerDashboard').classList.add('hidden');
    document.getElementById('adminPanel').classList.add('hidden');
    document.getElementById('loadingSection').classList.add('hidden');
}
function showCustomerDashboard() {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('customerDashboard').classList.remove('hidden');
    document.getElementById('adminPanel').classList.add('hidden');
    document.getElementById('loadingSection').classList.add('hidden');
}
function showAdminPanel() {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('customerDashboard').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    document.getElementById('loadingSection').classList.add('hidden');
}

// ── Sign Up ──
async function handleSignUp() {
    var email    = document.getElementById('authEmail').value.trim();
    var password = document.getElementById('authPassword').value.trim();
    if (!email || !password)      return showToast('Enter email and password', 'error');
    if (!isAllowedEmail(email))   return showToast('❌ Use a valid Gmail address', 'error');
    if (password.length < 6)      return showToast('Password must be at least 6 characters', 'error');

    showToast('Creating account...', '');
    var result = await db.auth.signUp({ email: email, password: password });
    if (result.error) {
        showToast('❌ ' + result.error.message, 'error');
    } else {
        showToast('✅ Account created! You are now logged in.', 'success');
    }
}

// ── Sign In ──
async function handleSignIn() {
    var email    = document.getElementById('authEmail').value.trim();
    var password = document.getElementById('authPassword').value.trim();
    if (!email || !password)    return showToast('Enter email and password', 'error');
    if (!isAllowedEmail(email)) return showToast('❌ Use a valid Gmail address', 'error');

    showToast('Signing in...', '');
    var result = await db.auth.signInWithPassword({ email: email, password: password });
    if (result.error) {
        if (result.error.message.toLowerCase().includes('invalid'))
            showToast('❌ Incorrect email or password', 'error');
        else
            showToast('❌ ' + result.error.message, 'error');
    } else {
        showToast('✅ Signed in!', 'success');
    }
}

// ── Logout ──
async function handleLogout() {
    await db.auth.signOut();
    selectedTopup = null;
    paymentScreenshotBase64 = null;
    document.getElementById('authEmail').value    = '';
    document.getElementById('authPassword').value = '';
    document.getElementById('inGameName').value   = '';
    document.getElementById('playerUID').value    = '';
    document.getElementById('gameDetailsCard').classList.add('hidden');
    document.getElementById('orderSummaryCard').classList.add('hidden');
    document.getElementById('paymentSection').classList.add('hidden');
    document.getElementById('uploadArea').classList.remove('has-file');
    document.getElementById('uploadPreview').classList.remove('show');
    document.getElementById('confirmOrderBtn').disabled = true;
    document.querySelectorAll('.selected').forEach(function(el) { el.classList.remove('selected'); });
    showToast('👋 Logged out');
}

// ── Auth State Listener ──
db.auth.onAuthStateChange(function(event, session) {
    if (session && session.user) {
        currentUser = session.user;
        isAdmin = (currentUser.email === ADMIN_EMAIL);
        if (isAdmin) {
            showAdminPanel();
            loadAllOrders();
            loadStockManagement();
        } else {
            showCustomerDashboard();
            renderTopupGrids();
            loadOrderHistory();
        }
    } else {
        currentUser = null;
        isAdmin = false;
        showAuthSection();
    }
});

// ── Stock from Supabase ──
async function getStockStatus() {
    var result = await db.from('stock').select('*');
    var stock  = {};
    // Default all in stock
    diamondTopups.forEach(function(_, i)    { stock['diamond_' + i]    = true; });
    membershipTopups.forEach(function(_, i) { stock['membership_' + i] = true; });
    if (result.data && result.data.length) {
        result.data.forEach(function(row) { stock[row.key] = row.in_stock; });
    }
    return stock;
}

async function setStockItem(key, inStock) {
    await db.from('stock').upsert({ key: key, in_stock: inStock });
}

// ── Render Grids ──
async function renderTopupGrids() {
    var stock = await getStockStatus();

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
    document.querySelectorAll('.topup-item.selected,.membership-item.selected')
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
    if (!name)                  return showToast('Enter your in-game name', 'error');
    if (!uid || uid.length < 6) return showToast('Enter a valid UID', 'error');
    if (!selectedTopup)         return showToast('Select a top-up package', 'error');
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
        e.preventDefault(); area.style.borderColor = '#cbd5e1';
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
async function confirmPlaceOrder() {
    var name = document.getElementById('inGameName').value.trim();
    var uid  = document.getElementById('playerUID').value.trim();
    if (!name || !uid || !selectedTopup || !paymentScreenshotBase64)
        return showToast('Please complete all fields', 'error');

    document.getElementById('confirmOrderBtn').disabled = true;
    showToast('Placing order...', '');

    var order = {
        order_id:       'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5).toUpperCase(),
        customer_email: currentUser.email,
        in_game_name:   name,
        player_uid:     uid,
        topup_label:    selectedTopup.label,
        price:          selectedTopup.price,
        screenshot:     paymentScreenshotBase64,
        status:         'pending'
    };

    var result = await db.from('orders').insert([order]);
    if (result.error) {
        showToast('❌ Failed to place order. Try again.', 'error');
        document.getElementById('confirmOrderBtn').disabled = false;
        return;
    }

    document.getElementById('thankYouModal').classList.remove('hidden');
    loadOrderHistory();
    resetAfterOrder();
}

function resetAfterOrder() {
    selectedTopup = null; paymentScreenshotBase64 = null;
    document.getElementById('paymentSection').classList.add('hidden');
    document.getElementById('orderSummaryCard').classList.add('hidden');
    document.getElementById('gameDetailsCard').classList.add('hidden');
    document.querySelectorAll('.selected').forEach(function(el) { el.classList.remove('selected'); });
    document.getElementById('inGameName').value = '';
    document.getElementById('playerUID').value  = '';
    document.getElementById('uploadArea').classList.remove('has-file');
    document.getElementById('uploadPreview').classList.remove('show');
    document.getElementById('confirmOrderBtn').disabled = true;
}

function closeThankYou() {
    document.getElementById('thankYouModal').classList.add('hidden');
}

// ── Order History (Customer) ──
async function loadOrderHistory() {
    if (!currentUser) return;
    var result = await db.from('orders')
        .select('*')
        .eq('customer_email', currentUser.email)
        .order('created_at', { ascending: false });

    var c = document.getElementById('orderHistoryContainer');
    if (!result.data || !result.data.length) {
        c.innerHTML = '<p style="text-align:center; color:var(--text-light)">No orders yet.</p>';
        return;
    }
    c.innerHTML = '<table class="order-table"><thead><tr>' +
        '<th>Status</th><th>Order ID</th><th>Name</th><th>UID</th><th>Package</th><th>Amount</th><th>Date</th>' +
        '</tr></thead><tbody>' +
        result.data.map(function(o) {
            return '<tr>' +
                '<td><span class="status-badge ' + (o.status === 'complete' ? 'status-complete' : 'status-pending') + '">' + o.status + '</span></td>' +
                '<td style="font-size:0.75rem">' + o.order_id + '</td>' +
                '<td>' + o.in_game_name + '</td>' +
                '<td>' + o.player_uid + '</td>' +
                '<td>' + o.topup_label + '</td>' +
                '<td>₹' + o.price + '</td>' +
                '<td>' + new Date(o.created_at).toLocaleDateString('en-IN') + '</td></tr>';
        }).join('') + '</tbody></table>';
}

// ── Admin: All Orders ──
async function loadAllOrders() {
    var result = await db.from('orders')
        .select('*')
        .order('created_at', { ascending: false });

    var c = document.getElementById('adminOrdersContainer');
    if (!result.data || !result.data.length) {
        c.innerHTML = '<p style="padding:12px; text-align:center">No orders yet.</p>';
        return;
    }
    c.innerHTML = result.data.map(function(o) {
        return '<div class="admin-order-card ' + (o.status === 'complete' ? 'complete' : '') + '">' +
            '<p><strong>🆔</strong> ' + o.order_id + '</p>' +
            '<p><strong>👤</strong> ' + o.customer_email + '</p>' +
            '<p><strong>🧑</strong> ' + o.in_game_name + '</p>' +
            '<p><strong>UID</strong> ' + o.player_uid + '</p>' +
            '<p><strong>💎</strong> ' + o.topup_label + '</p>' +
            '<p><strong>💰</strong> ₹' + o.price + '</p>' +
            '<p><strong>📅</strong> ' + new Date(o.created_at).toLocaleString('en-IN') + '</p>' +
            '<p><strong>📌</strong> <span class="status-badge ' + (o.status === 'complete' ? 'status-complete' : 'status-pending') + '">' + o.status + '</span></p>' +
            (o.screenshot ? '<details><summary>📸 Screenshot</summary><img src="' + o.screenshot + '" style="max-width:100%;border-radius:8px;margin-top:6px"></details>' : '') +
            '<div class="admin-actions">' +
            (o.status === 'pending'
                ? '<button class="btn btn-sm btn-success" onclick="markComplete(\'' + o.id + '\')">✅ Complete</button>'
                : '<button class="btn btn-sm btn-warning" onclick="markPending(\'' + o.id + '\')">⏳ Pending</button>') +
            '<button class="btn btn-sm btn-danger" onclick="deleteOrder(\'' + o.id + '\')">🗑 Delete</button>' +
            '</div></div>';
    }).join('');
}

async function markComplete(id) { await updateOrderStatus(id, 'complete'); }
async function markPending(id)  { await updateOrderStatus(id, 'pending');  }

async function updateOrderStatus(id, status) {
    var result = await db.from('orders').update({ status: status }).eq('id', id);
    if (result.error) return showToast('❌ Failed to update', 'error');
    showToast('Order marked ' + status, 'success');
    loadAllOrders();
}

async function deleteOrder(id) {
    if (!confirm('Delete this order?')) return;
    var result = await db.from('orders').delete().eq('id', id);
    if (result.error) return showToast('❌ Failed to delete', 'error');
    showToast('🗑 Deleted', 'success');
    loadAllOrders();
}

// ── Admin: Stock ──
async function loadStockManagement() {
    var c = document.getElementById('stockManagementContainer');
    if (!c) return;
    var stock = await getStockStatus();
    var html  = '<h4 style="margin-bottom:8px">Diamonds</h4>';
    diamondTopups.forEach(function(item, i) {
        var inStock = stock['diamond_' + i] !== false;
        html += '<div class="stock-item">' +
                '<span>💎 ' + item.diamonds + ' — ₹' + item.price + '</span>' +
                '<button class="btn btn-sm ' + (inStock ? 'btn-warning' : 'btn-success') + '" onclick="toggleStock(\'diamond\',' + i + ')">' +
                (inStock ? 'Mark Out' : 'Mark In') + '</button></div>';
    });
    html += '<h4 style="margin-top:12px;margin-bottom:8px">Memberships</h4>';
    membershipTopups.forEach(function(item, i) {
        var inStock = stock['membership_' + i] !== false;
        html += '<div class="stock-item">' +
                '<span>' + item.icon + ' ' + item.name + ' — ₹' + item.price + '</span>' +
                '<button class="btn btn-sm ' + (inStock ? 'btn-warning' : 'btn-success') + '" onclick="toggleStock(\'membership\',' + i + ')">' +
                (inStock ? 'Mark Out' : 'Mark In') + '</button></div>';
    });
    c.innerHTML = html;
}

async function toggleStock(type, index) {
    var stock   = await getStockStatus();
    var key     = type + '_' + index;
    var newVal  = !stock[key];
    await setStockItem(key, newVal);
    renderTopupGrids();
    loadStockManagement();
    showToast(newVal ? '✅ Marked In Stock' : '⛔ Marked Out of Stock', 'success');
}

async function setAllOutOfStock() {
    if (!confirm('Mark ALL items out of stock?')) return;
    var promises = [];
    diamondTopups.forEach(function(_, i)    { promises.push(setStockItem('diamond_' + i, false)); });
    membershipTopups.forEach(function(_, i) { promises.push(setStockItem('membership_' + i, false)); });
    await Promise.all(promises);
    renderTopupGrids();
    loadStockManagement();
    showToast('⛔ All items set to Out of Stock', 'success');
} 
async function resetAllInStock() {
    var promises = [];
    diamondTopups.forEach(function(_, i)    { promises.push(setStockItem('diamond_' + i, true)); });
    membershipTopups.forEach(function(_, i) { promises.push(setStockItem('membership_' + i, true)); });
    await Promise.all(promises);
    renderTopupGrids();
    loadStockManagement();
    showToast('✅ All items now In Stock', 'success');
}

// ── Init ──
document.addEventListener('DOMContentLoaded', function() {
    setupScreenshotUploader();
    document.getElementById('loadingSection').classList.remove('hidden');
    document.getElementById('authSection').classList.add('hidden');
});
