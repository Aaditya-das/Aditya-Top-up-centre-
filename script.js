// ══════════════════════════════════════════
//  Aaditya Top Up Centre — script.js
//  Database: Supabase
// ══════════════════════════════════════════

// ── Config ──
var SUPABASE_URL = 'https://wrabhrbvnipnxzeebadm.supabase.co';
var SUPABASE_KEY = 'sb_publishable_0iST9QwDsaLU2sKmo4qvhQ_FmXgMFp0';
var ADMIN_EMAIL  = 'aadityadas4000@gmail.com';

// ── Init Supabase ──
var _supabase;
try {
    _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch(e) {
    console.error('Supabase init failed:', e);
}

// ── State ──
var currentUser             = null;
var isAdmin                 = false;
var selectedTopup           = null;
var paymentScreenshotBase64 = null;

// ── Notification Channels ──
var _userChannel    = null;
var _adminChannel   = null;
var _newOrderCount  = 0;

// ── Data ──
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
    { name: 'Weekly Membership',      price: 220,  icon: '📅' },
    { name: 'Monthly Membership',     price: 1100, icon: '📆' },
    { name: 'Weekly + Monthly Combo', price: 1180, icon: '🎁' }
];

// ══════════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════════

function showToast(msg, type, duration) {
    duration = duration || 3000;
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.className   = 'toast ' + (type || '') + ' show';
    clearTimeout(t._t);
    t._t = setTimeout(function() { t.classList.remove('show'); }, duration);
}

// ══════════════════════════════════════════
//  NOTIFICATIONS
// ══════════════════════════════════════════

// ── Request browser notification permission ──
function requestNotificationPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

// ── Send browser notification ──
function sendBrowserNotification(title, body) {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    try {
        new Notification(title, {
            body: body,
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">💎</text></svg>'
        });
    } catch(e) { console.log('Notification error:', e); }
}

// ── Update admin notification badge ──
function updateNotificationBadge() {
    _newOrderCount++;
    var badge = document.getElementById('notifBadge');
    if (badge) {
        badge.textContent = _newOrderCount;
        badge.classList.remove('hidden');
    }
    var bell = document.getElementById('notifBell');
    if (bell) bell.style.animation = 'bellRing 0.5s ease 3';
}

function clearNotificationBadge() {
    _newOrderCount = 0;
    var badge = document.getElementById('notifBadge');
    if (badge) badge.classList.add('hidden');
}

// ── Subscribe user to their order updates (Supabase Realtime) ──
function subscribeToOrderUpdates() {
    if (!currentUser) return;
    if (_userChannel) { _supabase.removeChannel(_userChannel); _userChannel = null; }

    _userChannel = _supabase
        .channel('user-orders-' + currentUser.id)
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders'
        }, function(payload) {
            // Only notify if it's this user's order and it just became complete
            if (payload.new &&
                payload.new.customer_email === currentUser.email &&
                payload.new.status === 'complete' &&
                payload.old.status !== 'complete') {

                // Browser notification
                sendBrowserNotification(
                    '✅ Order Complete! 💎',
                    'Your ' + payload.new.topup_label + ' has been delivered! Check your Free Fire account.'
                );

                // In-app toast
                showToast('🎉 Your order is complete! Diamonds delivered!', 'success', 6000);

                // Refresh order history
                loadOrderHistory();

                // Show in-app popup
                showOrderCompletePopup(payload.new);
            }
        })
        .subscribe();
}

// ── Subscribe admin to new orders (Supabase Realtime) ──
function subscribeToNewOrders() {
    if (_adminChannel) { _supabase.removeChannel(_adminChannel); _adminChannel = null; }

    _adminChannel = _supabase
        .channel('admin-new-orders')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'orders'
        }, function(payload) {
            if (!payload.new) return;

            // Browser notification
            sendBrowserNotification(
                '🔔 New Order Received!',
                payload.new.customer_email + ' ordered ' + payload.new.topup_label + ' — ₹' + payload.new.price
            );

            // In-app toast
            showToast('🔔 New order! ' + payload.new.topup_label + ' — ₹' + payload.new.price, 'success', 6000);

            // Update badge
            updateNotificationBadge();

            // Refresh orders list
            loadAllOrders();
        })
        .subscribe();
}

