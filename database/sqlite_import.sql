PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS leave_requests;
DROP TABLE IF EXISTS leave_balance;
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS holidays;
DROP TABLE IF EXISTS employees;

CREATE TABLE employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(50) NOT NULL,
  email VARCHAR(50) NOT NULL,
  password VARCHAR(255) DEFAULT 'temp123',
  designation VARCHAR(50) DEFAULT NULL,
  role VARCHAR(50) DEFAULT 'employee',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  employee_id INTEGER DEFAULT NULL,
  contact_no VARCHAR(20) DEFAULT NULL,
  remarks TEXT,
  UNIQUE (email),
  UNIQUE (employee_id)
);

CREATE TABLE attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  date DATE NOT NULL,
  clock_in DATETIME DEFAULT NULL,
  clock_out DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  day VARCHAR(50) NOT NULL,
  purpose TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'General',
  number_of_days INTEGER DEFAULT 1,
  year INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE leave_balance (
  id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  earned_leave INTEGER DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE (employee_id),
  FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
);

CREATE TABLE leave_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  manager_id INTEGER DEFAULT NULL,
  leave_type VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  no_of_days INTEGER DEFAULT NULL,
  reason TEXT,
  status VARCHAR(50) DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE,
  FOREIGN KEY (manager_id) REFERENCES employees(employee_id) ON DELETE SET NULL
);

