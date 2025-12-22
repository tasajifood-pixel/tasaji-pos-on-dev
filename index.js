function logout() {
  if (confirm("Yakin ingin logout?")) {

    // AUTH
    localStorage.removeItem("pos_user");

    // SSOT KASIR (WAJIB BERSIH)
    localStorage.removeItem("pos_active_cashier_id");
    localStorage.removeItem("pos_active_cashier_name");

    // KODE / UI KASIR (OPSIONAL)
    localStorage.removeItem("pos_cashier_code");

    // LEGACY (AMAN DIHAPUS BERTAHAP)
    localStorage.removeItem("pos_cashier_id");
    localStorage.removeItem("pos_cashier_name");

    window.location.replace("login.html");
  }
}


/* =====================================================
   SUPABASE
===================================================== */
// ===== CONFIG =====
const sb = window.supabase.createClient(
  "https://fpjfdxpdaqtopjorqood.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwamZkeHBkYXF0b3Bqb3Jxb29kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NjU2NDUsImV4cCI6MjA3NjU0MTY0NX0.7cSIF32p9SHaHHlUcMFrrQSq7JBOdP4LneEvcMRrtXU"
);
	

/* =====================================================
   DOM REFS
===================================================== */
const panelReport = document.getElementById("panel-report");

const productGrid = document.getElementById("productGrid");
const pageInfo = document.getElementById("pageInfo");
const prevPage = document.getElementById("prevPage");
const nextPage = document.getElementById("nextPage");

const searchInput = document.getElementById("searchInput");
const btnCari = document.getElementById("btnCari");

const cartItems = document.getElementById("cartItems");
const itemCount = document.getElementById("itemCount");
const cartSubtotal = document.getElementById("cartSubtotal");
const cartTotal = document.getElementById("cartTotal");
const cartPanel = document.querySelector(".cart-panel");


const panelProduct = document.getElementById("panel-product");
const panelPayment = document.getElementById("panel-payment");
const panelTransactions = document.getElementById("panel-transactions");
const panelSettings = document.getElementById("panel-settings");

const quickCash = document.getElementById("quickCash");

const payItemCount = document.getElementById("payItemCount");
const payTotal = document.getElementById("payTotal");
const cashInput = document.getElementById("cashInput");
const changeOutput = document.getElementById("changeOutput");
const btnNext = document.getElementById("btnNext");

const payLinesList = document.getElementById("payLinesList");
const payRemaining = document.getElementById("payRemaining");
const btnFinishPayment = document.getElementById("btnFinishPayment");

const txnSearchInput = document.getElementById("txnSearchInput");
const txnList = document.getElementById("txnList");
const txnDetailTitle = document.getElementById("txnDetailTitle");
const txnDetailSub = document.getElementById("txnDetailSub");
const txnDetailBody = document.getElementById("txnDetailBody");
const txnDetailActions = document.getElementById("txnDetailActions");
const txnDetailBadge = document.getElementById("txnDetailBadge");
const customerInput = document.getElementById("customerInput");
const customerDropdown = document.getElementById("customerDropdown");

/* settings dom */
const setHideEmpty = document.getElementById("setHideEmpty");
const setHideKtn = document.getElementById("setHideKtn");
const setReceiptPaper = document.getElementById("setReceiptPaper");
const setStoreName = document.getElementById("setStoreName");
const setStoreSub = document.getElementById("setStoreSub");
const setShiftX = document.getElementById("setShiftX");
const setRequireStock = document.getElementById("setRequireStock");
const setNote1 = document.getElementById("setNote1");
const setNote2 = document.getElementById("setNote2");
const setAutoSyncHours = document.getElementById("setAutoSyncHours");



/* event input cash */
cashInput.addEventListener("input", onCashInputChange);
// customer autocomplete
if (customerInput) {
  customerInput.addEventListener("input", searchCustomer);

  customerInput.addEventListener("focus", () => {
    // kalau ada isi, tampilkan lagi hasil
    if (customerInput.value.trim()) searchCustomer();
  });
}

/* =====================================================
   STATE
===================================================== */
// ===== STATE =====
let PRODUCT_SORT_MODE =
  localStorage.getItem("product_sort_mode") || "best"; // best | latest | az

let PRODUCT_VIEW_MODE =
  localStorage.getItem("setting_product_view") || "normal";

let BEST_SELLER_PERIOD = "90d"; // default 90 hari

let page = 1;
const pageSize = 25;
let currentQuery = "";
let filters = {
  hideEmpty: false,
  hideKtn: false,
  requireStock: true   // default: WAJIB ADA STOK
};

let cart = [];
let selectedPaymentMethod = null;
let PAYMENT_LINES = []; // [{ method:'cash', label:'Kas', amount:20000 }]

let CUSTOMER_LIST = [];
let ACTIVE_CUSTOMER = null;
let PRICE_MAP = {};
let PACKING_MAP = {};
let STOCK_MAP = {}; // item_id -> stok_tersedia (dari decision.v_inventory_ui)

let CURRENT_SALESORDER_NO = null;
let CURRENT_LOCAL_ORDER_NO = null;     // ✅ nomor offline (local)
let CURRENT_ORDER_MODE = "online";     // "online" | "offline"

let CURRENT_HOLD_ID = null; // ✅ id transaksi tersimpan yang sedang aktif

let RECEIPT_PAPER = "80";
let STORE_NAME = "TASAJI FOOD";
let STORE_SUB = "Jalan Mandor Demong";
let STORE_NOTE_1 = "Terima kasih 🙏";
let STORE_NOTE_2 = ""; // misal: "Pengaduan: 0812xxxxxxx"
let REPORT_UI_BOUND = false;
// kasir/terminal (tanpa login)
let CASHIER_ID = null;
let CASHIER_NAME = null;
let AUTO_SYNC_HOURS = 3; // default

function loadCashier(){
  // SSOT kasir (UNTUK DATA & FILTER)
  CASHIER_ID = localStorage.getItem("pos_active_cashier_id") || null;
  CASHIER_NAME = localStorage.getItem("pos_active_cashier_name") || null;

  // OPTIONAL: kode kasir hanya untuk tampilan UI
  CASHIER_CODE = localStorage.getItem("pos_cashier_code") || null;
}


/* transaksi */
let TXN_PAGE = 1;
const TXN_PAGE_SIZE = 20;
let TXN_SELECTED = null; // { salesorder_no, header, items, payments }

/* =====================================================
   UTIL
===================================================== */
function updateTxnCount(count){
  const el = document.getElementById("txnCountInfo");
  if (!el) return;

  el.textContent = `Total: ${count} transaksi`;
}

async function manualSyncProducts(){
  if (!isOnline()) {
    alert("Tidak bisa sync saat offline.");
    return;
  }

  updateSyncStatus("⏳ Sync produk...");
  await syncAllProductsToCache();
	await loadStockMap();
  updateSyncStatus("✅ Sync selesai");
}
function updateSyncStatus(text){
  const el = document.getElementById("syncStatus");
  if (el) el.textContent = text;
}

// ==============================
// PRODUCT CACHE (OFFLINE SUPPORT)
// ==============================
// ==============================
// PRICE / PACKING / CUSTOMER CACHE
// ==============================
function saveJsonCache(key, obj){
  try{ localStorage.setItem(key, JSON.stringify(obj || null)); }catch{}
}
function loadJsonCache(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return fallback;
    return JSON.parse(raw);
  }catch{
    return fallback;
  }
}

function savePriceMapCache(map){
  saveJsonCache("pos_price_map_v1", map);
  localStorage.setItem("pos_price_map_ts", String(Date.now()));
}
function loadPriceMapCache(){
  return loadJsonCache("pos_price_map_v1", {}) || {};
}

function savePackingMapCache(map){
  saveJsonCache("pos_packing_map_v1", map);
  localStorage.setItem("pos_packing_map_ts", String(Date.now()));
}
function loadPackingMapCache(){
  return loadJsonCache("pos_packing_map_v1", {}) || {};
}
function saveStockMapCache(map){
  saveJsonCache("pos_stock_map_v1", map);
  localStorage.setItem("pos_stock_map_ts", String(Date.now()));
}
function loadStockMapCache(){
  return loadJsonCache("pos_stock_map_v1", {}) || {};
}
function getStockMapCacheAgeMs(){
  const ts = Number(localStorage.getItem("pos_stock_map_ts") || 0);
  if (!ts) return Infinity;
  return Date.now() - ts;
}

function saveCustomerCache(list){
  saveJsonCache("pos_customers_cache_v1", Array.isArray(list) ? list : []);
  localStorage.setItem("pos_customers_cache_ts", String(Date.now()));
}
function loadCustomerCache(){
  const list = loadJsonCache("pos_customers_cache_v1", []);
  return Array.isArray(list) ? list : [];
}

function saveProductsCache(list){
  if (!Array.isArray(list)) return;
  localStorage.setItem("pos_products_cache_v1", JSON.stringify(list));
}

function loadProductsCache(){
  try{
    return JSON.parse(localStorage.getItem("pos_products_cache_v1") || "[]");
  }catch{
    return [];
  }
}

/// ==============================
// CACHE STALENESS (PRODUCTS)
// ==============================
function getProductsCacheAgeMs(){
  const ts = Number(localStorage.getItem("pos_products_cache_ts") || 0);
  if (!ts) return Infinity;
  return Date.now() - ts;
}


async function syncAllProductsToCacheIfNeeded(){
  if (!isOnline()) return;

  const cached = loadProductsCache();
  const ageMs = getProductsCacheAgeMs();
  const maxAgeMs = (AUTO_SYNC_HOURS || 3) * 60 * 60 * 1000;

  if (!cached.length || ageMs > maxAgeMs) {
    await syncAllProductsToCache();
    updateSyncStatus("✅ Auto sync selesai");
  } else {
    updateSyncStatus("ℹ️ Cache masih fresh");
  }
}


// ==============================
// SYNC ALL PRODUCTS TO CACHE (ONLINE ONLY)
// ==============================
async function syncAllProductsToCache(){
  if(!isOnline()) return;

  try{
    let all = [];
    let from = 0;
    const size = 1000;

    while(true){
      const { data, error } = await sb
        .from("master_items")
        .select("item_id,item_code,item_name,thumbnail,sell_price,barcode")
        .order("item_name", { ascending:true })
        .range(from, from + size - 1);

      if(error) throw error;

      all.push(...(data || []));
      if(!data || data.length < size) break;

      from += size;
    }

    saveProductsCache(all);
    localStorage.setItem("pos_products_cache_ts", String(Date.now()));
    console.log("✅ Cached products:", all.length);
	  // ✅ sync stok map juga (agar OFFLINE stok tetap benar)
await loadStockMap();

  }catch(err){
    console.error("❌ syncAllProductsToCache error:", err);
  }
}

// ==============================
// ONLINE / OFFLINE DETECTOR
// ==============================
function isOnline(){
  return navigator.onLine === true;
}
async function canReachSupabase(){
  if (!navigator.onLine) return false;

  try {
    const { error } = await sb
      .from("master_items")
      .select("item_id")
      .limit(1);

    return !error;
  } catch {
    return false;
  }
}


// ==============================
// OFFLINE ORDER NO GENERATOR
// Format: L-TSJ-YYYYMMDD-KSR01-0001
// ==============================
function pad(n, len){
  return String(n || 0).padStart(len, "0");
}

function getLocalDateYMD(){
  const d = new Date();
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1, 2);
  const day = pad(d.getDate(), 2);
  return `${y}${m}${day}`;
}

function normalizeCashierIdForLocal(){
  // KSR-01 -> KSR01 (biar rapih)
  const raw = CASHIER_ID || "UNKNOWN";
  return String(raw).replace(/[^A-Za-z0-9]/g, "");
}

function getLocalCounterKey(){
  // counter per kasir per tanggal
  const ymd = getLocalDateYMD();
  const kid = normalizeCashierIdForLocal();
  return `pos_local_counter_${kid}_${ymd}`;
}

function generateLocalOrderNo(){
  const ymd = getLocalDateYMD();
  const kid = normalizeCashierIdForLocal();
  const key = getLocalCounterKey();

  const last = Number(localStorage.getItem(key) || 0);
  const next = last + 1;

  localStorage.setItem(key, String(next));

  return `L-TSJ-${ymd}-${kid}-${pad(next, 4)}`;
}

function isOrderActive(){
  return (cart && cart.length > 0) ||
         (panelPayment && panelPayment.offsetParent !== null);
}


function updateSwitchCashierButton(){
  const btn = document.getElementById("btnSwitchCashier");
  if(!btn) return;

  const locked = isOrderActive();
  btn.disabled = locked;
  btn.style.opacity = locked ? "0.5" : "1";
  btn.style.cursor = locked ? "not-allowed" : "pointer";
  btn.title = locked
    ? "Tidak bisa ganti kasir saat ada transaksi aktif. Selesaikan atau Reset dulu."
    : "Ganti kasir";
}

// ===== UTILITIES =====
const formatRupiah = n => "Rp " + Number(n || 0).toLocaleString("id-ID");

function applyShiftX(mm){
  const v = Number(mm || 0);
  document.documentElement.style.setProperty("--shiftX", `${v}mm`);
}
function openPriceCheck(){
  // buka tab baru ke halaman cek-harga
  // path relatif: karena file cek-harga.html satu folder dengan pos.html
   window.open("cek-harga.html", "_blank"); //offline
   window.open("/cek-harga.html", "_blank"); //online
}

function formatDateID(iso){
  try{
    return new Date(iso).toLocaleString("id-ID");
  } catch {
    return iso || "-";
  }
}
function normalizePhone(phone) {
  if (!phone) return "";
  let p = String(phone).replace(/\D/g, "");
  if (p.startsWith("0")) p = "62" + p.slice(1);
  if (!p.startsWith("62")) p = "62" + p;
  return Number(p);
}
/* =====================================================
   HOLD / PARKED ORDERS (per komputer - localStorage)
===================================================== */
// ===== HOLD TRANSACTION =====
function getHoldKey(){
  return "pos_holds_v1"; // per komputer (browser) saja
}

function loadHolds(){
  try{
    return JSON.parse(localStorage.getItem(getHoldKey()) || "[]") || [];
  }catch{
    return [];
  }
}

function saveHolds(list){
  localStorage.setItem(getHoldKey(), JSON.stringify(list || []));
}

function openHoldModal(){
  refreshHoldList();
  const m = document.getElementById("holdModal");
  if(m) m.style.display = "flex";
}

function closeHoldModal(){
  const m = document.getElementById("holdModal");
  if(m) m.style.display = "none";
}

function refreshHoldList(){
  const list = loadHolds();
  renderHoldList(list);
}

