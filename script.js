// ══════════════════════════════════════════
//  Aaditya Top Up Centre — script.js v4.0
//  Free Fire + PUBG | Reviews | Supabase
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
var paymentScreenshotBase64 = null;
var selectedStars           = 0;
var currentGame             = 'ff';
var _userChannel            = null;
var _adminChannel           = null;
var _newOrderCount          = 0;
var _authLoaded             = false;
var _authTimeout            = null;

// ══ FREE FIRE PACKAGES ══
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

// ══ PUBG PACKAGES ══
var pubgUCTopups = [
    {uc:60,   price:75,   hot:false},
    {uc:325,  price:380,  hot:false},
    {uc:660,  price:750,  hot:true},
    {uc:1800, price:1900, hot:true},
    {uc:3850, price:3800, hot:false},
    {uc:8100, price:7500, hot:false}
];
var pubgSpecialTopups = [
    {name:'Royal Pass (Month C1)',  price:800,  icon:'👑'},
    {name:'Royal Pass (Month C2)',  price:1500, icon:'💎'},
    {name:'Classic Crate Coupon',   price:80,   icon:'📦'},
    {name:'Premium Crate Coupon',   price:160,  icon:'🎁'}
];

// ══════════════════════════════════════════
//  GAME SWITCHER
// ══════════════════════════════════════════

function switchGame(game) {
    currentGame = game;
    var ffSection   = document.getElementById('ffSection');
    var pubgSection = document.getElementById('pubgSection');
    var tabFF       = document.getElementById('tabFF');
    var tabPUBG     = document.getElementById('tabPUBG');

    if (game === 'ff') {
        ffSection.classList.remove('hidden');
        pubgSection.classList.add('hidden');
        tabFF.classList.add('active');
        tabPUBG.classList.remove('active');
    } else {
        ffSection.classList.add('hidden');
        pubgSection.classList.remove('hidden');
        tabFF.classList.remove('active');
        tabPUBG.classList.add('active');
        renderPubgGrids();
    }

    // Reset selection when switching game
    selectedTopup = null;
    document.getElementById('gameDetailsCard').classList.add('hidden');
    document.getElementById('orderSummaryCard').classList.add('hidden');
    document.getElementById('paymentSection').classList.add('hidden');
    document.querySelectorAll('.topup-item.selected,.membership-item.selected,.pubg-item.selected,.pubg-special-item.selected')
        .forEach(function(el){ el.classList.remove('selected'); });
}

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
    var input = document.getElementById('authPassword');
    var btn   = document.getElementById('authPasswordToggle');
    if (input.type==='password'){ input.type='text';     btn.textContent='🙈'; }
    else                        { input.type='password'; btn.textContent='👁️'; }
}

function isAllowedEmail(email) {
    email = email.trim().toLowerCase();
    if (email === ADMIN_EMAIL) return true;
    return email.endsWith('@gmail.com') && email.length > '@gmail.com'.length;
}

function starsHTML(n) {
    var s='';
    for(var i=1;i<=5;i++) s+=(i<=n?'★':'☆');
    return s;
}

function timeAgo(dateStr) {
    var diff = Math.floor((Date.now()-new Date(dateStr))/1000);
    if(diff<60)    return 'Just now';
    if(diff<3600)  return Math.floor(diff/60)+' min ago';
    if(diff<86400) return Math.floor(diff/3600)+' hr ago';
    return Math.floor(diff/86400)+' days ago';
}

