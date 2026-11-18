const db = require('../config/db');

// Official BEAS Holiday Schedule for 2026
const holidays2026 = [
  // General Holidays (11)
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
  
  // Restricted Holidays (5)
  { date: '2026-01-23', day: 'Friday', purpose: 'Vasanth Panchami / Netaji Birthday', type: 'Restricted', number_of_days: 1, year: 2026 },
  { date: '2026-04-15', day: 'Wednesday', purpose: 'Bengali New Year', type: 'Restricted', number_of_days: 1, year: 2026 },
  { date: '2026-05-27', day: 'Wednesday', purpose: 'Bakrid / Eid-ul-Zuha', type: 'Restricted', number_of_days: 1, year: 2026 },
  { date: '2026-06-26', day: 'Friday', purpose: 'Muharram', type: 'Restricted', number_of_days: 1, year: 2026 },
  { date: '2026-11-11', day: 'Wednesday', purpose: 'Bhatri Ditiya', type: 'Restricted', number_of_days: 1, year: 2026 }
];

// Official BEAS Holiday Schedule for 2027 (from Inter-Office Memo)
const holidays2027 = [
  // General Holidays (10)
  { date: '2027-01-01', day: 'Friday', purpose: 'New Year', type: 'General', number_of_days: 1, year: 2027 },
  { date: '2027-01-26', day: 'Tuesday', purpose: 'Republic Day', type: 'General', number_of_days: 1, year: 2027 },
  { date: '2027-02-11', day: 'Thursday', purpose: 'Vasanth Panchami / Saraswati Puja', type: 'General', number_of_days: 1, year: 2027 },
  { date: '2027-03-22', day: 'Monday', purpose: 'Doljatra', type: 'General', number_of_days: 1, year: 2027 },
  { date: '2027-03-26', day: 'Friday', purpose: 'Good Friday', type: 'General', number_of_days: 1, year: 2027 },
  { date: '2027-10-05', day: 'Tuesday', purpose: 'Maha Sasti (Durga Puja)', type: 'General', number_of_days: 1, year: 2027 },
  { date: '2027-10-06', day: 'Wednesday', purpose: 'Maha Saptami (Durga Puja)', type: 'General', number_of_days: 1, year: 2027 },
  { date: '2027-10-07', day: 'Thursday', purpose: 'Maha Ashtami (Durga Puja)', type: 'General', number_of_days: 1, year: 2027 },
  { date: '2027-10-08', day: 'Friday', purpose: 'Maha Navami (Durga Puja)', type: 'General', number_of_days: 1, year: 2027 },
  { date: '2027-10-28', day: 'Thursday', purpose: 'Kali Puja / Diwali', type: 'General', number_of_days: 1, year: 2027 },

  // Restricted Holidays (7) [Any Two]
  { date: '2027-03-10', day: 'Wednesday', purpose: 'Id-ul-Fitr (Eid)', type: 'Restricted', number_of_days: 1, year: 2027 },
  { date: '2027-04-15', day: 'Thursday', purpose: 'Poila Boishakh / Bengali New Year', type: 'Restricted', number_of_days: 1, year: 2027 },
  { date: '2027-05-17', day: 'Monday', purpose: 'Bakrid / Eid-ul-Zuha', type: 'Restricted', number_of_days: 1, year: 2027 },
  { date: '2027-06-16', day: 'Wednesday', purpose: 'Muharram', type: 'Restricted', number_of_days: 1, year: 2027 },
  { date: '2027-08-25', day: 'Wednesday', purpose: 'Janmashtami', type: 'Restricted', number_of_days: 1, year: 2027 },
  { date: '2027-09-29', day: 'Wednesday', purpose: 'Mahalaya', type: 'Restricted', number_of_days: 1, year: 2027 },
  { date: '2027-10-14', day: 'Thursday', purpose: 'Lakshmi Puja (Kojagari Purnima)', type: 'Restricted', number_of_days: 1, year: 2027 }
];

async function seedHolidays() {
  try {
    console.log('Seeding holidays for 2026 and 2027...');

    // Clear old test records for 2026 and 2027
    await db.run('DELETE FROM holidays WHERE year IN (2026, 2027)');
    console.log('Cleared existing 2026 and 2027 holiday records');

    // Seed 2026
    for (const h of holidays2026) {
      await db.run(
        'INSERT INTO holidays (date, day, purpose, type, number_of_days, year) VALUES (?, ?, ?, ?, ?, ?)',
        [h.date, h.day, h.purpose, h.type, h.number_of_days, h.year]
      );
    }
    console.log(`✅ Seeded ${holidays2026.length} holidays for 2026`);

    // Seed 2027
    for (const h of holidays2027) {
      await db.run(
        'INSERT INTO holidays (date, day, purpose, type, number_of_days, year) VALUES (?, ?, ?, ?, ?, ?)',
        [h.date, h.day, h.purpose, h.type, h.number_of_days, h.year]
      );
    }
    console.log(`✅ Seeded ${holidays2027.length} holidays for 2027`);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding holidays:', error);
    process.exit(1);
  }
}

seedHolidays();
