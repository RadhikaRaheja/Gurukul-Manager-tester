const backendURL = 'https://script.google.com/macros/s/AKfycbw7NUg_5Av_re7t_ois3N27hKdeuIyoZxivmEIV-lWV09JzHPzmdBftjRa3RAFVXURLhw/exec';

document.addEventListener('DOMContentLoaded', () => {
  fetchStudents();
  setupModeToggle();
});

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.getElementById(tabName).classList.add('active');

  document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('active'));
  document.getElementById(tabName + 'Tab').classList.add('active');
}

// 🌓 Mode Toggle
function setupModeToggle() {
  const toggle = document.getElementById('modeSwitch');
  const mode = localStorage.getItem('mode') || 'dark';
  document.body.classList.toggle('light-mode', mode === 'light');
  toggle.checked = mode === 'light';

  toggle.addEventListener('change', () => {
    const isLight = toggle.checked;
    document.body.classList.toggle('light-mode', isLight);
    localStorage.setItem('mode', isLight ? 'light' : 'dark');
  });
}

// 👥 Fetch and Render Students
let students = [];

function fetchStudents() {
  fetch(`${backendURL}?action=getStudents`)
    .then(res => res.json())
    .then(data => {
      students = data;
      renderEntryList(data);
      renderStudentDropdown(data);
    });
}

// ➕ Entry UI
function renderEntryList(data) {
  const list = document.getElementById('entryList');
  list.innerHTML = '';
  data.forEach(student => {
    const row = document.createElement('div');
    row.className = 'entry-row';

    row.innerHTML = `
      <span>${student.name} (${student.class})</span>
      <input type="number" placeholder="Debit" class="debit" />
      <input type="number" placeholder="Credit" class="credit" />
    `;
    row.dataset.name = student.name;
    row.dataset.class = student.class;

    list.appendChild(row);
  });

  document.getElementById('saveAllButton').addEventListener('click', saveAllEntries);
}

// 💾 Save all transactions
function saveAllEntries() {
  const rows = document.querySelectorAll('.entry-row');
  const date = document.getElementById('entryDate').value;
  const payload = [];

  rows.forEach(row => {
    const debit = parseFloat(row.querySelector('.debit').value) || 0;
    const credit = parseFloat(row.querySelector('.credit').value) || 0;
    if (debit || credit) {
      payload.push({
        date,
        name: row.dataset.name,
        class: row.dataset.class,
        debit,
        credit
      });
    }
  });

  if (payload.length === 0) return alert("No entries to save!");

  fetch(backendURL, {
    method: 'POST',
    body: JSON.stringify({
      action: 'saveTransaction',
      payload: payload[0] // Save one at a time for now
    })
  }).then(() => {
    document.getElementById('entryStatus').textContent = "✅ Entry saved successfully.";
    document.querySelectorAll('.debit, .credit').forEach(input => input.value = '');
  });
}

// 📊 Dashboard Logic
function renderStudentDropdown(data) {
  const select = document.getElementById('dashboardStudent');
  select.innerHTML = '';
  data.forEach(student => {
    const opt = document.createElement('option');
    opt.value = `${student.name}|||${student.class}`;
    opt.textContent = `${student.name} (${student.class})`;
    select.appendChild(opt);
  });
}

function loadDashboard() {
  const [name, cls] = document.getElementById('dashboardStudent').value.split('|||');
  const from = document.getElementById('fromDate').value;
  const to = document.getElementById('toDate').value;

  fetch(`${backendURL}?action=getTransactions`)
    .then(res => res.json())
    .then(data => {
      const table = document.querySelector('#transactionTable tbody');
      table.innerHTML = '';

      const filtered = data
        .filter(tx => tx.name === name && tx.class === cls)
        .filter(tx => {
          const txDate = new Date(tx.date);
          return (!from || txDate >= new Date(from)) &&
                 (!to || txDate <= new Date(to));
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      let balance = 0;

      filtered.forEach(tx => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${formatDate(tx.date)}</td>
          <td>₹${tx.debit}</td>
          <td>₹${tx.credit}</td>
        `;
        table.appendChild(row);
        balance += tx.credit - tx.debit;
      });

      document.getElementById('dashboardSummary').textContent = `Balance in filtered range: ₹${balance}`;
      document.getElementById('tableBalanceTotal').innerHTML = `
        <button onclick="exportPDF()">📄 Share as PDF</button>
      `;
    });
}

// 📤 Share PDF
function exportPDF() {
  const doc = new window.jspdf.jsPDF();
  doc.text("Student Transactions", 14, 16);
  doc.autoTable({ html: '#transactionTable', startY: 22 });

  if (navigator.share) {
    doc.save('transactions.pdf'); // For fallback download
    doc.output('blob').then(blob => {
      const file = new File([blob], 'transactions.pdf', { type: 'application/pdf' });
      navigator.share({
        title: 'Transaction Report',
        files: [file]
      });
    });
  } else {
    doc.save('transactions.pdf');
  }
}

// 📆 Daily Snapshot (All Students)
function loadSnapshot() {
  const from = document.getElementById('snapFrom').value;
  const to = document.getElementById('snapTo').value || from;
  if (!from) return alert("Please select a date.");

  fetch(`${backendURL}?action=getSnapshot&from=${from}&to=${to}`)
    .then(res => res.json())
    .then(data => {
      const table = document.querySelector('#snapshotTable tbody');
      table.innerHTML = '';
      const sorted = data.sort((a, b) => new Date(a.date) - new Date(b.date));
      sorted.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${formatDate(row.date)}</td>
          <td>${row.name}</td>
          <td>${row.class}</td>
          <td>₹${row.debit}</td>
          <td>₹${row.credit}</td>
        `;
        table.appendChild(tr);
      });
    });
}

// 📅 Format date as dd-mm-yyyy
function formatDate(isoDate) {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-GB');
}