function escapeHtml(str) {
    if(!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ══════════════════════════════════════════
//  NOTIFICATIONS
// ══════════════════════════════════════════

function requestNotificationPermission() {
    if(!('Notification' in window)) return;
    if(Notification.permission==='default') Notification.requestPermission();
}

function sendBrowserNotification(title, body) {
    if(!('Notification' in window)||Notification.permission!=='granted') return;
    try { new Notification(title,{body:body}); } catch(e){}
}

function updateNotificationBadge() {
    _newOrderCount++;
    var badge=document.getElementById('notifBadge');
    if(badge){ badge.textContent=_newOrderCount; badge.classList.remove('hidden'); }
}
function clearNotificationBadge() {
    _newOrderCount=0;
    var badge=document.getElementById('notifBadge');
    if(badge) badge.classList.add('hidden');
}

function subscribeToOrderUpdates() {
    if(!currentUser) return;
    if(_userChannel){ try{_supabase.removeChannel(_userChannel);}catch(e){} }
    _userChannel = _supabase.channel('user-orders-'+currentUser.id)
        .on('postgres_changes',{event:'UPDATE',schema:'public',table:'orders'},function(payload){
            if(payload.new&&payload.new.customer_email===currentUser.email&&
               payload.new.status==='complete'&&payload.old.status!=='complete'){
                sendBrowserNotification('✅ Top-Up Delivered! 💎','Your '+payload.new.topup_label+' has been delivered!');
                showToast('🎉 Your top-up is complete! Check your game!','success',6000);
                loadOrderHistory();
                var modal=document.getElementById('orderCompleteModal');
                var text=document.getElementById('orderCompleteText');
                if(modal&&text){ text.textContent='Your '+payload.new.topup_label+' delivered to '+payload.new.in_game_name+'! Open your game to check. 💎'; modal.classList.remove('hidden'); }
            }
        }).subscribe();
}

function subscribeToNewOrders() {
    if(_adminChannel){ try{_supabase.removeChannel(_adminChannel);}catch(e){} }
    _adminChannel = _supabase.channel('admin-new-orders')
        .on('postgres_changes',{event:'INSERT',schema:'public',table:'orders'},function(payload){
            if(!payload.new) return;
            sendBrowserNotification('🔔 New Order!',payload.new.customer_email+' — '+payload.new.topup_label+' ₹'+payload.new.price);
            showToast('🔔 New order! '+payload.new.topup_label+' — ₹'+payload.new.price,'success',6000);
            updateNotificationBadge();
            loadAllOrders();
        }).subscribe();
}

function unsubscribeAll() {
    if(_userChannel) { try{_supabase.removeChannel(_userChannel); }catch(e){} _userChannel=null;  }
    if(_adminChannel){ try{_supabase.removeChannel(_adminChannel);}catch(e){} _adminChannel=null; }
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
    var email    = document.getElementById('authEmail').value.trim();
    var password = document.getElementById('authPassword').value.trim();
    if(!email&&!password) return showToast('⚠️ Enter your email and password','error');
    if(!email)            return showToast('⚠️ Enter your email address','error');
    if(!password)         return showToast('⚠️ Enter a password','error');
    if(!isAllowedEmail(email)) return showToast('❌ Only Gmail allowed e.g. you@gmail.com','error');
    if(password.length<6)      return showToast('❌ Password too short — min 6 characters','error');
    showToast('⏳ Creating your account…','');
    try {
        var res = await _supabase.auth.signUp({email:email,password:password});
        if(res.error){
            var msg=res.error.message.toLowerCase();
            if(msg.includes('already registered')||msg.includes('already exists'))
                showToast('❌ Email already registered — try Sign In','error');
            else showToast('❌ '+res.error.message,'error');
        } else { showToast('✅ Account created! Welcome!','success'); }
    } catch(e){ showToast('❌ Connection error — check your internet','error'); }
}

async function handleSignIn() {
    var email    = document.getElementById('authEmail').value.trim();
    var password = document.getElementById('authPassword').value.trim();
    if(!email&&!password) return showToast('⚠️ Enter your email and password','error');
    if(!email)            return showToast('⚠️ Enter your email address','error');
    if(!password)         return showToast('⚠️ Enter your password','error');
    if(!isAllowedEmail(email)) return showToast('❌ Only Gmail allowed e.g. you@gmail.com','error');
    showToast('⏳ Signing you in…','');
    try {
        var res = await _supabase.auth.signInWithPassword({email:email,password:password});
        if(res.error){
            var msg=res.error.message.toLowerCase();
            if(msg.includes('invalid')||msg.includes('wrong'))
                showToast('❌ Wrong password — please try again','error');
            else if(msg.includes('not found')||msg.includes('no user'))
                showToast('❌ No account found — Sign Up first','error');
            else if(msg.includes('too many')||msg.includes('rate'))
                showToast('⚠️ Too many attempts — wait a few minutes','error');
            else showToast('❌ '+res.error.message,'error');
        }
    } catch(e){ showToast('❌ Connection error — check your internet','error'); }
}

async function handleLogout() {
    unsubscribeAll();
    try{ await _supabase.auth.signOut(); }catch(e){}
    selectedTopup=null; paymentScreenshotBase64=null; selectedStars=0; currentGame='ff';
    ['authEmail','authPassword','inGameName','playerUID','reviewName','reviewText'].forEach(function(id){
        var el=document.getElementById(id); if(el) el.value='';
    });
    var ua=document.getElementById('uploadArea'),up=document.getElementById('uploadPreview'),cb=document.getElementById('confirmOrderBtn');
    if(ua) ua.classList.remove('has-file');
    if(up) up.classList.remove('show');
    if(cb){ cb.disabled=true; cb.textContent='✅ Confirm & Place Order'; }
    document.querySelectorAll('.selected').forEach(function(el){ el.classList.remove('selected'); });
    ['gameDetailsCard','orderSummaryCard','paymentSection'].forEach(function(id){ document.getElementById(id).classList.add('hidden'); });
    showToast('👋 Logged out');
}

_supabase.auth.onAuthStateChange(function(event,session){
    clearTimeout(_authTimeout);
    _authLoaded = true;
    if(session&&session.user){
        currentUser = session.user;
        isAdmin     = (currentUser.email===ADMIN_EMAIL);
        requestNotificationPermission();
        if(isAdmin){
            showAdminPanel();
            loadAllOrders();
            loadStockManagement();
            loadAdminReviews();
            subscribeToNewOrders();
        } else {
            showCustomerDashboard();
            renderTopupGrids();
            loadOrderHistory();
            loadReviews();
            subscribeToOrderUpdates();
        }
    } else {
        currentUser=null; isAdmin=false;
        unsubscribeAll();
        showAuthSection();
    }
});

// ══════════════════════════════════════════
//  STOCK
// ══════════════════════════════════════════

async function getStockStatus() {
    var stock={};
    diamondTopups.forEach(function(_,i){stock['diamond_'+i]=true;});
    membershipTopups.forEach(function(_,i){stock['membership_'+i]=true;});
    pubgUCTopups.forEach(function(_,i){stock['pubguc_'+i]=true;});
    pubgSpecialTopups.forEach(function(_,i){stock['pubgspecial_'+i]=true;});
    try {
        var res=await _supabase.from('stock').select('*');
        if(res.data) res.data.forEach(function(row){stock[row.key]=row.in_stock;});
    } catch(e){}
    return stock;
}
async function setStockItem(key,inStock){
    try{ await _supabase.from('stock').upsert({key:key,in_stock:inStock}); }catch(e){}
}

// ══════════════════════════════════════════
//  TOPUP GRIDS — FREE FIRE
// ══════════════════════════════════════════

async function renderTopupGrids() {
    var stock=await getStockStatus();
    document.getElementById('diamondGrid').innerHTML = diamondTopups.map(function(item,i){
        var inStock=stock['diamond_'+i]!==false;
        var badge=inStock?'<span class="stock-badge in-stock-badge">In Stock</span>':'<span class="stock-badge out-of-stock-badge">Out of Stock</span>';
        var hot=(item.diamonds===610||item.diamonds===1240)?'<span class="topup-badge">🔥 HOT</span>':'';
        var cls='topup-item'+(inStock?'':' out-of-stock');
        var click=inStock?'onclick="selectTopup(this,\'diamond\','+i+')"':'';
        return '<div class="'+cls+'" '+click+'>'+hot+'<div class="topup-diamonds">💎 '+item.diamonds+'</div><div class="topup-price">₹'+item.price+'</div>'+badge+'</div>';
    }).join('');
    document.getElementById('membershipGrid').innerHTML = membershipTopups.map(function(item,i){
        var inStock=stock['membership_'+i]!==false;
        var badge=inStock?'<span class="stock-badge in-stock-badge">In Stock</span>':'<span class="stock-badge out-of-stock-badge">Out of Stock</span>';
        var cls='membership-item'+(inStock?'':' out-of-stock');
        var click=inStock?'onclick="selectTopup(this,\'membership\','+i+')"':'';
        return '<div class="'+cls+'" '+click+'><div><span class="membership-name">'+item.icon+' '+item.name+'</span> '+badge+'</div><span class="membership-price">₹'+item.price+'</span></div>';
    }).join('');
}

// ══════════════════════════════════════════
//  TOPUP GRIDS — PUBG
// ══════════════════════════════════════════

async function renderPubgGrids() {
    var stock=await getStockStatus();
    document.getElementById('pubgUCGrid').innerHTML = pubgUCTopups.map(function(item,i){
        var inStock=stock['pubguc_'+i]!==false;
        var badge=inStock?'<span class="stock-badge in-stock-badge">In Stock</span>':'<span class="stock-badge out-of-stock-badge">Out of Stock</span>';
        var hot=item.hot?'<span class="topup-badge">🔥 HOT</span>':'';
        var cls='pubg-item'+(inStock?'':' out-of-stock');
        var click=inStock?'onclick="selectPubgTopup(this,\'uc\','+i+')"':'';
        return '<div class="'+cls+'" '+click+'>'+hot+'<div class="pubg-uc">🎯 '+item.uc+' UC</div><div class="pubg-price">₹'+item.price+'</div>'+badge+'</div>';
    }).join('');
    document.getElementById('pubgSpecialGrid').innerHTML = pubgSpecialTopups.map(function(item,i){
        var inStock=stock['pubgspecial_'+i]!==false;
        var badge=inStock?'<span class="stock-badge in-stock-badge">In Stock</span>':'<span class="stock-badge out-of-stock-badge">Out of Stock</span>';
        var cls='pubg-special-item'+(inStock?'':' out-of-stock');
        var click=inStock?'onclick="selectPubgTopup(this,\'special\','+i+')"':'';
        return '<div class="'+cls+'" '+click+'><div><span class="pubg-special-name">'+item.icon+' '+item.name+'</span> '+badge+'</div><span class="pubg-special-price">₹'+item.price+'</span></div>';
    }).join('');
}

// ══════════════════════════════════════════
//  TOPUP SELECTION
// ══════════════════════════════════════════

function selectTopup(el,type,index) {
    document.querySelectorAll('.topup-item.selected,.membership-item.selected,.pubg-item.selected,.pubg-special-item.selected')
        .forEach(function(e){ e.classList.remove('selected'); });
    el.classList.add('selected');
    var item,label;
    if(type==='diamond'){ item=diamondTopups[index]; label='💎 '+item.diamonds+' Diamonds (Free Fire)'; }
    else                { item=membershipTopups[index]; label=item.icon+' '+item.name+' (Free Fire)'; }
    selectedTopup={type:type, label:label, price:item.price, game:'Free Fire'};
    updateGameDetailsForm('ff');
    showOrderSummary();
}

function selectPubgTopup(el,type,index) {
    document.querySelectorAll('.topup-item.selected,.membership-item.selected,.pubg-item.selected,.pubg-special-item.selected')
        .forEach(function(e){ e.classList.remove('selected'); });
    el.classList.add('selected');
    var item,label;
    if(type==='uc'){ item=pubgUCTopups[index]; label='🎯 '+item.uc+' UC (PUBG Mobile)'; }
    else           { item=pubgSpecialTopups[index]; label=item.icon+' '+item.name+' (PUBG)'; }
    selectedTopup={type:type, label:label, price:item.price, game:'PUBG Mobile'};
    updateGameDetailsForm('pubg');
    showOrderSummary();
}

function updateGameDetailsForm(game) {
    var title   = document.getElementById('gameDetailsTitle');
    var nameLbl = document.getElementById('nameLabel');
    var uidLbl  = document.getElementById('uidLabel');
    var nameInp = document.getElementById('inGameName');
    var uidInp  = document.getElementById('playerUID');
    if(game==='ff'){
        if(title)   title.textContent   = 'Your Free Fire Details';
        if(nameLbl) nameLbl.textContent  = 'In-Game Name (Nickname)';
        if(uidLbl)  uidLbl.textContent   = 'Free Fire UID';
        if(nameInp) nameInp.placeholder  = 'Enter your Free Fire name';
        if(uidInp)  uidInp.placeholder   = 'e.g. 1234567890';
    } else {
        if(title)   title.textContent   = 'Your PUBG Mobile Details';
        if(nameLbl) nameLbl.textContent  = 'PUBG Character Name';
        if(uidLbl)  uidLbl.textContent   = 'PUBG Player ID';
        if(nameInp) nameInp.placeholder  = 'Enter your PUBG name';
        if(uidInp)  uidInp.placeholder   = 'e.g. 5123456789';
    }
}

function showOrderSummary() {
    document.getElementById('gameDetailsCard').classList.remove('hidden');
    document.getElementById('orderSummaryCard').classList.remove('hidden');
    document.getElementById('orderSummaryContent').innerHTML =
        '<div style="background:var(--primary-pale);padding:16px;border-radius:10px;text-align:center;border:1px solid var(--border-blue)">'+
        '<p style="font-size:1rem;font-weight:800;">'+selectedTopup.label+'</p>'+
        '<p style="font-size:1.6rem;font-weight:900;color:var(--success)">₹'+selectedTopup.price+'</p>'+
        '<p style="font-size:.72rem;color:var(--text-light);margin-top:4px;">Game: '+selectedTopup.game+'</p></div>';
    document.getElementById('gameDetailsCard').scrollIntoView({behavior:'smooth'});
}

// ══════════════════════════════════════════
//  PAYMENT & ORDER
// ══════════════════════════════════════════

function proceedToPayment() {
    var name=document.getElementById('inGameName').value.trim();
    var uid =document.getElementById('playerUID').value.trim();
    if(!name)             return showToast('⚠️ Enter your in-game name','error');
    if(!uid||uid.length<6)return showToast('⚠️ Enter a valid Player ID (min 6 digits)','error');
    if(!selectedTopup)    return showToast('⚠️ Select a package first','error');
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
    area.addEventListener('dragover',function(e){ e.preventDefault(); area.style.borderColor='var(--primary)'; });
    area.addEventListener('dragleave',function(){ area.style.borderColor=''; });
    area.addEventListener('drop',function(e){
        e.preventDefault(); area.style.borderColor='';
        if(e.dataTransfer.files.length) handleScreenshotUpload({target:{files:e.dataTransfer.files}});
    });
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
            document.getElementById('uploadArea').classList.add('has-file');
            document.getElementById('confirmOrderBtn').disabled=false;
            showToast('📸 Screenshot uploaded!','success');
        });
    };
    reader.readAsDataURL(file);
}

