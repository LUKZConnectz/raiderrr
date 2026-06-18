const $ = (id) => document.getElementById(id);
const money = (n) => `฿${Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;
const todayISO = () => new Date().toISOString().slice(0, 10);
const store = {
  get jobs(){ return JSON.parse(localStorage.getItem('rider_jobs') || '[]') },
  set jobs(v){ localStorage.setItem('rider_jobs', JSON.stringify(v)) },
  get goals(){ return JSON.parse(localStorage.getItem('rider_goals') || '{"daily":800,"monthly":18000}') },
  set goals(v){ localStorage.setItem('rider_goals', JSON.stringify(v)) }
};
let currentFuel = 38.25;
let goalReached = { daily:false, monthly:false };

const Toast = Swal.mixin({ toast:true, position:'top-end', timer:2200, showConfirmButton:false, customClass:{popup:'pixel-swal'} });

function init() {
  $('jobDate').value = todayISO();
  document.documentElement.classList.toggle('dark', localStorage.theme === 'dark');
  hydrateGoals();
  updateRealtimeRiders();
  setInterval(updateRealtimeRiders, 5000);
  bindEvents();
  loadFuelPrice();
  render();
  calculateFill();
}

function bindEvents(){
  $('themeBtn').onclick = () => { document.documentElement.classList.toggle('dark'); localStorage.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light'; };
  $('jobForm').onsubmit = saveJob;
  $('goalForm').onsubmit = saveGoals;
  $('clearBtn').onclick = clearJobs;
  $('sampleBtn').onclick = addSamples;
  $('excelBtn').onclick = exportExcel;
  $('pdfBtn').onclick = exportPDF;
  $('ocrBtn').onclick = () => $('imageInput').click();
  $('imageInput').onchange = mockOCR;
  ['fillBudget','fillPrice','fillEff'].forEach(id => $(id).addEventListener('input', calculateFill));
}

function updateRealtimeRiders(){
  const previous = Number(localStorage.riderCounter || 1278);
  const riders = previous + Math.floor(Math.random() * 5);
  localStorage.riderCounter = riders;
  $('riderCount').textContent = riders.toLocaleString('th-TH');
  $('profileRiderCount').textContent = riders.toLocaleString('th-TH');
  $('riderPulse').textContent = `Live +${riders - previous} ใน 5 วินาทีล่าสุด`;
}

async function loadFuelPrice(){
  const sources = [
    'https://api.chnwt.dev/thai-oil-api/latest',
    'https://api.allorigins.win/raw?url=https://api.chnwt.dev/thai-oil-api/latest'
  ];
  for (const url of sources) {
    try {
      const res = await fetch(url, { cache:'no-store' });
      if (!res.ok) throw new Error('bad status');
      const data = await res.json();
      const gasohol95 = JSON.stringify(data).match(/gasohol\s*95[^0-9]*(\d+\.?\d*)/i)?.[1];
      currentFuel = Number(gasohol95 || data?.response?.stations?.ptt?.gasohol_95?.price || currentFuel);
      break;
    } catch (_) { /* fallback below */ }
  }
  $('fuelHeadline').textContent = `${money(currentFuel)}/ลิตร`;
  $('fuelUpdated').textContent = `อัปเดต ${new Date().toLocaleString('th-TH')}`;
  $('fuelPrice').value = currentFuel;
  $('fillPrice').value = currentFuel;
  calculateFill();
}

function saveJob(e){
  e.preventDefault();
  const fare = +$('fare').value, distance = +$('distance').value, efficiency = +$('efficiency').value, fuelPrice = +$('fuelPrice').value;
  const liters = distance / efficiency;
  const fuelCost = liters * fuelPrice;
  const job = { id: crypto.randomUUID(), date:$('jobDate').value, name:$('jobName').value || 'Grab delivery', fare, distance, efficiency, fuelPrice, liters, fuelCost, profit: fare - fuelCost };
  store.jobs = [job, ...store.jobs];
  e.target.reset(); $('jobDate').value = todayISO(); $('efficiency').value = 40; $('fuelPrice').value = currentFuel;
  Toast.fire({icon:'success', title:'บันทึกงานแล้ว'});
  render();
}

function render(){
  const jobs = store.jobs;
  $('jobRows').innerHTML = jobs.map(j => `<tr><td>${j.date}</td><td class="font-bold">${j.name}</td><td>${money(j.fare)}</td><td>${j.distance.toFixed(2)}</td><td>${j.liters.toFixed(2)}</td><td>${money(j.fuelCost)}</td><td class="font-black ${j.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}">${money(j.profit)}</td><td><button class="pixel-btn bg-red-200 text-xs" onclick="deleteJob('${j.id}')">ลบ</button></td></tr>`).join('') || `<tr><td colspan="8" class="py-8 text-center font-bold">ยังไม่มีข้อมูล ลองเพิ่มงานแรกของคุณได้เลย</td></tr>`;
  const now = new Date();
  const day = todayISO();
  const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
  const month = day.slice(0,7);
  const sum = (arr, key) => arr.reduce((a,b)=>a + Number(b[key] || 0), 0);
  const todayJobs = jobs.filter(j => j.date === day);
  const weekJobs = jobs.filter(j => new Date(j.date) >= weekAgo);
  const monthJobs = jobs.filter(j => j.date?.startsWith(month));
  const todayProfit = sum(todayJobs,'profit');
  const monthlyProfit = sum(monthJobs,'profit');
  $('todayProfit').textContent = money(todayProfit);
  $('todayFuel').textContent = `ค่าน้ำมัน ${money(sum(todayJobs,'fuelCost'))}`;
  $('totalFare').textContent = money(sum(jobs,'fare'));
  $('totalKm').textContent = `${sum(jobs,'distance').toFixed(2)} กม.`;
  $('dailySummary').textContent = money(todayProfit);
  $('weeklySummary').textContent = money(sum(weekJobs,'profit'));
  $('monthlySummary').textContent = money(monthlyProfit);
  renderProfile(jobs, todayProfit, monthlyProfit);
  renderGoals(todayProfit, monthlyProfit);
}

function renderProfile(jobs, todayProfit, monthlyProfit){
  const monthly = lastMonths(6).map(({ key, label }) => ({ key, label, profit: sumProfit(jobs.filter(j => j.date?.startsWith(key))) }));
  const thisMonth = monthly.at(-1)?.profit || 0;
  const prevMonth = monthly.at(-2)?.profit || 0;
  const maxMonthly = Math.max(1, ...monthly.map(m => Math.abs(m.profit)));
  $('monthlyBars').innerHTML = monthly.map(m => `<div class="flex flex-col items-center gap-2"><div class="flex h-36 w-full items-end justify-center rounded-xl border-2 border-slate-900 bg-slate-100 p-1 dark:bg-slate-800"><div class="w-8 rounded-t-lg ${m.profit >= 0 ? 'bg-emerald-400' : 'bg-red-400'}" style="height:${Math.max(8, Math.abs(m.profit) / maxMonthly * 100)}%"></div></div><b class="text-xs">${m.label}</b><span class="text-xs font-black ${m.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}">${money(m.profit)}</span></div>`).join('');
  $('monthCompare').textContent = `${thisMonth >= prevMonth ? '▲' : '▼'} ${money(thisMonth - prevMonth)} เทียบเดือนก่อน`;
  $('profileMonthlyProfit').textContent = money(monthlyProfit);
  renderTrend(jobs);
  renderHeatmap(jobs);
}

function renderTrend(jobs){
  const days = lastDays(30).map(date => ({ date, profit: sumProfit(jobs.filter(j => j.date === date)) }));
  const values = days.map(d => d.profit);
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const points = days.map((d, i) => `${(i / 29) * 300},${110 - ((d.profit - min) / span) * 95}`).join(' ');
  $('dailyTrend').setAttribute('points', points);
  const active = days.filter(d => d.profit !== 0);
  $('trendHigh').textContent = money(Math.max(0, ...values));
  $('trendAvg').textContent = money(active.length ? sumProfit(active) / active.length : 0);
  $('trendDays').textContent = `${active.length} วัน`;
}

function renderHeatmap(jobs){
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const totalDays = new Date(year, month + 1, 0).getDate();
  const blanks = Array.from({ length:first.getDay() }, () => '<div></div>');
  const cells = Array.from({ length:totalDays }, (_, i) => {
    const date = `${year}-${String(month + 1).padStart(2,'0')}-${String(i + 1).padStart(2,'0')}`;
    const profit = sumProfit(jobs.filter(j => j.date === date));
    const intensity = Math.min(1, Math.abs(profit) / 1000);
    const alpha = profit === 0 ? .15 : .35 + (intensity * .65);
    const color = profit >= 0 ? `rgba(16,185,129,${alpha})` : `rgba(239,68,68,${alpha})`;
    return `<div title="${date} ${money(profit)}" class="heat-cell" style="background:${color}"><span>${i + 1}</span></div>`;
  });
  $('monthHeatmap').innerHTML = [...blanks, ...cells].join('');
}

function hydrateGoals(){
  const goals = store.goals;
  $('dailyGoal').value = goals.daily;
  $('monthlyGoal').value = goals.monthly;
}

function saveGoals(e){
  e.preventDefault();
  store.goals = { daily:+$('dailyGoal').value || 0, monthly:+$('monthlyGoal').value || 0 };
  goalReached = { daily:false, monthly:false };
  render();
  Toast.fire({ icon:'success', title:'อัปเดตเป้าหมายแล้ว' });
}

function renderGoals(todayProfit, monthlyProfit){
  const goals = store.goals;
  updateGoalBar('dailyGoalBar', 'dailyGoalText', todayProfit, goals.daily, 'รายวัน');
  updateGoalBar('monthlyGoalBar', 'monthlyGoalText', monthlyProfit, goals.monthly, 'รายเดือน');
  if (goals.daily > 0 && todayProfit >= goals.daily && !goalReached.daily) {
    goalReached.daily = true;
    Toast.fire({ icon:'success', title:'🎯 ถึงเป้ากำไรรายวันแล้ว!' });
  }
  if (goals.monthly > 0 && monthlyProfit >= goals.monthly && !goalReached.monthly) {
    goalReached.monthly = true;
    Toast.fire({ icon:'success', title:'🏆 ถึงเป้ากำไรรายเดือนแล้ว!' });
  }
}

function updateGoalBar(barId, textId, current, target, label){
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  $(barId).style.width = `${pct}%`;
  $(textId).textContent = `${label}: ${money(current)} / ${money(target)} (${pct.toFixed(0)}%)`;
}

function lastMonths(count){
  const formatter = new Intl.DateTimeFormat('th-TH', { month:'short' });
  const base = new Date();
  return Array.from({ length:count }, (_, i) => {
    const d = new Date(base.getFullYear(), base.getMonth() - (count - 1 - i), 1);
    return { key:`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`, label:formatter.format(d) };
  });
}

function lastDays(count){
  return Array.from({ length:count }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (count - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

function sumProfit(items){ return items.reduce((total, item) => total + Number(item.profit || 0), 0); }

window.deleteJob = (id) => { store.jobs = store.jobs.filter(j => j.id !== id); render(); };
function calculateFill(){
  const liters = +$('fillBudget').value / (+$('fillPrice').value || currentFuel);
  const km = liters * (+$('fillEff').value || 40);
  $('fillResult').textContent = `เติม ${money($('fillBudget').value)} ได้ ${liters.toFixed(2)} ลิตร วิ่งได้ประมาณ ${km.toFixed(1)} กม.`;
}
function clearJobs(){ Swal.fire({title:'ล้างข้อมูลทั้งหมด?', icon:'warning', showCancelButton:true, confirmButtonText:'ล้างเลย', cancelButtonText:'ยกเลิก', customClass:{popup:'pixel-swal'}}).then(r=>{ if(r.isConfirmed){ store.jobs=[]; render(); }}); }
function addSamples(){
  const samples = Array.from({ length:45 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i * 3);
    const distance = 5 + (i % 9) * 1.7;
    const fare = 65 + (i % 7) * 18;
    const fuelCost = (distance / 40) * currentFuel;
    return { id:crypto.randomUUID(), date:date.toISOString().slice(0,10), name:`Grab Food - ตัวอย่าง ${i + 1}`, fare, distance, efficiency:40, fuelPrice:currentFuel, liters:distance / 40, fuelCost, profit:fare - fuelCost - (i % 11 === 0 ? 95 : 0) };
  });
  store.jobs = [...samples, ...store.jobs];
  render();
  Toast.fire({icon:'success', title:'เพิ่มข้อมูลตัวอย่างแล้ว'});
}
function mockOCR(){ Swal.fire({title:'อ่านรูปแคปหน้าจอ', text:'เดโมนี้จะช่วยกรอกตัวเลขให้ตรวจแก้ก่อนบันทึก (ต่อยอดเชื่อม OCR API ได้)', icon:'info', confirmButtonText:'กรอกตัวอย่าง', customClass:{popup:'pixel-swal'}}).then(()=>{ $('fare').value = 68; $('distance').value = 6.7; $('jobName').value = 'นำเข้าจากรูป Grab'; }); }
function exportExcel(){ const ws = XLSX.utils.json_to_sheet(store.jobs); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Rider Jobs'); XLSX.writeFile(wb, `rider-jobs-${todayISO()}.xlsx`); }
function exportPDF(){ const { jsPDF } = window.jspdf; const doc = new jsPDF(); doc.text('Rider Fuel Report', 14, 16); doc.autoTable({ startY:22, head:[['Date','Job','Fare','KM','Fuel','Profit']], body:store.jobs.map(j=>[j.date,j.name,j.fare,j.distance,j.fuelCost.toFixed(2),j.profit.toFixed(2)]) }); doc.save(`rider-report-${todayISO()}.pdf`); }
init();