function renderHoldList(list){
  const box = document.getElementById("holdList");
  if(!box) return;

  if(!list.length){
    box.innerHTML = `<div style="padding:14px;color:#999;">Belum ada transaksi tersimpan.</div>`;
    return;
  }

  box.innerHTML = list
    .sort((a,b)=> (b.created_at||0) - (a.created_at||0))
    .map(h => {
      const cust = h.customer?.contact_name || h.customer?.contact_name || h.customer_name || "UMUM";
      const label = h.label || cust || "Transaksi";
      const total = Number(h.total || 0);
      const itemsCount = Number(h.item_count || 0);
      const by = h.cashier_name ? ` • Simpan: ${h.cashier_name}` : "";
      const when = h.created_at ? new Date(h.created_at).toLocaleString("id-ID") : "-";

      return `
        <div style="padding:12px 12px;border-bottom:1px solid #eee;display:flex;gap:10px;align-items:center;">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${label}
            </div>
            <div style="font-size:12px;color:#666;margin-top:4px;">
              ${when}${by} • ${itemsCount} item • <b>${formatRupiah(total)}</b>
            </div>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
            <button class="btn-primary" onclick="resumeHold('${h.id}')">Buka</button>
            <button class="btn-outline" onclick="renameHold('${h.id}')">Rename</button>
            <button class="btn-outline" style="border-color:#e53935;color:#e53935;" onclick="deleteHold('${h.id}')">Hapus</button>
          </div>
        </div>
      `;
    }).join("");
}

function parkCurrentOrder(){
  if(!cart || cart.length === 0){
    alert("Belum ada transaksi untuk disimpan.");
    return;
  }

  const defaultLabel =
    (ACTIVE_CUSTOMER?.contact_name ? ACTIVE_CUSTOMER.contact_name : "Pelanggan Umum");

  const label = prompt("Nama transaksi (opsional):", defaultLabel) || defaultLabel;

  const holds = loadHolds();

  const holdObj = {
    id: "HOLD-" + Date.now(),
    label,
    created_at: Date.now(),

 cashier_id: CASHIER_ID,
cashier_name: CASHIER_NAME,


    // simpan state
    customer: ACTIVE_CUSTOMER || null,
    cart: cart || [],
    salesorder_no: CURRENT_SALESORDER_NO || null,

    total: calcTotal(),
    item_count: calcItemCount()
  };

  holds.push(holdObj);
  saveHolds(holds);

  // reset transaksi aktif supaya bisa lanjut transaksi berikutnya
  resetAll();

  alert("✅ Transaksi disimpan.\nBuka lewat tombol: 🗂 Tersimpan");
}

function resumeHold(id){
  const holds = loadHolds();
  const h = holds.find(x => x.id === id);
  if(!h){
    alert("Data transaksi tersimpan tidak ditemukan.");
    return;
  }

  // kalau ada transaksi aktif, jangan tindih
  if (cart && cart.length > 0){
    alert("Masih ada transaksi aktif. Simpan dulu atau Reset dulu sebelum membuka transaksi tersimpan.");
    return;
  }
CURRENT_HOLD_ID = h.id; // ✅ tandai sedang buka hold ini

  // restore
  cart = Array.isArray(h.cart) ? h.cart : [];
  ACTIVE_CUSTOMER = h.customer || null;
  CURRENT_SALESORDER_NO = h.salesorder_no || null;

  // hitung ulang harga sesuai rules customer sekarang
  recalcCartPrices();

  renderCart();
  saveOrderState();
  updateOrderNumberUI();

  // set input customer
  const input = document.getElementById("customerInput");
  if (input){
    if (ACTIVE_CUSTOMER){
      input.value = ACTIVE_CUSTOMER.contact_name + " (" + (ACTIVE_CUSTOMER.category_display || "-") + ")";
    } else {
      input.value = "";
    }
  }

  // balik ke penjualan
  switchLeftTab("sales");
  panelPayment.style.display = "none";
  panelProduct.style.display = "flex";
  btnNext.style.display = "block";

  updateSwitchCashierButton();
  closeHoldModal();
}

function deleteHold(id){
  if(!confirm("Hapus transaksi tersimpan ini?")) return;
  const holds = loadHolds().filter(x => x.id !== id);
  saveHolds(holds);
  refreshHoldList();
}

function renameHold(id){
  const holds = loadHolds();
  const h = holds.find(x => x.id === id);
  if(!h) return;

  const next = prompt("Nama baru:", h.label || "") || h.label;
  h.label = next;
  saveHolds(holds);
  refreshHoldList();
}
function removeCurrentHoldIfAny(){
  if(!CURRENT_HOLD_ID) return;

  const holds = loadHolds().filter(x => x.id !== CURRENT_HOLD_ID);
  saveHolds(holds);

  CURRENT_HOLD_ID = null; // reset setelah dihapus
}

// klik backdrop untuk tutup
document.addEventListener("click", (e) => {
  const m = document.getElementById("holdModal");
  if(!m) return;
  if(m.style.display === "flex" && e.target === m) closeHoldModal();
});

// ==============================
// CARI PRODUK BERDASARKAN BARCODE (SCAN)
// ==============================
async function findProductByBarcode(barcode) {
  if (!barcode) return null;

  const { data, error } = await sb
    .from("master_items")
    .select("item_id,item_code,item_name,thumbnail,sell_price,barcode")
    .eq("barcode", barcode)
    .limit(1)
    .single();

  if (error || !data) return null;
  const stok = Number(STOCK_MAP?.[data.item_id] ?? 0);
data.stok_tersedia = stok; // tempel ke object biar konsisten dipakai bawah
if (stok <= 0 && filters.requireStock) return null;

  return data;
}

// simpan cart + customer ke localStorage
function saveOrderState() {
  localStorage.setItem("pos_cart", JSON.stringify(cart));
  localStorage.setItem("pos_customer", JSON.stringify(ACTIVE_CUSTOMER));
  localStorage.setItem("pos_salesorder_no", CURRENT_SALESORDER_NO || "");
  localStorage.setItem("pos_local_order_no", CURRENT_LOCAL_ORDER_NO || "");
  localStorage.setItem("pos_order_mode", CURRENT_ORDER_MODE || "online");

}

// ambil cart + customer dari localStorage
function loadOrderState() {
    const savedOrderNo = localStorage.getItem("pos_salesorder_no");
  const savedLocalNo = localStorage.getItem("pos_local_order_no");
  const savedMode = localStorage.getItem("pos_order_mode");

  const savedCart = localStorage.getItem("pos_cart");
  const savedCustomer = localStorage.getItem("pos_customer");


  if (savedCart) {
    try { cart = JSON.parse(savedCart) || []; } catch { cart = []; }
  }
  if (savedCustomer) {
    try { ACTIVE_CUSTOMER = JSON.parse(savedCustomer); } catch { ACTIVE_CUSTOMER = null; }
  }
  if (savedOrderNo) CURRENT_SALESORDER_NO = savedOrderNo;
    if (savedLocalNo) CURRENT_LOCAL_ORDER_NO = savedLocalNo;
  if (savedMode) CURRENT_ORDER_MODE = savedMode;

}

function updateOrderNumberUI() {
  const el = document.getElementById("orderNo");
  if (!el) return;
    el.textContent = CURRENT_SALESORDER_NO || CURRENT_LOCAL_ORDER_NO || "-";
}

/* =====================================================
   SETTINGS: LOAD/SAVE/APPLY
===================================================== */
function loadSettings(){
  const sPaper = localStorage.getItem("setting_receiptPaper");
  const sName  = localStorage.getItem("setting_storeName");
  const sSub   = localStorage.getItem("setting_storeSub");
  const sShift = localStorage.getItem("setting_shiftX");
const sNote1 = localStorage.getItem("setting_storeNote1");
const sNote2 = localStorage.getItem("setting_storeNote2");

  if (sPaper) RECEIPT_PAPER = sPaper;
  if (sName) STORE_NAME = sName;
  if (sSub) STORE_SUB = sSub;
  if (sNote1 !== null) STORE_NOTE_1 = sNote1;
if (sNote2 !== null) STORE_NOTE_2 = sNote2;

  if (sShift !== null) applyShiftX(sShift);

  // sync UI settings panel
  setReceiptPaper.value = RECEIPT_PAPER;
  setStoreName.value = STORE_NAME;
  setStoreSub.value = STORE_SUB;
  setShiftX.value = (sShift !== null) ? sShift : 0;
  if (setNote1) setNote1.value = STORE_NOTE_1 || "";
if (setNote2) setNote2.value = STORE_NOTE_2 || "";
const sAutoSync = localStorage.getItem("setting_autoSyncHours");
if (sAutoSync) AUTO_SYNC_HOURS = Number(sAutoSync) || 3;

const setAuto = document.getElementById("setAutoSyncHours");
if (setAutoSyncHours) setAutoSyncHours.value = AUTO_SYNC_HOURS;

}

function bindSettingsEvents(){

  setHideEmpty.addEventListener("change", () => {
    filters.hideEmpty = setHideEmpty.checked;
    localStorage.setItem("filterHideEmpty", filters.hideEmpty ? "1" : "0");
    page = 1;
    loadProducts();
  });

  setHideKtn.addEventListener("change", () => {
    filters.hideKtn = setHideKtn.checked;
    localStorage.setItem("filterHideKtn", filters.hideKtn ? "1" : "0");
    page = 1;
    loadProducts();
  });

  setReceiptPaper.addEventListener("change", () => {
    RECEIPT_PAPER = setReceiptPaper.value;
    localStorage.setItem("setting_receiptPaper", RECEIPT_PAPER);
  });

  setStoreName.addEventListener("input", () => {
    STORE_NAME = setStoreName.value || "TASAJI FOOD";
    localStorage.setItem("setting_storeName", STORE_NAME);
  });

  setStoreSub.addEventListener("input", () => {
    STORE_SUB = setStoreSub.value || "Jalan Mandor Demong";
    localStorage.setItem("setting_storeSub", STORE_SUB);
  });
if (setNote1) {
  setNote1.addEventListener("input", () => {
    STORE_NOTE_1 = setNote1.value || "";
    localStorage.setItem("setting_storeNote1", STORE_NOTE_1);
  });
}

if (setNote2) {
  setNote2.addEventListener("input", () => {
    STORE_NOTE_2 = setNote2.value || "";
    localStorage.setItem("setting_storeNote2", STORE_NOTE_2);
  });
}
const setAuto = document.getElementById("setAutoSyncHours");
if (setAutoSyncHours) {
  setAutoSyncHours.addEventListener("input", () => {
    const v = Math.max(1, Number(setAutoSyncHours.value || 1));
    AUTO_SYNC_HOURS = v;
    localStorage.setItem("setting_autoSyncHours", String(v));
  });
}


  setShiftX.addEventListener("input", () => {
    const v = Number(setShiftX.value || 0);
    localStorage.setItem("setting_shiftX", String(v));
    applyShiftX(v);
  });

  setRequireStock.addEventListener("change", () => {
    filters.requireStock = setRequireStock.checked;
    localStorage.setItem("filterRequireStock", filters.requireStock ? "1" : "0");
    page = 1;
    loadProducts();
  });

}

function loadFilterSettings(){
  const savedHideEmpty = localStorage.getItem("filterHideEmpty");
  const savedHideKtn   = localStorage.getItem("filterHideKtn");
  const savedRequireStock = localStorage.getItem("filterRequireStock");

  filters.hideEmpty = (savedHideEmpty === "1");
  filters.hideKtn   = (savedHideKtn === "1");
  filters.requireStock = savedRequireStock !== "0"; // default true

  if (setHideEmpty) setHideEmpty.checked = filters.hideEmpty;
  if (setHideKtn)   setHideKtn.checked   = filters.hideKtn;
  if (setRequireStock) setRequireStock.checked = filters.requireStock;
}


function syncFilterSettingsUI(){
  if (setHideEmpty) setHideEmpty.checked = !!filters.hideEmpty;
  if (setHideKtn)   setHideKtn.checked   = !!filters.hideKtn;
  if (setRequireStock) setRequireStock.checked = filters.requireStock;

}


/* =====================================================
   TABS SWITCHER (LEFT)
===================================================== */
function setActiveTabBtn(key){
  document.getElementById("tabSales").classList.toggle("active", key==="sales");
  document.getElementById("tabTxn").classList.toggle("active", key==="txn");
  document.getElementById("tabSet").classList.toggle("active", key==="set");
  document.getElementById("tabReport").classList.toggle("active", key==="report");
}


function showLeftPanel(panelKey){
  // sembunyikan semua panel kiri
  panelProduct.style.display = "none";
  panelPayment.style.display = "none";
  panelTransactions.style.display = "none";
  panelSettings.style.display = "none";

  if(panelKey === "sales"){
    // kalau lagi payment, tetap payment (biar gak bingung)
   if(panelKey === "sales"){
  const isPaying = (document.getElementById("panel-payment")?.dataset?.active === "1");
  if (isPaying) panelPayment.style.display = "block";
  else panelProduct.style.display = "flex";
}

  }
  if(panelKey === "txn"){
    panelTransactions.style.display = "flex";
  }
  if(panelKey === "set"){
    panelSettings.style.display = "flex";
  }
}

function switchLeftTab(key){
  setActiveTabBtn(key);

  // SEMBUNYIKAN SEMUA PANEL KIRI (WAJIB)
  panelProduct.style.display = "none";
  panelPayment.style.display = "none";
  panelTransactions.style.display = "none";
  panelSettings.style.display = "none";
  panelReport.style.display = "none";

  


  if (key === "sales") {
    panelProduct.style.display = "flex";
    if (cartPanel) cartPanel.style.display = "flex";
  }
if (key === "txn") {
  panelTransactions.style.display = "flex";
  if (cartPanel) cartPanel.style.display = "none";
  initTxnFilterUI();
  loadTransactions(true);
}


  if (key === "set") {
  panelSettings.style.display = "flex";
  if (cartPanel) cartPanel.style.display = "none";
}
if (key === "report") {
  panelReport.style.display = "flex";
  if (cartPanel) cartPanel.style.display = "none";
  initReportUI();
  loadReport();
}

}