function compressImage(dataUrl,maxW,quality,cb) {
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
    var name=document.getElementById('inGameName').value.trim();
    var uid =document.getElementById('playerUID').value.trim();
    if(!name||!uid||!selectedTopup||!paymentScreenshotBase64) return showToast('⚠️ Complete all fields','error');
    var btn=document.getElementById('confirmOrderBtn');
    btn.disabled=true; btn.textContent='⏳ Placing Order…';
    var order={
        order_id:      'ORD-'+Date.now()+'-'+Math.random().toString(36).substr(2,5).toUpperCase(),
        customer_email:currentUser.email,
        in_game_name:  name, player_uid:uid,
        topup_label:   selectedTopup.label,
        price:         selectedTopup.price,
        screenshot:    paymentScreenshotBase64,
        status:        'pending'
    };
    try {
        var res=await _supabase.from('orders').insert([order]);
        if(res.error){ showToast('❌ Failed to place order. Try again.','error'); btn.disabled=false; btn.textContent='✅ Confirm & Place Order'; return; }
        sendAdminEmailNotification(order);
        document.getElementById('thankYouModal').classList.remove('hidden');
        resetAfterOrder();
        loadOrderHistory();
    } catch(e){ showToast('❌ Connection error. Try again.','error'); btn.disabled=false; btn.textContent='✅ Confirm & Place Order'; }
}

