// ══════════════════════════════════════════
//  Aaditya Top Up Centre — script.js v7.0
//  Multi-page | Poppins | Card Design
// ══════════════════════════════════════════

var SUPABASE_URL = 'https://wrabhrbvnipnxzeebadm.supabase.co';
var SUPABASE_KEY = 'sb_publishable_0iST9QwDsaLU2sKmo4qvhQ_FmXgMFp0';
var ADMIN_EMAIL  = 'aadityadas4000@gmail.com';

var _supabase;
try { _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY); }
catch(e) { console.error('Supabase init failed:', e); }

// ── State ──
var currentUser             = null;
var isAdmin                 = false;
var selectedTopup           = null;
var currentGame             = 'freeFire';
var paymentScreenshotBase64 = null;
var selectedStars           = 0;
var _userChannel            = null;
var _adminChannel           = null;
var _newOrderCount          = 0;
var _authLoaded             = false;
var _curReviewGame          = 'freeFire';

// ── Packages ──
var diamondTopups = [
    {diamonds:115,  price:120},  {diamonds:240,  price:220},
    {diamonds:355,  price:340},  {diamonds:480,  price:440},
    {diamonds:610,  price:560},  {diamonds:725,  price:650},
    {diamonds:850,  price:760},  {diamonds:965,  price:880},
    {diamonds:1090, price:970},  {diamonds:1240, price:1080},
    {diamonds:1355, price:1200}, {diamonds:1480, price:1300},
    {diamonds:1720, price:1600}, {diamonds:2090, price:1800},
    {diamonds:2530, price:2200}
];
var membershipTopups = [
    {name:'Weekly Membership',      price:220,  icon:'📅', desc:'7 days access'},
    {name:'Monthly Membership',     price:1100, icon:'📆', desc:'30 days access'},
    {name:'Weekly + Monthly Combo', price:1180, icon:'🎁', desc:'Best value!'}
];
var pubgTopups = [
    {uc:60,   price:180},  {uc:120,  price:360},
    {uc:180,  price:490},  {uc:325,  price:860},
    {uc:385,  price:1000}, {uc:660,  price:1655},
    {uc:720,  price:1810}, {uc:985,  price:2450},
    {uc:1045, price:2600}, {uc:1500, price:3550},
    {uc:1800, price:3950}, {uc:2460, price:5500},
    {uc:3850, price:7810}, {uc:5650, price:11600},
    {uc:6000, price:12300},{uc:8100, price:15700}
];
var AVATARS = ['😊','😎','🎮','🔥','💪','🏆','⚡','🌟','👑','🎯','🦁','🐉'];

// ══════════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════════
function showToast(msg, type, duration) {
    duration = duration || 3000;
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className   = 'toast ' + (type||'') + ' show';
    clearTimeout(t._t);
    t._t = setTimeout(function(){ t.classList.remove('show'); }, duration);
}

function togglePasswordVisibility() {
    var inp = document.getElementById('authPassword');
    var btn = document.getElementById('authPasswordToggle');
    if (inp.type === 'password') { inp.type='text'; btn.textContent='🙈'; }
    else { inp.type='password'; btn.textContent='👁️'; }
}

function isAllowedEmail(email) {
    email = email.trim().toLowerCase();
    if (email === ADMIN_EMAIL) return true;
    return email.endsWith('@gmail.com') && email.length > '@gmail.com'.length;
}

function starsHTML(n) {
    var s = '';
    for (var i=1; i<=5; i++) s += (i<=n ? '★' : '☆');
    return s;
}

function timeAgo(dateStr) {
    var diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60)    return 'Just now';
    if (diff < 3600)  return Math.floor(diff/60) + 'm ago';
    if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
    return Math.floor(diff/86400) + 'd ago';
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Inline field errors ──
function showFieldError(fieldId, msg) {
    clearFieldError(fieldId);
    var field = document.getElementById(fieldId);
    if (!field) return;
    field.style.borderColor = '#ef4444';
    field.style.boxShadow   = '0 0 0 3px rgba(239,68,68,.12)';
    var err = document.createElement('div');
    err.className = 'field-error';
    err.id        = 'err_' + fieldId;
    err.textContent = '❌ ' + msg;
    field.parentNode.insertBefore(err, field.nextSibling);
    field.addEventListener('input', function(){ clearFieldError(fieldId); }, {once:true});
    field.focus();
}
function clearFieldError(fieldId) {
    var f = document.getElementById(fieldId);
    if (f) { f.style.borderColor=''; f.style.boxShadow=''; }
    var e = document.getElementById('err_'+fieldId);
    if (e) e.remove();
}
function clearAllErrors() {
    document.querySelectorAll('.field-error').forEach(function(e){ e.remove(); });
    document.querySelectorAll('.inp').forEach(function(f){ f.style.borderColor=''; f.style.boxShadow=''; });
}

