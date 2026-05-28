// ══════════════════════════════════════════
//  Aaditya Top Up Centre — script.js v4.0
//  Free Fire + PUBG | With Review System
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
var currentReviewGame       = 'freeFire';
var paymentScreenshotBase64 = null;
var selectedStars           = 0;
var _userChannel            = null;
var _adminChannel           = null;
var _newOrderCount          = 0;
var _authLoaded             = false;
var _authTimeout            = null;

// ── Free Fire Packages ──
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
    {name:'Weekly Membership',      price:220,  icon:'📅'},
    {name:'Monthly Membership',     price:1100, icon:'📆'},
    {name:'Weekly + Monthly Combo', price:1180, icon:'🎁'}
];

// ── PUBG Packages ──
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

// ── Avatars ──
var AVATARS = ['😊','😎','🎮','🔥','💪','🏆','⚡','🌟','👑','🎯','🦁','🐉'];

// ══════════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════════

function showToast(msg, type, duration) {
    duration = duration || 3000;
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className   = 'toast '+(type||'')+' show';
    clearTimeout(t._t);
    t._t = setTimeout(function(){ t.classList.remove('show'); }, duration);
}

function togglePasswordVisibility() {
    var inp = document.getElementById('authPassword');
    var btn = document.getElementById('authPasswordToggle');
    if (inp.type==='password'){ inp.type='text'; btn.textContent='🙈'; }
    else { inp.type='password'; btn.textContent='👁️'; }
}

function isAllowedEmail(email) {
    email = email.trim().toLowerCase();
    if (email === ADMIN_EMAIL) return true;
    return email.endsWith('@gmail.com') && email.length > '@gmail.com'.length;
}

function starsHTML(n) {
    var s='';
    for(var i=1;i<=5;i++) s += (i<=n?'★':'☆');
    return s;
}

function timeAgo(dateStr) {
    var diff = Math.floor((Date.now()-new Date(dateStr))/1000);
    if (diff<60)    return 'Just now';
    if (diff<3600)  return Math.floor(diff/60)+' min ago';
    if (diff<86400) return Math.floor(diff/3600)+' hr ago';
    return Math.floor(diff/86400)+' days ago';
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ══════════════════════════════════════════
//  GAME SWITCHING
// ══════════════════════════════════════════

function switchGame(game) {
    currentGame = game;
    selectedTopup = null;
    document.getElementById('gameDetailsCard').classList.add('hidden');
    document.getElementById('orderSummaryCard').classList.add('hidden');
    document.getElementById('paymentSection').classList.add('hidden');
    document.querySelectorAll('.pkg.on,.mem.on,.pubg-pkg.on').forEach(function(e){ e.classList.remove('on'); });

    var ffTab   = document.getElementById('ffTab');
    var pubgTab = document.getElementById('pubgTab');
    var ffSec   = document.getElementById('ffSection');
    var pubgSec = document.getElementById('pubgSection');

    if (game==='freeFire') {
        ffTab.classList.add('active');
        pubgTab.classList.remove('active');
        ffSec.style.display   = 'block';
        pubgSec.style.display = 'none';
    } else {
        pubgTab.classList.add('active');
        ffTab.classList.remove('active');
        ffSec.style.display   = 'none';
        pubgSec.style.display = 'block';
        renderPubgGrid();
    }
}

function switchReviewTab(game) {
    currentReviewGame = game;
    var ffTab   = document.getElementById('ffReviewTab');
    var pubgTab = document.getElementById('pubgReviewTab');
    if (game==='freeFire') {
        ffTab.classList.add('active');
        pubgTab.classList.remove('active');
    } else {
        pubgTab.classList.add('active');
        ffTab.classList.remove('active');
    }
    loadReviews(game);
}

// ══════════════════════════════════════════
//  NOTIFICATIONS
// ══════════════════════════════════════════

function requestNotificationPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission==='default') Notification.requestPermission();
}

function sendBrowserNotification(title, body) {
    if (!('Notification' in window)||Notification.permission!=='granted') return;
    try { new Notification(title, {body:body, icon:"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%231a56db'/><text y='72' x='50' text-anchor='middle' font-size='64'>💎</text></svg>"}); }
    catch(e){}
}

function updateNotificationBadge() {
    _newOrderCount++;
    var b = document.getElementById('notifBadge');
    if (b){ b.textContent=_newOrderCount; b.classList.remove('hidden'); }
}
function clearNotificationBadge() {
    _newOrderCount=0;
    var b = document.getElementById('notifBadge');
    if (b) b.classList.add('hidden');
}

function subscribeToOrderUpdates() {
    if (!currentUser) return;
    if (_userChannel){ try{_supabase.removeChannel(_userChannel);}catch(e){} }
    _userChannel = _supabase.channel('user-orders-'+currentUser.id)
        .on('postgres_changes',{event:'UPDATE',schema:'public',table:'orders'}, function(p){
            if (p.new && p.new.customer_email===currentUser.email && p.new.status==='complete' && p.old.status!=='complete'){
                sendBrowserNotification('✅ Top Up Delivered! 💎','Your '+p.new.topup_label+' has been delivered!');
                showToast('🎉 Your order is complete! Check your game account!','success',6000);
                loadOrderHistory();
                var modal=document.getElementById('orderCompleteModal');
                var text=document.getElementById('orderCompleteText');
                if(modal&&text){text.textContent='Your '+p.new.topup_label+' delivered to '+p.new.in_game_name+'! Open your game to check. 💎';modal.classList.remove('hidden');}
            }
        }).subscribe();
}