function sendAdminEmailNotification(order) {
    try {
        fetch('https://formsubmit.co/ajax/aadityadas4000@gmail.com',{
            method:'POST',
            headers:{'Content-Type':'application/json','Accept':'application/json'},
            body:JSON.stringify({
                _subject:'🔔 New Order! '+order.topup_label+' — ₹'+order.price,
                'Order ID':order.order_id,'Customer':order.customer_email,
                'Game Name':order.in_game_name,'Player UID':order.player_uid,
                'Package':order.topup_label,'Amount':'₹'+order.price,'Status':'Pending'
            })
        });
    } catch(e){}
}

function resetAfterOrder() {
    selectedTopup=null;paymentScreenshotBase64=null;
    ['paymentSection','orderSummaryCard','gameDetailsCard'].forEach(function(id){ document.getElementById(id).classList.add('hidden'); });
    document.querySelectorAll('.selected').forEach(function(el){ el.classList.remove('selected'); });
    document.getElementById('inGameName').value='';
    document.getElementById('playerUID').value='';
    document.getElementById('uploadArea').classList.remove('has-file');
    document.getElementById('uploadPreview').classList.remove('show');
    var btn=document.getElementById('confirmOrderBtn');
    btn.disabled=true; btn.textContent='✅ Confirm & Place Order';
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
        if(!res.data||!res.data.length){ c.innerHTML='<p style="text-align:center;color:var(--text-light);padding:20px;">No orders yet.</p>'; return; }
        c.innerHTML='<table class="order-table"><thead><tr><th>Status</th><th>Package</th><th>Amount</th><th>Date</th></tr></thead><tbody>'+
            res.data.map(function(o){
                return '<tr><td><span class="status-badge '+(o.status==='complete'?'status-complete':'status-pending')+'">'+o.status+'</span></td>'+
                    '<td style="font-size:.78rem">'+o.topup_label+'</td><td>₹'+o.price+'</td><td>'+new Date(o.created_at).toLocaleDateString('en-IN')+'</td></tr>';
            }).join('')+'</tbody></table>';
    } catch(e){ c.innerHTML='<p style="text-align:center;color:var(--text-light)">Could not load orders.</p>'; }
}