INSERT INTO employees VALUES (1,'Lalan Choudhury','chowdhruy.lalan@gmail.com','temp123','Office Executive','employee','2026-03-13 18:51:37',10033,'7890234826','');
INSERT INTO employees VALUES (2,'Manas Chattopadhyay','manas@beas.co.in','$2a$10$oT/joaAOKfMJ7rHmTgdJY.6xNFJyv6wtlm7oMoyq2ILE0fvoJB3Ei','Assistant General Manager','manager','2026-03-13 18:51:37',10117,'8240422047','');
INSERT INTO employees VALUES (3,'Snehasish Roy','snehasish.beas@gmail.com','temp123','Quality Consultant','employee','2026-03-13 18:51:37',10203,'9433731308','');
INSERT INTO employees VALUES (4,'Lalit Jha','lalitjha831@gmail.com','temp123','Driver','employee','2026-03-13 18:51:37',10225,'9007464109','');
INSERT INTO employees VALUES (5,'Amitava Sarkar','amitava_3297@yahoo.com','temp123','Senior Consultant','employee','2026-03-13 18:51:37',10319,'8296150521','');
INSERT INTO employees VALUES (6,'Debabrata Roy','roy.debabrata@rediffmail.com','temp123','Senior Systems Manager','employee','2026-03-13 18:51:37',10336,'9038398341','');
INSERT INTO employees VALUES (7,'Prodip Kumar Ghosal','prodipghosal655@hotmail.com','temp123','Chief Operations Officer','employee','2026-03-13 18:51:37',10406,'9831020678','');
INSERT INTO employees VALUES (8,'Ujjwal Kumar Sinha','usinha1968@gmail.com','temp123','Assistant General Manager','manager','2026-03-13 18:51:37',10452,'9874857234','');
INSERT INTO employees VALUES (9,'Subrata Kumar Mukherjee','subrata3277@gmail.com','temp123','Assistant General Manager','manager','2026-03-13 18:51:37',10453,'8583097497','');
INSERT INTO employees VALUES (10,'Suvrajit Pal','suvrajit15@gmail.com','temp123','Deputy Business Manager','employee','2026-03-13 18:51:37',10509,'9734354755','');
INSERT INTO employees VALUES (11,'Surojit Bera','surojitbera18@gmail.com','temp123','Senior. Ui/Ux Designer','employee','2026-03-13 18:51:37',10531,'7031704698','');
INSERT INTO employees VALUES (12,'Priyatosh Nath','priyatosh.nath@gmail.com','temp123','Project Director','employee','2026-03-13 18:51:37',10597,'9830262851','');
INSERT INTO employees VALUES (13,'Dipan Das','dipandas90@gmail.com','temp123','Principal Software Developer','employee','2026-03-13 18:51:37',10606,'9836041997','');
INSERT INTO employees VALUES (14,'Puspita Danda','mepuspita88@gmail.com','temp123','Senior Fronted Developer','employee','2026-03-13 18:51:37',10621,'6289062865','');
INSERT INTO employees VALUES (15,'Ankur Dey','ankur30dey@gmail.com','temp123','Sr. Systems Designer','employee','2026-03-13 18:51:37',10651,'9830958177','');
INSERT INTO employees VALUES (16,'Dibyakanta Sahoo','sahoodibyakanta67@gmail.com','temp123','System Designer','employee','2026-03-13 18:51:37',10658,'9178633460','');
INSERT INTO employees VALUES (17,'Shinjan Sardar','shnjnsrdr.1995@gmail.com','temp123','Senior Software Developer','employee','2026-03-13 18:51:37',10661,'9073400689','');
INSERT INTO employees VALUES (18,'Santanu Banerjee','sbanerjee2@yahoo.in','temp123','Security','employee','2026-03-13 18:51:37',10673,'8910773970','');
INSERT INTO employees VALUES (19,'Suvojit Pal','suvojit.pal2@live.com','temp123','Senior Software Developer','employee','2026-03-13 18:51:37',10681,'7890910513','');
INSERT INTO employees VALUES (20,'Motiur Rahaman Sardar','motiursardar.1991@gmail.com','temp123','Software Developer','employee','2026-03-13 18:51:37',10683,'9732622029','');
INSERT INTO employees VALUES (21,'Arundhati Amol Sutar','arundhati.sutar@hotmail.com','temp123','Systems Analyst','employee','2026-03-13 18:51:37',10684,'8805805860','');
INSERT INTO employees VALUES (22,'Chayan Samanta','chayansamanta@gmail.com','temp123','Systems Analyst','employee','2026-03-13 18:51:37',10685,'8927279789','');
INSERT INTO employees VALUES (23,'Vikash Pathak','vikashpathak00000@gmail.com','temp123','Software Developer','employee','2026-03-13 18:51:37',10686,'7003527263','');
INSERT INTO employees VALUES (24,'Gourab Kundu','gourab.kundu@beas.co.in','temp123','Analyst And Designer','employee','2026-03-13 18:51:37',10688,'9836790665','');
INSERT INTO employees VALUES (25,'Gourav Agarwal','gaurav.agarwal@beas.co.in','temp123','Analyst And Designer','employee','2026-03-13 18:51:37',10689,'9602891853','');
INSERT INTO employees VALUES (26,'Avishek Roy','avishek.roy@beas.co.in','temp123','Ast_ Mg Human Resources','employee','2026-03-13 18:51:37',10692,'8697310644','');
INSERT INTO employees VALUES (27,'Amit Banerjee','amit@beas.co.in','temp123','Senior Resource Manager','employee','2026-03-13 18:51:37',10709,'9831765023','');
INSERT INTO employees VALUES (28,'Nilanjan Ghosh','nilanjan.ghosh@beas.co.in','temp123','Principal Software Developer','employee','2026-03-13 18:51:37',10712,'8961431810','');
INSERT INTO employees VALUES (29,'Md Ahsamul Hoque','ahsamul.hoque@beas.co.in','temp123','Principal Software Developer','employee','2026-03-13 18:51:37',10718,'9614766456','');
INSERT INTO employees VALUES (30,'Tapu Jena','tapu.jena@beas.co.in','temp123','Senior Software Developer','employee','2026-03-13 18:51:37',10721,'7682021375','');
INSERT INTO employees VALUES (31,'Rajkumar Bag','rajkumar.bag@beas.co.in','temp123','Senior Software Tester','employee','2026-03-13 18:51:37',10731,'9153039952','');
INSERT INTO employees VALUES (32,'Gopinath Mukherjee','gopinath@beas.co.in','temp123','Analyst And Designer','employee','2026-03-13 18:51:37',10733,'8910194397','');
INSERT INTO employees VALUES (33,'Souvik Pal','souvik.pal@beas.co.in','temp123','Senior Software Developer','employee','2026-03-13 18:51:37',10737,'9038285750','');
INSERT INTO employees VALUES (34,'Pratik Kumar Saha','pratik.saha@beas.co.in','temp123','Software Developer','employee','2026-03-13 18:51:37',10740,'8017460145','');
INSERT INTO employees VALUES (35,'Dip Ganguli','dip.ganguli@beas.co.in','temp123','Senior Software Developer','employee','2026-03-13 18:51:37',10743,'9064810631','');
INSERT INTO employees VALUES (36,'Arpita Bairagi','arpita.bairagi@beas.co.in','temp123','Analyst And Designer','employee','2026-03-13 18:51:37',10748,'8910691787','');
INSERT INTO employees VALUES (37,'Rohan Raghoba Parab','rohan.parab@beas.co.in','temp123','Senior Software Developer','employee','2026-03-13 18:51:37',10750,'9527829697','');
INSERT INTO employees VALUES (38,'Sikandar Bhuimali','sikandarbhuimali007@gmail.com','temp123','Senior Software Developer','employee','2026-03-13 18:51:37',10752,'9330502108','');
INSERT INTO employees VALUES (39,'Sanjib Kumar Mukherjee','sanjib.475@rediffmail.com','temp123','Senior Accounts Officer','employee','2026-03-13 18:51:37',10753,'9432833715','');
INSERT INTO employees VALUES (40,'Sagar Kokande','kokande.sagar2712@gmail.com','temp123','Senior Software Developer','employee','2026-03-13 18:51:37',10756,'7387966254','');
INSERT INTO employees VALUES (41,'Shubham Sunil Kale','shubhamkale3103@gmail.com','temp123','Software Developer','employee','2026-03-13 18:51:37',10757,'9922854515','');
INSERT INTO employees VALUES (42,'Rashmi Mishra','rashmi.mishra2887@gmail.com','temp123','Senior Software Developer','employee','2026-03-13 18:51:37',10762,'7770026095','');
INSERT INTO employees VALUES (43,'Bharat Singh','singh.bharat1996@gmail.com','temp123','Senior Software Developer','employee','2026-03-13 18:51:37',10763,'8001451065','');
INSERT INTO employees VALUES (44,'Dillip Kumar Jena','java.dillipkumar@gmail.com','temp123','Senior Software Developer','employee','2026-03-13 18:51:37',10764,'8249038743','');
INSERT INTO employees VALUES (45,'Soumi Dhar','soumidhr@gmail.com','temp123','Technical Consultant','employee','2026-03-13 18:51:37',10768,'8820723330','');
INSERT INTO employees VALUES (46,'Nilasish Tewary','nilashis.tewary@gmail.com','temp123','Senior Software Developer','employee','2026-03-13 18:51:37',10770,'9679710532','');
INSERT INTO employees VALUES (47,'Rakesh Kumar Shaw','rakeshshaw134@gmail.com','temp123','Senior Software Developer','employee','2026-03-13 18:51:37',10771,'7003835800','');
INSERT INTO employees VALUES (48,'Arpita Bera','beraa5380@gmail.com','temp123','Senior Testing Engineer','employee','2026-03-13 18:51:37',10775,'8001017120','');
INSERT INTO employees VALUES (49,'Pravat Bera','pravatbera1995@gmail.com','temp123','Senior Software Developer','employee','2026-03-13 18:51:37',10777,'9851261010','');
INSERT INTO employees VALUES (50,'Tanmay Chiranjeeb Das','qatanmay8@gamil.com','temp123','Senior Software Tester','employee','2026-03-13 18:51:37',10778,'8247809016','');
INSERT INTO employees VALUES (51,'Dipankar Mallick','cse.dipankar@gmail.com','temp123','Deputy Business Manager','employee','2026-03-13 18:51:37',10787,'8981645347','');
INSERT INTO employees VALUES (52,'Urbashi Ghosh Dastidar','urbashi.sen@gmail.com','temp123','Senior Manager Resourcing','employee','2026-03-13 18:51:37',10788,'9433132814','');
INSERT INTO employees VALUES (53,'Raj Gupta','rkgupta0387@gmail.com','temp123','Senior Software Developer','employee','2026-03-13 18:51:37',10791,'7209380499','');
INSERT INTO employees VALUES (54,'Rudra Dey','rudradey1004@gmail.com','temp123','Software Developer','employee','2026-03-13 18:51:37',10796,'7003410418','');
INSERT INTO employees VALUES (55,'Pradipta De','pradipto4069@gmail.com','temp123','Senior Software Developer','employee','2026-03-13 18:51:37',10797,'7980736515','');
INSERT INTO employees VALUES (56,'Raj Dev Barman','iamrajdev1@gmail.com','temp123','Software Developer','employee','2026-03-13 18:51:37',10798,'8617654644','');
INSERT INTO employees VALUES (57,'Bhaskar Bandyopadhyay','bandyopadhyay.bhaskar81@gmail.com','temp123','Software Developer','employee','2026-03-13 18:51:37',10802,'9830300788','');
INSERT INTO employees VALUES (58,'UMA  BASU','uma_basu2001@yahoo.com','temp123','SENIOR SOFTWARE DEVELOPER','employee','2026-03-13 18:51:37',10805,'','');
INSERT INTO employees VALUES (59,'JAYANTA DHAR','jd1990.slg@live.com','temp123','SENIOR SOFTWARE DEVELOPER','employee','2026-03-13 18:51:37',10806,'','');
INSERT INTO employees VALUES (60,'DIPTAMOY SAYANAL','dipta20@gmail.com','$2a$10$GS2BxlvaQsBcL/pHIldQFeo86UDYLnJKxU1sNLvYzflLcIbHIZpK.','SENIOR SOFTWARE DEVELOPER','employee','2026-03-13 18:51:37',10812,'','');
INSERT INTO employees VALUES (61,'ABHISHEK DE','abhishek.de@beas.co.in','temp123','SOFTWARE DEVELOPER','employee','2026-03-13 18:51:37',10813,'','');
INSERT INTO employees VALUES (62,'Soumy  Mukhuty','soumy.mukhuty@gmail.com','temp123','SENIOR SOFTWARE DEVELOPER','employee','2026-03-13 18:51:37',10816,'9903025282','');
INSERT INTO employees VALUES (63,'DEBASIS KAYAL','debasiskayal1993@gmail.com','temp123','SENIOR SOFTWARE DEVELOPER','employee','2026-03-13 18:51:37',10818,'6290254046','');
INSERT INTO employees VALUES (64,'SOURAV PATRA','souravpatra396@gmail.com','temp123','SENIOR SOFTWARE DEVELOPER','employee','2026-03-13 18:51:38',10819,'','');
INSERT INTO employees VALUES (65,'TANMOY CHAKRABORTY','tanmoyc834@gmail.com','temp123','SOFTWARE DEVELOPER','employee','2026-03-13 18:51:38',10820,'8910133006','');
INSERT INTO employees VALUES (66,'Saheb Jana','saheb.jana@beas.co.in','temp123','SOFTWARE DEVELOPER','employee','2026-03-13 18:51:38',10821,'','');
INSERT INTO employees VALUES (67,'Manash Barai','manashjbarai@gmail.com','temp123','SOFTWARE DEVELOPER','employee','2026-03-13 18:51:38',10823,'7980689304','');
INSERT INTO employees VALUES (68,'Satya Prakash Ojha','satyaprakashojha42@gmail.com','temp123','Junior Software Develor','employee','2026-03-13 18:51:38',10828,'7992864665','');
INSERT INTO employees VALUES (69,'Rohan Rahaman','rohanrahaman786@gmail.com','temp123','SENIOR SOFTWARE DEVELOPER','employee','2026-03-13 18:51:38',10829,'8617043102','');
INSERT INTO employees VALUES (70,'Surajit Gouri','myselfsurajitgouri@gmail.com','temp123','SENIOR SOFTWARE DEVELOPER','employee','2026-03-13 18:51:38',10830,'7908316164','');
INSERT INTO employees VALUES (71,'Samiran Biswas','samiranbiswas124@gmail.com','temp123','SOFTWARE DEVELOPER','employee','2026-03-13 18:51:38',10827,'9851215184','');
INSERT INTO employees VALUES (72,'Barsha Podder','barsha.podder@beas.co.in','temp123','SOFTWARE DEVELOPER','employee','2026-03-13 18:51:38',10831,'9123360559','');
INSERT INTO employees VALUES (73,'Sudipta Maji','msudipta86@gmail.com','temp123','Senior Data Analyst','employee','2026-03-13 18:51:38',10833,'8145802403','');
INSERT INTO employees VALUES (74,'Shivam Kumar','shivamkumar590@gmail.com','temp123','SOFTWARE DEVELOPER','employee','2026-03-13 18:51:38',10835,'','');
INSERT INTO employees VALUES (75,'Sayak Ghosh','sayak21318@gmail.com','temp123','SOFTWARE DEVELOPER','employee','2026-03-13 18:51:38',10836,'9732114332','');
INSERT INTO employees VALUES (76,'SAIKAT SAHA','88saikat@gmail.com','temp123','SYSTEMS ANALYST','employee','2026-03-13 18:51:38',10837,'','');
INSERT INTO employees VALUES (77,'Ayesa Khatun','','temp123','SOFTWARE DEVELOPER','employee','2026-03-13 18:51:38',10838,'','');
INSERT INTO employees VALUES (78,'Priyanka Kamila','priyankakamila300@gmail.com','temp123','SENIOR SOFTWARE TESTER','employee','2026-03-13 18:51:38',10839,'9875351697','');
INSERT INTO employees VALUES (79,'Abhradeep Basu','abhradeep.digital@gmail.com','temp123','Senior Digital Marketing Executive','employee','2026-03-13 18:51:38',10840,'7003033860','');
INSERT INTO employees VALUES (80,'Rekha Rani Mandal','sourav20dba@gmail.com','temp123','Database Administrator','employee','2026-03-13 18:51:38',10841,'','');
INSERT INTO employees VALUES (81,'DURGABALA  MAITY','nabsmaity9@gmail.com','temp123','SOFTWARE DEVELOPER','employee','2026-03-13 18:51:38',10842,'','');
INSERT INTO employees VALUES (82,'Newajara Yasmin','umar9749@gmail.com','temp123','SOFTWARE DEVELOPER','employee','2026-03-13 18:51:38',10843,'','');
INSERT INTO employees VALUES (83,'Avik Roy Chowdhury','chowdhury_avik@outlook.com','temp123','SOFTWARE DEVELOPER','employee','2026-03-13 18:51:38',10844,'9163816865','');