// ── Unsubscribe all channels ──
function unsubscribeAll() {
    if (_userChannel)  { try { _supabase.removeChannel(_userChannel);  } catch(e){} _userChannel  = null; }
    if (_adminChannel) { try { _supabase.removeChannel(_adminChannel); } catch(e){} _adminChannel = null; }
}

// ── Show order complete popup for user ──
function showOrderCompletePopup(order) {
    var modal = document.getElementById('orderCompleteModal');
    var text  = document.getElementById('orderCompleteText');
    if (!modal || !text) return;
    text.textContent = 'Your ' + order.topup_label + ' has been delivered to ' + order.in_game_name + '! Open Free Fire to check. 💎';
    modal.classList.remove('hidden');
}

function closeOrderCompleteModal() {
    var modal = document.getElementById('orderCompleteModal');
    if (modal) modal.classList.add('hidden');
}

function togglePasswordVisibility() {
    var input = document.getElementById('authPassword');
    var btn   = document.getElementById('authPasswordToggle');
    if (input.type === 'password') { input.type = 'text';     btn.textContent = '🙈'; }
    else                           { input.type = 'password'; btn.textContent = '👁️'; }
}

function isAllowedEmail(email) {
    email = email.trim().toLowerCase();
    if (email === ADMIN_EMAIL) return true; // admin Gmail always allowed
    return email.endsWith('@gmail.com') && email.length > '@gmail.com'.length;
}

function setBtn(id, disabled, text) {
    var btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled     = disabled;
    btn.textContent  = text;
}

// ══════════════════════════════════════════
//  PANELS
// ══════════════════════════════════════════

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

// ══════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════

async function handleSignUp() {
    var email    = document.getElementById('authEmail').value.trim();
    var password = document.getElementById('authPassword').value.trim();

    if (!email && !password) return showToast('⚠️ Please enter your email and password', 'error');
    if (!email)              return showToast('⚠️ Please enter your email address', 'error');
    if (!password)           return showToast('⚠️ Please enter a password', 'error');
    if (!isAllowedEmail(email)) return showToast('❌ Only Gmail addresses allowed  e.g. you@gmail.com', 'error');
    if (password.length < 6) return showToast('❌ Password too short — use at least 6 characters', 'error');

    showToast('⏳ Creating your account...', '');
    try {
        var res = await _supabase.auth.signUp({ email: email, password: password });
        if (res.error) {
            var msg = res.error.message.toLowerCase();
            if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('user already'))
                showToast('❌ This email is already registered — try Sign In instead', 'error');
            else if (msg.includes('invalid email'))
                showToast('❌ That email address looks invalid — check and try again', 'error');
            else if (msg.includes('weak password'))
                showToast('❌ Password is too weak — use letters, numbers and symbols', 'error');
            else if (msg.includes('network') || msg.includes('fetch'))
                showToast('⚠️ No internet — check your connection and try again', 'error');
            else
                showToast('❌ ' + res.error.message, 'error');
        } else {
            showToast('✅ Account created! Welcome!', 'success');
        }
    } catch(e) {
        showToast('❌ Connection error — check your internet and try again', 'error');
    }
}

async function handleSignIn() {
    var email    = document.getElementById('authEmail').value.trim();
    var password = document.getElementById('authPassword').value.trim();

    if (!email && !password) return showToast('⚠️ Please enter your email and password', 'error');
    if (!email)              return showToast('⚠️ Please enter your email address', 'error');
    if (!password)           return showToast('⚠️ Please enter your password', 'error');
    if (!isAllowedEmail(email)) return showToast('❌ Only Gmail addresses allowed  e.g. you@gmail.com', 'error');

    showToast('⏳ Signing you in...', '');
    try {
        var res = await _supabase.auth.signInWithPassword({ email: email, password: password });
        if (res.error) {
            var msg = res.error.message.toLowerCase();
            if (msg.includes('invalid login') || msg.includes('invalid credentials') || msg.includes('wrong') || msg.includes('invalid'))
                showToast('❌ Wrong password — please try again', 'error');
            else if (msg.includes('user not found') || msg.includes('no user'))
                showToast('❌ No account found — please Sign Up first', 'error');
            else if (msg.includes('email not confirmed'))
                showToast('❌ Please confirm your email — check your inbox', 'error');
            else if (msg.includes('too many') || msg.includes('rate limit'))
                showToast('⚠️ Too many attempts — wait a few minutes and try again', 'error');
            else if (msg.includes('network') || msg.includes('fetch'))
                showToast('⚠️ No internet — check your connection and try again', 'error');
            else
                showToast('❌ ' + res.error.message, 'error');
        }
        // success is handled by onAuthStateChange
    } catch(e) {
        showToast('❌ Connection error — check your internet and try again', 'error');
    }
}