// ══════════════════════════════════════════
//  ADMIN ORDERS
// ══════════════════════════════════════════

async function loadAllOrders() {
    var c=document.getElementById('adminOrdersContainer');
    try {
        var res=await _supabase.from('orders').select('*').order('created_at',{ascending:false});
        if(!res.data||!res.data.length){ c.innerHTML='<p style="padding:12px;text-align:center">No orders yet.</p>'; return; }
        c.innerHTML=res.data.map(function(o){
            return '<div class="admin-order-card '+(o.status==='complete'?'complete':'')+'">'+
                '<p><strong>🆔</strong> '+o.order_id+'</p>'+
                '<p><strong>👤</strong> '+o.customer_email+'</p>'+
                '<p><strong>🧑</strong> '+o.in_game_name+' | <strong>UID:</strong> '+o.player_uid+'</p>'+
                '<p><strong>📦</strong> '+o.topup_label+' | <strong>💰</strong> ₹'+o.price+'</p>'+
                '<p><strong>📅</strong> '+new Date(o.created_at).toLocaleString('en-IN')+'</p>'+
                '<p><strong>📌</strong> <span class="status-badge '+(o.status==='complete'?'status-complete':'status-pending')+'">'+o.status+'</span></p>'+
                (o.screenshot?'<details><summary style="cursor:pointer;font-size:.82rem;margin-top:6px">📸 View Screenshot</summary><img src="'+o.screenshot+'" style="max-width:100%;border-radius:8px;margin-top:6px"></details>':'')+
                '<div class="admin-actions">'+
                (o.status==='pending'
                    ?'<button class="btn btn-sm btn-success" onclick="markComplete(\''+o.id+'\')">✅ Complete</button>'
                    :'<button class="btn btn-sm btn-warning" onclick="markPending(\''+o.id+'\')">⏳ Pending</button>')+
                '<button class="btn btn-sm btn-danger" onclick="deleteOrder(\''+o.id+'\')">🗑 Delete</button>'+
                '</div></div>';
        }).join('');
    } catch(e){ c.innerHTML='<p style="padding:12px;text-align:center;color:var(--danger)">Failed to load orders.</p>'; }
}