/* =====================================================
   LOAD PRODUCTS
===================================================== */
async function loadStockMap(){
  // OFFLINE → pakai cache
  if(!isOnline()){
    STOCK_MAP = loadStockMapCache();
    return;
  }

  // ONLINE tapi supabase gak bisa dijangkau → fallback cache
  const supabaseOK = await canReachSupabase();
  if(!supabaseOK){
    STOCK_MAP = loadStockMapCache();
    return;
  }

  try{
    const { data, error } = await sb
      .schema("decision")
      .from("v_inventory_ui")
      .select("item_id, stok_tersedia");

    if(error) throw error;

    const map = {};
    (data || []).forEach(r => {
      map[r.item_id] = Number(r.stok_tersedia || 0);
    });

    STOCK_MAP = map;
    saveStockMapCache(STOCK_MAP);
  }catch(err){
    console.error("❌ loadStockMap error:", err);
    STOCK_MAP = loadStockMapCache();
  }
}

async function loadProducts() {
  // default sort
  let sortMode = PRODUCT_SORT_MODE || localStorage.getItem("product_sort_mode") || "az";

  // ==========================
  // OFFLINE MODE → LOAD CACHE
  // ==========================
  if (!isOnline()) {
    const cached = loadProductsCache();

    if (!cached.length) {
      productGrid.innerHTML = `
        <div style="padding:16px;color:#999;">
          ⚠️ Produk belum tersedia offline.<br>
          Hubungkan internet minimal sekali untuk sinkron produk.
        </div>
      `;
      return;
    }

    // filter manual (search, stok, ktn)
    let list = cached.slice();
// pastikan STOCK_MAP terisi (offline pakai cache)
if (!STOCK_MAP || Object.keys(STOCK_MAP).length === 0){
  STOCK_MAP = loadStockMapCache();
}

// inject stok dari SSOT UI ke data produk
list = list.map(p => ({
  ...p,
  stok_tersedia: Number(STOCK_MAP?.[p.item_id] ?? 0)
}));

    if (currentQuery) {
      const q = currentQuery.toLowerCase();
      list = list.filter(p =>
        (p.item_name || "").toLowerCase().includes(q) ||
        (p.item_code || "").toLowerCase().includes(q) ||
        (p.barcode || "").includes(q)
      );
    }

    if (filters.hideEmpty) list = list.filter(p => Number(p.stok_tersedia || 0) > 0);
    if (filters.hideKtn) list = list.filter(p => !/ktn/i.test(p.item_name || ""));
// ==========================
// APPLY SORT (OFFLINE)
// ==========================
if (sortMode === "az") {
  list.sort((a,b)=> String(a.item_name||"").localeCompare(String(b.item_name||""), "id"));
} else if (sortMode === "latest") {
  list.sort((a,b)=> Number(b.item_id||0) - Number(a.item_id||0));
} else if (sortMode === "best") {
  // offline tidak bisa ambil rank dari server, fallback A-Z
  list.sort((a,b)=> String(a.item_name||"").localeCompare(String(b.item_name||""), "id"));
}

    // hitung pagination lokal (offline)
const total = list.length;
const pages = Math.max(1, Math.ceil(total / pageSize));
if (page > pages) page = pages;

const start = (page - 1) * pageSize;
const slice = list.slice(start, start + pageSize);

renderProducts(slice);
updatePagination(total);
pageInfo.textContent = `OFFLINE • Hal ${page}/${pages}`;
return;

  }

  // ==========================
  // ONLINE MODE → SUPABASE
  // ==========================
  let q = sb
  .from("master_items")
  .select("item_id,item_code,item_name,thumbnail,sell_price,barcode",{ count:"exact" });


  if (currentQuery) {
    q = q.or(`item_name.ilike.%${currentQuery}%,item_code.ilike.%${currentQuery}%,barcode.ilike.%${currentQuery}%`);
  }

  if (filters.hideKtn) q = q.not("item_name","ilike","%ktn%");
  // ==========================
  // APPLY SORT (ONLINE)
  // ==========================
  if (sortMode === "az") {
    q = q.order("item_name", { ascending: true });
  } else if (sortMode === "latest") {
    // kalau tidak punya kolom updated_at, pakai item_id sebagai pendekatan "terbaru"
    q = q.order("item_id", { ascending: false });
  } else {
    // "best" ditangani setelah data diambil (sort manual pakai rankMap)
    // agar aman tanpa FK join
    q = q.order("item_name", { ascending: true }); // fallback biar stabil
  }

  const from = (page-1)*pageSize;
  const to = from + pageSize - 1;

   // ==========================
  // BEST SELLER: sort manual
  // ==========================
  if (sortMode === "best") {
    const rankMap = await loadBestSellerMap();

    // Ambil "lebih banyak" dulu, baru sort, lalu slice untuk page
    // (Karena kalau kita range dulu, sorting rank-nya jadi salah)
    const { data: allData, error: e1 } = await q;


    if (e1) { console.error("loadProducts error", e1); return; }

    const list = (allData || []).slice();
	  await loadStockMap(); // pastikan STOCK_MAP fresh
list.forEach(p => { p.stok_tersedia = Number(STOCK_MAP?.[p.item_id] ?? 0); });

if (filters.hideEmpty) {
  // hideEmpty pakai stok_tersedia SSOT UI
  for (let i = list.length - 1; i >= 0; i--){
    if (Number(list[i].stok_tersedia || 0) <= 0) list.splice(i,1);
  }
}


    list.sort((a,b)=>{
  const ra = rankMap[a.item_code];
  const rb = rankMap[b.item_code];

  if (ra == null && rb == null) return 0;
  if (ra == null) return 1;   // yang bukan best seller selalu di bawah
  if (rb == null) return -1;

  return ra - rb;
});


    const total = list.length;

    const pages = Math.max(1, Math.ceil(total / pageSize));
    if (page > pages) page = pages;

    const start = (page - 1) * pageSize;
    const slice = list.slice(start, start + pageSize);

    renderProducts(slice);
    updatePagination(total);
    return;
  }

  // ==========================
  // NON-BEST: normal range
  // ==========================
  const { data, count, error } = await q.range(from,to);
  if (error) { console.error("loadProducts error", error); return; }
await loadStockMap();
const list = (data || []).map(p => ({
  ...p,
  stok_tersedia: Number(STOCK_MAP?.[p.item_id] ?? 0)
}));

const finalList = filters.hideEmpty
  ? list.filter(p => Number(p.stok_tersedia || 0) > 0)
  : list;

renderProducts(finalList);
updatePagination(count||0);
return;

  renderProducts(data||[]);
  updatePagination(count||0);

  if (error) {
    console.error("loadProducts error", error);
    return;
  }
  

  renderProducts(data||[]);
  updatePagination(count||0);
}


async function loadPriceMap() {
  // OFFLINE → pakai cache
  if(!isOnline()){
    PRICE_MAP = loadPriceMapCache();
    return;
  }

  const { data, error } = await sb
    .from("product_prices")
    .select("item_code, kategori_harga, harga");

  if (error) {
    console.error("Gagal load price map", error);
    // fallback ke cache kalau online tapi error
    PRICE_MAP = loadPriceMapCache();
    return;
  }

  PRICE_MAP = {};
  (data || []).forEach(r => {
    if (!PRICE_MAP[r.item_code]) PRICE_MAP[r.item_code] = {};
    PRICE_MAP[r.item_code][r.kategori_harga] = r.harga;
  });

  // ONLINE → simpan cache
  savePriceMapCache(PRICE_MAP);
}

function getSellPriceFromCache(itemCode){
  const cached = loadProductsCache();
  const p = cached.find(x => x.item_code === itemCode);
  return Number(p?.sell_price || 0);
}

async function loadPackingMap() {
  // OFFLINE → pakai cache
  if(!isOnline()){
    PACKING_MAP = loadPackingMapCache();
    return;
  }

  const { data, error } = await sb
    .from("product_packing")
    .select("item_code, pcs_per_karton");

  if (error) {
    console.error("Gagal load packing map", error);
    PACKING_MAP = loadPackingMapCache();
    return;
  }

  PACKING_MAP = {};
  (data || []).forEach(r => { PACKING_MAP[r.item_code] = r.pcs_per_karton; });

  // ONLINE → simpan cache
  savePackingMapCache(PACKING_MAP);
}


function resolvePriceCategory(itemCode, qty) {
  const cid = ACTIVE_CUSTOMER?.category_id ?? -1;
  const pcsPerKarton = PACKING_MAP[itemCode] || Infinity;

  if (cid === -1) return "umum";
  if (cid === 3) return "member";

  if (cid === 2) {
    if (qty >= pcsPerKarton) return "lv1_pcs";
    if (qty >= 2) return "reseller";
    return "member";
  }

  const isAgenBase = [1,17,18].includes(cid);
  if (isAgenBase) {
    if (qty >= pcsPerKarton) return "lv1_pcs";
    if (qty >= 3) return "agen";
    if (qty >= 2) return "reseller";
    return "member";
  }

  if ([22,14].includes(cid)) {
    if (qty >= pcsPerKarton) return "lv1_pcs";
    return "reseller";
  }

  if (cid === 15) {
    if (qty >= pcsPerKarton) return "lv2_pcs";
    if (qty >= 3) return "agen";
    if (qty >= 2) return "reseller";
    return "member";
  }

  if (cid === 16) {
    if (qty >= pcsPerKarton) return "lv3_pcs";
    if (qty >= 3) return "agen";
    if (qty >= 2) return "reseller";
    return "member";
  }

  if (cid === 19) return "agen";

  if (cid === 21) {
    if (qty >= 3) return "lv1_pcs";
    if (qty === 2) return "reseller";
    return "member";
  }

  return "umum";
}

function getFinalPrice(itemCode, qty) {
  // pastikan PRICE_MAP terisi dari cache kalau belum ada
  const priceMapReady = PRICE_MAP && Object.keys(PRICE_MAP).length > 0;
  if (!priceMapReady) {
    PRICE_MAP = loadPriceMapCache();
  }

  const readyNow = PRICE_MAP && Object.keys(PRICE_MAP).length > 0;

  // kalau tetap belum ada (cache kosong), fallback ke sell_price
  if (!readyNow) {
    return getSellPriceFromCache(itemCode);
  }

  // normal: ONLINE maupun OFFLINE tetap pakai kategori
  const kategori = resolvePriceCategory(itemCode, qty);
  const harga = PRICE_MAP[itemCode]?.[kategori];

  if (!harga) return PRICE_MAP[itemCode]?.["umum"] || getSellPriceFromCache(itemCode);
  return harga;
}



function recalcCartPrices() {
  cart.forEach(i => {
    const code = i.code || i.itemCode;
    i.price = getFinalPrice(code, i.qty);
  });
}

/* =====================================================
   LOAD CUSTOMERS
===================================================== */
async function loadCustomers() {
  // OFFLINE → pakai cache
  const supabaseOK = await canReachSupabase();
if(!isOnline() || !supabaseOK){
  CUSTOMER_LIST = loadCustomerCache();
  return;
}


  try {
    let all = [];
    let from = 0;
    const size = 1000;

    while (true) {
      const { data, error } = await sb
        .from("customers")
        .select("contact_id,contact_name,phone,category_id,category_display")
        .range(from, from + size - 1);

      if (error) throw error;

      all.push(...(data || []));
      if (!data || data.length < size) break;
      from += size;
    }

    CUSTOMER_LIST = all;

    // ONLINE → simpan cache
    saveCustomerCache(CUSTOMER_LIST);

  } catch (err) {
    console.error("❌ Gagal load customer:", err);
    // fallback cache kalau error
    CUSTOMER_LIST = loadCustomerCache();
  }
}
// =====================
// LOAD BEST SELLER MAP (FINAL)
// SSOT: decision.mv_best_seller_ui
// =====================
async function loadBestSellerMap() {
  // OFFLINE → tidak ada best seller
  if (!isOnline()) return {};

  try {
    const { data, error } = await sb
      .schema("decision")
      .from("mv_best_seller_ui")   // ✅ SSOT UI
      .select("pcs_item_code, rank_no")
      .eq("period_key", BEST_SELLER_PERIOD || "90d");

    if (error) throw error;

    const map = {};
    (data || []).forEach(r => {
      map[r.pcs_item_code] = Number(r.rank_no);
    });

    return map;

  } catch (err) {
    console.error("❌ loadBestSellerMap error:", err);
    return {};
  }
}


/* =====================================================
   RENDER PRODUCTS
===================================================== */
function renderProducts(list){
  productGrid.innerHTML="";
  if(!list.length){
    productGrid.innerHTML="<div>Tidak ada produk</div>";
    return;
  }

  list.forEach(p=>{
    const card=document.createElement("div");
   const qty = Number(p.stok_tersedia ?? p.available_qty ?? 0); // fallback terakhir (kalau ada)
const outOfStock = qty <= 0;

const requireStock = filters.requireStock;

// class:
// - kalau stok 0 & requireStock ON -> locked (cursor not allowed)
// - kalau stok 0 & requireStock OFF -> oos (redup tapi tetap pointer)
let extraClass = "";
if (outOfStock && requireStock) extraClass = " locked";
else if (outOfStock && !requireStock) extraClass = " oos";

card.className = "product-card" + extraClass;

if (!outOfStock || !requireStock) {
  card.onclick = () => addToCart(p);
}


    card.innerHTML=`
      <img class="product-image" src="${p.thumbnail||""}">
      <div class="product-body">
        <div class="product-name">${p.item_name}</div>
      </div>
      <div class="product-footer">
        <div class="product-price">
  ${formatRupiah(getFinalPrice(p.item_code, 1))}
</div>

        <div class="product-stock">Stok ${qty}</div>
      </div>`;
        productGrid.appendChild(card);
  });

  // ✅ apply short / normal SETELAH render selesai
  applyProductViewMode();
}


/* =====================================================
   CART LOGIC
===================================================== */
// ===== CART =====
  async function addToCart(p){

  // ✅ nomor order: online pakai server, offline pakai local
  if (!CURRENT_SALESORDER_NO && !CURRENT_LOCAL_ORDER_NO) {
    if (isOnline()) {
      CURRENT_ORDER_MODE = "online";
      CURRENT_SALESORDER_NO = await generateSalesOrderNo();
    } else {
      CURRENT_ORDER_MODE = "offline";
      CURRENT_LOCAL_ORDER_NO = generateLocalOrderNo();
    }
    updateOrderNumberUI();
    saveOrderState();
  }

  const exist = cart.find(i => (i.code || i.itemCode) === p.item_code);
  if (exist) {
    exist.qty++;
    exist.price = getFinalPrice(exist.code || exist.itemCode, exist.qty);
  } else {
    const price = getFinalPrice(p.item_code, 1);
    cart.push({
      itemId: p.item_id,
      jubelioItemId: null,
      code: p.item_code,
      itemCode: p.item_code,
      name: p.item_name,
      price,
      qty: 1
    });
  }

  renderCart();
  saveOrderState();
}


