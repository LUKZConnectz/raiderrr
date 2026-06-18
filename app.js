const $ = (id) => document.getElementById(id);
const money = (n) => `฿${Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;
const todayISO = () => new Date().toISOString().slice(0, 10);
const store = { get jobs(){ return JSON.parse(localStorage.getItem('rider_jobs') || '[]') }, set jobs(v){ localStorage.setItem('rider_jobs', JSON.stringify(v)) } };
let currentFuel = 38.25;

const Toast = Swal.mixin({ toast:true, position:'top-end', timer:2200, showConfirmButton:false, customClass:{popup:'pixel-swal'} });

function init() {
  $('jobDate').value = todayISO();
  document.documentElement.classList.toggle('dark', localStorage.theme === 'dark');
  const riders = Number(localStorage.riderCounter || 1278) + Math.floor(Math.random() * 4);
  localStorage.riderCounter = riders;
  $('riderCount').textContent = riders.toLocaleString('th-TH');
  bindEvents();
  loadFuelPrice();
  render();
  calculateFill();
}

function bindEvents(){
  $('themeBtn').onclick = () => { document.documentElement.classList.toggle('dark'); localStorage.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light'; };
  $('jobForm').onsubmit = saveJob;
  $('clearBtn').onclick = clearJobs;
  $('sampleBtn').onclick = addSamples;
  $('excelBtn').onclick = exportExcel;
  $('pdfBtn').onclick = exportPDF;
  $('ocrBtn').onclick = () => $('imageInput').click();
  $('imageInput').onchange = mockOCR;
  ['fillBudget','fillPrice','fillEff'].forEach(id => $(id).addEventListener('input', calculateFill));
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
  $('todayProfit').textContent = money(sum(todayJobs,'profit'));
  $('todayFuel').textContent = `ค่าน้ำมัน ${money(sum(todayJobs,'fuelCost'))}`;
  $('totalFare').textContent = money(sum(jobs,'fare'));
  $('totalKm').textContent = `${sum(jobs,'distance').toFixed(2)} กม.`;
  $('dailySummary').textContent = money(sum(todayJobs,'profit'));
  $('weeklySummary').textContent = money(sum(weekJobs,'profit'));
  $('monthlySummary').textContent = money(sum(monthJobs,'profit'));
}

window.deleteJob = (id) => { store.jobs = store.jobs.filter(j => j.id !== id); render(); };
function calculateFill(){
  const liters = +$('fillBudget').value / (+$('fillPrice').value || currentFuel);
  const km = liters * (+$('fillEff').value || 40);
  $('fillResult').textContent = `เติม ${money($('fillBudget').value)} ได้ ${liters.toFixed(2)} ลิตร วิ่งได้ประมาณ ${km.toFixed(1)} กม.`;
}
function clearJobs(){ Swal.fire({title:'ล้างข้อมูลทั้งหมด?', icon:'warning', showCancelButton:true, confirmButtonText:'ล้างเลย', cancelButtonText:'ยกเลิก', customClass:{popup:'pixel-swal'}}).then(r=>{ if(r.isConfirmed){ store.jobs=[]; render(); }}); }
function addSamples(){ store.jobs = [{id:crypto.randomUUID(),date:todayISO(),name:'Grab Food - ตัวอย่าง',fare:72,distance:8.4,efficiency:40,fuelPrice:currentFuel,liters:.21,fuelCost:.21*currentFuel,profit:72-(.21*currentFuel)}, ...store.jobs]; render(); Toast.fire({icon:'success', title:'เพิ่มข้อมูลตัวอย่างแล้ว'}); }
function mockOCR(){ Swal.fire({title:'อ่านรูปแคปหน้าจอ', text:'เดโมนี้จะช่วยกรอกตัวเลขให้ตรวจแก้ก่อนบันทึก (ต่อยอดเชื่อม OCR API ได้)', icon:'info', confirmButtonText:'กรอกตัวอย่าง', customClass:{popup:'pixel-swal'}}).then(()=>{ $('fare').value = 68; $('distance').value = 6.7; $('jobName').value = 'นำเข้าจากรูป Grab'; }); }
function exportExcel(){ const ws = XLSX.utils.json_to_sheet(store.jobs); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Rider Jobs'); XLSX.writeFile(wb, `rider-jobs-${todayISO()}.xlsx`); }
function exportPDF(){ const { jsPDF } = window.jspdf; const doc = new jsPDF(); doc.text('Rider Fuel Report', 14, 16); doc.autoTable({ startY:22, head:[['Date','Job','Fare','KM','Fuel','Profit']], body:store.jobs.map(j=>[j.date,j.name,j.fare,j.distance,j.fuelCost.toFixed(2),j.profit.toFixed(2)]) }); doc.save(`rider-report-${todayISO()}.pdf`); }
init();