// ══════════════════════════════════════════
//  NOTIFICATIONS
// ══════════════════════════════════════════
function requestNotificationPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') Notification.requestPermission();
}
function sendBrowserNotification(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try { new Notification(title, {body:body}); } catch(e){}
}
function updateNotificationBadge() {
    _newOrderCount++;
    var b = document.getElementById('notifBadge');
    if (b) { b.textContent=_newOrderCount; b.classList.remove('hidden'); }
}
function clearNotificationBadge() {
    _newOrderCount = 0;
    var b = document.getElementById('notifBadge');
    if (b) b.classList.add('hidden');
}
function subscribeToOrderUpdates() {
    if (!currentUser) return;
    if (_userChannel) { try{_supabase.removeChannel(_userChannel);}catch(e){} }
    _userChannel = _supabase.channel('user-orders-'+currentUser.id)
        .on('postgres_changes',{event:'UPDATE',schema:'public',table:'orders'}, function(p){
            if (p.new && p.new.customer_email === currentUser.email &&
                p.new.status === 'complete' && p.old.status !== 'complete') {
                sendBrowserNotification('✅ Top Up Delivered!','Your '+p.new.topup_label+' has been delivered!');
                showToast('🎉 Your order is complete! Check your game!','success',5000);
                loadOrderHistory();
                var m=document.getElementById('orderCompleteModal');
                var t=document.getElementById('orderCompleteText');
                if(m&&t){t.textContent='Your '+p.new.topup_label+' delivered to '+p.new.in_game_name+'!';m.classList.remove('hidden');}
            }
        }).subscribe();
}
function subscribeToNewOrders() {
    if (_adminChannel) { try{_supabase.removeChannel(_adminChannel);}catch(e){} }
    _adminChannel = _supabase.channel('admin-new-orders')
        .on('postgres_changes',{event:'INSERT',schema:'public',table:'orders'}, function(p){
            if (!p.new) return;
            sendBrowserNotification('🔔 New Order!', p.new.customer_email+' — '+p.new.topup_label+' ₹'+p.new.price);
            showToast('🔔 New order! '+p.new.topup_label+' — ₹'+p.new.price,'success',6000);
            updateNotificationBadge();
            loadAllOrders();
        }).subscribe();
}
function unsubscribeAll() {
    if (_userChannel) { try{_supabase.removeChannel(_userChannel);}catch(e){} _userChannel=null; }
    if (_adminChannel){ try{_supabase.removeChannel(_adminChannel);}catch(e){} _adminChannel=null; }
}
function closeOrderCompleteModal() {
    var m=document.getElementById('orderCompleteModal');
    if(m) m.classList.add('hidden');
}

// ══════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════
async function handleSignUp() {
    clearAllErrors();
    var email    = document.getElementById('authEmail').value.trim();
    var password = document.getElementById('authPassword').value.trim();
    var ok = true;
    if (!email)                { showFieldError('authEmail','Enter your Gmail address'); ok=false; }
    else if (!isAllowedEmail(email)) { showFieldError('authEmail','Only Gmail addresses allowed — e.g. yourname@gmail.com'); ok=false; }
    if (!password)             { showFieldError('authPassword','Enter a password'); ok=false; }
    else if (password.length<6){ showFieldError('authPassword','Password too short — use at least 6 characters'); ok=false; }
    if (!ok) return;
    showToast('⏳ Creating account…','');
    try {
        var res = await _supabase.auth.signUp({email:email, password:password});
        if (res.error) {
            var m = res.error.message.toLowerCase();
            if (m.includes('already')) showFieldError('authEmail','Email already registered — try Sign In');
            else showToast('❌ '+res.error.message,'error');
        } else showToast('✅ Account created! Welcome!','success');
    } catch(e){ showToast('❌ Connection error','error'); }
}

async function handleSignIn() {
    clearAllErrors();
    var email    = document.getElementById('authEmail').value.trim();
    var password = document.getElementById('authPassword').value.trim();
    var ok = true;
    if (!email)                { showFieldError('authEmail','Enter your Gmail address'); ok=false; }
    else if (!isAllowedEmail(email)) { showFieldError('authEmail','Only Gmail addresses allowed — e.g. yourname@gmail.com'); ok=false; }
    if (!password)             { showFieldError('authPassword','Enter your password'); ok=false; }
    if (!ok) return;
    showToast('⏳ Signing in…','');
    try {
        var res = await _supabase.auth.signInWithPassword({email:email, password:password});
        if (res.error) {
            var m = res.error.message.toLowerCase();
            if (m.includes('invalid')||m.includes('wrong')) showFieldError('authPassword','Wrong password — try again');
            else if (m.includes('not found')||m.includes('no user')) showFieldError('authEmail','No account found — please Sign Up first');
            else if (m.includes('too many')||m.includes('rate')) showToast('⚠️ Too many attempts — wait a few minutes','error',5000);
            else showToast('❌ '+res.error.message,'error');
        }
    } catch(e){ showToast('❌ Connection error','error'); }
}

async function handleLogout() {
    unsubscribeAll();
    try { await _supabase.auth.signOut(); } catch(e){}
    selectedTopup=null; paymentScreenshotBase64=null; selectedStars=0;
    ['authEmail','authPassword','inGameName','playerUID','pubgName','pubgID','reviewName','reviewText'].forEach(function(id){
        var el=document.getElementById(id); if(el) el.value='';
    });
    var ua=document.getElementById('uploadArea'), up=document.getElementById('uploadPreview'), cb=document.getElementById('confirmOrderBtn');
    if(ua){ua.classList.remove('ok');}
    if(up){up.classList.remove('show');}
    if(cb){cb.disabled=true; cb.textContent='✅ Confirm & Place Order';}
    document.querySelectorAll('.pkg-card.selected,.mem-card.selected,.pkg-card.pg-card.selected').forEach(function(el){ el.classList.remove('selected'); });
    ['gameDetailsCard','orderSummaryCard','paymentSection'].forEach(function(id){
        var el=document.getElementById(id); if(el) el.classList.add('hidden');
    });
    showToast('👋 Logged out');
}

// ── Auth state change ──
_supabase.auth.onAuthStateChange(function(event, session) {
    _authLoaded = true;
    var ls = document.getElementById('loadingSection');
    if (ls) ls.classList.add('hidden');

    if (session && session.user) {
        currentUser = session.user;
        isAdmin     = (currentUser.email === ADMIN_EMAIL);
        requestNotificationPermission();

        // Update UI
        if (typeof updateUI === 'function') updateUI(currentUser, isAdmin);

        if (isAdmin) {
            loadAllOrders();
            loadStockManagement();
            loadAdminReviews();
            loadVisitorStats();
            subscribeToNewOrders();
        } else {
            renderTopupGrids();
            loadOrderHistory();
            loadReviews('freeFire');
            updateReviewPackages();
            trackVisitor();
            subscribeToOrderUpdates();
        }
    } else {
        currentUser = null; isAdmin = false;
        unsubscribeAll();
        if (typeof updateUI === 'function') updateUI(null, false);
    }
});