async function handleLogout() {
    unsubscribeAll();
    try { await _supabase.auth.signOut(); } catch(e) {}
    currentUser             = null;
    isAdmin                 = false;
    selectedTopup           = null;
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
    document.querySelectorAll('.selected').forEach(function(el){ el.classList.remove('selected'); });
    showAuthSection();
    showToast('👋 Logged out');
}

// ── Auth State Listener ──
var _authLoaded = false;
// Timeout — if auth doesn't respond in 4s, show auth section
var _authTimeout = setTimeout(function() {
    if (!_authLoaded) {
        _authLoaded = true;
        showAuthSection();
    }
}, 4000);

_supabase.auth.onAuthStateChange(function(event, session) {
    clearTimeout(_authTimeout);
    _authLoaded = true;

    if (session && session.user) {
        currentUser = session.user;
        isAdmin     = (currentUser.email === ADMIN_EMAIL);

        // Request notification permission on login
        requestNotificationPermission();

        if (isAdmin) {
            showAdminPanel();
            loadAllOrders();
            loadStockManagement();
            // Admin listens for new orders
            subscribeToNewOrders();
        } else {
            showCustomerDashboard();
            renderTopupGrids();
            loadOrderHistory();
            // User listens for their order status changes
            subscribeToOrderUpdates();
        }
    } else {
        currentUser = null;
        isAdmin     = false;
        unsubscribeAll();
        showAuthSection();
    }
});

// ══════════════════════════════════════════
//  STOCK
// ══════════════════════════════════════════

function getDefaultStock() {
    var s = {};
    diamondTopups.forEach(function(_, i)    { s['diamond_' + i]    = true; });
    membershipTopups.forEach(function(_, i) { s['membership_' + i] = true; });
    return s;
}

async function getStockStatus() {
    try {
        var res = await _supabase.from('stock').select('*');
        var stock = getDefaultStock();
        if (res.data && res.data.length) {
            res.data.forEach(function(row) { stock[row.key] = row.in_stock; });
        }
        return stock;
    } catch(e) { return getDefaultStock(); }
}

async function setStockItem(key, inStock) {
    try {
        await _supabase.from('stock').upsert({ key: key, in_stock: inStock }, { onConflict: 'key' });
    } catch(e) { console.error('Stock update failed', e); }
}

// ══════════════════════════════════════════
//  TOPUP GRIDS
// ══════════════════════════════════════════

async function renderTopupGrids() {
    document.getElementById('diamondGrid').innerHTML    = '<p style="text-align:center;color:var(--text-light);grid-column:1/-1">Loading...</p>';
    document.getElementById('membershipGrid').innerHTML = '';
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
               '<div><span class="membership-name">' + item.icon + ' ' + item.name + '</span><br>' + badge + '</div>' +
               '<span class="membership-price">₹' + item.price + '</span></div>';
    }).join('');
}

// ══════════════════════════════════════════
//  SELECT & ORDER FLOW
// ══════════════════════════════════════════

function selectTopup(el, type, index) {
    document.querySelectorAll('.topup-item.selected,.membership-item.selected')
            .forEach(function(e) { e.classList.remove('selected'); });
    el.classList.add('selected');

    if (type === 'diamond') {
        var item  = diamondTopups[index];
        selectedTopup = { type: 'diamond', label: item.diamonds + ' Diamonds', price: item.price };
    } else {
        var item  = membershipTopups[index];
        selectedTopup = { type: 'membership', label: item.name, price: item.price };
    }

    document.getElementById('gameDetailsCard').classList.remove('hidden');
    document.getElementById('orderSummaryCard').classList.remove('hidden');
    document.getElementById('orderSummaryContent').innerHTML =
        '<div style="background:#f8faff;padding:14px;border-radius:10px;text-align:center">' +
        '<p style="font-size:1.1rem;font-weight:700">' + (type === 'diamond' ? '💎' : '🏅') +
        ' ' + selectedTopup.label + '</p>' +
        '<p style="font-size:1.5rem;font-weight:800;color:#059669">₹' + selectedTopup.price + '</p></div>';
    document.getElementById('gameDetailsCard').scrollIntoView({ behavior: 'smooth' });
}