function changeQty(code,delta){
  const item = cart.find(i => (i.code || i.itemCode) === code);
  if(!item) return;

  item.qty+=delta;
  item.price = getFinalPrice(item.code || item.itemCode, item.qty);

  if(item.qty<=0) cart=cart.filter(i=>i.code!==code);

  renderCart();
  saveOrderState();
}

function resetAll() {
CURRENT_HOLD_ID = null;
  cart = [];
  renderCart();

  ACTIVE_CUSTOMER = null;
  const input = document.getElementById("customerInput");
  if (input) input.value = "";

const dropdown = customerDropdown || document.getElementById("customerDropdown");

  if (dropdown) dropdown.style.display = "none";

  selectedPaymentMethod = null;
  PAYMENT_LINES = [];

  localStorage.removeItem("pos_cart");
  localStorage.removeItem("pos_customer");

  CURRENT_SALESORDER_NO = null;
  localStorage.removeItem("pos_salesorder_no");
  updateOrderNumberUI();
    CURRENT_LOCAL_ORDER_NO = null;
  CURRENT_ORDER_MODE = "online";
  localStorage.removeItem("pos_local_order_no");
  localStorage.removeItem("pos_order_mode");


  document.querySelectorAll(".pay-method-btn").forEach(b => b.classList.remove("active"));

  if (cashInput) {
    cashInput.disabled = false;
    cashInput.readOnly = false;
    cashInput.value = "";
  }
  if (changeOutput) changeOutput.textContent = formatRupiah(0);

  if (payTotal) payTotal.textContent = formatRupiah(0);
  if (payItemCount) payItemCount.textContent = "0";
  if (payRemaining) payRemaining.textContent = formatRupiah(0);

  if (quickCash) quickCash.style.display = "none";

  recalcPaymentStatus();

  panelPayment.style.display = "none";
  panelProduct.style.display = "flex";
  btnNext.style.display = "block";
  panelPayment.dataset.active = "0";

}

function resetCart(){ resetAll(); }

function calcTotal(){
  return cart.reduce((s,i)=>s+i.qty*i.price,0);
}
function calcItemCount(){
  return cart.reduce((s,i)=>s+i.qty,0);
}

function renderCart(){
  cartItems.innerHTML="";
  const total = calcTotal();
  const count = calcItemCount();

  if(!cart.length){
  cartItems.innerHTML = `
    <div style="
      padding:12px;
      color:#999;
      font-size:13px;
      text-align:center;
    ">
      Belum ada item di transaksi
    </div>
  `;
}


  cart.forEach(i=>{
    const el=document.createElement("div");
    el.className="cart-item";
    el.innerHTML=`
      <div class="cart-item-price">${formatRupiah(i.price)}</div>
      <div class="cart-item-name">${i.name}</div>
      <div class="cart-item-code">${i.code}</div>

      <div class="cart-item-actions">
        <button class="qty-btn" onclick="changeQty('${i.code}',-1)">−</button>
        <div class="qty-value">${i.qty}</div>
        <button class="qty-btn" onclick="changeQty('${i.code}',1)">+</button>
        <button class="btn-delete" onclick="changeQty('${i.code}',-999)">🗑</button>
      </div>
    `;
    cartItems.appendChild(el);
  });

  itemCount.textContent=count;
  cartSubtotal.textContent=formatRupiah(total);
  cartTotal.textContent=formatRupiah(total);
  updateSwitchCashierButton(); // ✅ tambah ini
}

/* =====================================================
   CUSTOMER AUTOCOMPLETE
===================================================== */
function searchCustomer() {
  const keyword = document.getElementById("customerInput").value.toLowerCase().trim();
  const dropdown = document.getElementById("customerDropdown");

  if (!keyword) {
    dropdown.style.display = "none";
    return;
  }

  const results = CUSTOMER_LIST
    .filter(c =>
      (c.contact_name || "").toLowerCase().includes(keyword) ||
      (c.phone || "").includes(keyword)
    )
    .slice(0, 20);

  if (!results.length) {
    dropdown.innerHTML = "<div style='padding:8px;color:#999'>Tidak ditemukan</div>";
    dropdown.style.display = "block";
    return;
  }

 dropdown.innerHTML = results.map(c => `
  <div class="customer-item"
       onclick="selectCustomer('${c.contact_id}')">
    <div class="customer-name">${c.contact_name}</div>
    <div class="customer-meta">
      ${c.phone || "-"} • ${c.category_display}
    </div>
  </div>
`).join("");


  dropdown.style.display = "block";
}

function selectCustomer(contactId) {
  const cust = CUSTOMER_LIST.find(c => c.contact_id == contactId);
  if (!cust) return;

  ACTIVE_CUSTOMER = cust;

  document.getElementById("customerInput").value =
    cust.contact_name + " (" + cust.category_display + ")";

  document.getElementById("customerDropdown").style.display = "none";

  recalcCartPrices();
  renderCart();

  saveOrderState();
}

/* =====================================================
   PAGINATION & EVENT
===================================================== */

function updatePagination(total){
  const pages=Math.max(1,Math.ceil(total/pageSize));
  pageInfo.textContent=`Hal ${page}/${pages}`;
  prevPage.disabled=page<=1;
  nextPage.disabled=page>=pages;
}

prevPage.onclick = () => {
  if (page <= 1) return;
  page--;
  loadProducts();
};

nextPage.onclick = () => {
  page++;
  loadProducts();
};

searchInput.oninput=()=>{ currentQuery=searchInput.value.trim(); page=1; loadProducts(); };
btnCari.onclick=()=>{ page=1; loadProducts(); };

searchInput.addEventListener("keydown", async (e) => {
  if (e.key !== "Enter") return;

  const barcode = searchInput.value.trim();
  if (!barcode) return;

  e.preventDefault();

  const product = await findProductByBarcode(barcode);

  if (product) {
    await addToCart(product);

    searchInput.value = "";
    currentQuery = "";
    page = 1;

    loadProducts();
  } else {
    alert("Produk dengan barcode tersebut tidak ditemukan / stok habis");
  }
});


/* =====================================================
   PAGE SWITCH: CASHIER <-> PAYMENT
===================================================== */
// ===== PAYMENT =====
async function goToPayment() {
  if (!cart.length) {
    alert("Belum ada item di keranjang");
    return;
  }

    // ✅ nomor order: online pakai server, offline pakai local
  if (!CURRENT_SALESORDER_NO && !CURRENT_LOCAL_ORDER_NO) {
    if (isOnline()) {
      CURRENT_ORDER_MODE = "online";
      CURRENT_SALESORDER_NO = await generateSalesOrderNo();
    } else {
      CURRENT_ORDER_MODE = "offline";
      CURRENT_LOCAL_ORDER_NO = generateLocalOrderNo();
    }
    updateOrderNumberUI();
    saveOrderState();
  }


  // pastikan tab kiri tetap "sales"
  setActiveTabBtn("sales");

  panelProduct.style.display = "none";
  panelPayment.style.display = "block";
  panelPayment.dataset.active = "1";
  panelTransactions.style.display = "none";
  panelSettings.style.display = "none";
  btnNext.style.display = "none";

  payTotal.textContent = formatRupiah(calcTotal());
  payItemCount.textContent = calcItemCount();

  selectedPaymentMethod = null;
  document.querySelectorAll(".pay-method-btn").forEach(b => b.classList.remove("active"));

  cashInput.disabled = false;
  cashInput.readOnly = false;
  cashInput.value = "";
  changeOutput.textContent = formatRupiah(0);

  if (quickCash) quickCash.style.display = "none";

  PAYMENT_LINES = [];
  cashInput.value = "";
  changeOutput.textContent = formatRupiah(0);

  recalcPaymentStatus();
}

function methodLabel(method){
  const map = {
    cash: "Kas",
    debit_bca: "Debit BCA",
    debit_mandiri: "Debit Mandiri",
    qris_gopay: "QRIS GoPay",
    transfer_bca: "Transfer BCA"
  };
  return map[method] || method;
}

function formatLineAmount(n){
  return "Rp" + Number(n||0).toLocaleString("id-ID") + ",00";
}

function totalPaid(){
  return PAYMENT_LINES.reduce((s,x)=>s + (Number(x.amount)||0), 0);
}

function remainingAmount(){
  return calcTotal() - totalPaid();
}

function renderPaymentLines(){
  if(!payLinesList) return;

  if(PAYMENT_LINES.length === 0){
    payLinesList.innerHTML = `
      <div style="padding:12px;color:#999;font-size:13px">
        Belum ada pembayaran
      </div>
    `;
  } else {
    payLinesList.innerHTML = PAYMENT_LINES.map((x, idx) => `
      <div style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding:12px;
        border-bottom:1px solid #eee;
      ">
        <div style="font-size:13px;color:#333">${x.label}</div>

        <div style="display:flex;align-items:center;gap:10px">
          <div style="font-weight:700;color:#111">
            ${formatLineAmount(x.amount)}
          </div>
          <button type="button" onclick="removePayLine(${idx})"
            style="border:none;background:transparent;cursor:pointer;color:#e53935;font-size:16px;"
            title="Hapus">🗑</button>
        </div>
      </div>
    `).join("");
  }

  if(payRemaining){
    const rem = remainingAmount();
    payRemaining.textContent = formatRupiah(rem > 0 ? rem : 0);
  }
}

function recalcPaymentStatus(){
  renderPaymentLines();

  const total = calcTotal();
  const paid = totalPaid();
  const rem = total - paid;

  const hasCash = PAYMENT_LINES.some(x => x.method === "cash");
  const change = (hasCash && paid > total) ? (paid - total) : 0;
  changeOutput.textContent = formatRupiah(change);

  const isLunas = rem <= 0 && PAYMENT_LINES.length > 0;

  if(isLunas){
    btnFinishPayment.classList.remove("disabled");
    btnFinishPayment.classList.add("active");
    btnFinishPayment.disabled = false;
  } else {
    btnFinishPayment.classList.remove("active");
    btnFinishPayment.classList.add("disabled");
    btnFinishPayment.disabled = true;
  }
}

function upsertCashLine(amount){
  const idx = PAYMENT_LINES.findIndex(x => x.method === "cash");
  if(amount <= 0){
    if(idx >= 0) PAYMENT_LINES.splice(idx,1);
    recalcPaymentStatus();
    return;
  }

  if(idx >= 0){
    PAYMENT_LINES[idx].amount = amount;
  } else {
    PAYMENT_LINES.unshift({
      method:"cash",
      label: methodLabel("cash"),
      amount
    });
  }
  recalcPaymentStatus();
}

function setCash(amount) {
  selectedPaymentMethod = "cash";

  cashInput.disabled = false;
  cashInput.readOnly = false;
  cashInput.value = amount;

  upsertCashLine(Number(amount));

  if (quickCash) quickCash.style.display = "flex";
}

function onCashInputChange(){
  if(selectedPaymentMethod !== "cash") return;
  const v = Number(cashInput.value || 0);
  upsertCashLine(v);
}

function addNonCashLine(method){
  const total = calcTotal();
  if(total <= 0){
    alert("Total masih Rp0. Cek data harga (PRICE_MAP).");
    return;
  }

  const rem = remainingAmount();
  if(rem <= 0) return;

  PAYMENT_LINES.push({
    method,
    label: methodLabel(method),
    amount: rem
  });

  recalcPaymentStatus();
}


function removePayLine(idx){
  const removed = PAYMENT_LINES[idx];
  PAYMENT_LINES.splice(idx,1);

  if(removed?.method === "cash"){
    cashInput.value = "";
  }

  recalcPaymentStatus();
}

document.querySelectorAll(".pay-method-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".pay-method-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedPaymentMethod = btn.dataset.method;

    if (selectedPaymentMethod === "cash") {
      cashInput.disabled = false;
      cashInput.readOnly = false;
      cashInput.value = "";
      changeOutput.textContent = formatRupiah(0);
      cashInput.focus();

      if (quickCash) quickCash.style.display = "flex";
    } else {
      cashInput.disabled = true;
      cashInput.readOnly = true;
      cashInput.value = "";
      changeOutput.textContent = formatRupiah(0);

      if (quickCash) quickCash.style.display = "none";
      addNonCashLine(selectedPaymentMethod);
    }

    recalcPaymentStatus();
  });
});

async function processPayment() {
  // ==============================
  // OFFLINE MODE: SIMPAN LOKAL SAJA
  // ==============================
  if (!isOnline()) {

    const offlineOrder = {
      local_order_no: CURRENT_LOCAL_ORDER_NO || generateLocalOrderNo(),
      cashier_id: CASHIER_ID,
      cashier_name: CASHIER_NAME,
      created_at: new Date().toISOString(),
      customer: ACTIVE_CUSTOMER,
      cart: cart,
      payments: PAYMENT_LINES,
      total: calcTotal(),
      status: "OFFLINE_DRAFT"
    };

    const key = "pos_offline_orders_v1";
    const list = JSON.parse(localStorage.getItem(key) || "[]");
    list.push(offlineOrder);
    localStorage.setItem(key, JSON.stringify(list));

    // cetak struk pakai nomor LOCAL
    generateReceiptData(
      offlineOrder.local_order_no,
      cart,
      PAYMENT_LINES,
      {
        customer_name: ACTIVE_CUSTOMER?.contact_name || "UMUM",
        cashier_name: CASHIER_NAME,
        transaction_date: offlineOrder.created_at,
        grand_total: offlineOrder.total
      }
    );

    resetAll();
    alert("⚠️ Transaksi disimpan OFFLINE.\nAkan disinkronkan saat online.");
    return;
  }

  try {

    // ✅ 1. PASTIKAN item_id SEMUA VALID
    await hydrateCartItemIds();

    // ✅ 2. SIMPAN HEADER
    const order = await saveSalesOrder();

    // ✅ 3. SIMPAN ITEMS
    await saveSalesOrderItems(order.salesorder_no);

    // ✅ 4. SIMPAN PAYMENTS (INI YANG TADI KE-SKIP)
    await saveSalesOrderPayments(order.salesorder_no);

    // (payload Jubelio boleh, tapi TIDAK mengganggu flow DB)
    const jubelioPayload = buildJubelioPayload(
      order,
      cart.map(i => ({
        item_id: i.jubelioItemId,
        description: i.name,
        qty_in_base: i.qty,
        price: i.price,
        amount: i.qty * i.price,
        tax_id: 1,
        unit: "Buah",
        location_id: -1,
        shipper: "Ambil Sendiri",
        serial_no: "",
        channel_order_detail_id: "",
        tracking_no: ""
      }))
    );

    await saveJubelioPayloadToOrder(order.salesorder_no, jubelioPayload);
console.log("✅ jubelio_payload tersimpan");


// hapus dari transaksi tersimpan (jika ada)
removeCurrentHoldIfAny();

// cetak struk (print otomatis ada di dalamnya)
generateReceiptData(
  order.salesorder_no,
  cart,
  PAYMENT_LINES,
  order
);

// reset transaksi SETELAH print dipanggil
resetAll();



  } catch (err) {
    console.error("❌ processPayment error:", err);

    CURRENT_SALESORDER_NO = null;
    localStorage.removeItem("pos_salesorder_no");
    updateOrderNumberUI();

    alert("Gagal menyimpan transaksi.\nNomor order di-reset.\nSilakan coba lagi.");
  }
}

