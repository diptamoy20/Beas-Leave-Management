BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    date DATE NOT NULL,
    clock_in DATETIME,
    clock_out DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
  );
CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    department TEXT,
    role TEXT DEFAULT 'employee',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  , employee_id TEXT);
CREATE TABLE IF NOT EXISTS holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,
    day TEXT NOT NULL,
    purpose TEXT NOT NULL,
    type TEXT DEFAULT 'General',
    number_of_days INTEGER DEFAULT 1,
    year INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
CREATE TABLE IF NOT EXISTS leave_balance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    casual_leave INTEGER DEFAULT 12,
    sick_leave INTEGER DEFAULT 10,
    paid_leave INTEGER DEFAULT 15,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
  );
CREATE TABLE IF NOT EXISTS leave_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    leave_type TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'Pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
  );
INSERT INTO "attendance" ("id","employee_id","date","clock_in","clock_out","created_at") VALUES (1,1,'2026-03-11','2026-03-11T09:40:06.864Z',NULL,'2026-03-11 09:40:06');
INSERT INTO "attendance" ("id","employee_id","date","clock_in","clock_out","created_at") VALUES (2,6,'2026-03-12','2026-03-12T11:45:59.394Z',NULL,'2026-03-12 11:45:59');
INSERT INTO "attendance" ("id","employee_id","date","clock_in","clock_out","created_at") VALUES (3,8,'2026-03-12','2026-03-12T12:45:39.677Z','2026-03-12T12:45:41.793Z','2026-03-12 12:45:39');
INSERT INTO "attendance" ("id","employee_id","date","clock_in","clock_out","created_at") VALUES (4,9,'2026-03-13','2026-03-13T09:32:43.525Z','2026-03-13T09:32:45.232Z','2026-03-13 09:32:43');
INSERT INTO "employees" ("id","name","email","password","department","role","created_at","employee_id") VALUES (1,'Dipta','diptamoy.sanyal@beas.co.in','$2a$10$K6HN1vkJw1I24DL9ONCZsux9CQRN9/RClpdoqn/un7fO0BufffDj2','IT','employee','2026-03-11 09:23:15','EMP0001');
INSERT INTO "employees" ("id","name","email","password","department","role","created_at","employee_id") VALUES (2,'Test Manager','manager@gmail.com','$2a$10$XFVIIB5awFYtgWLJPp.TzONJJy0RprZNSEjid1ODlFOKf48/h9Pye','IT','manager','2026-03-11 09:24:58','EMP0002');
INSERT INTO "employees" ("id","name","email","password","department","role","created_at","employee_id") VALUES (3,'Test User New','testnew@test.com','$2a$10$q92zJGr9SVBARD5buZnW6esmFahLd4xz1d/hvy2jAptkSjEexqdru','HR','employee','2026-03-11 13:01:59','EMP0003');
INSERT INTO "employees" ("id","name","email","password","department","role","created_at","employee_id") VALUES (4,'Abhradeep','abhra@beas.co.in','$2a$10$q2TrrGHSFkJBUzP/aS.tH.x6jOhwx79CgnQggHRJvPhC5.9GcFHBq','DM','employee','2026-03-11 13:09:11','EMP0004');
INSERT INTO "employees" ("id","name","email","password","department","role","created_at","employee_id") VALUES (5,'ABhra','abhra@gmail.com','$2a$10$Fhf2HMFDTkigLYkhyyGSjujRdNz2NDLz.NY1Zuz3mE9iCHZWC/qlO','DM','employee','2026-03-11 13:39:36','EMP0005');
INSERT INTO "employees" ("id","name","email","password","department","role","created_at","employee_id") VALUES (6,'Clerk','clerk@gmail.com','$2a$10$dLnGsIjvfOFoTPw38ZUQhekkdDHY57C2yaICDY8UtVeMW6MCVmLaS','IT','employee','2026-03-11 13:45:55','112233');
INSERT INTO "employees" ("id","name","email","password","department","role","created_at","employee_id") VALUES (7,'emplyee','emp@gmail.com','$2a$10$Ev88XyTzkiDAPIyukl.ZkeqaETo.mbaDC9EF6Ikz2042jWxEh9GI2','it','employee','2026-03-12 11:32:02','EMP002');
INSERT INTO "employees" ("id","name","email","password","department","role","created_at","employee_id") VALUES (8,'Test','test@gmal.com','$2a$10$.hdF2FkkGeCuLtdjXVXZZ.iAChNLMVGW4scuPBG53KbZcCirOeKYm','IT','employee','2026-03-12 11:34:20','80130');
INSERT INTO "employees" ("id","name","email","password","department","role","created_at","employee_id") VALUES (9,'Manager test','managertest@gmail.com','$2a$10$OsowwgQe35aOt6uYx7kTyOId7SD/UvREqzvSHvKMfBozShUb0ETXK','IT','manager','2026-03-12 12:21:07','12345');
INSERT INTO "holidays" ("id","date","day","purpose","type","number_of_days","year","created_at") VALUES (50,'2025-12-31','Thursday','New Year','General',1,2026,'2026-03-13 09:34:12');
INSERT INTO "holidays" ("id","date","day","purpose","type","number_of_days","year","created_at") VALUES (51,'2026-01-22','Friday','Vasanth Panchami / Netaji Birthday','Restricted',1,2026,'2026-03-13 09:34:12');
INSERT INTO "holidays" ("id","date","day","purpose","type","number_of_days","year","created_at") VALUES (52,'2026-01-25','Monday','Republic Day','General',1,2026,'2026-03-13 09:34:12');
INSERT INTO "holidays" ("id","date","day","purpose","type","number_of_days","year","created_at") VALUES (53,'2026-03-02','Tuesday','Doljatra','General',1,2026,'2026-03-13 09:34:12');
INSERT INTO "holidays" ("id","date","day","purpose","type","number_of_days","year","created_at") VALUES (54,'2026-04-02','Friday','Good Friday','General',1,2026,'2026-03-13 09:34:12');
INSERT INTO "holidays" ("id","date","day","purpose","type","number_of_days","year","created_at") VALUES (55,'2026-04-14','Wednesday','Bengali New Year','Restricted',1,2026,'2026-03-13 09:34:12');
INSERT INTO "holidays" ("id","date","day","purpose","type","number_of_days","year","created_at") VALUES (56,'2026-04-30','Friday','May Day','General',1,2026,'2026-03-13 09:34:12');
INSERT INTO "holidays" ("id","date","day","purpose","type","number_of_days","year","created_at") VALUES (57,'2026-05-26','Wednesday','Bakrid / Eid-ul-Zuha','Restricted',1,2026,'2026-03-13 09:34:12');
INSERT INTO "holidays" ("id","date","day","purpose","type","number_of_days","year","created_at") VALUES (58,'2026-06-25','Friday','Muharram','Restricted',1,2026,'2026-03-13 09:34:12');
INSERT INTO "holidays" ("id","date","day","purpose","type","number_of_days","year","created_at") VALUES (59,'2026-10-15','Friday','Maha Panchami (Durga Puja)','General',1,2026,'2026-03-13 09:34:12');
INSERT INTO "holidays" ("id","date","day","purpose","type","number_of_days","year","created_at") VALUES (60,'2026-10-18','Monday','Maha Ashtami (Durga Puja)','General',1,2026,'2026-03-13 09:34:12');
INSERT INTO "holidays" ("id","date","day","purpose","type","number_of_days","year","created_at") VALUES (61,'2026-10-19','Tuesday','Maha Navami (Durga Puja)','General',1,2026,'2026-03-13 09:34:12');
INSERT INTO "holidays" ("id","date","day","purpose","type","number_of_days","year","created_at") VALUES (62,'2026-10-20','Wednesday','Maha Dashami (Durga Puja)','General',1,2026,'2026-03-13 09:34:12');
INSERT INTO "holidays" ("id","date","day","purpose","type","number_of_days","year","created_at") VALUES (63,'2026-11-08','Monday','Kali Puja','General',1,2026,'2026-03-13 09:34:12');
INSERT INTO "holidays" ("id","date","day","purpose","type","number_of_days","year","created_at") VALUES (64,'2026-11-10','Wednesday','Bhatri Ditiya','Restricted',1,2026,'2026-03-13 09:34:12');
INSERT INTO "holidays" ("id","date","day","purpose","type","number_of_days","year","created_at") VALUES (65,'2026-12-24','Friday','Christmas','General',1,2026,'2026-03-13 09:34:12');
INSERT INTO "leave_balance" ("id","employee_id","casual_leave","sick_leave","paid_leave") VALUES (1,1,9,7,14);
INSERT INTO "leave_balance" ("id","employee_id","casual_leave","sick_leave","paid_leave") VALUES (2,2,12,10,15);
INSERT INTO "leave_balance" ("id","employee_id","casual_leave","sick_leave","paid_leave") VALUES (3,3,12,10,15);
INSERT INTO "leave_balance" ("id","employee_id","casual_leave","sick_leave","paid_leave") VALUES (4,4,9,10,15);
INSERT INTO "leave_balance" ("id","employee_id","casual_leave","sick_leave","paid_leave") VALUES (5,5,12,10,15);
INSERT INTO "leave_balance" ("id","employee_id","casual_leave","sick_leave","paid_leave") VALUES (6,6,12,10,15);
INSERT INTO "leave_balance" ("id","employee_id","casual_leave","sick_leave","paid_leave") VALUES (7,7,12,10,15);
INSERT INTO "leave_balance" ("id","employee_id","casual_leave","sick_leave","paid_leave") VALUES (8,8,8,10,15);
INSERT INTO "leave_balance" ("id","employee_id","casual_leave","sick_leave","paid_leave") VALUES (9,9,9,10,15);
INSERT INTO "leave_requests" ("id","employee_id","leave_type","start_date","end_date","reason","status","created_at") VALUES (1,1,'Casual Leave','2026-03-11','2026-03-13','test','Approved','2026-03-11 09:23:51');
INSERT INTO "leave_requests" ("id","employee_id","leave_type","start_date","end_date","reason","status","created_at") VALUES (2,1,'Sick Leave','2026-03-24','2026-03-26','tesst','Approved','2026-03-11 09:40:49');
INSERT INTO "leave_requests" ("id","employee_id","leave_type","start_date","end_date","reason","status","created_at") VALUES (3,1,'Paid Leave','2026-03-26','2026-03-26','test','Approved','2026-03-11 12:15:12');
INSERT INTO "leave_requests" ("id","employee_id","leave_type","start_date","end_date","reason","status","created_at") VALUES (4,8,'Casual Leave','2026-03-16','2026-03-19','test','Approved','2026-03-12 12:18:46');
INSERT INTO "leave_requests" ("id","employee_id","leave_type","start_date","end_date","reason","status","created_at") VALUES (5,9,'Casual Leave','2026-03-16','2026-03-18','test','Approved','2026-03-13 09:35:02');
INSERT INTO "leave_requests" ("id","employee_id","leave_type","start_date","end_date","reason","status","created_at") VALUES (6,4,'Casual Leave','2026-03-16','2026-03-18','test','Approved','2026-03-13 09:35:57');
CREATE UNIQUE INDEX idx_employee_id ON employees(employee_id);
COMMIT;