function subscribeToNewOrders() {
    if (_adminChannel){ try{_supabase.removeChannel(_adminChannel);}catch(e){} }
    _adminChannel = _supabase.channel('admin-new-orders')
        .on('postgres_changes',{event:'INSERT',schema:'public',table:'orders'}, function(p){
            if (!p.new) return;
            sendBrowserNotification('🔔 New Order!',p.new.customer_email+' ordered '+p.new.topup_label+' — ₹'+p.new.price);
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

async function handleSignUp() {
    clearAllErrors();
    var email    = document.getElementById('authEmail').value.trim();
    var password = document.getElementById('authPassword').value.trim();
    var valid = true;
    if (!email) {
        showFieldError('authEmail', 'Please enter your Gmail address');
        valid = false;
    } else if (!isAllowedEmail(email)) {
        showFieldError('authEmail', 'Only Gmail addresses allowed — e.g. yourname@gmail.com');
        valid = false;
    }
    if (!password) {
        showFieldError('authPassword', 'Please enter a password');
        valid = false;
    } else if (password.length < 6) {
        showFieldError('authPassword', 'Password too short — use at least 6 characters');
        valid = false;
    }
    if (!valid) return;
    showToast('⏳ Creating your account…', '');
    try {
        var res = await _supabase.auth.signUp({email:email, password:password});
        if (res.error) {
            var msg = res.error.message.toLowerCase();
            if (msg.includes('already')) showFieldError('authEmail', 'This email is already registered — try Sign In instead');
            else showFieldError('authEmail', res.error.message);
        } else {
            showSuccess('authEmail');
            showToast('✅ Account created! Welcome!', 'success');
        }
    } catch(e) { showToast('❌ Connection error — check your internet', 'error'); }
}

async function handleSignIn() {
    clearAllErrors();
    var email    = document.getElementById('authEmail').value.trim();
    var password = document.getElementById('authPassword').value.trim();
    var valid = true;
    if (!email) {
        showFieldError('authEmail', 'Please enter your Gmail address');
        valid = false;
    } else if (!isAllowedEmail(email)) {
        showFieldError('authEmail', 'Only Gmail addresses allowed — e.g. yourname@gmail.com');
        valid = false;
    }
    if (!password) {
        showFieldError('authPassword', 'Please enter your password');
        valid = false;
    }
    if (!valid) return;
    showToast('⏳ Signing you in…', '');
    try {
        var res = await _supabase.auth.signInWithPassword({email:email, password:password});
        if (res.error) {
            var msg = res.error.message.toLowerCase();
            if (msg.includes('invalid') || msg.includes('wrong'))
                showFieldError('authPassword', 'Wrong password — please try again');
            else if (msg.includes('not found') || msg.includes('no user'))
                showFieldError('authEmail', 'No account found with this email — please Sign Up first');
            else if (msg.includes('too many') || msg.includes('rate'))
                showToast('⚠️ Too many attempts — wait a few minutes and try again', 'error', 5000);
            else
                showToast('❌ ' + res.error.message, 'error');
        }
    } catch(e) { showToast('❌ Connection error — check your internet', 'error'); }
}

async function handleLogout() {
    unsubscribeAll();
    try { await _supabase.auth.signOut(); } catch(e){}
    selectedTopup=null; paymentScreenshotBase64=null; selectedStars=0; currentGame='freeFire';
    ['authEmail','authPassword','inGameName','playerUID','pubgName','pubgID','reviewName','reviewText'].forEach(function(id){
        var el=document.getElementById(id); if(el) el.value='';
    });
    var up=document.getElementById('uploadArea'), pr=document.getElementById('uploadPreview'), cb=document.getElementById('confirmOrderBtn');
    if(up) up.classList.remove('ok');
    if(pr) pr.classList.remove('show');
    if(cb){ cb.disabled=true; cb.textContent='✅ Confirm & Place Order'; }
    document.querySelectorAll('.pkg.on,.mem.on,.pubg-pkg.on').forEach(function(el){ el.classList.remove('on'); });
    ['gameDetailsCard','orderSummaryCard','paymentSection'].forEach(function(id){ var el=document.getElementById(id); if(el) el.classList.add('hidden'); });
    showToast('👋 Logged out');
}

_supabase.auth.onAuthStateChange(function(event, session) {
    clearTimeout(_authTimeout); _authLoaded=true;
    if (session&&session.user) {
        currentUser=session.user;
        isAdmin=(currentUser.email===ADMIN_EMAIL);
        requestNotificationPermission();
        if (isAdmin) {
            showAdminPanel(); loadAllOrders(); loadStockManagement(); loadAdminReviews(); loadVisitorStats(); subscribeToNewOrders();
        } else {
            showCustomerDashboard(); renderTopupGrids(); loadOrderHistory(); loadReviews('freeFire'); updateReviewPackages(); subscribeToOrderUpdates(); trackVisitor();
        }
    } else {
        currentUser=null; isAdmin=false; unsubscribeAll(); showAuthSection();
    }
});

// ══════════════════════════════════════════
//  STOCK
// ══════════════════════════════════════════

async function getStockStatus() {
    var stock={};
    diamondTopups.forEach(function(_,i){ stock['diamond_'+i]=true; });
    membershipTopups.forEach(function(_,i){ stock['membership_'+i]=true; });
    pubgTopups.forEach(function(_,i){ stock['pubg_'+i]=true; });
    try {
        var res=await _supabase.from('stock').select('*');
        if(res.data) res.data.forEach(function(r){ stock[r.key]=r.in_stock; });
    } catch(e){}
    return stock;
}
async function setStockItem(key,val) {
    try { await _supabase.from('stock').upsert({key:key,in_stock:val}); } catch(e){}
}

// ══════════════════════════════════════════
//  RENDER GRIDS
// ══════════════════════════════════════════

async function renderTopupGrids() {
    var stock=await getStockStatus();
    // Free Fire Diamonds
    document.getElementById('diamondGrid').innerHTML = diamondTopups.map(function(item,i){
        var inStock=stock['diamond_'+i]!==false;
        var badge=inStock?'<span class="stock-badge in-stock-badge">In Stock</span>':'<span class="stock-badge out-of-stock-badge">Out of Stock</span>';
        var hot=(item.diamonds===610||item.diamonds===1240)?'<span class="hot-badge">🔥 HOT</span>':'';
        var cls='pkg'+(inStock?'':' out-of-stock');
        var click=inStock?'onclick="selectTopup(this,\'diamond\','+i+')"':'';
        return '<div class="'+cls+'" '+click+'>'+hot+'<div class="pkg-icon">💎</div><div class="pkg-top">'+item.diamonds+' Diamonds</div><div class="pkg-price">₹'+item.price+'</div><div><span class="stk '+(inStock?'in':'out')+'">'+(inStock?'In Stock':'Out of Stock')+'</span></div></div>';
    }).join('');
    // Memberships
    document.getElementById('membershipGrid').innerHTML = membershipTopups.map(function(item,i){
        var inStock=stock['membership_'+i]!==false;
        var badge=inStock?'<span class="stock-badge in-stock-badge">In Stock</span>':'<span class="stock-badge out-of-stock-badge">Out of Stock</span>';
        var cls='mem'+(inStock?'':' out-of-stock');
        var click=inStock?'onclick="selectTopup(this,\'membership\','+i+')"':'';
        return '<div class="'+cls+'" '+click+'><div class="mem-left"><span class="mem-name">'+item.icon+' '+item.name+'</span><span class="mem-desc">💎 Free Fire Pass</span><span class="stk '+(inStock?'in':'out')+'">'+(inStock?'In Stock':'Out of Stock')+'</span></div><span class="mem-price">₹'+item.price+'</span></div>';
    }).join('');
}

async function renderPubgGrid() {
    var stock=await getStockStatus();
    document.getElementById('pubgGrid').innerHTML = pubgTopups.map(function(item,i){
        var inStock=stock['pubg_'+i]!==false;
        var badge=inStock?'<span class="stock-badge in-stock-badge">In Stock</span>':'<span class="stock-badge out-of-stock-badge">Out of Stock</span>';
        var hot=(item.uc===660||item.uc===1800)?'<span class="pub-hot">🔥 HOT</span>':'';
        var cls='pubg-pkg'+(inStock?'':' out-of-stock');
        var click=inStock?'onclick="selectTopup(this,\'pubg\','+i+')"':'';
        return '<div class="'+cls+'" '+click+'>'+hot+'<div class="pubg-icon">🎮</div><div class="pubg-top">'+item.uc+' UC</div><div class="pkg-price">₹'+item.price+'</div><div><span class="stk '+(inStock?'in':'out')+'">'+(inStock?'In Stock':'Out of Stock')+'</span></div></div>';
    }).join('');
}

function selectTopup(el, type, index) {
    document.querySelectorAll('.pkg.on,.mem.on,.pubg-pkg.on').forEach(function(e){ e.classList.remove('on'); });
    el.classList.add('on');

    var detailsCard = document.getElementById('gameDetailsCard');
    var ffDetails   = detailsCard.querySelector('.ff-details');
    var pubgDetails = detailsCard.querySelector('.pubg-details');
    var icon        = document.getElementById('gameDetailsIcon');
    var title       = document.getElementById('gameDetailsTitle');

    if (type==='pubg') {
        var item=pubgTopups[index];
        selectedTopup={type:'pubg', label:item.uc+' UC', price:item.price, game:'pubg'};
        ffDetails.style.display='none'; pubgDetails.style.display='block';
        icon.textContent='🎮'; title.textContent='PUBG Mobile Details';
    } else if (type==='diamond') {
        var item=diamondTopups[index];
        selectedTopup={type:'diamond', label:item.diamonds+' Diamonds', price:item.price, game:'freeFire'};
        ffDetails.style.display='block'; pubgDetails.style.display='none';
        icon.textContent='💎'; title.textContent='Free Fire Details';
    } else {
        var item=membershipTopups[index];
        selectedTopup={type:'membership', label:item.name, price:item.price, game:'freeFire'};
        ffDetails.style.display='block'; pubgDetails.style.display='none';
        icon.textContent='🏅'; title.textContent='Free Fire Details';
    }

    detailsCard.classList.remove('hidden');
    document.getElementById('orderSummaryCard').classList.remove('hidden');
    var gameIcon = (type==='pubg')?'🎮':(type==='diamond'?'💎':'🏅');
    var gameColor = (type==='pubg')?'#c2410c':'var(--success)';
    document.getElementById('orderSummaryContent').innerHTML =
        '<div style="background:'+(type==='pubg'?'#fff7ed':'var(--primary-pale)')+';padding:16px;border-radius:10px;text-align:center;border:1px solid '+(type==='pubg'?'#fed7aa':'var(--border-blue)')+'">' +
        '<p style="font-size:1.1rem;font-weight:800;">'+gameIcon+' '+selectedTopup.label+'</p>' +
        '<p style="font-size:1.6rem;font-weight:900;color:'+gameColor+'">₹'+selectedTopup.price+'</p></div>';
    detailsCard.scrollIntoView({behavior:'smooth'});
}

// ══════════════════════════════════════════
//  PAYMENT
// ══════════════════════════════════════════

function proceedToPayment() {
    clearAllErrors();
    if (!selectedTopup) {
        showToast('⚠️ Please select a package first!', 'error');
        window.scrollTo({top:0, behavior:'smooth'});
        return;
    }
    var valid = true;
    if (selectedTopup.game === 'pubg') {
        var name = document.getElementById('pubgName').value.trim();
        var uid  = document.getElementById('pubgID').value.trim();
        if (!name) { showFieldError('pubgName', 'Enter your PUBG player name'); valid = false; }
        if (!uid || uid.length < 5) { showFieldError('pubgID', 'Enter a valid PUBG Player ID (5 to 12 digits)'); valid = false; }
    } else {
        var name = document.getElementById('inGameName').value.trim();
        var uid  = document.getElementById('playerUID').value.trim();
        if (!name) { showFieldError('inGameName', 'Enter your Free Fire in-game name'); valid = false; }
        if (!uid || uid.length < 8 || uid.length > 11) { showFieldError('playerUID', 'Free Fire UID must be 8 to 11 digits (check your profile)'); valid = false; }
    }
    if (!valid) return;
    document.getElementById('paymentSection').classList.remove('hidden');
    document.getElementById('paymentSection').scrollIntoView({behavior:'smooth'});
}

function cancelPayment() {
    document.getElementById('paymentSection').classList.add('hidden');
    document.getElementById('orderSummaryCard').scrollIntoView({behavior:'smooth'});
}

function setupScreenshotUploader() {
    var area=document.getElementById('uploadArea');
    if(!area) return;
    area.addEventListener('dragover',function(e){e.preventDefault();area.style.borderColor='var(--primary)';});
    area.addEventListener('dragleave',function(){area.style.borderColor='';});
    area.addEventListener('drop',function(e){e.preventDefault();area.style.borderColor='';if(e.dataTransfer.files.length) handleScreenshotUpload({target:{files:e.dataTransfer.files}});});
}

function handleScreenshotUpload(event) {
    var file=event.target.files[0];
    if(!file) return;
    if(file.size>5*1024*1024) return showToast('❌ File too large (max 5MB)','error');
    var reader=new FileReader();
    reader.onload=function(e){
        compressImage(e.target.result,800,0.7,function(b64){
            paymentScreenshotBase64=b64;
            document.getElementById('uploadPreview').src=b64;
            document.getElementById('uploadPreview').classList.add('show');
            document.getElementById('uploadArea').classList.add('ok');
            document.getElementById('confirmOrderBtn').disabled=false;
            showToast('📸 Screenshot uploaded!','success');
        });
    };
    reader.readAsDataURL(file);
}

function compressImage(dataUrl,maxW,quality,cb){
    var img=new Image();
    img.onload=function(){
        var canvas=document.createElement('canvas');
        var w=img.width,h=img.height;
        if(w>maxW){h=(maxW/w)*h;w=maxW;}
        canvas.width=w;canvas.height=h;
        canvas.getContext('2d').drawImage(img,0,0,w,h);
        cb(canvas.toDataURL('image/jpeg',quality));
    };
    img.src=dataUrl;
}

async function confirmPlaceOrder() {
    if (!selectedTopup) return showToast('⚠️ No package selected','error');
    var name, uid;
    if (selectedTopup.game==='pubg') {
        name = document.getElementById('pubgName').value.trim();
        uid  = document.getElementById('pubgID').value.trim();
    } else {
        name = document.getElementById('inGameName').value.trim();
        uid  = document.getElementById('playerUID').value.trim();
    }
    if (!name)                    return showToast('⚠️ Enter your in-game name','error');
    if (selectedTopup.game === 'pubg') {
        if (!uid || uid.length < 5 || uid.length > 12) return showToast('⚠️ PUBG Player ID must be 5 to 12 digits','error');
    } else {
        if (!uid || uid.length < 8 || uid.length > 11) return showToast('⚠️ Free Fire UID must be 8 to 11 digits','error');
    }
    if (!paymentScreenshotBase64) {
        // Show error on upload area
        var uploadArea = document.getElementById('uploadArea');
        if (uploadArea) {
            uploadArea.style.borderColor = '#ef4444';
            uploadArea.style.background  = '#fee2e2';
            var existErr = document.getElementById('err_uploadArea');
            if (!existErr) {
                var err = document.createElement('div');
                err.id = 'err_uploadArea';
                err.innerHTML = '❌ Please upload your eSewa payment screenshot first!';
                err.style.cssText = 'color:#dc2626;font-size:.78rem;font-weight:700;margin-top:8px;padding:8px 12px;background:#fee2e2;border-radius:8px;border-left:3px solid #ef4444;text-align:center;';
                uploadArea.parentNode.insertBefore(err, uploadArea.nextSibling);
                setTimeout(function(){
                    if(err.parentNode) err.remove();
                    if(uploadArea) { uploadArea.style.borderColor=''; uploadArea.style.background=''; }
                }, 4000);
            }
        }
        showToast('⚠️ Upload your eSewa payment screenshot first', 'error');
        document.getElementById('uploadArea').scrollIntoView({behavior:'smooth'});
        return;
    }

    var btn = document.getElementById('confirmOrderBtn');
    btn.disabled = true; btn.textContent = '⏳ Placing Order…';
    showToast('⏳ Saving your order…', '');

    // ── Build order object (without game column first for compatibility) ──
    var orderId = 'ORD-'+Date.now()+'-'+Math.random().toString(36).substr(2,5).toUpperCase();
    var order = {
        order_id:       orderId,
        customer_email: currentUser.email,
        in_game_name:   name,
        player_uid:     uid,
        topup_label:    selectedTopup.label,
        price:          selectedTopup.price,
        screenshot:     paymentScreenshotBase64,
        status:         'pending'
    };

    try {
        // Try with game column first
        var orderWithGame = Object.assign({}, order, {game: selectedTopup.game || 'freeFire'});
        var res = await _supabase.from('orders').insert([orderWithGame]);

        // If game column doesn't exist, retry without it
        if (res.error && res.error.message && res.error.message.includes('game')) {
            res = await _supabase.from('orders').insert([order]);
        }

        if (res.error) {
            console.error('Order error:', res.error);
            // If screenshot too large, try without screenshot
            if (res.error.message && (res.error.message.includes('too large') || res.error.message.includes('size'))) {
                var orderNoSS = Object.assign({}, orderWithGame, {screenshot: null});
                res = await _supabase.from('orders').insert([orderNoSS]);
                if (!res.error) {
                    showToast('✅ Order placed! (Screenshot too large — send via WhatsApp)', 'success', 5000);
                    sendAdminEmailNotification(orderWithGame);
                    document.getElementById('thankYouModal').classList.remove('hidden');
                    resetAfterOrder(); loadOrderHistory();
                    return;
                }
            }
            showToast('❌ Error: ' + res.error.message, 'error', 5000);
            btn.disabled = false; btn.textContent = '✅ Confirm & Place Order';
            return;
        }

        sendAdminEmailNotification(orderWithGame);
        document.getElementById('thankYouModal').classList.remove('hidden');
        resetAfterOrder(); loadOrderHistory();

    } catch(e) {
        console.error('Order exception:', e);
        showToast('❌ Connection error — check your internet and try again','error');
        btn.disabled = false; btn.textContent = '✅ Confirm & Place Order';
    }
}

function sendAdminEmailNotification(order) {
    try {
        fetch('https://formsubmit.co/ajax/aadityadas4000@gmail.com',{
            method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'},
            body:JSON.stringify({
                _subject:'🔔 New '+(order.game==='pubg'?'PUBG':'FF')+' Order! '+order.topup_label+' — ₹'+order.price,
                'Game':order.game==='pubg'?'PUBG Mobile':'Free Fire',
                'Order ID':order.order_id,'Customer':order.customer_email,
                'Name':order.in_game_name,'ID/UID':order.player_uid,
                'Package':order.topup_label,'Amount':'₹'+order.price,'Status':'Pending'
            })
        });
    } catch(e){}
}

function resetAfterOrder() {
    selectedTopup=null; paymentScreenshotBase64=null;
    ['paymentSection','orderSummaryCard','gameDetailsCard'].forEach(function(id){
        var el=document.getElementById(id); if(el) el.classList.add('hidden');
    });
    document.querySelectorAll('.pkg.on,.mem.on,.pubg-pkg.on').forEach(function(el){ el.classList.remove('on'); });
    ['inGameName','playerUID','pubgName','pubgID'].forEach(function(id){
        var el=document.getElementById(id); if(el) el.value='';
    });
    var up=document.getElementById('uploadArea'),pr=document.getElementById('uploadPreview'),cb=document.getElementById('confirmOrderBtn');
    if(up) up.classList.remove('ok');
    if(pr) pr.classList.remove('show');
    if(cb){cb.disabled=true;cb.textContent='✅ Confirm & Place Order';}
}

function closeThankYou(){ document.getElementById('thankYouModal').classList.add('hidden'); }

// ══════════════════════════════════════════
//  ORDER HISTORY
// ══════════════════════════════════════════

async function loadOrderHistory() {
    if(!currentUser) return;
    var c=document.getElementById('orderHistoryContainer');
    try {
        var res=await _supabase.from('orders').select('*').eq('customer_email',currentUser.email).order('created_at',{ascending:false});
        if(!res.data||!res.data.length){c.innerHTML='<p style="text-align:center;color:var(--text-light);padding:20px;">No orders yet.</p>';return;}
        c.innerHTML='<table class="order-table"><thead><tr><th>Game</th><th>Status</th><th>Package</th><th>Amount</th><th>Date</th></tr></thead><tbody>'+
            res.data.map(function(o){
                var gameIcon=o.game==='pubg'?'🎮':'🔥';
                return '<tr><td>'+gameIcon+'</td><td><span class="status-badge '+(o.status==='complete'?'status-complete':'status-pending')+'">'+o.status+'</span></td>'+
                    '<td>'+o.topup_label+'</td><td>₹'+o.price+'</td><td>'+new Date(o.created_at).toLocaleDateString('en-IN')+'</td></tr>';
            }).join('')+'</tbody></table>';
    } catch(e){c.innerHTML='<p style="text-align:center;color:var(--text-light)">Could not load orders.</p>';}
}

// ══════════════════════════════════════════
//  ADMIN ORDERS
// ══════════════════════════════════════════

async function loadAllOrders() {
    var c=document.getElementById('adminOrdersContainer');
    try {
        var res=await _supabase.from('orders').select('*').order('created_at',{ascending:false});
        if(!res.data||!res.data.length){c.innerHTML='<p style="padding:12px;text-align:center">No orders yet.</p>';return;}
        c.innerHTML=res.data.map(function(o){
            var gameIcon=o.game==='pubg'?'🎮 PUBG':'🔥 Free Fire';
            return '<div class="admin-order-card '+(o.status==='complete'?'complete':'')+'">'+
                '<p><strong>'+gameIcon+'</strong> | <strong>🆔</strong> '+o.order_id+'</p>'+
                '<p><strong>👤</strong> '+o.customer_email+'</p>'+
                '<p><strong>🧑</strong> '+o.in_game_name+' | <strong>ID:</strong> '+o.player_uid+'</p>'+
                '<p><strong>📦</strong> '+o.topup_label+' | <strong>💰</strong> ₹'+o.price+'</p>'+
                '<p><strong>📅</strong> '+new Date(o.created_at).toLocaleString('en-IN')+'</p>'+
                '<p><strong>📌</strong> <span class="status-badge '+(o.status==='complete'?'status-complete':'status-pending')+'">'+o.status+'</span></p>'+
                (o.screenshot?'<details><summary style="cursor:pointer;font-size:.82rem;margin-top:6px">📸 View Screenshot</summary><img src="'+o.screenshot+'" style="max-width:100%;border-radius:8px;margin-top:6px"></details>':'')+
                '<div class="admin-actions">'+
                (o.status==='pending'?'<button class="btn btn-sm btn-success" onclick="markComplete(\''+o.id+'\')">✅ Complete</button>':'<button class="btn btn-sm btn-warning" onclick="markPending(\''+o.id+'\')">⏳ Pending</button>')+
                '<button class="btn btn-sm btn-danger" onclick="deleteOrder(\''+o.id+'\')">🗑 Delete</button>'+
                '</div></div>';
        }).join('');
    } catch(e){c.innerHTML='<p style="padding:12px;text-align:center;color:var(--danger)">Failed to load orders.</p>';}
}

async function markComplete(id){ await updateOrderStatus(id,'complete'); }
async function markPending(id) { await updateOrderStatus(id,'pending'); }
async function updateOrderStatus(id,status){
    try{var res=await _supabase.from('orders').update({status:status}).eq('id',id);if(res.error)return showToast('❌ Failed to update','error');showToast('Order marked '+status,'success');loadAllOrders();}
    catch(e){showToast('❌ Connection error','error');}
}
async function deleteOrder(id){
    if(!confirm('Delete this order?')) return;
    try{await _supabase.from('orders').delete().eq('id',id);showToast('🗑 Deleted','success');loadAllOrders();}
    catch(e){showToast('❌ Failed to delete','error');}
}

// ══════════════════════════════════════════
//  STOCK
// ══════════════════════════════════════════

async function loadStockManagement() {
    var c=document.getElementById('stockManagementContainer');
    if(!c) return;
    var stock=await getStockStatus();
    var html='<h4 style="margin-bottom:8px;font-size:.88rem;">🔥 Free Fire Diamonds</h4>';
    diamondTopups.forEach(function(item,i){
        var inStock=stock['diamond_'+i]!==false;
        html+='<div class="stock-item"><span>💎 '+item.diamonds+' — ₹'+item.price+'</span><button class="btn btn-sm '+(inStock?'btn-warning':'btn-success')+'" onclick="toggleStock(\'diamond\','+i+')">'+(inStock?'Mark Out':'Mark In')+'</button></div>';
    });
    html+='<h4 style="margin-top:12px;margin-bottom:8px;font-size:.88rem;">🏅 Memberships</h4>';
    membershipTopups.forEach(function(item,i){
        var inStock=stock['membership_'+i]!==false;
        html+='<div class="stock-item"><span>'+item.icon+' '+item.name+' — ₹'+item.price+'</span><button class="btn btn-sm '+(inStock?'btn-warning':'btn-success')+'" onclick="toggleStock(\'membership\','+i+')">'+(inStock?'Mark Out':'Mark In')+'</button></div>';
    });
    html+='<h4 style="margin-top:12px;margin-bottom:8px;font-size:.88rem;">🎮 PUBG Mobile UC</h4>';
    pubgTopups.forEach(function(item,i){
        var inStock=stock['pubg_'+i]!==false;
        html+='<div class="stock-item"><span>🎮 '+item.uc+' UC — ₹'+item.price+'</span><button class="btn btn-sm '+(inStock?'btn-warning':'btn-success')+'" onclick="toggleStock(\'pubg\','+i+')">'+(inStock?'Mark Out':'Mark In')+'</button></div>';
    });
    c.innerHTML=html;
}

async function toggleStock(type,index){
    var stock=await getStockStatus(); var newVal=!stock[type+'_'+index];
    await setStockItem(type+'_'+index,newVal);
    renderTopupGrids(); if(currentGame==='pubg') renderPubgGrid();
    loadStockManagement();
    showToast(newVal?'✅ Marked In Stock':'⛔ Marked Out of Stock','success');
}
async function setAllOutOfStock(){
    if(!confirm('Mark ALL items out of stock?')) return;
    var p=[];
    diamondTopups.forEach(function(_,i){p.push(setStockItem('diamond_'+i,false));});
    membershipTopups.forEach(function(_,i){p.push(setStockItem('membership_'+i,false));});
    pubgTopups.forEach(function(_,i){p.push(setStockItem('pubg_'+i,false));});
    await Promise.all(p); renderTopupGrids(); loadStockManagement();
    showToast('⛔ All items set to Out of Stock','success');
}
async function resetAllInStock(){
    var p=[];
    diamondTopups.forEach(function(_,i){p.push(setStockItem('diamond_'+i,true));});
    membershipTopups.forEach(function(_,i){p.push(setStockItem('membership_'+i,true));});
    pubgTopups.forEach(function(_,i){p.push(setStockItem('pubg_'+i,true));});
    await Promise.all(p); renderTopupGrids(); loadStockManagement();
    showToast('✅ All items now In Stock','success');
}

// ══════════════════════════════════════════
//  REVIEW SYSTEM
// ══════════════════════════════════════════

function setReviewStar(n){
    selectedStars=n;
    document.querySelectorAll('.star-btn').forEach(function(btn){
        btn.classList.toggle('active',parseInt(btn.dataset.star)<=n);
    });
}

function updateReviewPackages(){
    var game=document.getElementById('reviewGame').value;
    var sel =document.getElementById('reviewPackage');
    var opts=['<option value="">Select package…</option>'];
    if(game==='freeFire'){
        diamondTopups.forEach(function(item){opts.push('<option>💎 '+item.diamonds+' Diamonds</option>');});
        membershipTopups.forEach(function(item){opts.push('<option>'+item.icon+' '+item.name+'</option>');});
    } else {
        pubgTopups.forEach(function(item){opts.push('<option>🎮 '+item.uc+' UC</option>');});
    }
    sel.innerHTML=opts.join('');
}

async function submitReview(){
    clearAllErrors();
    var game=document.getElementById('reviewGame').value;
    var name=(document.getElementById('reviewName').value||'').trim();
    var pkg =(document.getElementById('reviewPackage').value||'').trim();
    var text=(document.getElementById('reviewText').value||'').trim();
    var valid = true;
    if (!name) { showFieldError('reviewName', 'Please enter your name'); valid = false; }
    if (selectedStars === 0) { showToast('⚠️ Please tap the stars to give a rating ⭐', 'error', 4000); valid = false; }
    if (!text || text.trim().split(/\s+/).length < 1 || text.trim().length < 1) { showFieldError('reviewText', 'Please write at least one word for your review'); valid = false; }
    if (!valid) return;
    try {
        var res=await _supabase.from('reviews').insert([{customer_name:name,stars:selectedStars,review_text:text,package:pkg||null,game:game,approved:false}]);
        if(res.error){showToast('❌ Failed to submit review. Try again.','error');return;}
        document.getElementById('reviewName').value='';
        document.getElementById('reviewPackage').value='';
        document.getElementById('reviewText').value='';
        selectedStars=0;
        document.querySelectorAll('.star-btn').forEach(function(b){b.classList.remove('active');});
        showToast('🌟 Review submitted! It will appear after approval.','success',4000);
    } catch(e){showToast('❌ Connection error. Try again.','error');}
}

async function loadReviews(game){
    game=game||'freeFire';
    var c=document.getElementById('reviewsList');
    var avgEl=document.getElementById('avgRating');
    var totalEl=document.getElementById('totalReviews');
    var countEl=document.getElementById('reviewCountBadge');
    if(!c) return;
    c.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-light);">Loading…</div>';
    try {
        var res=await _supabase.from('reviews').select('*').eq('approved',true).eq('game',game).order('created_at',{ascending:false});
        var reviews=res.data||[];
        if(!reviews.length){
            c.innerHTML='<p style="text-align:center;color:var(--text-light);padding:20px;">No reviews yet — be the first! ⭐</p>';
            if(avgEl) avgEl.textContent='—';
            if(totalEl) totalEl.textContent='No reviews yet';
            if(countEl) countEl.textContent='0 reviews';
            return;
        }
        var avg=reviews.reduce(function(s,r){return s+r.stars;},0)/reviews.length;
        if(avgEl) avgEl.textContent=avg.toFixed(1);
        if(totalEl) totalEl.textContent='Based on '+reviews.length+' review'+(reviews.length>1?'s':'');
        if(countEl) countEl.textContent=reviews.length+' reviews';
        var gameColor=game==='pubg'?'#c2410c':'var(--primary)';
        c.innerHTML=reviews.map(function(r,idx){
            var avatar=AVATARS[idx%AVATARS.length];
            return '<div class="review-card">'+
                '<div class="review-top">'+
                '<div class="review-avatar">'+avatar+'</div>'+
                '<div class="review-meta">'+
                '<div class="review-name">'+escapeHtml(r.customer_name)+'</div>'+
                '<div class="review-stars" style="color:#f59e0b">'+starsHTML(r.stars)+'</div>'+
                (r.package?'<div class="review-package" style="color:'+gameColor+'">'+escapeHtml(r.package)+'</div>':'')+
                '</div>'+
                '<div class="review-verified">✅ Verified</div>'+
                '</div>'+
                '<div class="review-text">"'+escapeHtml(r.review_text)+'"</div>'+
                '<div class="review-date">'+timeAgo(r.created_at)+'</div>'+
                '</div>';
        }).join('');
    } catch(e){if(c) c.innerHTML='<p style="text-align:center;color:var(--text-light)">Could not load reviews.</p>';}
}

// ── Admin Review Management ──
async function loadAdminReviews(){
    var c=document.getElementById('adminReviewsContainer');
    if(!c) return;
    try {
        var res=await _supabase.from('reviews').select('*').eq('approved',false).order('created_at',{ascending:false});
        var pending=res.data||[];
        if(!pending.length){c.innerHTML='<p style="text-align:center;color:var(--text-light);padding:12px;">No pending reviews ✅</p>';return;}
        c.innerHTML=pending.map(function(r){
            var gameLabel=r.game==='pubg'?'🎮 PUBG':'🔥 Free Fire';
            return '<div style="background:var(--bg-soft);border-radius:10px;padding:12px;margin-bottom:8px;border-left:3px solid var(--accent)">'+
                '<p><strong>'+escapeHtml(r.customer_name)+'</strong> — '+starsHTML(r.stars)+' | '+gameLabel+'</p>'+
                (r.package?'<p style="font-size:.78rem;color:var(--text-light)">'+escapeHtml(r.package)+'</p>':'')+
                '<p style="font-size:.82rem;margin:6px 0;">"'+escapeHtml(r.review_text)+'"</p>'+
                '<div style="display:flex;gap:8px;margin-top:8px;">'+
                '<button class="btn btn-sm btn-success" onclick="approveReview(\''+r.id+'\')">✅ Approve</button>'+
                '<button class="btn btn-sm btn-danger"  onclick="rejectReview(\''+r.id+'\')">🗑 Reject</button>'+
                '</div></div>';
        }).join('');
    } catch(e){c.innerHTML='<p style="color:var(--danger);padding:12px;">Failed to load reviews.</p>';}
}

async function approveReview(id){
    try{await _supabase.from('reviews').update({approved:true}).eq('id',id);showToast('✅ Review approved!','success');loadAdminReviews();}
    catch(e){showToast('❌ Failed to approve','error');}
}
async function rejectReview(id){
    if(!confirm('Delete this review?')) return;
    try{await _supabase.from('reviews').delete().eq('id',id);showToast('🗑 Review deleted','success');loadAdminReviews();}
    catch(e){showToast('❌ Failed to delete','error');}
}

// ══════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function(){
    setupScreenshotUploader();
    updateReviewPackages();
    trackVisitor();
    document.getElementById('loadingSection').classList.remove('hidden');
    document.getElementById('authSection').classList.add('hidden');
    _authTimeout=setTimeout(function(){
        if(!_authLoaded){
            document.getElementById('loadingSection').classList.add('hidden');
            document.getElementById('authSection').classList.remove('hidden');
        }
    }, 5000);
});