function backToEdit() {
  setActiveTabBtn("sales");
  panelPayment.style.display = "none";
  panelProduct.style.display = "flex";
  btnNext.style.display = "block";
  panelPayment.dataset.active = "0";

}

async function saveJubelioPayloadToOrder(salesorderNo, payloadObj){
  const { error } = await sb
    .from("pos_sales_orders")
    .update({
      jubelio_payload: payloadObj,
      jubelio_synced: false,
      jubelio_synced_at: null,
      jubelio_error: null
    })
    .eq("salesorder_no", salesorderNo);

  if (error) {
    console.error("❌ Gagal simpan jubelio_payload", error);
    throw error;
  }
}
async function txnSyncJubelio(){
  if (!TXN_SELECTED?.salesorder_no) return;

  const orderNo = TXN_SELECTED.salesorder_no;

  const { data, error } = await sb
    .from("pos_sales_orders")
    .select("jubelio_payload,jubelio_synced,jubelio_error")
    .eq("salesorder_no", orderNo)
    .single();

  if (error) {
    alert("Gagal cek data sync");
    return;
  }

  if (!data?.jubelio_payload) {
    alert("Payload Jubelio belum tersimpan di transaksi ini.");
    return;
  }

  // tandai ulang untuk retry sync
  const { error: e2 } = await sb
    .from("pos_sales_orders")
    .update({
      jubelio_synced: false,
      jubelio_synced_at: null,
      jubelio_error: null
    })
    .eq("salesorder_no", orderNo);

  if (e2) {
    alert("Gagal set retry sync");
    return;
  }

  alert("OK. Transaksi ditandai untuk di-sync ke Jubelio (retry).");
}

/* =====================================================
   SALES ORDER NUMBER
===================================================== */
async function generateSalesOrderNo() {
  const today = new Date();
  const dateForDb = today.toISOString().slice(0, 10);
  const ymd = dateForDb.replace(/-/g, "");
  const hhmm =
    String(today.getHours()).padStart(2, "0") +
    String(today.getMinutes()).padStart(2, "0");

  const { data, error } = await sb
    .rpc("get_next_daily_order_number", { p_date: dateForDb });

  if (error) {
    console.error("Gagal generate nomor order", error);
    throw error;
  }

  const seq = String(data).padStart(4, "0");
  return `TSJP-${ymd}-${hhmm}-${seq}`;
}
/* =====================================================
   BUILD PAYLOAD JUBELIO
===================================================== */
function buildJubelioPayload(order, items) {
  return {
    mode: "new",
    salesorder_id: 0,

    salesorder_no: order.salesorder_no,
    ref_no: order.salesorder_no,

    contact_id: order.contact_id,
    customer_name: order.customer_name,

    transaction_date: order.transaction_date,

    is_tax_included: false,
    note: "Pesanan dari POS Offline",

    sub_total: order.sub_total,
    total_disc: 0,
    total_tax: 0,
    grand_total: order.grand_total,

    location_id: -1,
    store_id: -100,
    source: 1,

    is_canceled: false,
    is_paid: true,

    shipping_full_name: order.customer_name,
    shipping_phone: normalizePhone(order.shipping_phone),
    shipping_country: "Indonesia",

    items: items.map(i => ({
      salesorder_detail_id: 0,
      item_id: i.item_id,
      serial_no: "",
      description: i.description,
      tax_id: 1,
      price: i.price,
      unit: "Buah",
      qty_in_base: i.qty_in_base,
      disc: 0,
      disc_amount: 0,
      tax_amount: 0,
      amount: i.amount,
      location_id: -1,
      shipper: "Ambil Sendiri",
      channel_order_detail_id: "",
      tracking_no: ""
    }))
  };
}

/* =====================================================
   SAVE SALES ORDER (HEADER / ITEMS / PAYMENTS)
===================================================== */

// ✅ pastikan setiap item di cart punya itemId (anti NaN -> null)
async function hydrateCartItemIds(){
  for (const item of cart) {
    if (
      item.itemId !== undefined &&
      item.itemId !== null &&
      !Number.isNaN(Number(item.itemId))
    ) continue;

    const code = item.itemCode || item.code;
    if (!code) continue;

    const { data, error } = await sb
      .from("master_items")
      .select("item_id")
      .eq("item_code", code)
      .limit(1)
      .single();

    if (!error && data?.item_id) {
      item.itemId = data.item_id;
      item.itemCode = code;
      item.code = code;
    }
  }

  // simpan kembali ke localStorage biar permanen
  saveOrderState();
}


/**
 * Simpan sales order ke server
 */
async function saveSalesOrder(){
  // ⛔ HARD GUARD – TIDAK BOLEH LANJUT TANPA KASIR
  if (!CASHIER_ID || !CASHIER_NAME) {
    alert("Identitas kasir tidak valid. Silakan login ulang.");
    throw new Error("CASHIER_NOT_SET");
  }

  // pastikan cart item valid
  await hydrateCartItemIds();

  const payload = {
    // =====================
    // IDENTITAS TRANSAKSI
    // =====================
    salesorder_no: CURRENT_SALESORDER_NO,

    cashier_id: CASHIER_ID,
    cashier_name: CASHIER_NAME,

    // =====================
    // CUSTOMER
    // =====================
    contact_id: ACTIVE_CUSTOMER?.contact_id ?? -1,
    customer_name: ACTIVE_CUSTOMER?.contact_name ?? "Pelanggan Umum",
    shipping_phone: ACTIVE_CUSTOMER?.phone ?? null,

    // =====================
    // TOTAL & WAKTU
    // =====================
    transaction_date: new Date().toISOString(),
    sub_total: calcTotal(),
    grand_total: calcTotal(),

    // =====================
    // PEMBAYARAN
    // =====================
    payment_method: PAYMENT_LINES.map(p => p.label).join(", "),
    is_paid: true,

    // =====================
    // METADATA
    // =====================
    location_id: -1,
    store_id: -100,

    // =====================
    // STATUS SYNC JUBELIO
    // =====================
    jubelio_synced: false,
    jubelio_synced_at: null,
    jubelio_error: null,
    jubelio_payload: null
  };

  const { data, error } = await sb
    .from("pos_sales_orders")
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error("❌ Gagal simpan sales order", error);
    console.error("PAYLOAD:", payload);
    throw error;
  }

  return data;
}


async function saveSalesOrderItems(salesorderNo) {
  if (!cart.length) return;

  const itemsPayload = cart.map(item => {
  const itemIdNum = Number(item.itemId);

  if (!itemIdNum || Number.isNaN(itemIdNum)) {
    throw new Error("item_id kosong untuk item_code: " + (item.itemCode || item.code));
  }

  return {
    salesorder_no: salesorderNo,

    item_id: itemIdNum,
    item_code: item.itemCode || item.code,

    description: item.name,
    qty_in_base: item.qty,
    price: item.price,
    amount: item.qty * item.price,
    location_id: -1
  };
});



  const { error } = await sb
    .from("pos_sales_order_items")
    .insert(itemsPayload);

  if (error) {
    console.error("❌ Gagal simpan item order", error);
    throw error;
  }
}

async function saveSalesOrderPayments(salesorderNo) {
  if (!PAYMENT_LINES || PAYMENT_LINES.length === 0) return;

  const paymentsPayload = PAYMENT_LINES.map(p => ({
    salesorder_no: salesorderNo,
    payment_method: p.label,
    amount: p.amount
  }));

  const { error } = await sb
    .from("pos_sales_order_payments")
    .insert(paymentsPayload);

  if (error) {
    console.error("❌ Gagal simpan pembayaran", error);
    throw error;
  }
}

/* =====================================================
   STRUK: GENERATE DARI DATA (reprint / selesai bayar)
===================================================== */
function normalizePaymentsForReceipt(payments){
  // payments bisa dari PAYMENT_LINES (punya method) atau dari DB (payment_method)
  return (payments || []).map(p => {
    const label = p.label || p.payment_method || "-";
    const amount = Number(p.amount || 0);
    const low = String(label).toLowerCase();
    const method = p.method || (low.includes("kas") || low.includes("cash") ? "cash" : "noncash");
    return { label, amount, method };
  });
}

function generateReceiptData(orderNo, items, payments, header){
  const paperClass = RECEIPT_PAPER === "80" ? "receipt-80" : "receipt-58";
const custNameRaw  = header?.customer_name || "";
const custPhoneRaw = header?.shipping_phone || "";

// customer line
const customerLine = custNameRaw
  ? `<div>Customer: ${custNameRaw}</div>`
  : `<div>Customer: UMUM</div>`;

// phone line (muncul hanya kalau ada)
const phoneLine = custPhoneRaw
  ? `<div>Telp: ${custPhoneRaw}</div>`
  : ``;

const cashierName =
  header?.cashier_name ||
  CASHIER_NAME ||
  "Kasir";

  const itemsHtml = (items || []).map(i => {
    const name = i.name || i.description || "-";
    const qty = Number(i.qty || i.qty_in_base || 0);
    const price = Number(i.price || 0);
    return `
      <div style="margin-bottom:2px;">
        <div class="r-left">${RECEIPT_PAPER==="80" ? `<strong>${name}</strong>` : name}</div>
        <div class="r-cols">
          <div class="r-qty">x${qty}</div>
          <div class="r-unit">@${formatRupiah(price)}</div>
          <div class="r-sub">${formatRupiah(qty * price)}</div>
        </div>
      </div>
    `;
  }).join("");

  const payNorm = normalizePaymentsForReceipt(payments);
  const paymentHtml = payNorm.map(p => `
    <div class="r-row">
      <div class="r-left">${p.label}</div>
      <div class="r-right">${formatRupiah(p.amount)}</div>
    </div>
  `).join("");

  const total = Number(header?.grand_total ?? 0) || (items || []).reduce((s,i)=>s+Number(i.price||0)*Number(i.qty||i.qty_in_base||0),0);
  const paid = payNorm.reduce((s,p)=>s+p.amount,0);
  const hasCash = payNorm.some(p => p.method === "cash");
  const change = (hasCash && paid > total) ? (paid - total) : 0;

  const tanggal = header?.transaction_date ? formatDateID(header.transaction_date) : new Date().toLocaleString("id-ID");

    const html = `
    <div class="receipt ${paperClass}">
      <div class="r-center" style="font-size:11px;font-weight:700;">${STORE_NAME}</div>
      <div class="r-center">${STORE_SUB}</div>

      <div class="r-sep"></div>

      <div>No: ${orderNo}</div>
<div>${tanggal}</div>
${customerLine}
${phoneLine}
<div>Kasir: ${cashierName}</div>


      <div class="r-sep"></div>


      ${itemsHtml}

      <div class="r-sep"></div>

      <div class="r-row" style="font-size:11px;">
        <strong class="r-left">TOTAL</strong>
        <strong class="r-right">${formatRupiah(total)}</strong>
      </div>

      <div class="r-sep"></div>

      ${paymentHtml}

      ${change > 0 ? `
        <div class="r-row">
          <div class="r-left">Kembalian</div>
          <div class="r-right">${formatRupiah(change)}</div>
        </div>
      ` : ""}

     <div class="r-sep"></div>

${(STORE_NOTE_1 || "").trim() ? `<div class="r-center" style="font-size:9px;">${STORE_NOTE_1}</div>` : ""}
${(STORE_NOTE_2 || "").trim() ? `<div class="r-center" style="font-size:9px;">${STORE_NOTE_2}</div>` : ""}

</div>


  `;

  document.getElementById("receiptContent").innerHTML = html;
  document.getElementById("receiptModal").style.display = "flex";

  setTimeout(() => { window.print(); }, 300);
}

/* CLOSE STRUK */
document.getElementById("receiptModal").onclick = () => {
  document.getElementById("receiptModal").style.display = "none";
};
window.addEventListener("afterprint", () => {
  const m = document.getElementById("receiptModal");
  if (m) m.style.display = "none";
});
function txnSetToday(){
  const fromEl = document.getElementById("txnDateFrom");
  const toEl   = document.getElementById("txnDateTo");
  if(!fromEl || !toEl) return;

  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  const todayStr = `${yyyy}-${mm}-${dd}`;

  fromEl.value = todayStr;
  toEl.value   = todayStr;

  fromEl.dispatchEvent(new Event("change", { bubbles:true }));
}

function txnSetYesterday(){
  const fromEl = document.getElementById("txnDateFrom");
  const toEl   = document.getElementById("txnDateTo");
  if(!fromEl || !toEl) return;

  const d = new Date();
  d.setDate(d.getDate() - 1);

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  const yStr = `${yyyy}-${mm}-${dd}`;

  fromEl.value = yStr;
  toEl.value   = yStr;

  fromEl.dispatchEvent(new Event("change", { bubbles:true }));
}

let TXN_FILTER_BOUND = false;

function initTxnFilterUI(){
  const fromEl   = document.getElementById("txnDateFrom");
  const toEl     = document.getElementById("txnDateTo");
  const filterEl = document.getElementById("txnCashierFilter");

  if(!fromEl || !toEl || !filterEl) return;

  // default: hari ini
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth()+1).padStart(2,"0");
  const dd = String(today.getDate()).padStart(2,"0");
  const todayStr = `${yyyy}-${mm}-${dd}`;

  if (!fromEl.value) fromEl.value = todayStr;
  if (!toEl.value)   toEl.value   = todayStr;

  // default: kasir aktif saja (ingat pilihan)
const saved = localStorage.getItem("txn_cashier_filter"); // "ALL" | "ACTIVE"
filterEl.value = saved || "ACTIVE";
if (!saved) localStorage.setItem("txn_cashier_filter", filterEl.value);



  if(!TXN_FILTER_BOUND){
    TXN_FILTER_BOUND = true;

    fromEl.addEventListener("change", () => loadTransactions(true));
    toEl.addEventListener("change", () => loadTransactions(true));
    filterEl.addEventListener("change", () => {
  localStorage.setItem("txn_cashier_filter", filterEl.value);
  loadTransactions(true);
});

  }
}