async function markComplete(id){ await updateOrderStatus(id,'complete'); }
async function markPending(id) { await updateOrderStatus(id,'pending');  }
async function updateOrderStatus(id,status) {
    try {
        var res=await _supabase.from('orders').update({status:status}).eq('id',id);
        if(res.error) return showToast('❌ Failed to update','error');
        showToast('Order marked '+status,'success'); loadAllOrders();
    } catch(e){ showToast('❌ Connection error','error'); }
}
async function deleteOrder(id) {
    if(!confirm('Delete this order?')) return;
    try { await _supabase.from('orders').delete().eq('id',id); showToast('🗑 Deleted','success'); loadAllOrders(); }
    catch(e){ showToast('❌ Failed to delete','error'); }
}

// ══════════════════════════════════════════
//  STOCK MANAGEMENT
// ══════════════════════════════════════════

async function loadStockManagement() {
    var c=document.getElementById('stockManagementContainer');
    if(!c) return;
    var stock=await getStockStatus();
    var html='<h4 style="margin-bottom:8px;font-size:.85rem;color:var(--text-mid)">🔥 Free Fire Diamonds</h4>';
    diamondTopups.forEach(function(item,i){
        var inStock=stock['diamond_'+i]!==false;
        html+='<div class="stock-item"><span>💎 '+item.diamonds+' — ₹'+item.price+'</span>'+
            '<button class="btn btn-sm '+(inStock?'btn-warning':'btn-success')+'" onclick="toggleStock(\'diamond\','+i+')">'+(inStock?'Mark Out':'Mark In')+'</button></div>';
    });
    html+='<h4 style="margin-top:10px;margin-bottom:8px;font-size:.85rem;color:var(--text-mid)">🏅 FF Memberships</h4>';
    membershipTopups.forEach(function(item,i){
        var inStock=stock['membership_'+i]!==false;
        html+='<div class="stock-item"><span>'+item.icon+' '+item.name+' — ₹'+item.price+'</span>'+
            '<button class="btn btn-sm '+(inStock?'btn-warning':'btn-success')+'" onclick="toggleStock(\'membership\','+i+')">'+(inStock?'Mark Out':'Mark In')+'</button></div>';
    });
    html+='<h4 style="margin-top:10px;margin-bottom:8px;font-size:.85rem;color:var(--text-mid)">🎯 PUBG UC</h4>';
    pubgUCTopups.forEach(function(item,i){
        var inStock=stock['pubguc_'+i]!==false;
        html+='<div class="stock-item"><span>🎯 '+item.uc+' UC — ₹'+item.price+'</span>'+
            '<button class="btn btn-sm '+(inStock?'btn-warning':'btn-success')+'" onclick="toggleStock(\'pubguc\','+i+')">'+(inStock?'Mark Out':'Mark In')+'</button></div>';
    });
    html+='<h4 style="margin-top:10px;margin-bottom:8px;font-size:.85rem;color:var(--text-mid)">🎁 PUBG Special</h4>';
    pubgSpecialTopups.forEach(function(item,i){
        var inStock=stock['pubgspecial_'+i]!==false;
        html+='<div class="stock-item"><span>'+item.icon+' '+item.name+' — ₹'+item.price+'</span>'+
            '<button class="btn btn-sm '+(inStock?'btn-warning':'btn-success')+'" onclick="toggleStock(\'pubgspecial\','+i+')">'+(inStock?'Mark Out':'Mark In')+'</button></div>';
    });
    c.innerHTML=html;
}

