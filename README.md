# Leave Management System

A simple Leave Management System built with React.js and Node.js for small offices.

## Features

### Employee Features
- Apply for leave (Casual, Sick, Paid)
- View leave balance
- Track leave history
- View leave status (Pending/Approved/Rejected)

### Manager Features
- Approve/Reject leave requests
- View all employee leave requests
- Employee management
- Leave reports

## Tech Stack

- Frontend: React.js
- Backend: Node.js + Express
- Database: MySQL
- Authentication: JWT

## Setup Instructions

### Prerequisites
- Node.js (v14+)
- MySQL (v5.7+)
- npm or yarn

### Database Setup

1. Create MySQL database:
```bash
mysql -u root -p < database/schema.sql
```

### Backend Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Update `.env` with your database credentials:
```
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=leave_management
JWT_SECRET=your_secret_key
```

4. Start the server:
```bash
npm run server
```

### Frontend Setup

1. Navigate to client folder and install dependencies:
```bash
cd client
npm install
```

2. Start the React app:
```bash
npm start
```

The app will run on http://localhost:3000

## Usage

### Default Accounts
After running the schema, you can create accounts via the Register page.

### Employee Workflow
1. Login with employee credentials
2. Navigate to "Apply Leave"
3. Fill in leave details and submit
4. Check status in "My Leaves"

### Manager Workflow
1. Login with manager credentials
2. Navigate to "Manage Leaves"
3. Approve or reject pending requests

## API Endpoints

### Authentication
- POST `/api/auth/register` - Register new user
- POST `/api/auth/login` - Login user
- GET `/api/auth/me` - Get current user

### Leaves
- POST `/api/leaves/apply` - Apply for leave
- GET `/api/leaves/my-leaves` - Get user's leaves
- GET `/api/leaves/balance` - Get leave balance
- GET `/api/leaves/all` - Get all leaves (Manager only)
- PUT `/api/leaves/:id/status` - Update leave status (Manager only)

### Employees
- GET `/api/employees` - Get all employees (Manager only)

## Project Structure

```
leave-management-system/
├── server/
│   ├── config/
│   │   └── db.js
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── leaves.js
│   │   └── employees.js
│   └── index.js
├── client/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Login.js
│   │   │   ├── Register.js
│   │   │   ├── Dashboard.js
│   │   │   ├── ApplyLeave.js
│   │   │   ├── MyLeaves.js
│   │   │   ├── LeaveBalance.js
│   │   │   ├── ManageLeaves.js
│   │   │   └── Navbar.js
│   │   ├── App.js
│   │   ├── index.js
│   │   └── index.css
│   └── package.json
├── database/
│   └── schema.sql
├── package.json
└── README.md
```

## License

MIT