// ══════════════════════════════════════════
//  STOCK
// ══════════════════════════════════════════
async function getStockStatus() {
    var stock = {};
    diamondTopups.forEach(function(_,i)    { stock['diamond_'+i]    = true; });
    membershipTopups.forEach(function(_,i) { stock['membership_'+i] = true; });
    pubgTopups.forEach(function(_,i)       { stock['pubg_'+i]       = true; });
    try {
        var res = await _supabase.from('stock').select('*');
        if (res.data) res.data.forEach(function(r){ stock[r.key]=r.in_stock; });
    } catch(e){}
    return stock;
}
async function setStockItem(key, val) {
    try { await _supabase.from('stock').upsert({key:key, in_stock:val}); } catch(e){}
}

// ══════════════════════════════════════════
//  RENDER GRIDS — CARD DESIGN WITH BUY BTN
// ══════════════════════════════════════════
async function renderTopupGrids() {
    var stock = await getStockStatus();

    // ── Diamonds ──
    document.getElementById('diamondGrid').innerHTML = diamondTopups.map(function(item,i){
        var inStock = stock['diamond_'+i] !== false;
        var isHot   = (item.diamonds===610 || item.diamonds===1240);
        var cls     = 'pkg-card' + (inStock ? '' : ' out-of-stock');
        var click   = inStock ? 'onclick="selectTopup(this,\'diamond\','+i+')"' : '';
        return '<div class="'+cls+'" '+click+'>'+
            (isHot ? '<span class="hot-badge">🔥 HOT</span>' : '')+
            '<div class="pkg-card-icon">💎</div>'+
            '<div class="pkg-card-amt">'+item.diamonds+'</div>'+
            '<div class="pkg-card-label">Diamonds</div>'+
            '<div class="pkg-card-price">₹'+item.price+'</div>'+
            '<span class="pkg-card-stock '+(inStock?'in':'out')+'">'+(inStock?'✅ In Stock':'❌ Out')+' </span>'+
            (inStock ? '<button class="pkg-card-btn ff-btn">Buy Now →</button>' : '')+
        '</div>';
    }).join('');

    // ── Memberships ──
    document.getElementById('membershipGrid').innerHTML = membershipTopups.map(function(item,i){
        var inStock = stock['membership_'+i] !== false;
        var cls     = 'mem-card' + (inStock ? '' : ' out-of-stock');
        var click   = inStock ? 'onclick="selectTopup(this,\'membership\','+i+')"' : '';
        return '<div class="'+cls+'" '+click+'>'+
            '<div class="mem-card-left">'+
                '<span class="mem-card-name">'+item.icon+' '+item.name+'</span>'+
                '<span class="mem-card-tag">'+item.desc+'</span>'+
                '<span class="pkg-card-stock '+(inStock?'in':'out')+'" style="display:inline-block;margin-top:4px;">'+(inStock?'✅ In Stock':'❌ Out')+'</span>'+
            '</div>'+
            '<div class="mem-card-right">'+
                '<span class="mem-card-price">₹'+item.price+'</span>'+
                (inStock ? '<button class="mem-card-btn">Buy →</button>' : '')+
            '</div>'+
        '</div>';
    }).join('');
}

async function renderPubgGrid() {
    var stock = await getStockStatus();
    document.getElementById('pubgGrid').innerHTML = pubgTopups.map(function(item,i){
        var inStock = stock['pubg_'+i] !== false;
        var isHot   = (item.uc===660 || item.uc===1800);
        var cls     = 'pkg-card pg-card' + (inStock ? '' : ' out-of-stock');
        var click   = inStock ? 'onclick="selectTopup(this,\'pubg\','+i+')"' : '';
        return '<div class="'+cls+'" '+click+'>'+
            (isHot ? '<span class="hot-badge">🔥 HOT</span>' : '')+
            '<div class="pkg-card-icon">🏆</div>'+
            '<div class="pkg-card-amt">'+item.uc+'</div>'+
            '<div class="pkg-card-label">UC</div>'+
            '<div class="pkg-card-price">₹'+item.price+'</div>'+
            '<span class="pkg-card-stock '+(inStock?'in':'out')+'">'+(inStock?'✅ In Stock':'❌ Out')+'</span>'+
            (inStock ? '<button class="pkg-card-btn pg-btn">Buy Now →</button>' : '')+
        '</div>';
    }).join('');
}

// ══════════════════════════════════════════
//  GAME SWITCHING
// ══════════════════════════════════════════
function switchGame(game) {
    currentGame   = game;
    selectedTopup = null;
    document.getElementById('gameDetailsCard').classList.add('hidden');
    document.getElementById('orderSummaryCard').classList.add('hidden');
    document.getElementById('paymentSection').classList.add('hidden');
    document.querySelectorAll('.pkg-card.selected,.mem-card.selected').forEach(function(e){ e.classList.remove('selected'); });

    var ffTab   = document.getElementById('ffTab');
    var pgTab   = document.getElementById('pubgTab');
    var ffSec   = document.getElementById('ffSection');
    var pgSec   = document.getElementById('pubgSection');

    if (game === 'freeFire') {
        ffTab.className = 'gtog ff on';
        pgTab.className = 'gtog pg';
        ffSec.style.display = 'block';
        pgSec.style.display = 'none';
    } else {
        pgTab.className = 'gtog pg on';
        ffTab.className = 'gtog ff';
        ffSec.style.display = 'none';
        pgSec.style.display = 'block';
        renderPubgGrid();
    }
}