/* =====================================================
   TRANSAKSI: LIST + DETAIL + REPRINT + REORDER
===================================================== */
async function syncOfflineOrdersToServer(){
  const key = "pos_offline_orders_v1";
  const list = JSON.parse(localStorage.getItem(key) || "[]");

  if (!list.length) return;

  const supabaseOK = await canReachSupabase();
  if (!supabaseOK) return;

  console.log("🔄 Sync OFFLINE orders:", list.length);

  const remaining = [];

  for (const off of list){
    try{
      // 1️⃣ generate nomor server
      const salesorderNo = await generateSalesOrderNo();

      // 2️⃣ simpan HEADER
      const headerPayload = {
        salesorder_no: salesorderNo,
        cashier_id: off.cashier_id,
		cashier_name: off.cashier_name,
        contact_id: off.customer?.contact_id ?? -1,
        customer_name: off.customer?.contact_name || "Pelanggan Umum",
        shipping_phone: off.customer?.phone || null,
        transaction_date: off.created_at,
        sub_total: off.total,
        grand_total: off.total,
        payment_method: off.payments.map(p => p.label).join(", "),
        location_id: -1,
        store_id: -100,
        is_paid: true,
        jubelio_synced: false
      };

      const { error: hErr } = await sb
        .from("pos_sales_orders")
        .insert([headerPayload]);

      if (hErr) throw hErr;

      // 3️⃣ ITEMS
      const itemsPayload = off.cart.map(i => ({
        salesorder_no: salesorderNo,
        item_id: i.itemId,
        item_code: i.code,
        description: i.name,
        qty_in_base: i.qty,
        price: i.price,
        amount: i.qty * i.price,
        location_id: -1
      }));

      const { error: iErr } = await sb
        .from("pos_sales_order_items")
        .insert(itemsPayload);

      if (iErr) throw iErr;

      // 4️⃣ PAYMENTS
      const payPayload = off.payments.map(p => ({
        salesorder_no: salesorderNo,
        payment_method: p.label,
        amount: p.amount
      }));

      const { error: pErr } = await sb
        .from("pos_sales_order_payments")
        .insert(payPayload);

      if (pErr) throw pErr;

      console.log("✅ OFFLINE synced:", off.local_order_no, "→", salesorderNo);

    }catch(err){
      console.error("❌ Gagal sync offline:", off.local_order_no, err);
      remaining.push(off); // simpan yg gagal
    }
  }

  localStorage.setItem(key, JSON.stringify(remaining));
}

function loadOfflineTransactions(){
  try{
    return JSON.parse(localStorage.getItem("pos_offline_orders_v1") || "[]") || [];
  }catch{
    return [];
  }
}

// ==============================
// RESET UI TRANSAKSI (WAJIB SAAT GANTI KASIR)
// ==============================
function resetTransactionUI(){
  // reset state
  TXN_PAGE = 1;
  TXN_SELECTED = null;

  // reset list transaksi
  if (txnList) {
    txnList.innerHTML = `<div style="padding:12px;color:#999;">
      Tidak ada transaksi.
    </div>`;
  }

  // reset detail transaksi
  if (txnDetailTitle) txnDetailTitle.textContent = "Pilih transaksi";
  if (txnDetailSub) txnDetailSub.textContent = "Klik salah satu transaksi di kiri";
  if (txnDetailBody) txnDetailBody.innerHTML = `<div style="color:#999;">Belum ada data.</div>`;
  if (txnDetailActions) txnDetailActions.style.display = "none";
  if (txnDetailBadge) txnDetailBadge.innerHTML = "";
}

function txnPrevPage(){
  if (TXN_PAGE <= 1) return;
  TXN_PAGE--;
  loadTransactions(false);
}

function txnNextPage(){
  TXN_PAGE++;
  loadTransactions(false);
}


// ==========================
// OFFLINE MODE → LOCAL ONLY
// ==========================
async function loadTransactions(resetPage){
// ===== FILTER TANGGAL TRANSAKSI =====
const fromVal = document.getElementById("txnDateFrom")?.value || "";
const toVal   = document.getElementById("txnDateTo")?.value || "";

let startISO = null;
let endISO   = null;

if (fromVal && toVal) {
  const start = new Date(fromVal + "T00:00:00");
  const end   = new Date(toVal   + "T23:59:59");
  startISO = start.toISOString();
  endISO   = end.toISOString();
}
// ===== FILTER KASIR TRANSAKSI =====
const cashierFilter =
  document.getElementById("txnCashierFilter")?.value
  || localStorage.getItem("txn_cashier_filter")
  || "ACTIVE";

const activeCashierId = CASHIER_ID || null;
  if (resetPage) TXN_PAGE = 1;
  // ✅ kalau terlihat online tapi server nggak bisa dijangkau → anggap OFFLINE
  const supabaseOK = await canReachSupabase();
  if (!supabaseOK) {
    const kw = ((txnSearchInput?.value || "").trim()).toLowerCase();

    let list = loadOfflineTransactions()
      .filter(x => !activeCashierId || x.cashier_id === activeCashierId);

    if (kw) {
      list = list.filter(x => {
        const no = String(x.local_order_no || "").toLowerCase();
        const nm = String(x.customer?.contact_name || "UMUM").toLowerCase();
        const ph = String(x.customer?.phone || "").toLowerCase();
        return no.includes(kw) || nm.includes(kw) || ph.includes(kw);
      });
    }

    list.sort((a,b)=> new Date(b.created_at) - new Date(a.created_at));
    renderOfflineTransactionList(list);
    return;
  }

  // ==========================
  // OFFLINE MODE → LOCAL ONLY
  // ==========================
  if (!isOnline()) {
    const kw = ((txnSearchInput?.value || "").trim()).toLowerCase();

    let list = loadOfflineTransactions()
  .filter(x => {
    // filter tanggal
    if (startISO && endISO) {
      const t = new Date(x.created_at || 0).getTime();
      if (
        t < new Date(startISO).getTime() ||
        t > new Date(endISO).getTime()
      ) return false;
    }

    // filter kasir
    if (cashierFilter === "ACTIVE" && activeCashierId) {
      return x.cashier_id === activeCashierId;
    }

    return true; // ALL kasir
  });



    if (kw) {
      list = list.filter(x => {
        const no = String(x.local_order_no || "").toLowerCase();
        const nm = String(x.customer?.contact_name || "UMUM").toLowerCase();
        const ph = String(x.customer?.phone || "").toLowerCase();
        return no.includes(kw) || nm.includes(kw) || ph.includes(kw);
      });
    }

    list.sort((a,b)=> new Date(b.created_at) - new Date(a.created_at));
    renderOfflineTransactionList(list);
    return;
  }

  // ==========================
  // ONLINE MODE → SUPABASE
  // ==========================
  const keyword = (txnSearchInput?.value || "").trim();
  const from = (TXN_PAGE-1) * TXN_PAGE_SIZE;
  const to = from + TXN_PAGE_SIZE - 1;

  let q = sb
    .from("pos_sales_orders")
    .select("salesorder_no,transaction_date,customer_name,shipping_phone,grand_total,is_paid", { count:"exact" })
    .order("transaction_date", { ascending:false });
	// filter tanggal (from - to)
if (startISO && endISO) {
  q = q.gte("transaction_date", startISO)
       .lte("transaction_date", endISO);
}
// filter kasir
if (cashierFilter === "ACTIVE" && activeCashierId) {
  q = q.eq("cashier_id", activeCashierId);
}

  // search
  if (keyword) {
    q = q.or(
      `salesorder_no.ilike.%${keyword}%,customer_name.ilike.%${keyword}%,shipping_phone.ilike.%${keyword}%`
    );
  }

  const { data, count, error } = await q.range(from, to);


  if (error) {
    console.error("❌ loadTransactions error", error);
    txnList.innerHTML = `<div style="padding:12px;color:#e53935;">Gagal load transaksi.</div>`;
    return;
  }

  renderTransactionList(data || []);
  updateTxnCount(count || (data || []).length);

}

function renderOfflineTransactionList(list){
updateTxnCount(list.length);

  if(!list.length){
    txnList.innerHTML = `<div style="padding:12px;color:#999;">
      Tidak ada transaksi OFFLINE.
    </div>`;
    return;
  }

  txnList.innerHTML = list.map(x => `
    <div class="txn-item one-line" onclick="selectOfflineTransaction('${x.local_order_no}')">
      <div class="txn-col order">
        ${x.local_order_no}
      </div>

      <div class="txn-col datetime">
        ${formatDateID(x.created_at)}
      </div>

      <div class="txn-col customer">
        ${x.customer?.contact_name || "UMUM"}
      </div>

      <div class="txn-col total">
        ${formatRupiah(x.total)}
      </div>

      <div class="txn-col status">
        <span class="badge unpaid">OFFLINE</span>
      </div>
    </div>
  `).join("");

  txnDetailTitle.textContent = "Transaksi Offline";
  txnDetailSub.textContent = "Belum tersinkron ke server";
  txnDetailBody.innerHTML = `
    <div style="color:#777;">
      Transaksi ini dibuat saat OFFLINE.<br>
      Akan disinkronkan otomatis saat online.
    </div>
  `;
  txnDetailActions.style.display = "none";
}

function renderTransactionList(list){
  if(!list.length){
    txnList.innerHTML = `<div style="padding:12px;color:#999;">Tidak ada transaksi.</div>`;
    txnDetailTitle.textContent = "Pilih transaksi";
    txnDetailSub.textContent = "Klik salah satu transaksi di kiri";
    txnDetailBody.innerHTML = `<div style="color:#999;">Belum ada data.</div>`;
    txnDetailActions.style.display = "none";
    txnDetailBadge.innerHTML = "";
    TXN_SELECTED = null;
    return;
  }

  txnList.innerHTML = list.map(x => {
  const paid = x.is_paid === true;
  const badge = paid
    ? `<span class="badge paid">Lunas</span>`
    : `<span class="badge unpaid">Belum</span>`;

  return `
    <div class="txn-item one-line"
         id="txn-${x.salesorder_no}"
         onclick="selectTransaction('${x.salesorder_no}')">

      <div class="txn-col order">
        ${x.salesorder_no}
      </div>

      <div class="txn-col datetime">
        ${formatDateID(x.transaction_date)}
      </div>

      <div class="txn-col customer">
        ${x.customer_name || "UMUM"}
      </div>

      <div class="txn-col total">
        ${formatRupiah(x.grand_total)}
      </div>

      <div class="txn-col status">
        ${badge}
      </div>

    </div>
  `;
}).join("");

}
function selectOfflineTransaction(localNo){
  const list = loadOfflineTransactions();
  const t = list.find(x => x.local_order_no === localNo);
  if (!t) return;

  // highlight
  document.querySelectorAll(".txn-item").forEach(el => el.classList.remove("active"));

  txnDetailTitle.textContent = t.local_order_no;
  txnDetailSub.textContent = "Transaksi OFFLINE";
  txnDetailBadge.innerHTML = `<span class="badge unpaid">OFFLINE</span>`;

  const itemRows = (t.cart || []).map(i => `
    <div class="row">
      <div class="name">
        <div style="font-weight:700">${i.name}</div>
        <div style="font-size:11px;color:#777">${i.code}</div>
      </div>
      <div class="meta">x${i.qty}</div>
      <div class="meta">${formatRupiah(i.qty * i.price)}</div>
    </div>
  `).join("");

  const payRows = (t.payments || []).map(p => `
    <div class="row">
      <div class="name">${p.label}</div>
      <div class="meta">${formatRupiah(p.amount)}</div>
    </div>
  `).join("");

  txnDetailBody.innerHTML = `
    <div class="txn-section-title">Item</div>
    <div class="txn-items">${itemRows}</div>

    <div class="txn-totalbox">
      <div>Total</div>
      <div>${formatRupiah(t.total)}</div>
    </div>

    <div class="txn-section-title">Pembayaran</div>
    <div class="txn-items">${payRows}</div>
  `;

  txnDetailActions.style.display = "flex";
  txnDetailActions.innerHTML = `
    <button class="btn-outline" onclick="txnReprintOffline('${t.local_order_no}')">🖨 Cetak Ulang</button>
  `;
}
function txnReprintOffline(localNo){
  const list = loadOfflineTransactions();
  const t = list.find(x => x.local_order_no === localNo);
  if (!t) return;

  generateReceiptData(
    t.local_order_no,
    t.cart,
    t.payments,
    {
      customer_name: t.customer?.contact_name || "UMUM",
      cashier_name: t.cashier_name,
      transaction_date: t.created_at,
      grand_total: t.total
    }
  );
}

async function selectTransaction(orderNo){
  document.querySelectorAll(".txn-item").forEach(el => el.classList.remove("active"));
  const el = document.getElementById(`txn-${orderNo}`);
  if (el) el.classList.add("active");

  txnDetailTitle.textContent = orderNo;
  txnDetailSub.textContent = "Memuat detail...";
  txnDetailBody.innerHTML = `<div style="color:#999;">Loading...</div>`;
  txnDetailActions.style.display = "none";
  txnDetailBadge.innerHTML = "";

  // header
  const { data: header, error: e1 } = await sb
    .from("pos_sales_orders")
    .select("*")
    .eq("salesorder_no", orderNo)
    .single();

  if (e1 || !header) {
    console.error("❌ load header", e1);
    txnDetailSub.textContent = "Gagal memuat header.";
    txnDetailBody.innerHTML = `<div style="color:#e53935;">Gagal memuat data.</div>`;
    return;
  }

  // items
  const { data: items, error: e2 } = await sb
    .from("pos_sales_order_items")
    .select("item_id,item_code,description,qty_in_base,price,amount")
    .eq("salesorder_no", orderNo)
    .order("description", { ascending:true });

  if (e2) console.error("❌ load items", e2);

  // payments
  const { data: pays, error: e3 } = await sb
    .from("pos_sales_order_payments")
    .select("payment_method,amount")
    .eq("salesorder_no", orderNo);

  if (e3) console.error("❌ load payments", e3);

  TXN_SELECTED = {
    salesorder_no: orderNo,
    header,
    items: items || [],
    payments: pays || []
  };

  renderTransactionDetail(TXN_SELECTED);
}