// ══════════════════════════════════════════
//  INLINE FIELD ERROR SYSTEM
// ══════════════════════════════════════════

function showFieldError(fieldId, msg) {
    clearFieldError(fieldId);
    var field = document.getElementById(fieldId);
    if (!field) return;
    field.style.borderColor = '#ef4444';
    field.style.boxShadow   = '0 0 0 3px rgba(239,68,68,0.15)';
    var err = document.createElement('div');
    err.className = 'field-error';
    err.id        = 'err_' + fieldId;
    err.innerHTML = '❌ ' + msg;
    err.style.cssText = 'color:#dc2626;font-size:.78rem;font-weight:700;margin-top:6px;padding:8px 12px;background:#fee2e2;border-radius:8px;border-left:3px solid #ef4444;display:flex;align-items:center;gap:6px;';
    field.parentNode.insertBefore(err, field.nextSibling);
    field.addEventListener('input', function(){ clearFieldError(fieldId); }, {once:true});
    field.focus();
}

function clearFieldError(fieldId) {
    var field = document.getElementById(fieldId);
    if (field) { field.style.borderColor=''; field.style.boxShadow=''; }
    var err = document.getElementById('err_'+fieldId);
    if (err) err.remove();
}

function clearAllErrors() {
    document.querySelectorAll('.field-error').forEach(function(e){ e.remove(); });
    document.querySelectorAll('.form-input').forEach(function(f){ f.style.borderColor=''; f.style.boxShadow=''; });
}