function proceedToPayment() {
    var name = document.getElementById('inGameName').value.trim();
    var uid  = document.getElementById('playerUID').value.trim();
    if (!name)                  return showToast('Enter your in-game name', 'error');
    if (!uid || uid.length < 6) return showToast('Enter a valid UID (min 6 digits)', 'error');
    if (!selectedTopup)         return showToast('Select a top-up package', 'error');
    document.getElementById('paymentSection').classList.remove('hidden');
    document.getElementById('paymentSection').scrollIntoView({ behavior: 'smooth' });
}

function cancelPayment() {
    document.getElementById('paymentSection').classList.add('hidden');
    document.getElementById('orderSummaryCard').scrollIntoView({ behavior: 'smooth' });
}

// ══════════════════════════════════════════
//  SCREENSHOT UPLOAD
// ══════════════════════════════════════════

function setupScreenshotUploader() {
    var area = document.getElementById('uploadArea');
    if (!area) return;
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
    if (!file.type.startsWith('image/')) return showToast('Please upload an image file', 'error');
    if (file.size > 10 * 1024 * 1024)   return showToast('File too large (max 10MB)', 'error');

    var reader = new FileReader();
    reader.onload = function(e) {
        compressImage(e.target.result, 700, 0.6, function(b64) {
            paymentScreenshotBase64 = b64;
            document.getElementById('uploadPreview').src = b64;
            document.getElementById('uploadPreview').classList.add('show');
            document.getElementById('uploadArea').classList.add('has-file');
            document.getElementById('confirmOrderBtn').disabled = false;
            showToast('📸 Screenshot uploaded!', 'success');
        });
    };
    reader.onerror = function() { showToast('Failed to read file', 'error'); };
    reader.readAsDataURL(file);
}

function compressImage(dataUrl, maxW, quality, cb) {
    var img = new Image();
    img.onload = function() {
        var canvas = document.createElement('canvas');
        var w = img.width, h = img.height;
        if (w > maxW) { h = Math.round((maxW / w) * h); w = maxW; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        cb(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = function() { showToast('Failed to process image', 'error'); };
    img.src = dataUrl;
}

// ══════════════════════════════════════════
//  PLACE ORDER
// ══════════════════════════════════════════

async function confirmPlaceOrder() {
    var name = document.getElementById('inGameName').value.trim();
    var uid  = document.getElementById('playerUID').value.trim();
    if (!name || !uid || !selectedTopup || !paymentScreenshotBase64)
        return showToast('Please complete all fields', 'error');

    var btn = document.getElementById('confirmOrderBtn');
    btn.disabled    = true;
    btn.textContent = '⏳ Placing Order...';

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

    try {
        var res = await _supabase.from('orders').insert([order]);
        if (res.error) {
            showToast('❌ Failed to place order: ' + res.error.message, 'error');
            btn.disabled    = false;
            btn.textContent = '✅ Confirm & Place Order';
            return;
        }

        // ── Send email notification to admin ──
        sendAdminEmailNotification(order);

        document.getElementById('thankYouModal').classList.remove('hidden');
        resetAfterOrder();
        loadOrderHistory();
    } catch(e) {
        showToast('❌ Connection error. Try again.', 'error');
        btn.disabled    = false;
        btn.textContent = '✅ Confirm & Place Order';
    }
}

// ── Send email to admin (aadityadas4000@gmail.com) when new order ──
function sendAdminEmailNotification(order) {
    try {
        fetch('https://formsubmit.co/ajax/aadityadas4000@gmail.com', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                _subject:      '🔔 New Order! ' + order.topup_label + ' — ₹' + order.price,
                'Order ID':    order.order_id,
                'Customer':    order.customer_email,
                'In-Game Name': order.in_game_name,
                'Player UID':  order.player_uid,
                'Package':     order.topup_label,
                'Amount':      '₹' + order.price,
                'Status':      'Pending',
                'Message':     'A new order has been placed on Aaditya Top Up Centre. Please process it!'
            })
        });
    } catch(e) { console.log('Email notification failed:', e); }
}