// ══════════════════════════════════════════
//  SELECT TOPUP
// ══════════════════════════════════════════
function selectTopup(el, type, index) {
    document.querySelectorAll('.pkg-card.selected,.mem-card.selected').forEach(function(e){ e.classList.remove('selected'); });
    el.classList.add('selected');

    var ffDetails   = document.querySelector('.ff-details');
    var pgDetails   = document.querySelector('.pubg-details');
    var icon        = document.getElementById('gameDetailsIcon');
    var title       = document.getElementById('gameDetailsTitle');
    var detailsCard = document.getElementById('gameDetailsCard');

    if (type === 'pubg') {
        var item = pubgTopups[index];
        selectedTopup = {type:'pubg', label:item.uc+' UC', price:item.price, game:'pubg'};
        if(ffDetails) ffDetails.style.display='none';
        if(pgDetails) pgDetails.style.display='block';
        if(icon)  icon.textContent  = '🎮';
        if(title) title.textContent = 'PUBG Mobile Details';
    } else if (type === 'diamond') {
        var item = diamondTopups[index];
        selectedTopup = {type:'diamond', label:item.diamonds+' Diamonds', price:item.price, game:'freeFire'};
        if(ffDetails) ffDetails.style.display='block';
        if(pgDetails) pgDetails.style.display='none';
        if(icon)  icon.textContent  = '💎';
        if(title) title.textContent = 'Free Fire Details';
    } else {
        var item = membershipTopups[index];
        selectedTopup = {type:'membership', label:item.name, price:item.price, game:'freeFire'};
        if(ffDetails) ffDetails.style.display='block';
        if(pgDetails) pgDetails.style.display='none';
        if(icon)  icon.textContent  = '🏅';
        if(title) title.textContent = 'Free Fire Details';
    }

    if(detailsCard) detailsCard.classList.remove('hidden');

    var gameIcon  = type==='pubg' ? '🏆' : (type==='diamond' ? '💎' : '🏅');
    var gameColor = type==='pubg' ? '#92400e' : 'var(--success)';
    var sumCard   = document.getElementById('orderSummaryCard');
    var sumContent= document.getElementById('orderSummaryContent');
    if (sumCard && sumContent) {
        sumContent.innerHTML =
            '<div class="order-sum-box">'+
            '<div class="order-sum-pkg">'+gameIcon+' '+selectedTopup.label+'</div>'+
            '<div class="order-sum-price" style="color:'+gameColor+'">₹'+selectedTopup.price+'</div>'+
            '</div>';
        sumCard.classList.remove('hidden');
    }

    if(detailsCard) detailsCard.scrollIntoView({behavior:'smooth', block:'start'});
}

// ══════════════════════════════════════════
//  PAYMENT FLOW
// ══════════════════════════════════════════
function proceedToPayment() {
    clearAllErrors();
    if (!selectedTopup) { showToast('⚠️ Select a package first','error'); return; }
    var ok = true;
    if (selectedTopup.game === 'pubg') {
        var name = (document.getElementById('pubgName').value||'').trim();
        var uid  = (document.getElementById('pubgID').value||'').trim();
        if (!name) { showFieldError('pubgName','Enter your PUBG player name'); ok=false; }
        if (!uid || uid.length<5 || uid.length>12) { showFieldError('pubgID','Enter a valid PUBG Player ID (5–12 digits)'); ok=false; }
    } else {
        var name = (document.getElementById('inGameName').value||'').trim();
        var uid  = (document.getElementById('playerUID').value||'').trim();
        if (!name) { showFieldError('inGameName','Enter your Free Fire in-game name'); ok=false; }
        if (!uid || uid.length<8 || uid.length>11) { showFieldError('playerUID','Free Fire UID must be 8–11 digits'); ok=false; }
    }
    if (!ok) return;
    var ps = document.getElementById('paymentSection');
    if (ps) {
        ps.classList.remove('hidden');
        ps.scrollIntoView({behavior:'smooth', block:'start'});
    }
}

function cancelPayment() {
    var ps = document.getElementById('paymentSection');
    if (ps) ps.classList.add('hidden');
    var sc = document.getElementById('orderSummaryCard');
    if (sc) sc.scrollIntoView({behavior:'smooth'});
}

function setupScreenshotUploader() {
    var area = document.getElementById('uploadArea');
    if (!area) return;
    area.addEventListener('dragover',  function(e){ e.preventDefault(); area.style.borderColor='var(--primary)'; });
    area.addEventListener('dragleave', function(){ area.style.borderColor=''; });
    area.addEventListener('drop', function(e){
        e.preventDefault(); area.style.borderColor='';
        if (e.dataTransfer.files.length) handleScreenshotUpload({target:{files:e.dataTransfer.files}});
    });
}

function handleScreenshotUpload(event) {
    var file = event.target.files[0];
    if (!file) return;
    if (file.size > 5*1024*1024) { showToast('❌ File too large (max 5MB)','error'); return; }
    var err = document.getElementById('err_uploadArea');
    if (err) err.remove();
    var reader = new FileReader();
    reader.onload = function(e) {
        compressImage(e.target.result, 800, 0.75, function(b64){
            paymentScreenshotBase64 = b64;
            var prev = document.getElementById('uploadPreview');
            var area = document.getElementById('uploadArea');
            var btn  = document.getElementById('confirmOrderBtn');
            if (prev) { prev.src=b64; prev.classList.add('show'); }
            if (area) area.classList.add('ok');
            if (btn)  btn.disabled = false;
            showToast('📸 Screenshot uploaded!','success');
        });
    };
    reader.readAsDataURL(file);
}