function showSuccess(fieldId) {
    var field = document.getElementById(fieldId);
    if (!field) return;
    field.style.borderColor = '#10b981';
    field.style.boxShadow   = '0 0 0 3px rgba(16,185,129,0.15)';
}

// ══════════════════════════════════════════
//  VISITOR TRACKING SYSTEM
// ══════════════════════════════════════════

function getDeviceType() {
    var ua = navigator.userAgent;
    if (/tablet|ipad|playbook|silk/i.test(ua)) return 'Tablet 📱';
    if (/mobile|iphone|ipod|android|blackberry|mini|windows\sce|palm/i.test(ua)) return 'Mobile 📱';
    return 'Desktop 💻';
}

function getOrCreateSessionId() {
    var sid = sessionStorage.getItem('aatc_sid');
    if (!sid) {
        sid = 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem('aatc_sid', sid);
    }
    return sid;
}

async function trackVisitor() {
    try {
        var sid = getOrCreateSessionId();
        // Don't track if already tracked this session
        if (sessionStorage.getItem('aatc_tracked')) return;
        await _supabase.from('visitors').insert([{
            session_id:  sid,
            device_type: getDeviceType()
        }]);
        sessionStorage.setItem('aatc_tracked', '1');
    } catch(e) { /* silent fail */ }
}