function resetAfterOrder() {
    selectedTopup           = null;
    paymentScreenshotBase64 = null;
    document.getElementById('paymentSection').classList.add('hidden');
    document.getElementById('orderSummaryCard').classList.add('hidden');
    document.getElementById('gameDetailsCard').classList.add('hidden');
    document.querySelectorAll('.selected').forEach(function(el){ el.classList.remove('selected'); });
    document.getElementById('inGameName').value   = '';
    document.getElementById('playerUID').value    = '';
    document.getElementById('uploadArea').classList.remove('has-file');
    document.getElementById('uploadPreview').classList.remove('show');
    document.getElementById('confirmOrderBtn').disabled    = true;
    document.getElementById('confirmOrderBtn').textContent = '✅ Confirm & Place Order';
    // Reset file input
    var fi = document.getElementById('screenshotInput');
    if (fi) fi.value = '';
}

function closeThankYou() {
    document.getElementById('thankYouModal').classList.add('hidden');
}

// ══════════════════════════════════════════
//  ORDER HISTORY (Customer)
// ══════════════════════════════════════════

async function loadOrderHistory() {
    if (!currentUser) return;
    var c = document.getElementById('orderHistoryContainer');
    c.innerHTML = '<p style="text-align:center;color:var(--text-light)">Loading orders...</p>';
    try {
        var res = await _supabase
            .from('orders')
            .select('order_id, in_game_name, player_uid, topup_label, price, status, created_at')
            .eq('customer_email', currentUser.email)
            .order('created_at', { ascending: false });

        if (res.error) throw res.error;
        if (!res.data || !res.data.length) {
            c.innerHTML = '<p style="text-align:center;color:var(--text-light)">No orders yet.</p>';
            return;
        }
        c.innerHTML =
            '<div style="overflow-x:auto">' +
            '<table class="order-table"><thead><tr>' +
            '<th>Status</th><th>Order ID</th><th>Name</th><th>UID</th><th>Package</th><th>Amount</th><th>Date</th>' +
            '</tr></thead><tbody>' +
            res.data.map(function(o) {
                return '<tr>' +
                    '<td><span class="status-badge ' + (o.status === 'complete' ? 'status-complete' : 'status-pending') + '">' + o.status + '</span></td>' +
                    '<td style="font-size:0.7rem;white-space:nowrap">' + o.order_id + '</td>' +
                    '<td>' + o.in_game_name + '</td>' +
                    '<td>' + o.player_uid + '</td>' +
                    '<td>' + o.topup_label + '</td>' +
                    '<td>₹' + o.price + '</td>' +
                    '<td style="white-space:nowrap">' + new Date(o.created_at).toLocaleDateString('en-IN') + '</td>' +
                    '</tr>';
            }).join('') +
            '</tbody></table></div>';
    } catch(e) {
        c.innerHTML = '<p style="text-align:center;color:#ef4444">Failed to load orders. Check connection.</p>';
    }
}

// ══════════════════════════════════════════
//  ADMIN — ALL ORDERS
// ══════════════════════════════════════════

async function loadAllOrders() {
    var c = document.getElementById('adminOrdersContainer');
    c.innerHTML = '<p style="padding:12px;text-align:center">Loading orders...</p>';
    try {
        var res = await _supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (res.error) throw res.error;
        if (!res.data || !res.data.length) {
            c.innerHTML = '<p style="padding:12px;text-align:center;color:var(--text-light)">No orders yet.</p>';
            return;
        }
        c.innerHTML = res.data.map(function(o) {
            return '<div class="admin-order-card ' + (o.status === 'complete' ? 'complete' : '') + '">' +
                '<p><strong>🆔</strong> ' + o.order_id + '</p>' +
                '<p><strong>👤</strong> ' + o.customer_email + '</p>' +
                '<p><strong>🧑</strong> ' + o.in_game_name + '</p>' +
                '<p><strong>UID</strong> ' + o.player_uid + '</p>' +
                '<p><strong>💎</strong> ' + o.topup_label + '</p>' +
                '<p><strong>💰</strong> ₹' + o.price + '</p>' +
                '<p><strong>📅</strong> ' + new Date(o.created_at).toLocaleString('en-IN') + '</p>' +
                '<p><strong>📌</strong> <span class="status-badge ' +
                (o.status === 'complete' ? 'status-complete' : 'status-pending') + '">' + o.status + '</span></p>' +
                (o.screenshot
                    ? '<details><summary style="cursor:pointer;font-weight:600;margin:6px 0">📸 View Screenshot</summary>' +
                      '<img src="' + o.screenshot + '" style="max-width:100%;border-radius:8px;margin-top:6px"></details>'
                    : '') +
                '<div class="admin-actions">' +
                (o.status === 'pending'
                    ? '<button class="btn btn-sm btn-success" onclick="markComplete(\'' + o.id + '\')">✅ Complete</button>'
                    : '<button class="btn btn-sm btn-warning" onclick="markPending(\'' + o.id + '\')">⏳ Pending</button>') +
                '<button class="btn btn-sm btn-danger" onclick="deleteOrder(\'' + o.id + '\')">🗑 Delete</button>' +
                '</div></div>';
        }).join('');
    } catch(e) {
        c.innerHTML = '<p style="padding:12px;text-align:center;color:#ef4444">Failed to load orders.</p>';
    }
}

