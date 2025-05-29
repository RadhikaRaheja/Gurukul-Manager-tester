const backendURL = 'https://script.google.com/macros/s/AKfycbw7NUg_5Av_re7t_ois3N27hKdeuIyoZxivmEIV-lWV09JzHPzmdBftjRa3RAFVXURLhw/exec';

let allTransactions = [];

function switchTab(tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  document.querySelectorAll('.nav-tabs button').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId + 'Tab').classList.add('active');
}

document.addEventListener('DOMContentLoaded', async () => {
  const students = await fetchStudents();
  await fetchAllTransactions();
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
      <span style="font-weight: bold; color: ${balance < 0 ? '#e53935' : '#10b981'};">Rs. ${balance}</span>
    `;
    row.dataset.name = s.name;
    row.dataset.class = s.class;
    container.appendChild(row);
  });

  document.getElementById('entryTotal').textContent = `Grand Total = Rs. ${grandTotal}`;
}

function calculateBalance(name, cls) {
  const txs = allTransactions.filter(t => t.name === name && t.class === cls);
  return txs.reduce((sum, tx) => sum + (tx.credit - tx.debit), 0);
}
console.log("Entries to save:", entries.length, entries);
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

  try {
    const res = await fetch(backendURL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'saveTransactionsBatch',
        payload: entries
      })
    });
    const result = await res.json();
    document.getElementById('entryStatus').textContent = `✅ ${result.saved} entries saved!`;
  } catch (err) {
    alert('Error saving entries. Please try again.');
    console.error(err);
  }

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
  const value = document.getElementById('dashboardStudent').value;
  if (!value) return;
  const [name, cls] = value.split('|||');
  const from = document.getElementById('fromDate').value;
  const to = document.getElementById('toDate').value;

  const filtered = allTransactions
    .filter(tx => tx.name === name && tx.class === cls)
    .filter(tx => (!from || tx.date >= from) && (!to || tx.date <= to))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const tbody = document.querySelector('#transactionTable tbody');
  tbody.innerHTML = '';
  let rangeTotal = 0;
  filtered.forEach(tx => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDateDMY(tx.date)}</td>
      <td style="color:#e53935;">Rs. ${tx.debit}</td>
      <td style="color:#10b981;">Rs. ${tx.credit}</td>
    `;
    tbody.appendChild(tr);
    rangeTotal += tx.credit - tx.debit;
  });

  const totalTxs = allTransactions.filter(t => t.name === name && t.class === cls);
  const totalBalance = totalTxs.reduce((sum, tx) => sum + (tx.credit - tx.debit), 0);

  document.getElementById('tableBalanceTotal').innerHTML = `
    💡 Balance for selected range: Rs. ${rangeTotal}<br>
    📊 Total balance: Rs. ${totalBalance}
    <br><br>
    <button class="export-btn" onclick="exportDashboardPDF('${name}')">📤 Share as PDF</button>
  `;
}

async function exportDashboardPDF(name) {
  const doc = new jspdf.jsPDF();
  doc.text(`Transaction Report - ${name} (in Rs.)`, 14, 16);
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
  const balanceFilter = document.getElementById('balanceFilter').value;

  if (!from) return alert('Please select a date');

  const res = await fetch(`${backendURL}?action=getSnapshot&from=${from}&to=${to}`);
  const data = await res.json();

  const filtered = data.filter(row => {
    const net = row.credit - row.debit;
    if (balanceFilter === 'credit') return net > 0;
    if (balanceFilter === 'debit') return net < 0;
    return true;
  });

  const tbody = document.querySelector('#snapshotTable tbody');
  tbody.innerHTML = '';
  filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
  filtered.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDateDMY(row.date)}</td>
      <td>${row.name}</td>
      <td>${row.class}</td>
      <td style="color:#e53935;">Rs. ${row.debit}</td>
      <td style="color:#10b981;">Rs. ${row.credit}</td>
    `;
    tbody.appendChild(tr);
  });
}