function compressImage(dataUrl, maxW, quality, cb) {
    var img = new Image();
    img.onload = function(){
        var canvas=document.createElement('canvas');
        var w=img.width, h=img.height;
        if (w>maxW){ h=(maxW/w)*h; w=maxW; }
        canvas.width=w; canvas.height=h;
        canvas.getContext('2d').drawImage(img,0,0,w,h);
        cb(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
}

async function confirmPlaceOrder() {
    if (!selectedTopup) return showToast('⚠️ No package selected','error');
    var name, uid;
    if (selectedTopup.game === 'pubg') {
        name = (document.getElementById('pubgName').value||'').trim();
        uid  = (document.getElementById('pubgID').value||'').trim();
    } else {
        name = (document.getElementById('inGameName').value||'').trim();
        uid  = (document.getElementById('playerUID').value||'').trim();
    }
    if (!name || !uid) return showToast('⚠️ Enter your game details','error');
    if (!paymentScreenshotBase64) {
        var area = document.getElementById('uploadArea');
        if (area) { area.style.borderColor='#ef4444'; area.style.background='#fee2e2'; }
        showToast('⚠️ Upload your eSewa payment screenshot first!','error',4000);
        if (area) area.scrollIntoView({behavior:'smooth'});
        setTimeout(function(){
            if(area){area.style.borderColor='';area.style.background='';}
        }, 3000);
        return;
    }

    var btn = document.getElementById('confirmOrderBtn');
    if (btn) { btn.disabled=true; btn.textContent='⏳ Placing Order…'; }
    showToast('⏳ Saving your order…','');

    var order = {
        order_id:       'ORD-'+Date.now()+'-'+Math.random().toString(36).substr(2,5).toUpperCase(),
        customer_email: currentUser.email,
        in_game_name:   name,
        player_uid:     uid,
        topup_label:    selectedTopup.label,
        price:          selectedTopup.price,
        screenshot:     paymentScreenshotBase64,
        status:         'pending'
    };

    try {
        var orderWithGame = Object.assign({}, order, {game: selectedTopup.game||'freeFire'});
        var res = await _supabase.from('orders').insert([orderWithGame]);
        if (res.error && res.error.message && res.error.message.includes('game')) {
            res = await _supabase.from('orders').insert([order]);
        }
        if (res.error) {
            showToast('❌ '+res.error.message,'error',5000);
            if (btn) { btn.disabled=false; btn.textContent='✅ Confirm & Place Order'; }
            return;
        }
        sendAdminEmailNotification(orderWithGame);
        document.getElementById('thankYouModal').classList.remove('hidden');
        resetAfterOrder();
        loadOrderHistory();
    } catch(e) {
        showToast('❌ Connection error. Try again.','error');
        if (btn) { btn.disabled=false; btn.textContent='✅ Confirm & Place Order'; }
    }
}

function sendAdminEmailNotification(order) {
    try {
        fetch('https://formsubmit.co/ajax/aadityadas4000@gmail.com', {
            method:'POST',
            headers:{'Content-Type':'application/json','Accept':'application/json'},
            body:JSON.stringify({
                _subject:'🔔 New '+(order.game==='pubg'?'PUBG':'FF')+' Order! '+order.topup_label+' — ₹'+order.price,
                'Game':order.game==='pubg'?'PUBG Mobile':'Free Fire',
                'Order ID':order.order_id, 'Customer':order.customer_email,
                'Name':order.in_game_name, 'ID':order.player_uid,
                'Package':order.topup_label, 'Amount':'₹'+order.price
            })
        });
    } catch(e){}
}

function resetAfterOrder() {
    selectedTopup=null; paymentScreenshotBase64=null;
    ['paymentSection','orderSummaryCard','gameDetailsCard'].forEach(function(id){
        var el=document.getElementById(id); if(el) el.classList.add('hidden');
    });
    document.querySelectorAll('.pkg-card.selected,.mem-card.selected').forEach(function(el){ el.classList.remove('selected'); });
    ['inGameName','playerUID','pubgName','pubgID'].forEach(function(id){
        var el=document.getElementById(id); if(el) el.value='';
    });
    var ua=document.getElementById('uploadArea'), up=document.getElementById('uploadPreview'), cb=document.getElementById('confirmOrderBtn');
    if(ua){ua.classList.remove('ok'); ua.style.borderColor=''; ua.style.background='';}
    if(up) up.classList.remove('show');
    if(cb){cb.disabled=true; cb.textContent='✅ Confirm & Place Order';}
}

function closeThankYou() { document.getElementById('thankYouModal').classList.add('hidden'); }

// ══════════════════════════════════════════
//  ORDER HISTORY — CARD FORMAT
// ══════════════════════════════════════════
async function loadOrderHistory() {
    if (!currentUser) return;
    var c = document.getElementById('orderHistoryContainer');
    if (!c) return;
    try {
        var res = await _supabase.from('orders').select('*').eq('customer_email',currentUser.email).order('created_at',{ascending:false});
        if (!res.data || !res.data.length) {
            c.innerHTML =
                '<div class="empty-state">'+
                '<div class="empty-state-icon">📦</div>'+
                '<div class="empty-state-text">No orders yet</div>'+
                '<div class="empty-state-sub">Your orders will appear here</div>'+
                '</div>';
            return;
        }
        c.innerHTML = res.data.map(function(o){
            var gameIcon  = (o.game==='pubg') ? '🎮 PUBG' : '🔥 Free Fire';
            var statusCls = o.status==='complete' ? 'ocs-complete' : 'ocs-pending';
            var statusTxt = o.status==='complete' ? '✅ Complete' : '⏳ Pending';
            var date      = new Date(o.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
            return '<div class="order-card">'+
                '<div class="order-card-top">'+
                    '<span class="order-card-game">'+gameIcon+'</span>'+
                    '<span class="order-card-status-badge '+statusCls+'">'+statusTxt+'</span>'+
                '</div>'+
                '<div class="order-card-pkg">'+o.topup_label+'</div>'+
                '<div class="order-card-footer">'+
                    '<span class="order-card-price">₹'+o.price+'</span>'+
                    '<span class="order-card-date">'+date+'</span>'+
                '</div>'+
                '<div class="order-card-id">ID: '+o.order_id+'</div>'+
            '</div>';
        }).join('');
    } catch(e) {
        c.innerHTML = '<p style="text-align:center;color:var(--text-light);padding:20px;font-size:.84rem;">Could not load orders.</p>';
    }
}

// ══════════════════════════════════════════
//  ADMIN ORDERS
// ══════════════════════════════════════════
async function loadAllOrders() {
    var c = document.getElementById('adminOrdersContainer');
    if (!c) return;
    try {
        var res = await _supabase.from('orders').select('*').order('created_at',{ascending:false});
        if (!res.data||!res.data.length) { c.innerHTML='<p style="padding:12px;text-align:center;font-size:.82rem;">No orders yet.</p>'; return; }
        c.innerHTML = res.data.map(function(o){
            var gameIcon = o.game==='pubg'?'🎮 PUBG':'🔥 Free Fire';
            return '<div class="aoc '+(o.status==='complete'?'done':'')+'">'+
                '<p><strong>'+gameIcon+'</strong> | <strong>'+o.order_id+'</strong></p>'+
                '<p>👤 '+o.customer_email+'</p>'+
                '<p>🧑 '+o.in_game_name+' | ID: '+o.player_uid+'</p>'+
                '<p>📦 '+o.topup_label+' | 💰 ₹'+o.price+'</p>'+
                '<p>📅 '+new Date(o.created_at).toLocaleString('en-IN')+'</p>'+
                '<p>📌 <span class="order-card-status-badge '+(o.status==='complete'?'ocs-complete':'ocs-pending')+'">'+o.status+'</span></p>'+
                (o.screenshot?'<details style="margin-top:6px;"><summary style="cursor:pointer;font-size:.78rem;font-weight:600;">📸 Screenshot</summary><img src="'+o.screenshot+'" style="max-width:100%;border-radius:8px;margin-top:6px;"></details>':'')+
                '<div class="aac">'+
                (o.status==='pending'
                    ?'<button class="btn btn-sm btn-success" onclick="markComplete(\''+o.id+'\')">✅ Complete</button>'
                    :'<button class="btn btn-sm btn-warning" onclick="markPending(\''+o.id+'\')">⏳ Pending</button>')+
                '<button class="btn btn-sm btn-danger" onclick="deleteOrder(\''+o.id+'\')">🗑 Delete</button>'+
                '</div></div>';
        }).join('');
    } catch(e) { c.innerHTML='<p style="padding:12px;text-align:center;color:red;font-size:.82rem;">Failed to load.</p>'; }
}

async function markComplete(id) { await updateOrderStatus(id,'complete'); }
async function markPending(id)  { await updateOrderStatus(id,'pending');  }
async function updateOrderStatus(id, status) {
    try { await _supabase.from('orders').update({status:status}).eq('id',id); showToast('Order marked '+status,'success'); loadAllOrders(); }
    catch(e){ showToast('❌ Failed','error'); }
}
async function deleteOrder(id) {
    if (!confirm('Delete this order?')) return;
    try { await _supabase.from('orders').delete().eq('id',id); showToast('🗑 Deleted','success'); loadAllOrders(); }
    catch(e){ showToast('❌ Failed','error'); }
}

// ══════════════════════════════════════════
//  STOCK MANAGEMENT
// ══════════════════════════════════════════
async function loadStockManagement() {
    var c = document.getElementById('stockManagementContainer');
    if (!c) return;
    var stock = await getStockStatus();
    var html = '<p style="font-size:.76rem;font-weight:700;color:var(--text-mid);margin-bottom:8px;">💎 Free Fire Diamonds</p>';
    diamondTopups.forEach(function(item,i){
        var on = stock['diamond_'+i]!==false;
        html += '<div class="stock-item"><span>💎 '+item.diamonds+' — ₹'+item.price+'</span><button class="btn btn-sm '+(on?'btn-warning':'btn-success')+'" onclick="toggleStock(\'diamond\','+i+')">'+(on?'Mark Out':'Mark In')+'</button></div>';
    });
    html += '<p style="font-size:.76rem;font-weight:700;color:var(--text-mid);margin:12px 0 8px;">🏅 Memberships</p>';
    membershipTopups.forEach(function(item,i){
        var on = stock['membership_'+i]!==false;
        html += '<div class="stock-item"><span>'+item.icon+' '+item.name+' — ₹'+item.price+'</span><button class="btn btn-sm '+(on?'btn-warning':'btn-success')+'" onclick="toggleStock(\'membership\','+i+')">'+(on?'Mark Out':'Mark In')+'</button></div>';
    });
    html += '<p style="font-size:.76rem;font-weight:700;color:var(--text-mid);margin:12px 0 8px;">🏆 PUBG UC</p>';
    pubgTopups.forEach(function(item,i){
        var on = stock['pubg_'+i]!==false;
        html += '<div class="stock-item"><span>🏆 '+item.uc+' UC — ₹'+item.price+'</span><button class="btn btn-sm '+(on?'btn-warning':'btn-success')+'" onclick="toggleStock(\'pubg\','+i+')">'+(on?'Mark Out':'Mark In')+'</button></div>';
    });
    c.innerHTML = html;
}

async function toggleStock(type, index) {
    var stock = await getStockStatus();
    var newVal = !stock[type+'_'+index];
    await setStockItem(type+'_'+index, newVal);
    renderTopupGrids();
    if (currentGame==='pubg') renderPubgGrid();
    loadStockManagement();
    showToast(newVal?'✅ In Stock':'⛔ Out of Stock','success');
}
async function setAllOutOfStock() {
    if (!confirm('Mark ALL items out of stock?')) return;
    var p=[];
    diamondTopups.forEach(function(_,i){p.push(setStockItem('diamond_'+i,false));});
    membershipTopups.forEach(function(_,i){p.push(setStockItem('membership_'+i,false));});
    pubgTopups.forEach(function(_,i){p.push(setStockItem('pubg_'+i,false));});
    await Promise.all(p);
    renderTopupGrids(); loadStockManagement();
    showToast('⛔ All Out of Stock','success');
}
async function resetAllInStock() {
    var p=[];
    diamondTopups.forEach(function(_,i){p.push(setStockItem('diamond_'+i,true));});
    membershipTopups.forEach(function(_,i){p.push(setStockItem('membership_'+i,true));});
    pubgTopups.forEach(function(_,i){p.push(setStockItem('pubg_'+i,true));});
    await Promise.all(p);
    renderTopupGrids(); loadStockManagement();
    showToast('✅ All In Stock','success');
}

// ══════════════════════════════════════════
//  REVIEW SYSTEM
// ══════════════════════════════════════════
function setReviewStar(n) {
    selectedStars = n;
    document.querySelectorAll('.star').forEach(function(btn){
        btn.classList.toggle('on', parseInt(btn.dataset.star) <= n);
    });
}

function updateReviewPackages() {
    var game = (document.getElementById('reviewGame')||{}).value || 'freeFire';
    var sel  = document.getElementById('reviewPackage');
    if (!sel) return;
    var opts = ['<option value="">Select package…</option>'];
    if (game === 'freeFire') {
        diamondTopups.forEach(function(i){ opts.push('<option>💎 '+i.diamonds+' Diamonds</option>'); });
        membershipTopups.forEach(function(i){ opts.push('<option>'+i.icon+' '+i.name+'</option>'); });
    } else {
        pubgTopups.forEach(function(i){ opts.push('<option>🏆 '+i.uc+' UC</option>'); });
    }
    sel.innerHTML = opts.join('');
}

function switchReviewTab(game) {
    _curReviewGame = game;
    window._curReviewGame = game;
    var ff = document.getElementById('ffReviewTab');
    var pg = document.getElementById('pubgReviewTab');
    if (ff) ff.className = 'rtab ff' + (game==='freeFire'?' on':'');
    if (pg) pg.className = 'rtab pg' + (game==='pubg'?' on':'');
    loadReviews(game);
}

async function submitReview() {
    clearAllErrors();
    var game = (document.getElementById('reviewGame')||{}).value || 'freeFire';
    var name = ((document.getElementById('reviewName')||{}).value||'').trim();
    var pkg  = ((document.getElementById('reviewPackage')||{}).value||'').trim();
    var text = ((document.getElementById('reviewText')||{}).value||'').trim();
    var ok   = true;
    if (!name)         { showFieldError('reviewName','Enter your name'); ok=false; }
    if (selectedStars===0){ showToast('⚠️ Please tap the stars to give a rating','error',3500); ok=false; }
    if (!text)         { showFieldError('reviewText','Write at least one word'); ok=false; }
    if (!ok) return;
    try {
        var res = await _supabase.from('reviews').insert([{customer_name:name, stars:selectedStars, review_text:text, package:pkg||null, game:game, approved:false}]);
        if (res.error){ showToast('❌ Failed to submit. Try again.','error'); return; }
        ['reviewName','reviewText'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
        var rp=document.getElementById('reviewPackage'); if(rp) rp.selectedIndex=0;
        selectedStars=0;
        document.querySelectorAll('.star').forEach(function(b){ b.classList.remove('on'); });
        showToast('🌟 Review submitted! Awaiting approval.','success',4000);
    } catch(e){ showToast('❌ Connection error','error'); }
}

async function loadReviews(game) {
    var c      = document.getElementById('reviewsList');
    var avgEl  = document.getElementById('avgRating');
    var totEl  = document.getElementById('totalReviews');
    var cntEl  = document.getElementById('reviewCountBadge');
    if (!c) return;
    c.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-light);font-size:.82rem;">Loading…</p>';
    try {
        var res = await _supabase.from('reviews').select('*').eq('approved',true).eq('game',game).order('created_at',{ascending:false});
        var reviews = res.data || [];
        if (!reviews.length) {
            c.innerHTML = '<div class="empty-state" style="padding:24px;"><div class="empty-state-icon">💬</div><div class="empty-state-text">No reviews yet</div><div class="empty-state-sub">Be the first to review!</div></div>';
            if(avgEl) avgEl.textContent='—';
            if(totEl) totEl.textContent='No reviews yet';
            if(cntEl) cntEl.textContent='';
            return;
        }
        var avg = reviews.reduce(function(s,r){ return s+r.stars; },0)/reviews.length;
        if(avgEl) avgEl.textContent=avg.toFixed(1);
        if(totEl) totEl.textContent='Based on '+reviews.length+' review'+(reviews.length>1?'s':'');
        if(cntEl) cntEl.textContent=reviews.length+' reviews';
        c.innerHTML = reviews.map(function(r,idx){
            var avatar = ['😊','😎','🎮','🔥','💪','🏆','⚡','🌟','👑','🎯'][idx%10];
            return '<div class="review-card">'+
                '<div class="rc-top">'+
                '<div class="rc-avatar">'+avatar+'</div>'+
                '<div style="flex:1;">'+
                    '<div class="rc-name">'+escapeHtml(r.customer_name)+'</div>'+
                    '<div class="rc-stars">'+starsHTML(r.stars)+'</div>'+
                    (r.package?'<div class="rc-pkg">'+escapeHtml(r.package)+'</div>':'')+
                '</div>'+
                '<span class="rc-verified">✅ Verified</span>'+
                '</div>'+
                '<div class="rc-text">"'+escapeHtml(r.review_text)+'"</div>'+
                '<div class="rc-date">'+timeAgo(r.created_at)+'</div>'+
            '</div>';
        }).join('');
    } catch(e){ c.innerHTML='<p style="text-align:center;padding:20px;color:var(--text-light);">Could not load reviews.</p>'; }
}

// Admin reviews
async function loadAdminReviews() {
    var c = document.getElementById('adminReviewsContainer');
    if (!c) return;
    try {
        var res = await _supabase.from('reviews').select('*').eq('approved',false).order('created_at',{ascending:false});
        var pending = res.data||[];
        if (!pending.length){ c.innerHTML='<p style="text-align:center;color:var(--text-light);padding:10px;font-size:.8rem;">No pending reviews ✅</p>'; return; }
        c.innerHTML = pending.map(function(r){
            return '<div style="background:var(--bg);border-radius:10px;padding:12px;margin-bottom:8px;border-left:3px solid var(--accent);">'+
                '<p style="font-size:.8rem;"><strong>'+escapeHtml(r.customer_name)+'</strong> — '+starsHTML(r.stars)+' | '+(r.game==='pubg'?'🎮 PUBG':'🔥 FF')+'</p>'+
                (r.package?'<p style="font-size:.74rem;color:var(--text-light);">'+escapeHtml(r.package)+'</p>':'')+
                '<p style="font-size:.8rem;margin:5px 0;">"'+escapeHtml(r.review_text)+'"</p>'+
                '<div class="aac">'+
                '<button class="btn btn-sm btn-success" onclick="approveReview(\''+r.id+'\')">✅ Approve</button>'+
                '<button class="btn btn-sm btn-danger" onclick="rejectReview(\''+r.id+'\')">🗑 Reject</button>'+
                '</div></div>';
        }).join('');
    } catch(e){ c.innerHTML='<p style="color:red;padding:10px;font-size:.8rem;">Failed to load.</p>'; }
}
async function approveReview(id) {
    try{ await _supabase.from('reviews').update({approved:true}).eq('id',id); showToast('✅ Approved!','success'); loadAdminReviews(); }
    catch(e){ showToast('❌ Failed','error'); }
}
async function rejectReview(id) {
    if(!confirm('Delete this review?')) return;
    try{ await _supabase.from('reviews').delete().eq('id',id); showToast('🗑 Deleted','success'); loadAdminReviews(); }
    catch(e){ showToast('❌ Failed','error'); }
}

// ══════════════════════════════════════════
//  VISITOR TRACKING
// ══════════════════════════════════════════
function getDeviceType() {
    var ua=navigator.userAgent;
    if(/tablet|ipad/i.test(ua)) return 'Tablet 📱';
    if(/mobile|android|iphone/i.test(ua)) return 'Mobile 📱';
    return 'Desktop 💻';
}
function getOrCreateSessionId() {
    var sid=sessionStorage.getItem('aatc_sid');
    if (!sid){ sid='v_'+Date.now()+'_'+Math.random().toString(36).substr(2,9); sessionStorage.setItem('aatc_sid',sid); }
    return sid;
}
async function trackVisitor() {
    try {
        if (sessionStorage.getItem('aatc_tracked')) return;
        await _supabase.from('visitors').insert([{session_id:getOrCreateSessionId(), device_type:getDeviceType()}]);
        sessionStorage.setItem('aatc_tracked','1');
    } catch(e){}
}
async function loadVisitorStats() {
    var c = document.getElementById('visitorStatsContainer');
    if (!c) return;
    c.innerHTML = '<p style="text-align:center;color:var(--text-light);padding:10px;font-size:.8rem;">Loading…</p>';
    try {
        var now   = new Date();
        var today = new Date(now.getFullYear(),now.getMonth(),now.getDate()).toISOString();
        var week  = new Date(now.getFullYear(),now.getMonth(),now.getDate()-7).toISOString();
        var res   = await _supabase.from('visitors').select('*').order('visited_at',{ascending:false});
        var all   = res.data||[];
        var todayArr = all.filter(function(v){ return v.visited_at>=today; });
        var weekArr  = all.filter(function(v){ return v.visited_at>=week; });
        var uAll  = new Set(all.map(function(v){ return v.session_id; })).size;
        var uToday= new Set(todayArr.map(function(v){ return v.session_id; })).size;
        var uWeek = new Set(weekArr.map(function(v){ return v.session_id; })).size;
        var mob   = all.filter(function(v){ return v.device_type&&v.device_type.includes('Mobile'); }).length;
        var desk  = all.filter(function(v){ return v.device_type&&v.device_type.includes('Desktop'); }).length;
        var tot   = all.length||1;

        // Last 7 days chart
        var days=[];
        for(var i=6;i>=0;i--){
            var d=new Date(now.getFullYear(),now.getMonth(),now.getDate()-i);
            var dEnd=new Date(now.getFullYear(),now.getMonth(),now.getDate()-i+1);
            var cnt=all.filter(function(v){ return v.visited_at>=d.toISOString()&&v.visited_at<dEnd.toISOString(); }).length;
            days.push({label:['Su','Mo','Tu','We','Th','Fr','Sa'][d.getDay()], count:cnt});
        }
        var maxDay=Math.max.apply(null,days.map(function(d){ return d.count; }))||1;

        c.innerHTML=
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;">'+
            sCard('👁️','Today',uToday)+sCard('📅','Week',uWeek)+sCard('🌍','Total',uAll)+
        '</div>'+
        '<div style="margin-bottom:10px;">'+
            dBar('📱 Mobile',mob,tot,'#3b82f6')+dBar('💻 Desktop',desk,tot,'#7c3aed')+
        '</div>'+
        '<div style="background:var(--bg);border-radius:10px;padding:12px;">'+
        '<p style="font-size:.72rem;font-weight:700;color:var(--text-mid);margin-bottom:10px;">📊 Last 7 Days</p>'+
        '<div style="display:flex;align-items:flex-end;gap:5px;height:70px;">'+
        days.map(function(d){
            var h=Math.max(4,Math.round((d.count/maxDay)*56));
            return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;">'+
                '<span style="font-size:.58rem;font-weight:700;color:var(--primary);">'+(d.count||'')+' </span>'+
                '<div style="width:100%;height:'+h+'px;background:linear-gradient(135deg,var(--primary),var(--purple));border-radius:3px 3px 0 0;"></div>'+
                '<span style="font-size:.6rem;color:var(--text-light);">'+d.label+'</span>'+
            '</div>';
        }).join('')+
        '</div></div>';
    } catch(e){ c.innerHTML='<p style="color:red;padding:10px;font-size:.8rem;">Failed to load.</p>'; }
}
function sCard(icon,label,val){
    return '<div style="background:#fff;border-radius:10px;padding:12px;text-align:center;border:1px solid var(--border);">'+
        '<div style="font-size:1.2rem;">'+icon+'</div>'+
        '<div style="font-size:1.3rem;font-weight:900;color:var(--primary-dark);">'+val+'</div>'+
        '<div style="font-size:.64rem;color:var(--text-light);font-weight:600;">'+label+'</div>'+
    '</div>';
}
function dBar(label,count,total,color){
    var pct=Math.round((count/total)*100);
    return '<div style="margin-bottom:7px;">'+
        '<div style="display:flex;justify-content:space-between;font-size:.74rem;margin-bottom:3px;">'+
        '<span style="font-weight:600;">'+label+'</span><span style="color:var(--text-light);">'+count+' ('+pct+'%)</span></div>'+
        '<div style="background:var(--border);border-radius:20px;height:7px;overflow:hidden;">'+
        '<div style="width:'+pct+'%;height:100%;background:'+color+';border-radius:20px;"></div></div></div>';
}

// ══════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function(){
    setupScreenshotUploader();
    updateReviewPackages();
    // Show loading
    var ls = document.getElementById('loadingSection');
     if (ls) ls.classList.add('hidden');
    // Timeout fallback
    setTimeout(function(){
        if (!_authLoaded) {
            var ls2=document.getElementById('loadingSection');
            if(ls2) ls2.classList.add('hidden');
        }
    }, 5000);
});