async function toggleStock(type,index) {
    var stock=await getStockStatus();
    var newVal=!stock[type+'_'+index];
    await setStockItem(type+'_'+index,newVal);
    renderTopupGrids();
    if(currentGame==='pubg') renderPubgGrids();
    loadStockManagement();
    showToast(newVal?'✅ Marked In Stock':'⛔ Marked Out of Stock','success');
}
async function setAllOutOfStock() {
    if(!confirm('Mark ALL items out of stock?')) return;
    var p=[];
    diamondTopups.forEach(function(_,i){p.push(setStockItem('diamond_'+i,false));});
    membershipTopups.forEach(function(_,i){p.push(setStockItem('membership_'+i,false));});
    pubgUCTopups.forEach(function(_,i){p.push(setStockItem('pubguc_'+i,false));});
    pubgSpecialTopups.forEach(function(_,i){p.push(setStockItem('pubgspecial_'+i,false));});
    await Promise.all(p);
    renderTopupGrids(); loadStockManagement();
    showToast('⛔ All items set to Out of Stock','success');
}
async function resetAllInStock() {
    var p=[];
    diamondTopups.forEach(function(_,i){p.push(setStockItem('diamond_'+i,true));});
    membershipTopups.forEach(function(_,i){p.push(setStockItem('membership_'+i,true));});
    pubgUCTopups.forEach(function(_,i){p.push(setStockItem('pubguc_'+i,true));});
    pubgSpecialTopups.forEach(function(_,i){p.push(setStockItem('pubgspecial_'+i,true));});
    await Promise.all(p);
    renderTopupGrids(); loadStockManagement();
    showToast('✅ All items now In Stock','success');
}

// ══════════════════════════════════════════
//  REVIEW SYSTEM
// ══════════════════════════════════════════

var AVATARS=['😊','😎','🎮','🔥','💪','🏆','⚡','🌟','👑','🎯'];

function setReviewStar(n) {
    selectedStars=n;
    document.querySelectorAll('.star-btn').forEach(function(btn){
        btn.classList.toggle('active',parseInt(btn.dataset.star)<=n);
    });
}

async function submitReview() {
    var name=(document.getElementById('reviewName').value||'').trim();
    var pkg =(document.getElementById('reviewPackage').value||'').trim();
    var text=(document.getElementById('reviewText').value||'').trim();
    if(!name)               return showToast('⚠️ Enter your name','error');
    if(selectedStars===0)   return showToast('⚠️ Select a star rating','error');
    if(text.length<10)      return showToast('⚠️ Review too short — write at least 10 characters','error');
    try {
        var res=await _supabase.from('reviews').insert([{
            customer_name:name, stars:selectedStars,
            review_text:text, package:pkg||null, approved:false
        }]);
        if(res.error){ showToast('❌ Failed to submit. Try again.','error'); return; }
        document.getElementById('reviewName').value='';
        document.getElementById('reviewPackage').value='';
        document.getElementById('reviewText').value='';
        selectedStars=0;
        document.querySelectorAll('.star-btn').forEach(function(b){ b.classList.remove('active'); });
        showToast('🌟 Review submitted! It will appear after approval.','success',4000);
    } catch(e){ showToast('❌ Connection error. Try again.','error'); }
}