INSERT INTO holidays VALUES (1,'2025-12-30','Thursday','New Year','General',1,2026,'2026-03-13 14:01:07');
INSERT INTO holidays VALUES (2,'2026-01-21','Friday','Vasanth Panchami / Netaji Birthday','Restricted',1,2026,'2026-03-13 14:01:07');
INSERT INTO holidays VALUES (3,'2026-01-24','Monday','Republic Day','General',1,2026,'2026-03-13 14:01:07');
INSERT INTO holidays VALUES (4,'2026-03-01','Tuesday','Doljatra','General',1,2026,'2026-03-13 14:01:07');
INSERT INTO holidays VALUES (5,'2026-04-01','Friday','Good Friday','General',1,2026,'2026-03-13 14:01:07');
INSERT INTO holidays VALUES (6,'2026-04-13','Wednesday','Bengali New Year','Restricted',1,2026,'2026-03-13 14:01:07');
INSERT INTO holidays VALUES (7,'2026-04-29','Friday','May Day','General',1,2026,'2026-03-13 14:01:07');
INSERT INTO holidays VALUES (8,'2026-05-25','Wednesday','Bakrid / Eid-ul-Zuha','Restricted',1,2026,'2026-03-13 14:01:07');
INSERT INTO holidays VALUES (9,'2026-06-24','Friday','Muharram','Restricted',1,2026,'2026-03-13 14:01:07');
INSERT INTO holidays VALUES (10,'2026-10-14','Friday','Maha Panchami (Durga Puja)','General',1,2026,'2026-03-13 14:01:07');
INSERT INTO holidays VALUES (11,'2026-10-17','Monday','Maha Ashtami (Durga Puja)','General',1,2026,'2026-03-13 14:01:07');
INSERT INTO holidays VALUES (12,'2026-10-18','Tuesday','Maha Navami (Durga Puja)','General',1,2026,'2026-03-13 14:01:07');
INSERT INTO holidays VALUES (13,'2026-10-19','Wednesday','Maha Dashami (Durga Puja)','General',1,2026,'2026-03-13 14:01:07');
INSERT INTO holidays VALUES (14,'2026-11-07','Monday','Kali Puja','General',1,2026,'2026-03-13 14:01:07');
INSERT INTO holidays VALUES (15,'2026-11-09','Wednesday','Bhatri Ditiya','Restricted',1,2026,'2026-03-13 14:01:07');
INSERT INTO holidays VALUES (16,'2026-12-23','Friday','Christmas','General',1,2026,'2026-03-13 14:01:07');