async function markComplete(id) { await updateOrderStatus(id, 'complete'); }
async function markPending(id)  { await updateOrderStatus(id, 'pending');  }

async function updateOrderStatus(id, status) {
    try {
        var res = await _supabase.from('orders').update({ status: status }).eq('id', id);
        if (res.error) throw res.error;
        showToast('Order marked ' + status + '!', 'success');
        loadAllOrders();
    } catch(e) {
        showToast('❌ Failed to update order', 'error');
    }
}

async function deleteOrder(id) {
    if (!confirm('Delete this order? This cannot be undone.')) return;
    try {
        var res = await _supabase.from('orders').delete().eq('id', id);
        if (res.error) throw res.error;
        showToast('🗑 Order deleted', 'success');
        loadAllOrders();
    } catch(e) {
        showToast('❌ Failed to delete order', 'error');
    }
}

// ══════════════════════════════════════════
//  ADMIN — STOCK MANAGEMENT
// ══════════════════════════════════════════

async function loadStockManagement() {
    var c = document.getElementById('stockManagementContainer');
    if (!c) return;
    c.innerHTML = '<p style="color:var(--text-light)">Loading stock...</p>';
    var stock = await getStockStatus();
    var html  = '<h4 style="margin-bottom:8px;color:var(--primary-dark)">💎 Diamonds</h4>';

    diamondTopups.forEach(function(item, i) {
        var inStock = stock['diamond_' + i] !== false;
        html += '<div class="stock-item">' +
                '<span>💎 ' + item.diamonds + ' — ₹' + item.price + '</span>' +
                '<button class="btn btn-sm ' + (inStock ? 'btn-warning' : 'btn-success') +
                '" onclick="toggleStock(\'diamond\',' + i + ')">' +
                (inStock ? '⛔ Mark Out' : '✅ Mark In') + '</button></div>';
    });

    html += '<h4 style="margin-top:14px;margin-bottom:8px;color:var(--primary-dark)">🏅 Memberships</h4>';
    membershipTopups.forEach(function(item, i) {
        var inStock = stock['membership_' + i] !== false;
        html += '<div class="stock-item">' +
                '<span>' + item.icon + ' ' + item.name + ' — ₹' + item.price + '</span>' +
                '<button class="btn btn-sm ' + (inStock ? 'btn-warning' : 'btn-success') +
                '" onclick="toggleStock(\'membership\',' + i + ')">' +
                (inStock ? '⛔ Mark Out' : '✅ Mark In') + '</button></div>';
    });
    c.innerHTML = html;
}

async function toggleStock(type, index) {
    var stock  = await getStockStatus();
    var key    = type + '_' + index;
    var newVal = !stock[key];
    await setStockItem(key, newVal);
    showToast(newVal ? '✅ Marked In Stock' : '⛔ Marked Out of Stock', 'success');
    loadStockManagement();
}

async function setAllOutOfStock() {
    if (!confirm('Mark ALL items out of stock?')) return;
    var tasks = [];
    diamondTopups.forEach(function(_, i)    { tasks.push(setStockItem('diamond_' + i, false)); });
    membershipTopups.forEach(function(_, i) { tasks.push(setStockItem('membership_' + i, false)); });
    await Promise.all(tasks);
    showToast('⛔ All items set Out of Stock', 'success');
    loadStockManagement();
}

async function resetAllInStock() {
    var tasks = [];
    diamondTopups.forEach(function(_, i)    { tasks.push(setStockItem('diamond_' + i, true)); });
    membershipTopups.forEach(function(_, i) { tasks.push(setStockItem('membership_' + i, true)); });
    await Promise.all(tasks);
    showToast('✅ All items now In Stock', 'success');
    loadStockManagement();
}

// ══════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function() {
    setupScreenshotUploader();
    document.getElementById('loadingSection').classList.remove('hidden');
    document.getElementById('authSection').classList.add('hidden');
});
