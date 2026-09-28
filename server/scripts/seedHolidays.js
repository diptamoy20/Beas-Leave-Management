const db = require('./config/db');

const holidays2026 = [
  // General Holidays
  { date: '2026-01-01', day: 'Thursday', purpose: 'New Year', type: 'General', number_of_days: 1, year: 2026 },
  { date: '2026-01-26', day: 'Monday', purpose: 'Republic Day', type: 'General', number_of_days: 1, year: 2026 },
  { date: '2026-03-03', day: 'Tuesday', purpose: 'Doljatra', type: 'General', number_of_days: 1, year: 2026 },
  { date: '2026-04-03', day: 'Friday', purpose: 'Good Friday', type: 'General', number_of_days: 1, year: 2026 },
  { date: '2026-05-01', day: 'Friday', purpose: 'May Day', type: 'General', number_of_days: 1, year: 2026 },
  { date: '2026-10-16', day: 'Friday', purpose: 'Maha Panchami (Durga Puja)', type: 'General', number_of_days: 1, year: 2026 },
  { date: '2026-10-19', day: 'Monday', purpose: 'Maha Ashtami (Durga Puja)', type: 'General', number_of_days: 1, year: 2026 },
  { date: '2026-10-20', day: 'Tuesday', purpose: 'Maha Navami (Durga Puja)', type: 'General', number_of_days: 1, year: 2026 },
  { date: '2026-10-21', day: 'Wednesday', purpose: 'Maha Dashami (Durga Puja)', type: 'General', number_of_days: 1, year: 2026 },
  { date: '2026-11-09', day: 'Monday', purpose: 'Kali Puja', type: 'General', number_of_days: 1, year: 2026 },
  { date: '2026-12-25', day: 'Friday', purpose: 'Christmas', type: 'General', number_of_days: 1, year: 2026 },
  
  // Restricted Holidays
  { date: '2026-01-23', day: 'Friday', purpose: 'Vasanth Panchami / Netaji Birthday', type: 'Restricted', number_of_days: 1, year: 2026 },
  { date: '2026-04-15', day: 'Wednesday', purpose: 'Bengali New Year', type: 'Restricted', number_of_days: 1, year: 2026 },
  { date: '2026-05-27', day: 'Wednesday', purpose: 'Bakrid / Eid-ul-Zuha', type: 'Restricted', number_of_days: 1, year: 2026 },
  { date: '2026-06-26', day: 'Friday', purpose: 'Muharram', type: 'Restricted', number_of_days: 1, year: 2026 },
  { date: '2026-11-11', day: 'Wednesday', purpose: 'Bhatri Ditiya', type: 'Restricted', number_of_days: 1, year: 2026 }
];

async function seedHolidays() {
  try {
    console.log('Seeding holidays for 2026...');
    
    for (const holiday of holidays2026) {
      await db.run(
        'INSERT INTO holidays (date, day, purpose, type, number_of_days, year) VALUES (?, ?, ?, ?, ?, ?)',
        [holiday.date, holiday.day, holiday.purpose, holiday.type, holiday.number_of_days, holiday.year]
      );
    }
    
    console.log('✅ Successfully seeded', holidays2026.length, 'holidays for 2026');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding holidays:', error);
    process.exit(1);
  }
}

seedHolidays();
