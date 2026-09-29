const formatDateIST = (dateInput) => {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;

  const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('en-IN', options);
  
  // en-IN format is DD/MM/YYYY
  const parts = formatter.formatToParts(d);
  const day = parts.find(p => p.type === 'day').value;
  const month = parts.find(p => p.type === 'month').value;
  const year = parts.find(p => p.type === 'year').value;
  
  return `${day}-${month}-${year}`;
};

const parseDateIST = (dateStr) => {
  // If input is DD-MM-YYYY, convert back to YYYY-MM-DD for DB insertion
  if (!dateStr || typeof dateStr !== 'string') return dateStr;
  const parts = dateStr.split('-');
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
};

module.exports = {
  formatDateIST,
  parseDateIST
};