async function loadReviews() {
    var c=document.getElementById('reviewsList');
    if(!c) return;
    try {
        var res=await _supabase.from('reviews').select('*').eq('approved',true).order('created_at',{ascending:false});
        var reviews=res.data||[];
        var countEl=document.getElementById('reviewCountBadge');
        var avgEl  =document.getElementById('avgRating');
        var totalEl=document.getElementById('totalReviews');
        var avgStarsEl=document.getElementById('avgStarsDisplay');
        if(!reviews.length){
            c.innerHTML='<p style="text-align:center;color:var(--text-light);padding:20px;">Be the first to review! ⭐</p>';
            if(countEl) countEl.textContent='0 reviews';
            return;
        }
        var avg=reviews.reduce(function(sum,r){return sum+r.stars;},0)/reviews.length;
        var roundedAvg=Math.round(avg);
        if(avgEl)      avgEl.textContent=avg.toFixed(1);
        if(avgStarsEl) avgStarsEl.textContent=starsHTML(roundedAvg);
        if(totalEl)    totalEl.textContent='Based on '+reviews.length+' review'+(reviews.length>1?'s':'');
        if(countEl)    countEl.textContent=reviews.length+' reviews';
        c.innerHTML=reviews.map(function(r,idx){
            var avatar=AVATARS[idx%AVATARS.length];
            return '<div class="review-card">'+
                '<div class="review-top">'+
                '<div class="review-avatar">'+avatar+'</div>'+
                '<div class="review-meta">'+
                '<div class="review-name">'+escapeHtml(r.customer_name)+'</div>'+
                '<div class="review-stars" title="'+r.stars+' out of 5 stars">'+starsHTML(r.stars)+'</div>'+
                (r.package?'<div class="review-package" style="font-size:.7rem;color:var(--text-light);margin-top:2px;">'+escapeHtml(r.package)+'</div>':'')+
                '</div>'+
                '<span class="review-verified">✅ Verified</span>'+
                '</div>'+
                '<div class="review-text">"'+escapeHtml(r.review_text)+'"</div>'+
                '<div class="review-date">'+timeAgo(r.created_at)+'</div>'+
                '</div>';
        }).join('');
    } catch(e){
        if(c) c.innerHTML='<p style="text-align:center;color:var(--text-light)">Could not load reviews.</p>';
    }
}

async function loadAdminReviews() {
    var c=document.getElementById('adminReviewsContainer');
    if(!c) return;
    try {
        var res=await _supabase.from('reviews').select('*').eq('approved',false).order('created_at',{ascending:false});
        var pending=res.data||[];
        if(!pending.length){ c.innerHTML='<p style="text-align:center;color:var(--text-light);padding:12px;">No pending reviews ✅</p>'; return; }
        c.innerHTML=pending.map(function(r){
            return '<div style="background:var(--bg-soft);border-radius:10px;padding:12px;margin-bottom:8px;border-left:3px solid var(--accent)">'+
                '<p><strong>'+escapeHtml(r.customer_name)+'</strong> — <span style="color:#f59e0b;">'+starsHTML(r.stars)+'</span></p>'+
                (r.package?'<p style="font-size:.75rem;color:var(--text-light)">'+escapeHtml(r.package)+'</p>':'')+
                '<p style="font-size:.82rem;margin:6px 0;">"'+escapeHtml(r.review_text)+'"</p>'+
                '<div style="display:flex;gap:8px;margin-top:8px;">'+
                '<button class="btn btn-sm btn-success" onclick="approveReview(\''+r.id+'\')">✅ Approve</button>'+
                '<button class="btn btn-sm btn-danger"  onclick="rejectReview(\''+r.id+'\')">🗑 Reject</button>'+
                '</div></div>';
        }).join('');
    } catch(e){ c.innerHTML='<p style="color:var(--danger);padding:12px;">Failed to load reviews.</p>'; }
}

async function approveReview(id) {
    try { await _supabase.from('reviews').update({approved:true}).eq('id',id); showToast('✅ Review approved!','success'); loadAdminReviews(); }
    catch(e){ showToast('❌ Failed to approve','error'); }
}
async function rejectReview(id) {
    if(!confirm('Delete this review?')) return;
    try { await _supabase.from('reviews').delete().eq('id',id); showToast('🗑 Review deleted','success'); loadAdminReviews(); }
    catch(e){ showToast('❌ Failed to delete','error'); }
}

// ══════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════

document.addEventListener('DOMContentLoaded',function(){
    setupScreenshotUploader();
    document.getElementById('loadingSection').classList.remove('hidden');
    document.getElementById('authSection').classList.add('hidden');
    _authTimeout=setTimeout(function(){
        if(!_authLoaded){
            document.getElementById('loadingSection').classList.add('hidden');
            document.getElementById('authSection').classList.remove('hidden');
        }
    },5000);
});
