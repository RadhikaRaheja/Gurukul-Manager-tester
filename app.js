const backendURL = 'https://script.google.com/macros/s/AKfycbw7NUg_5Av_re7t_ois3N27hKdeuIyoZxivmEIV-lWV09JzHPzmdBftjRa3RAFVXURLhw/exec';

document.addEventListener('DOMContentLoaded', () => {
  fetchStudents();
  document.getElementById('entryForm').addEventListener('submit', handleEntrySubmit);
});

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.getElementById(tabName).classList.add('active');

  document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('active'));
  document.getElementById(tabName + 'Tab').classList.add('active');
}

function fetchStudents() {
  fetch(`${backendURL}?action=getStudents`)
    .then(res => res.json())
    .then(data => {
      const studentSelect = document.getElementById('studentSelect');
      const dashboardSelect = document.getElementById('dashboardStudent');
      studentSelect.innerHTML = '';
      dashboardSelect.innerHTML = '';

      data.forEach(student => {
        const option = document.createElement('option');
        option.value = `${student.name}|||${student.class}`;
        option.textContent = `${student.name} (${student.class})`;
        studentSelect.appendChild(option);
        dashboardSelect.appendChild(option.cloneNode(true));
      });
    });
}

function handleEntrySubmit(e) {
  e.preventDefault();
  const [name, cls] = document.getElementById('studentSelect').value.split('|||');
  const date = document.getElementById('date').value;
  const debit = parseFloat(document.getElementById('debit').value) || 0;
  const credit = parseFloat(document.getElementById('credit').value) || 0;

  fetch(backendURL, {
    method: 'POST',
    body: JSON.stringify({
      action: 'saveTransaction',
      payload: { name, class: cls, date, debit, credit }
    })
  })
  .then(res => res.json())
  .then(data => {
    document.getElementById('entryStatus').textContent = '✅ Transaction Saved!';
    document.getElementById('entryForm').reset();
  });
}

function loadDashboard() {
  const [name, cls] = document.getElementById('dashboardStudent').value.split('|||');
  const fromDate = new Date(document.getElementById('filterDate').value);
  const toDateInput = document.getElementById('toDate');
  const toDate = toDateInput ? new Date(toDateInput.value) : null;

  fetch(`${backendURL}?action=getTransactions`)
    .then(res => res.json())
    .then(data => {
      const filtered = data.filter(tx => tx.name === name && tx.class === cls);
      const tableBody = document.getElementById('transactionTable').querySelector('tbody');
      tableBody.innerHTML = '';

      let total = 0;
      let inRange = 0;
      let dailyMap = {};

      filtered.forEach(tx => {
        const date = new Date(tx.date);
        const net = tx.credit - tx.debit;
        total += net;

        const inFilterRange = (!isNaN(fromDate) && date >= fromDate) && (!isNaN(toDate) ? date <= toDate : true);
        if (inFilterRange) {
          inRange += net;
          dailyMap[tx.date] = (dailyMap[tx.date] || 0) + net;

          const row = document.createElement('tr');
          row.innerHTML = `<td>${tx.date}</td><td>₹${tx.debit}</td><td>₹${tx.credit}</td>`;
          tableBody.appendChild(row);
        }
      });

      document.getElementById('summary').innerHTML = `
        <p><strong>📆 Balance in date range:</strong> ₹${inRange}</p>
        <p><strong>💰 Total Balance:</strong> ₹${total}</p>
        <button onclick="exportPDF()">📄 Export as PDF</button>
        <h4>📈 Daily Snapshot</h4>
        <ul>
          ${Object.entries(dailyMap).map(([d, b]) => `<li>${d}: ₹${b}</li>`).join('')}
        </ul>
      `;
    });
}

// Export table to PDF using jsPDF
function exportPDF() {
  const doc = new window.jspdf.jsPDF();
  doc.text("Transaction Report", 14, 16);
  doc.autoTable({ html: '#transactionTable', startY: 20 });
  doc.save("transactions.pdf");
}