INSERT INTO leave_balance VALUES (1,10033,15);
INSERT INTO leave_balance VALUES (2,10117,11);
INSERT INTO leave_balance VALUES (3,10203,15);
INSERT INTO leave_balance VALUES (4,10225,15);
INSERT INTO leave_balance VALUES (5,10319,15);
INSERT INTO leave_balance VALUES (6,10336,15);
INSERT INTO leave_balance VALUES (7,10406,15);
INSERT INTO leave_balance VALUES (8,10452,15);
INSERT INTO leave_balance VALUES (9,10453,15);
INSERT INTO leave_balance VALUES (10,10509,15);
INSERT INTO leave_balance VALUES (11,10531,15);
INSERT INTO leave_balance VALUES (12,10597,15);
INSERT INTO leave_balance VALUES (13,10606,15);
INSERT INTO leave_balance VALUES (14,10621,15);
INSERT INTO leave_balance VALUES (15,10651,15);
INSERT INTO leave_balance VALUES (16,10658,15);
INSERT INTO leave_balance VALUES (17,10661,15);
INSERT INTO leave_balance VALUES (18,10673,15);
INSERT INTO leave_balance VALUES (19,10681,15);
INSERT INTO leave_balance VALUES (20,10683,15);
INSERT INTO leave_balance VALUES (21,10684,15);
INSERT INTO leave_balance VALUES (22,10685,15);
INSERT INTO leave_balance VALUES (23,10686,15);
INSERT INTO leave_balance VALUES (24,10688,15);
INSERT INTO leave_balance VALUES (25,10689,15);
INSERT INTO leave_balance VALUES (26,10692,15);
INSERT INTO leave_balance VALUES (27,10709,15);
INSERT INTO leave_balance VALUES (28,10712,15);
INSERT INTO leave_balance VALUES (29,10718,15);
INSERT INTO leave_balance VALUES (30,10721,15);
INSERT INTO leave_balance VALUES (31,10731,15);
INSERT INTO leave_balance VALUES (32,10733,15);
INSERT INTO leave_balance VALUES (33,10737,15);
INSERT INTO leave_balance VALUES (34,10740,15);
INSERT INTO leave_balance VALUES (35,10743,15);
INSERT INTO leave_balance VALUES (36,10748,15);
INSERT INTO leave_balance VALUES (37,10750,15);
INSERT INTO leave_balance VALUES (38,10752,15);
INSERT INTO leave_balance VALUES (39,10753,15);
INSERT INTO leave_balance VALUES (40,10756,15);
INSERT INTO leave_balance VALUES (41,10757,15);
INSERT INTO leave_balance VALUES (42,10762,15);
INSERT INTO leave_balance VALUES (43,10763,15);
INSERT INTO leave_balance VALUES (44,10764,15);
INSERT INTO leave_balance VALUES (45,10768,15);
INSERT INTO leave_balance VALUES (46,10770,15);
INSERT INTO leave_balance VALUES (47,10771,15);
INSERT INTO leave_balance VALUES (48,10775,15);
INSERT INTO leave_balance VALUES (49,10777,15);
INSERT INTO leave_balance VALUES (50,10778,15);
INSERT INTO leave_balance VALUES (51,10787,15);
INSERT INTO leave_balance VALUES (52,10788,15);
INSERT INTO leave_balance VALUES (53,10791,15);
INSERT INTO leave_balance VALUES (54,10796,15);
INSERT INTO leave_balance VALUES (55,10797,15);
INSERT INTO leave_balance VALUES (56,10798,15);
INSERT INTO leave_balance VALUES (57,10802,15);
INSERT INTO leave_balance VALUES (58,10805,15);
INSERT INTO leave_balance VALUES (59,10806,15);
INSERT INTO leave_balance VALUES (60,10812,11);
INSERT INTO leave_balance VALUES (61,10813,15);
INSERT INTO leave_balance VALUES (62,10816,15);
INSERT INTO leave_balance VALUES (63,10818,15);
INSERT INTO leave_balance VALUES (64,10819,15);
INSERT INTO leave_balance VALUES (65,10820,15);
INSERT INTO leave_balance VALUES (66,10821,15);
INSERT INTO leave_balance VALUES (67,10823,15);
INSERT INTO leave_balance VALUES (68,10828,15);
INSERT INTO leave_balance VALUES (69,10829,15);
INSERT INTO leave_balance VALUES (70,10830,15);
INSERT INTO leave_balance VALUES (71,10827,15);
INSERT INTO leave_balance VALUES (72,10831,15);
INSERT INTO leave_balance VALUES (73,10833,15);
INSERT INTO leave_balance VALUES (74,10835,15);
INSERT INTO leave_balance VALUES (75,10836,15);
INSERT INTO leave_balance VALUES (76,10837,15);
INSERT INTO leave_balance VALUES (77,10838,15);
INSERT INTO leave_balance VALUES (78,10839,15);
INSERT INTO leave_balance VALUES (79,10840,15);
INSERT INTO leave_balance VALUES (80,10841,15);
INSERT INTO leave_balance VALUES (81,10842,15);
INSERT INTO leave_balance VALUES (82,10843,15);
INSERT INTO leave_balance VALUES (83,10844,15);

INSERT INTO leave_requests VALUES (7,10812,10117,'Earned Leave','2026-03-16','2026-03-19',4,'test','Approved','2026-03-16 09:45:23');
INSERT INTO leave_requests VALUES (8,10812,10452,'Earned Leave','2026-03-22','2026-03-25',4,'test','Approved','2026-03-16 14:20:05');
INSERT INTO leave_requests VALUES (9,10117,10812,'Earned Leave','2026-03-31','2026-04-05',4,'test','Approved','2026-03-17 05:19:01');

PRAGMA foreign_keys = ON;