function renderTransactionDetail(txn){
  const h = txn.header || {};
  const paid = Number(h.is_paid) === 1;

  txnDetailSub.textContent = `${formatDateID(h.transaction_date)} • ${h.customer_name || "UMUM"}`;
  txnDetailBadge.innerHTML = paid
    ? `<span class="badge paid">Lunas</span>`
    : `<span class="badge unpaid">Belum Lunas</span>`;

  const phone = h.shipping_phone || "-";
  const total = Number(h.grand_total || 0);

  const itemRows = (txn.items || []).map(i => {
    const qty = Number(i.qty_in_base || 0);
    const price = Number(i.price || 0);
    return `
      <div class="row">
        <div class="name">
          <div style="font-weight:700;">${i.description || "-"}</div>
          <div style="font-size:11px;color:#777;">${i.item_code || ""}</div>
        </div>
        <div class="meta">x${qty}</div>
        <div class="meta">${formatRupiah(qty * price)}</div>
      </div>
    `;
  }).join("");

  const payRows = (txn.payments || []).map(p => `
    <div class="row">
      <div class="name">${p.payment_method || "-"}</div>
      <div class="meta">${formatRupiah(p.amount)}</div>
    </div>
  `).join("");

  txnDetailBody.innerHTML = `
    <div class="txn-kv">
      <div class="key">Customer</div><div>${h.customer_name || "UMUM"}</div>
      <div class="key">Telepon</div><div>${phone}</div>
      <div class="key">Tanggal</div><div>${formatDateID(h.transaction_date)}</div>
      <div class="key">No Order</div><div style="font-weight:800;">${txn.salesorder_no}</div>
    </div>

    <div class="txn-section-title">Item</div>
    <div class="txn-items">
      ${itemRows || `<div class="row"><div class="name" style="color:#999;">Tidak ada item</div></div>`}
    </div>

    <div class="txn-totalbox">
      <div>Total</div>
      <div>${formatRupiah(total)}</div>
    </div>

    <div class="txn-section-title">Pembayaran</div>
    <div class="txn-items">
      ${payRows || `<div class="row"><div class="name" style="color:#999;">Tidak ada pembayaran</div></div>`}
    </div>
  `;

  txnDetailActions.style.display = "flex";
}

function txnReprint(){
  if (!TXN_SELECTED) return;
  const t = TXN_SELECTED;
  const items = (t.items || []).map(i => ({
    code: i.item_code,
    name: i.description,
    qty: i.qty_in_base,
    price: i.price
  }));
  generateReceiptData(t.salesorder_no, items, t.payments, t.header);
}

async function txnReorder(){
  if (!TXN_SELECTED) return;

  const h = TXN_SELECTED.header || {};
  const items = TXN_SELECTED.items || [];

  // set customer (kalau contact_id ada)
  ACTIVE_CUSTOMER = null;
  if (h.contact_id) {
    const found = CUSTOMER_LIST.find(c => String(c.contact_id) === String(h.contact_id));
    if (found) ACTIVE_CUSTOMER = found;
  }

  // isi input customer
  const input = document.getElementById("customerInput");
  if (input) {
    if (ACTIVE_CUSTOMER) {
      input.value = ACTIVE_CUSTOMER.contact_name + " (" + ACTIVE_CUSTOMER.category_display + ")";
    } else {
      input.value = (h.customer_name || "UMUM");
    }
  }

  // buat cart baru dari item lama
cart = items.map(i => ({
  itemId: i.item_id,
  itemCode: i.item_code,
  code: i.item_code,
  name: i.description,
  qty: Number(i.qty_in_base || 0),
  price: 0
}));


  // reset order no (biar transaksi baru)
  CURRENT_SALESORDER_NO = null;
  localStorage.removeItem("pos_salesorder_no");

  // hitung ulang harga by rules customer sekarang
  recalcCartPrices();

  // render + simpan
  renderCart();
  saveOrderState();
  updateOrderNumberUI();

  // balik ke penjualan
  switchLeftTab("sales");
  panelPayment.style.display = "none";
  panelProduct.style.display = "flex";
  btnNext.style.display = "block";
}
function applyProductViewMode(){
  const grid = document.getElementById("productGrid");
  const btn  = document.getElementById("btnShort");
  if(!grid || !btn) return;

  const isShort = PRODUCT_VIEW_MODE === "short";
  grid.classList.toggle("short", isShort);
  btn.classList.toggle("active", isShort);
}

function toggleProductShortMode(){
  PRODUCT_VIEW_MODE =
    (PRODUCT_VIEW_MODE === "short") ? "normal" : "short";

  localStorage.setItem(
    "setting_product_view",
    PRODUCT_VIEW_MODE
  );

  applyProductViewMode();
}
function applySortUI(){
  document.querySelectorAll(".sort-btn").forEach(btn => {
    btn.classList.toggle(
      "active",
      btn.dataset.sort === PRODUCT_SORT_MODE
    );
  });
}
function applyBestPeriodUI(){
  const box = document.getElementById("bestPeriodBox");
  if (!box) return;

  // tampil hanya saat mode "best"
  box.style.display = (PRODUCT_SORT_MODE === "best") ? "flex" : "none";

  // aktifkan tombol period yang sesuai
  box.querySelectorAll(".period-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.period === BEST_SELLER_PERIOD);
  });
}

function bindSortButtons(){
  const btns = document.querySelectorAll(".sort-btn");
  if (!btns.length) return;

  btns.forEach(btn => {
    btn.addEventListener("click", () => {

      // set active UI
      btns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // simpan mode
      PRODUCT_SORT_MODE = btn.dataset.sort;
      localStorage.setItem("product_sort_mode", PRODUCT_SORT_MODE);
applySortUI();
applyBestPeriodUI();

      // reset halaman & reload
      page = 1;
      loadProducts();
    });
  });
}
function bindBestPeriodButtons(){
  const box = document.getElementById("bestPeriodBox");
  if (!box) return;

  const btns = box.querySelectorAll(".period-btn");
  if (!btns.length) return;

  btns.forEach(btn => {
    btn.addEventListener("click", () => {
      // set aktif UI
      btns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // simpan period
      BEST_SELLER_PERIOD = btn.dataset.period || "90d";

      // (opsional) simpan ke localStorage biar inget
      localStorage.setItem("best_seller_period", BEST_SELLER_PERIOD);

      // reset halaman & reload
      page = 1;
      loadProducts();
    });
  });
}

/* =====================================================
   INIT
===================================================== */

(async () => {

  // 1️⃣ load kasir dulu
  loadCashier();
  updateCashierInfo();
  updateTxnHead();

  // 2️⃣ cek apakah perlu tampil welcome
  checkCashier();

  // 3️⃣ settings
  loadSettings();
  loadFilterSettings();
  bindSettingsEvents();
  const savedPeriod = localStorage.getItem("best_seller_period");
if (savedPeriod) BEST_SELLER_PERIOD = savedPeriod;

bindSortButtons();
applySortUI();

bindBestPeriodButtons();
applyBestPeriodUI();


    // ✅ SHORT MODE
  const btnShort = document.getElementById("btnShort");
  if (btnShort) {
    btnShort.addEventListener("click", toggleProductShortMode);
  }

  // apply saat load
  applyProductViewMode();

  updateSyncStatus(`Auto sync: tiap ${AUTO_SYNC_HOURS} jam`);
  initReportUI();



  // 4️⃣ master data
  await loadPriceMap();
  await loadPackingMap();
  await loadCustomers();
	await loadStockMap();

if (isOnline()) {
  await syncAllProductsToCacheIfNeeded();
}



  // 5️⃣ restore transaksi
  loadOrderState();

  // ✅ TAMBAH INI
  recalcCartPrices();


  // 6️⃣ render UI
  syncFilterSettingsUI();
  page = 1;
  await loadProducts();
  renderCart();
  updateOrderNumberUI();
  updateSwitchCashierButton();

  if (ACTIVE_CUSTOMER) {
    const input = document.getElementById("customerInput");
    if (input) {
      input.value = ACTIVE_CUSTOMER.contact_name + " (" + ACTIVE_CUSTOMER.category_display + ")";
    }
  }

  // 🔄 auto sync offline orders jika online
if (isOnline()) {
  syncOfflineOrdersToServer();
}

})();


// ==============================
// WELCOME SCREEN LOGIC
// ==============================

/**
 * Pilih kasir (UI ONLY)
 * SSOT kasir tetap dari LOGIN
 */
function selectCashier(code){
  // simpan kode kasir hanya untuk UI
  localStorage.setItem("pos_cashier_code", code);

  // pastikan variabel global terisi dari SSOT
  loadCashier();

  updateCashierInfo();
  updateTxnHead();
  resetTransactionUI();

  document.getElementById("welcomeScreen").style.display = "none";
}

/**
 * Cek apakah kasir sudah ada
 * Dipanggil saat app load
 */
function checkCashier(){
  loadCashier(); // ✅ SSOT

  if (!CASHIER_ID || !CASHIER_NAME) {
    document.getElementById("welcomeScreen").style.display = "flex";
    return;
  }

  document.getElementById("welcomeScreen").style.display = "none";
}

/**
 * Reset / ganti kasir
 */
function resetCashier(){
  // ❌ tidak boleh ganti kasir saat transaksi aktif
  if (isOrderActive()){
    alert(
      "Tidak bisa ganti kasir saat ada transaksi aktif.\n" +
      "Selesaikan transaksi atau klik Reset dulu."
    );
    return;
  }

  if (!confirm("Ganti kasir? Transaksi berjalan akan tetap aman.")) return;

  // hapus identitas kasir
  localStorage.removeItem("pos_active_cashier_id");
  localStorage.removeItem("pos_active_cashier_name");
  localStorage.removeItem("pos_cashier_code");

  CASHIER_ID = null;
  CASHIER_NAME = null;

  updateCashierInfo();
  updateTxnHead();
  resetTransactionUI();

  document.getElementById("welcomeScreen").style.display = "flex";
}

/**
 * Update judul daftar transaksi
 */
function updateTxnHead(){
  const titleEl = document.getElementById("txnHeadTitle");
  if (!titleEl) return;

  const name = CASHIER_NAME;
  const code = localStorage.getItem("pos_cashier_code");

  titleEl.textContent = name
    ? (code
        ? `Daftar Transaksi — ${name} (${code})`
        : `Daftar Transaksi — ${name}`)
    : "Daftar Transaksi";
}

/**
 * Update info kasir di header POS
 */
function updateCashierInfo(){
  const el = document.getElementById("cashierInfo");
  if (!el) return;

  const name = CASHIER_NAME;
  const code = localStorage.getItem("pos_cashier_code");

  if (!name) {
    el.textContent = "";
    return;
  }

  el.textContent = code
    ? `Kasir: ${name} (${code})`
    : `Kasir: ${name}`;
}

// ==============================
// NETWORK EVENT
// ==============================
window.addEventListener("online", () => {
  console.log("🌐 Online kembali → sync offline orders");
  syncOfflineOrdersToServer();
});

/* =====================================================
   REPORT (LAPORAN SINGKAT)
===================================================== */

function reportSetToday(){
  const fromEl = document.getElementById("reportDateFrom");
  const toEl   = document.getElementById("reportDateTo");
  if(!fromEl || !toEl) return;

  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  const todayStr = `${yyyy}-${mm}-${dd}`;

  fromEl.value = todayStr;
  toEl.value   = todayStr;

  // biar auto refresh jalan
  fromEl.dispatchEvent(new Event("change", { bubbles:true }));
}

function reportSetYesterday(){
  const fromEl = document.getElementById("reportDateFrom");
  const toEl   = document.getElementById("reportDateTo");
  if(!fromEl || !toEl) return;

  const d = new Date();
  d.setDate(d.getDate() - 1);

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  const yStr = `${yyyy}-${mm}-${dd}`;

  fromEl.value = yStr;
  toEl.value   = yStr;

  // biar auto refresh jalan
  fromEl.dispatchEvent(new Event("change", { bubbles:true }));
}

function initReportUI(){
  const fromEl   = document.getElementById("reportDateFrom");
  const toEl     = document.getElementById("reportDateTo");
  const filterEl = document.getElementById("reportCashierFilter");

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth()+1).padStart(2,"0");
  const dd = String(today.getDate()).padStart(2,"0");
  const todayStr = `${yyyy}-${mm}-${dd}`;

  if (fromEl && !fromEl.value) fromEl.value = todayStr;
  if (toEl && !toEl.value)   toEl.value   = todayStr;

  if (filterEl) filterEl.value = "ACTIVE";

  if (!REPORT_UI_BOUND) {
    REPORT_UI_BOUND = true;

    fromEl?.addEventListener("change", () => loadReport(true));
    toEl?.addEventListener("change", () => loadReport(true));
    filterEl?.addEventListener("change", () => loadReport(true));
  }

  // VISI ABI: langsung hidup
  loadReport(true);
}

// VISI ABI: Metode Pembayaran bukan card terpisah
const paymentCard = document.getElementById("reportPaymentCard");
if (paymentCard) paymentCard.style.display = "none";


function normPayKey(label){
  const t = String(label || "").toLowerCase();

  // CASH
  if (t === "kas" || t === "cash" || t.includes("kas")) return "Cash";

  // QRIS / E-WALLET
  if (t.includes("qris") || t.includes("gopay")) return "QRIS";

  // DEBIT
  if (t.includes("debit bca")) return "Debit BCA";
  if (t.includes("debit mandiri")) return "Debit Mandiri";

  // TRANSFER
  if (t.includes("transfer bca")) return "Transfer BCA";
  if (t.includes("transfer mandiri")) return "Transfer Mandiri";

  return "Lainnya";
}
function makeSummaryCards({ trxCount, omzet, payMap }) {
  const box = document.getElementById("reportSummary");
  if (!box) return;

  const methods = [
    { key: "Cash", label: "Cash" },
    { key: "QRIS", label: "QRIS" },
    { key: "Debit BCA", label: "Debit BCA" },
    { key: "Debit Mandiri", label: "Debit Mandiri" },
    { key: "Transfer BCA", label: "Transfer BCA" },
    { key: "Transfer Mandiri", label: "Transfer Mandiri" },
  ];

  // susun kartu
  const cards = [
    // Total Transaksi → ANGKA SAJA, TANPA Rp
    {
      title: "Total Transaksi",
      value: Number(trxCount || 0),
      type: "count",
      big: true
    },

    // Metode pembayaran → HANYA YANG > 0
    ...methods
      .map(m => ({
        title: m.label,
        value: Number(payMap?.[m.key] || 0),
        type: "money",
        big: false
      }))
      .filter(c => c.value > 0),

    // Total Omzet
    {
      title: "Total Omzet",
      value: Number(omzet || 0),
      type: "money",
      big: true
    }
  ];

  box.innerHTML = `
    <div class="rpt-cards">
      ${cards.map(c => `
        <div class="rpt-card rpt-card-small">
          <div class="rpt-card-title">${c.title}</div>
          <div class="rpt-card-value ${c.big ? "big" : ""}">
            ${
              c.type === "count"
                ? c.value
                : formatRupiah(c.value)
            }
          </div>
        </div>
      `).join("")}
    </div>
  `;
}