async function loadVisitorStats() {
    var c = document.getElementById('visitorStatsContainer');
    if (!c) return;
    c.innerHTML = '<p style="text-align:center;color:var(--text-light);padding:12px;">Loading stats…</p>';
    try {
        var now   = new Date();
        var today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        var week  = new Date(now.getFullYear(), now.getMonth(), now.getDate()-7).toISOString();
        var month = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        // Get all visitor data
        var resAll   = await _supabase.from('visitors').select('*').order('visited_at', {ascending:false});
        var all      = resAll.data || [];
        var todayArr = all.filter(function(v){ return v.visited_at >= today; });
        var weekArr  = all.filter(function(v){ return v.visited_at >= week; });
        var monthArr = all.filter(function(v){ return v.visited_at >= month; });

        // Unique sessions
        var uniqueAll   = new Set(all.map(function(v){ return v.session_id; })).size;
        var uniqueToday = new Set(todayArr.map(function(v){ return v.session_id; })).size;
        var uniqueWeek  = new Set(weekArr.map(function(v){ return v.session_id; })).size;
        var uniqueMonth = new Set(monthArr.map(function(v){ return v.session_id; })).size;

        // Device breakdown
        var mobile  = all.filter(function(v){ return v.device_type && v.device_type.includes('Mobile'); }).length;
        var desktop = all.filter(function(v){ return v.device_type && v.device_type.includes('Desktop'); }).length;
        var tablet  = all.filter(function(v){ return v.device_type && v.device_type.includes('Tablet'); }).length;
        var total   = all.length || 1;

        // Last 7 days chart data
        var days = [];
        for (var i=6; i>=0; i--) {
            var d    = new Date(now.getFullYear(), now.getMonth(), now.getDate()-i);
            var dEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate()-i+1);
            var cnt  = all.filter(function(v){ return v.visited_at >= d.toISOString() && v.visited_at < dEnd.toISOString(); }).length;
            var label= ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
            days.push({label:label, count:cnt});
        }
        var maxDay = Math.max.apply(null, days.map(function(d){ return d.count; })) || 1;

        // Recent visitors
        var recent = all.slice(0, 5);

        c.innerHTML =
        // Stats Cards
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">'+
            statCard('👁️', 'Today', uniqueToday, 'visitors') +
            statCard('📅', 'This Week', uniqueWeek, 'visitors') +
            statCard('🗓️', 'This Month', uniqueMonth, 'visitors') +
            statCard('🌍', 'All Time', uniqueAll, 'visitors') +
        '</div>'+

        // Device breakdown
        '<div style="background:var(--bg-soft);border-radius:12px;padding:14px;margin-bottom:14px;border:1px solid var(--border);">'+
        '<p style="font-weight:700;font-size:.85rem;margin-bottom:10px;color:var(--text-mid);">📱 Device Breakdown</p>'+
        deviceBar('Mobile 📱', mobile, total, '#3b82f6') +
        deviceBar('Desktop 💻', desktop, total, '#8b5cf6') +
        deviceBar('Tablet 🖥️', tablet, total, '#10b981') +
        '</div>'+

        // Last 7 days chart
        '<div style="background:var(--bg-soft);border-radius:12px;padding:14px;margin-bottom:14px;border:1px solid var(--border);">'+
        '<p style="font-weight:700;font-size:.85rem;margin-bottom:12px;color:var(--text-mid);">📊 Last 7 Days</p>'+
        '<div style="display:flex;align-items:flex-end;gap:6px;height:80px;">'+
        days.map(function(d){
            var h = Math.max(4, Math.round((d.count/maxDay)*70));
            return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">'+
                '<span style="font-size:.65rem;font-weight:700;color:var(--primary);">'+d.count+'</span>'+
                '<div style="width:100%;height:'+h+'px;background:linear-gradient(135deg,#1a56db,#7c3aed);border-radius:4px 4px 0 0;"></div>'+
                '<span style="font-size:.62rem;color:var(--text-light);">'+d.label+'</span>'+
            '</div>';
        }).join('')+
        '</div></div>'+

        // Recent activity
        '<div style="background:var(--bg-soft);border-radius:12px;padding:14px;border:1px solid var(--border);">'+
        '<p style="font-weight:700;font-size:.85rem;margin-bottom:10px;color:var(--text-mid);">🕐 Recent Visitors</p>'+
        (recent.length ? recent.map(function(v){
            var t = new Date(v.visited_at);
            return '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:.78rem;">'+
                '<span>'+v.device_type+'</span>'+
                '<span style="color:var(--text-light);">'+t.toLocaleString('en-IN')+'</span>'+
            '</div>';
        }).join('') : '<p style="text-align:center;color:var(--text-light);">No data yet</p>') +
        '</div>';

    } catch(e) {
        c.innerHTML = '<p style="color:var(--danger);padding:12px;text-align:center;">Failed to load stats.</p>';
    }
}

function statCard(icon, label, value, unit) {
    return '<div style="background:#fff;border-radius:12px;padding:14px;text-align:center;border:1px solid var(--border-blue);box-shadow:var(--shadow-sm);">'+
        '<div style="font-size:1.4rem;">'+icon+'</div>'+
        '<div style="font-size:1.6rem;font-weight:900;color:var(--primary-dark);line-height:1.2;">'+value+'</div>'+
        '<div style="font-size:.7rem;color:var(--text-light);font-weight:600;">'+label+'</div>'+
    '</div>';
}

function deviceBar(label, count, total, color) {
    var pct = Math.round((count/total)*100);
    return '<div style="margin-bottom:8px;">'+
        '<div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:3px;">'+
        '<span style="font-weight:600;">'+label+'</span>'+
        '<span style="color:var(--text-light);">'+count+' ('+pct+'%)</span></div>'+
        '<div style="background:var(--border);border-radius:20px;height:8px;overflow:hidden;">'+
        '<div style="width:'+pct+'%;height:100%;background:'+color+';border-radius:20px;transition:width .8s ease;"></div>'+
        '</div></div>';
}
