const $ = (id) => document.getElementById(id);
const money = (n) => `฿ ${Number(n || 0).toFixed(2)}`;
const productImage = 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=900&q=80';

const products = Array.from({ length: 10 }, (_, i) => ({
  id: `night-vision-${i + 1}`,
  name: 'Night Vision Goggles',
  desc: 'อุปกรณ์มองกลางคืน เหมาะสำหรับภารกิจลับหรือบุกเวลากลางคืน',
  price: 3500,
  stock: i === 0 ? 4 : 12,
  image: productImage,
  featured: i === 0
}));

let state = JSON.parse(localStorage.getItem('boxser_state') || 'null') || {
  wallet: 0,
  cart: [],
  orders: [
    { id: '85632007-13c8-40f5-952b-9c77edcc6d51', tx: '35307e92-646e-48b6-922d-d88dde3f6772', date: '26/5/2568 02:59:06', status: 'ยกเลิกแล้ว', items: [{ productId: products[0].id, qty: 1 }, { productId: products[1].id, qty: 1 }] },
    { id: '2a21b707-f779-4ba0-acd4-06c5dc4cc8df', tx: '548b1efd-4798-4e35-ad8a-2a06feff9167', date: '26/5/2568 04:25:07', status: 'รอชำระเงิน', items: [{ productId: products[2].id, qty: 1 }, { productId: products[3].id, qty: 1 }] }
  ],
  theme: 'light'
};
let selectedProduct = products[0];
let heroIndex = 0;

function save(){ localStorage.setItem('boxser_state', JSON.stringify(state)); }
function toast(text){ $('toast').textContent = text; $('toast').classList.remove('hidden'); setTimeout(()=>$('toast').classList.add('hidden'), 1800); }
function getProduct(id){ return products.find(p => p.id === id) || products[0]; }
function setPage(){
  const page = location.hash.replace('#','') || 'home';
  document.querySelectorAll('.page').forEach(el => el.classList.toggle('active', el.id === page));
  if (page === 'cart') renderCart();
  if (page === 'orders') renderOrders();
}
function applyTheme(){ document.body.classList.toggle('dark', state.theme === 'dark'); $('themeToggle').textContent = state.theme === 'dark' ? '☾' : '☼'; }
function renderHero(){ $('heroCard').innerHTML = heroIndex % 2 ? `<img src="${productImage}" alt="Night Vision Goggles">` : ''; }
function renderProducts(){
  $('productGrid').innerHTML = products.map((p) => `
    <article class="product-card ${p.featured ? 'featured' : ''}" data-product="${p.id}">
      <div class="thumb"><img src="${p.image}" alt="${p.name}"><span class="tag">สินค้ายอดนิยม</span></div>
      <div class="product-info"><h3>${p.name}</h3><p>${p.desc}</p><strong class="price">${money(p.price)}</strong></div>
    </article>`).join('');
  document.querySelectorAll('[data-product]').forEach(card => card.addEventListener('click', () => openProduct(card.dataset.product)));
}
function openProduct(id){
  selectedProduct = getProduct(id);
  $('modalImg').src = selectedProduct.image;
  $('modalImg').alt = selectedProduct.name;
  $('modalTitle').textContent = selectedProduct.name;
  $('modalDesc').textContent = selectedProduct.desc;
  $('modalPrice').textContent = money(selectedProduct.price);
  $('modalStock').textContent = `จำนวนคงเหลือ ${selectedProduct.stock} ชิ้น`;
  $('modalQty').value = 1;
  $('productModal').classList.remove('hidden');
}
function closeProduct(){ $('productModal').classList.add('hidden'); }
function addToCart(productId = selectedProduct.id, qty = Number($('modalQty').value || 1)){
  const found = state.cart.find(i => i.productId === productId);
  if (found) found.qty += qty; else state.cart.push({ productId, qty });
  save(); renderBadge(); toast('เพิ่มสินค้าในตะกร้าแล้ว'); closeProduct();
}
function createOrder(items, status = 'รอชำระเงิน'){
  state.orders.unshift({ id: crypto.randomUUID(), tx: crypto.randomUUID(), date: new Date().toLocaleString('th-TH'), status, items });
  save(); renderOrders(); location.hash = 'orders'; toast('สร้างคำสั่งซื้อแล้ว');
}
function renderBadge(){ const count = state.cart.reduce((t,i)=>t+i.qty,0); $('cartBadge').textContent = count; $('cartBadge').classList.toggle('hidden', count === 0); }
function renderCart(){
  $('cartList').innerHTML = state.cart.map((item, i) => { const p = getProduct(item.productId); return `<article class="cart-item"><div><h3>${p.name}</h3><p>${p.desc}</p><p>จำนวน ${item.qty}</p></div><strong class="price">${money(p.price * item.qty)}</strong><button class="icon-btn" data-remove="${i}">×</button></article>`; }).join('') || '<p class="wallet-text">ยังไม่มีสินค้าในตะกร้า</p>';
  $('cartTotal').textContent = money(state.cart.reduce((t,i)=>t+getProduct(i.productId).price*i.qty,0));
  document.querySelectorAll('[data-remove]').forEach(btn => btn.onclick = () => { state.cart.splice(Number(btn.dataset.remove),1); save(); renderCart(); renderBadge(); });
}
function renderOrders(){
  $('ordersList').innerHTML = state.orders.map(order => `<article class="order-card"><div class="order-head"><div><h2>รหัสคำสั่งซื้อ: ${order.id}</h2><p>วันที่: ${order.date}</p><p>การชำระเงิน: <span class="status ${order.status === 'ยกเลิกแล้ว' ? 'cancelled' : 'pending'}">${order.status}</span></p></div><p>รหัสธุรกรรม:<br>${order.tx}</p></div>${order.items.map(item => { const p = getProduct(item.productId); return `<div class="order-line"><div><h3>${p.name}</h3><p>จำนวน: ${item.qty}</p></div><div class="order-price"><b>${money(p.price * item.qty)}</b><br><small>(${p.price.toFixed(2)} x ${item.qty})</small></div></div>`; }).join('')}<div class="order-actions"><button class="pill">ยกเลิกคำสั่งซื้อ</button><button class="pill">ชำระเงิน</button></div></article>`).join('');
}
function bind(){
  window.addEventListener('hashchange', setPage);
  $('themeToggle').onclick = () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; save(); applyTheme(); };
  $('prevHero').onclick = () => { heroIndex--; renderHero(); };
  $('nextHero').onclick = () => { heroIndex++; renderHero(); };
  $('closeModal').onclick = closeProduct;
  $('productModal').onclick = e => { if (e.target.id === 'productModal') closeProduct(); };
  $('addCartBtn').onclick = () => addToCart();
  $('buyNowBtn').onclick = () => createOrder([{ productId: selectedProduct.id, qty: Number($('modalQty').value || 1) }]);
  $('topupBtn').onclick = () => { state.wallet += 1000; $('walletText').textContent = `ยอดเงินคงเหลือ ${money(state.wallet)}`; $('topupCode').value = ''; save(); toast('เติมเงินสำเร็จ +฿1000'); };
  $('checkoutBtn').onclick = () => { if (!state.cart.length) return toast('ตะกร้าว่าง'); createOrder([...state.cart]); state.cart = []; save(); renderBadge(); };
  $('logoutBtn').onclick = () => toast('ออกจากระบบตัวอย่างแล้ว');
}
function init(){ bind(); applyTheme(); renderHero(); renderProducts(); renderBadge(); $('walletText').textContent = `ยอดเงินคงเหลือ ${money(state.wallet)}`; setPage(); }
init();