function renderByCashier(rows){
  const filterEl = document.getElementById("reportCashierFilter");
  const box = document.getElementById("reportByCashier");
  if(!box) return;

  if (filterEl && filterEl.value === "ACTIVE") {
    box.innerHTML = "";
    return;
  }

  const list = (rows || []).slice().sort((a,b)=> (b.omzet||0) - (a.omzet||0));

  if(!list.length){
    box.innerHTML = `<div style="color:#999;">Tidak ada data kasir.</div>`;
    return;
  }

  const fmt = v => v > 0 ? formatRupiah(v) : "";

  box.innerHTML = `
    <div class="rpt-table">
      <div class="rpt-row head">
        <div>Kasir</div>
        <div class="rpt-center">Transaksi</div>
        <div class="rpt-right">Cash</div>
        <div class="rpt-right">QRIS</div>
        <div class="rpt-right">Debit BCA</div>
        <div class="rpt-right">Debit Mandiri</div>
        <div class="rpt-right">Transfer BCA</div>
        <div class="rpt-right">Transfer Mandiri</div>
        <div class="rpt-right">Total Omzet</div>
      </div>

      ${list.map(r => `
        <div class="rpt-row">
          <div>
            <b>${r.cashier_name}</b>
            <span class="rpt-muted"> (${r.cashier_id})</span>
          </div>

          <div class="rpt-center">${r.trxCount || 0}</div>

          <div class="rpt-right">${fmt(r.cash)}</div>
          <div class="rpt-right">${fmt(r.qris)}</div>
          <div class="rpt-right">${fmt(r.debit_bca)}</div>
          <div class="rpt-right">${fmt(r.debit_mandiri)}</div>
          <div class="rpt-right">${fmt(r.transfer_bca)}</div>
          <div class="rpt-right">${fmt(r.transfer_mandiri)}</div>

          <div class="rpt-right"><b>${formatRupiah(r.omzet || 0)}</b></div>
        </div>
      `).join("")}
    </div>
  `;
}

function computeAppliedPayment(total, payList){
  const lines = (payList || []).map(p => ({
    label: p.label || p.payment_method || "",
    amount: Number(p.amount || 0)
  }));

  const sumByKey = {};
  let sumNonCash = 0;
  let sumCash = 0;

  for (const x of lines){
    const k = normPayKey(x.label);
    sumByKey[k] = (sumByKey[k] || 0) + x.amount;

    if (k === "Cash") sumCash += x.amount;
    else sumNonCash += x.amount;
  }

  const remainingForCash = Math.max(0, Number(total || 0) - sumNonCash);
  const cashApplied = Math.min(sumCash, remainingForCash);

  // hasil final yang “benar” untuk laporan
  return {
    applied: {
      ...sumByKey,
      Cash: cashApplied
    }
  };
  }
async function loadReport(forceRefresh){
  console.log("LOAD REPORT DIPANGGIL");
  const info = document.getElementById("reportInfo");
  const filterEl = document.getElementById("reportCashierFilter");

  try {
    const from = document.getElementById("reportDateFrom")?.value || "";
    const to   = document.getElementById("reportDateTo")?.value || "";

    if(!from || !to){
      alert("Pilih tanggal dulu.");
      return;
    }

    // ✅ TARUH DI SINI (PALING ATAS loadReport)
    const start = new Date(from + "T00:00:00");
    const end   = new Date(to   + "T23:59:59");
    const startISO = start.toISOString();
    const endISO   = end.toISOString();

    const filterMode = filterEl?.value || "ALL";

    // tampil/sembunyi rincian kasir
    const cashierCard = document.getElementById("reportByCashierCard");
    const cashierBox  = document.getElementById("reportByCashier");
    if (filterMode === "ALL") {
      if (cashierCard) cashierCard.style.display = "";
    } else {
      if (cashierCard) cashierCard.style.display = "none";
      if (cashierBox) cashierBox.innerHTML = "";
    }

   let cashierFilterId = null;
if(filterMode === "ACTIVE"){
  cashierFilterId = CASHIER_ID || null;
}


   // if(info) info.textContent = "⏳ Memuat laporan...";

    // ====== AGGREGATOR ======
    let trxCount = 0;
    let omzet = 0;
    const payMap = {};
    const byCashier = {};

    function bumpCashier(cashier_id, cashier_name, add){
      const id = cashier_id || "UNKNOWN";
      if(!byCashier[id]){
        byCashier[id] = {
          cashier_id: id,
          cashier_name: cashier_name || "UNKNOWN",
          trxCount: 0,
          omzet: 0,
          cash: 0,
          qris: 0,
          debit_bca: 0,
          debit_mandiri: 0,
          transfer_bca: 0,
          transfer_mandiri: 0
        };
      }
      const x = byCashier[id];
      x.trxCount += (add.trxCount||0);
      x.omzet += (add.omzet||0);
      x.cash += (add.cash||0);
      x.qris += (add.qris||0);
      x.debit_bca += (add.debit_bca||0);
      x.debit_mandiri += (add.debit_mandiri||0);
      x.transfer_bca += (add.transfer_bca||0);
      x.transfer_mandiri += (add.transfer_mandiri||0);
    }

    // ====== OFFLINE ======
    const offlineList = loadOfflineTransactions();
    const offlineOnDate = (offlineList || []).filter(o => {
      const t = new Date(o.created_at || 0).getTime();
      const inRange = t >= new Date(startISO).getTime() && t <= new Date(endISO).getTime();
      const matchCashier = cashierFilterId ? (o.cashier_id === cashierFilterId) : true;
      return inRange && matchCashier;
    });

    for(const o of offlineOnDate){
      trxCount += 1;
      omzet += Number(o.total || 0);

      const appliedObj = computeAppliedPayment(o.total, o.payments).applied;

Object.entries(appliedObj).forEach(([k, amt]) => {
  // bumpPay butuh label mentah, tapi kamu pakai normPayKey di dalam.
  // Jadi kita langsung bump map final:
  payMap[k] = (payMap[k] || 0) + Number(amt || 0);
});


      const sumByKey = (key) => (o.payments || [])
        .filter(p => normPayKey(p.label) === key)
        .reduce((s,p)=> s + Number(p.amount||0), 0);

      bumpCashier(o.cashier_id, o.cashier_name, {
  trxCount: 1,
  omzet: Number(o.total||0),
  cash: Number(appliedObj["Cash"] || 0),
  qris: Number(appliedObj["QRIS"] || 0),
  debit_bca: Number(appliedObj["Debit BCA"] || 0),
  debit_mandiri: Number(appliedObj["Debit Mandiri"] || 0),
  transfer_bca: Number(appliedObj["Transfer BCA"] || 0),
  transfer_mandiri: Number(appliedObj["Transfer Mandiri"] || 0)
});

    }

    // ====== ONLINE ======
    const supabaseOK = await canReachSupabase();
    if(isOnline() && supabaseOK){
      let q = sb
        .from("pos_sales_orders")
        .select("salesorder_no,grand_total,cashier_id,cashier_name,transaction_date")
        .gte("transaction_date", startISO)
        .lte("transaction_date", endISO)
        .order("transaction_date", { ascending:false });

      if(cashierFilterId){
        q = q.eq("cashier_id", cashierFilterId);
      }

      const { data: orders, error: e1 } = await q;
      if(e1){
        console.error("❌ Report load orders error:", e1);
      } else {
        const orderNos = (orders || []).map(o => o.salesorder_no);
        trxCount += (orders || []).length;
        omzet += (orders || []).reduce((s,o)=> s + Number(o.grand_total||0), 0);

        if(orderNos.length){
          const { data: pays, error: e2 } = await sb
            .from("pos_sales_order_payments")
            .select("salesorder_no,payment_method,amount")
            .in("salesorder_no", orderNos);

          if(e2){
            console.error("❌ Report load payments error:", e2);
          } else {

            const payByOrder = {};
            (pays || []).forEach(p => {
              const no = p.salesorder_no;
              if(!payByOrder[no]) payByOrder[no] = [];
              payByOrder[no].push(p);
            });

            (orders || []).forEach(o => {
  const list = payByOrder[o.salesorder_no] || [];

  // ✅ hitung NET payment yang benar
  const appliedObj = computeAppliedPayment(
    o.grand_total,
    list.map(p => ({
      label: p.payment_method,
      amount: Number(p.amount || 0)
    }))
  ).applied;

  // ✅ update ringkasan metode bayar (payMap) pakai appliedObj
  Object.entries(appliedObj).forEach(([k, amt]) => {
    payMap[k] = (payMap[k] || 0) + Number(amt || 0);
  });

  // ✅ update per kasir pakai appliedObj (bukan sum mentah)
  bumpCashier(o.cashier_id, o.cashier_name, {
    trxCount: 1,
    omzet: Number(o.grand_total || 0),
    cash: Number(appliedObj["Cash"] || 0),
    qris: Number(appliedObj["QRIS"] || 0),
    debit_bca: Number(appliedObj["Debit BCA"] || 0),
    debit_mandiri: Number(appliedObj["Debit Mandiri"] || 0),
    transfer_bca: Number(appliedObj["Transfer BCA"] || 0),
    transfer_mandiri: Number(appliedObj["Transfer Mandiri"] || 0)
  });
});

          }
        }
      }
    }


    // ====== RENDER (WAJIB DI AKHIR TRY) ======
    makeSummaryCards({ trxCount, omzet, payMap });
    renderByCashier(Object.values(byCashier));

    // if(info){
//   info.textContent = `✅ Laporan siap. Total transaksi: ${trxCount} • Total omzet: ${formatRupiah(omzet)}`;
// }


  } catch (err) {
    console.error("❌ loadReport crash:", err);
   // if(info) info.textContent = "❌ Gagal memuat laporan (lihat console).";
  } finally {
    // safety net: jangan sampai nyangkut “memuat”
   // if (info && String(info.textContent || "").includes("Memuat")) {
   //   info.textContent = "✅ Laporan siap.";
  //  }
  }
}

  const cashierButtons = document.querySelectorAll("#welcomeScreen .btn-cashier");
  const cashierHandlers = [
    "selectCashier('KSR-01','Rifqi')",
    "selectCashier('KSR-02','Inan')",
    "selectCashier('KSR-03','Imad')",
    "selectCashier('KSR-04','Ahmad')"
  ];
  cashierButtons.forEach((btn, idx) => {
    const handler = cashierHandlers[idx];
    if (handler) btn.setAttribute("onclick", handler);
  });

  const btnSwitchCashier = document.getElementById("btnSwitchCashier");
  if (btnSwitchCashier) btnSwitchCashier.setAttribute("onclick", "resetCashier()");

  const tabSales = document.getElementById("tabSales");
  if (tabSales) tabSales.setAttribute("onclick", "switchLeftTab(\'sales\')");
  const tabTxn = document.getElementById("tabTxn");
  if (tabTxn) tabTxn.setAttribute("onclick", "switchLeftTab(\'txn\')");
  const tabSet = document.getElementById("tabSet");
  if (tabSet) tabSet.setAttribute("onclick", "switchLeftTab(\'set\')");
  const tabPrice = document.getElementById("tabPrice");
  if (tabPrice) tabPrice.setAttribute("onclick", "openPriceCheck()");
  const tabReport = document.getElementById("tabReport");
  if (tabReport) tabReport.setAttribute("onclick", "switchLeftTab(\'report\')");

  const logoutBtn = document.querySelector(".logout-btn");
  if (logoutBtn) logoutBtn.setAttribute("onclick", "logout()");

  const quickCashButtons = document.querySelectorAll("#quickCash .btn");
  const quickCashHandlers = [
    "setCash(calcTotal())",
    "setCash(50000)",
    "setCash(100000)"
  ];
  quickCashButtons.forEach((btn, idx) => {
    const handler = quickCashHandlers[idx];
    if (handler) btn.setAttribute("onclick", handler);
  });
	
  if (btnFinishPayment) btnFinishPayment.setAttribute("onclick", "processPayment()");

  const txnFilterButtons = document.querySelectorAll("#panel-transactions .txn-filter .btn-outline");
  if (txnFilterButtons[0]) txnFilterButtons[0].setAttribute("onclick", "txnSetToday()");
  if (txnFilterButtons[1]) txnFilterButtons[1].setAttribute("onclick", "txnSetYesterday()");

  const txnSearchButtons = document.querySelectorAll("#panel-transactions .txn-toolbar button.btn");
  txnSearchButtons.forEach(btn => btn.setAttribute("onclick", "loadTransactions(true)"));

  const txnPagingButtons = document.querySelectorAll("#panel-transactions .txn-list button.btn");
  if (txnPagingButtons[0]) txnPagingButtons[0].setAttribute("onclick", "txnPrevPage()");
  if (txnPagingButtons[1]) txnPagingButtons[1].setAttribute("onclick", "txnNextPage()");

  const txnActions = document.querySelectorAll("#txnDetailActions button");
  if (txnActions[0]) txnActions[0].setAttribute("onclick", "txnReprint()");
  if (txnActions[1]) txnActions[1].setAttribute("onclick", "txnSyncJubelio()");
  if (txnActions[2]) txnActions[2].setAttribute("onclick", "txnReorder()");

  const manualSyncButton = document.querySelector("#panel-settings .btn-primary");
  if (manualSyncButton) manualSyncButton.setAttribute("onclick", "manualSyncProducts()");

  const reportFilterButtons = document.querySelectorAll("#panel-report .btn-outline");
  if (reportFilterButtons[0]) reportFilterButtons[0].setAttribute("onclick", "reportSetToday()");
  if (reportFilterButtons[1]) reportFilterButtons[1].setAttribute("onclick", "reportSetYesterday()");

  const holdButtons = document.querySelectorAll(".cart-header .btn-outline");
  if (holdButtons[0]) holdButtons[0].setAttribute("onclick", "openHoldModal()");
  if (holdButtons[1]) holdButtons[1].setAttribute("onclick", "parkCurrentOrder()");

  const cartReset = document.querySelector(".cart-reset");
  if (cartReset) cartReset.setAttribute("onclick", "resetCart()");

  const backToEditBtn = document.querySelector(".cart-panel .btn-back");
  if (backToEditBtn) backToEditBtn.setAttribute("onclick", "backToEdit()");

  if (btnNext) btnNext.setAttribute("onclick", "goToPayment()");

  const holdToolbarButtons = document.querySelectorAll("#holdModal .btn-outline");
  if (holdToolbarButtons[0]) holdToolbarButtons[0].setAttribute("onclick", "refreshHoldList()");
  if (holdToolbarButtons[1]) holdToolbarButtons[1].setAttribute("onclick", "closeHoldModal()");
