const backendURL = 'https://script.google.com/macros/s/AKfycbw7NUg_5Av_re7t_ois3N27hKdeuIyoZxivmEIV-lWV09JzHPzmdBftjRa3RAFVXURLhw/exec';

let allTransactions = [];

document.addEventListener('DOMContentLoaded', async () => {
  const students = await fetchStudents();
  await fetchAllTransactions(); // for balance calculation
  renderEntryRows(students);
  populateDropdowns(students);
  document.getElementById('saveAllButton').addEventListener('click', saveAllEntries);
  document.getElementById('modeSwitch').addEventListener('change', toggleMode);
  applySavedMode();
});

function applySavedMode() {
  const isLight = localStorage.getItem('mode') === 'light';
  document.body.classList.toggle('light-mode', isLight);
  document.body.classList.toggle('dark-mode', !isLight);
  document.getElementById('modeSwitch').checked = isLight;
}

function toggleMode() {
  const isLight = document.getElementById('modeSwitch').checked;
  document.body.classList.toggle('light-mode', isLight);
  document.body.classList.toggle('dark-mode', !isLight);
  localStorage.setItem('mode', isLight ? 'light' : 'dark');
}

function switchTab(tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');

  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId + 'Tab').classList.add('active');
}

async function fetchStudents() {
  const res = await fetch(`${backendURL}?action=getStudents`);
  return await res.json();
}

async function fetchAllTransactions() {
  const res = await fetch(`${backendURL}?action=getTransactions`);
  allTransactions = await res.json();
}

function populateDropdowns(students) {
  const dashboardSel = document.getElementById('dashboardStudent');
  dashboardSel.innerHTML = '';
  students.forEach(s => {
    const opt = document.createElement('option');
    opt.value = `${s.name}|||${s.class}`;
    opt.textContent = `${s.name} (${s.class})`;
    dashboardSel.appendChild(opt);
  });
}

function renderEntryRows(students) {
  const container = document.getElementById('entryList');
  container.innerHTML = '';
  let grandTotal = 0;

  students.forEach(s => {
    const balance = calculateBalance(s.name, s.class);
    grandTotal += balance;

    const row = document.createElement('div');
    row.className = 'entry-row';
    row.innerHTML = `
      <span>${s.name} (${s.class})</span>
      <input type="number" placeholder="Debit" class="debit" />
      <input type="number" placeholder="Credit" class="credit" />
      <span style="min-width: 120px; font-weight: bold; color: ${balance < 0 ? '#ef4444' : '#10b981'};">
        ₹${balance}
      </span>
    `;
    row.dataset.name = s.name;
    row.dataset.class = s.class;
    container.appendChild(row);
  });

  document.getElementById('entryTotal').textContent = `Grand Total = ₹${grandTotal}`;
}

function calculateBalance(name, cls) {
  const txs = allTransactions.filter(t => t.name === name && t.class === cls);
  return txs.reduce((sum, tx) => sum + (tx.credit - tx.debit), 0);
}

async function saveAllEntries() {
  const date = document.getElementById('entryDate').value;
  if (!date) return alert('Please select a date.');

  const rows = document.querySelectorAll('.entry-row');
  const entries = [];

  rows.forEach(row => {
    const name = row.dataset.name;
    const cls = row.dataset.class;
    const debit = parseFloat(row.querySelector('.debit').value) || 0;
    const credit = parseFloat(row.querySelector('.credit').value) || 0;
    if (debit || credit) {
      entries.push({ date, name, class: cls, debit, credit });
    }
  });

  if (entries.length === 0) return alert('No entries to save.');

  const btn = document.getElementById('saveAllButton');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  const savePromises = entries.map(entry =>
    fetch(backendURL, {
      method: 'POST',
      body: JSON.stringify({ action: 'saveTransaction', payload: entry })
    })
  );

  await Promise.all(savePromises);
  document.getElementById('entryStatus').textContent = '✅ Entries saved!';

  rows.forEach(r => {
    r.querySelector('.debit').value = '';
    r.querySelector('.credit').value = '';
  });

  await fetchAllTransactions();
  const students = await fetchStudents();
  renderEntryRows(students);

  setTimeout(() => {
    btn.disabled = false;
    btn.textContent = '💾 Save All Entries';
    document.getElementById('entryStatus').textContent = '';
  }, 2000);
}

function formatDateDMY(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}-${m}-${y}`;
}

async function loadDashboard() {
  const [name, cls] = document.getElementById('dashboardStudent').value.split('|||');
  const from = document.getElementById('fromDate').value;
  const to = document.getElementById('toDate').value;

  const filtered = allTransactions
    .filter(tx => tx.name === name && tx.class === cls)
    .filter(tx => (!from || tx.date >= from) && (!to || tx.date <= to))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const tbody = document.querySelector('#transactionTable tbody');
  tbody.innerHTML = '';

  let total = 0;
  filtered.forEach(tx => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDateDMY(tx.date)}</td>
      <td style="color:#ef4444;">₹${tx.debit}</td>
      <td style="color:#10b981;">₹${tx.credit}</td>
    `;
    tbody.appendChild(tr);
    total += tx.credit - tx.debit;
  });

  document.getElementById('tableBalanceTotal').innerHTML = `
    🧾 Total Balance for ${name}: ₹${total}
    <br /><br />
    <button onclick="exportDashboardPDF('${name}')">📤 Share as PDF</button>
  `;
}

async function exportDashboardPDF(name) {
  const doc = new jspdf.jsPDF();
  doc.text(`Transaction Report - ${name}`, 14, 16);
  doc.autoTable({ html: '#transactionTable', startY: 24 });

  const blob = doc.output('blob');
  const file = new File([blob], `${name}_transactions.pdf`, { type: 'application/pdf' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: `${name} Transactions` });
  } else {
    alert("Sharing not supported on this device.");
  }
}

async function loadSnapshot() {
  const from = document.getElementById('snapFrom').value;
  const to = document.getElementById('snapTo').value || from;
  if (!from) return alert('Please select a date');

  const res = await fetch(`${backendURL}?action=getSnapshot&from=${from}&to=${to}`);
  const data = await res.json();

  const tbody = document.querySelector('#snapshotTable tbody');
  tbody.innerHTML = '';
  data.sort((a, b) => new Date(a.date) - new Date(b.date));
  data.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDateDMY(row.date)}</td>
      <td>${row.name}</td>
      <td>${row.class}</td>
      <td style="color:#ef4444;">₹${row.debit}</td>
      <td style="color:#10b981;">₹${row.credit}</td>
    `;
    tbody.appendChild(tr);
  });
}
