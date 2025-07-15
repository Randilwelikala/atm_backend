const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// In-memory user data
const users = [
  { name:'User 1',accountType:'smartgen',branch:'Homagama', accountNumber: '1234', pin: '1234', balance: 1000 },
  { name:'User 2',accountType:'ran kekulu',branch:'Kottawa', accountNumber: '4321', pin: '4321', balance: 2000 },
];

// Login endpoint
app.post('/login', (req, res) => {
  const { accountNumber, pin } = req.body;
  const user = users.find(u => u.accountNumber === accountNumber && u.pin === pin);
  if (user) {
    res.json({ success: true, balance: user.balance });
  } else {
    res.status(401).json({ success: false, message: 'Invalid card number or PIN' });
  }
});

// Get balance endpoint
app.get('/balance/:accountNumber', (req, res) => {
  const user = users.find(u => u.accountNumber === req.params.accountNumber);
  if (user) {
    res.json({ balance: user.balance });
  } else {
    res.status(404).json({ message: 'User not found' });
  }
});

// Deposit money
app.post('/deposit', (req, res) => {
  const { accountNumber, amount } = req.body;
  const user = users.find(u => u.accountNumber === accountNumber);
  if (user) {
    user.balance += amount;
    res.json({ balance: user.balance });
  } else {
    res.status(404).json({ message: 'User not found' });
  }
});

// Withdraw money
app.post('/withdraw', (req, res) => {
  const { accountNumber, amount } = req.body;
  const user = users.find(u => u.accountNumber === accountNumber);
  if (user) {
    if (user.balance >= amount) {
      user.balance -= amount;
      res.json({ balance: user.balance });
    } else {
      res.status(400).json({ message: 'Insufficient balance' });
    }
  } else {
    res.status(404).json({ message: 'User not found' });
  }
});

// Get user details by account number
app.get('/user/:accountNumber', (req, res) => {
    const user = users.find(u => u.accountNumber === req.params.accountNumber);
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ message: 'User not found' });
  }
});




const PORT = 3001;
app.listen(PORT, () => console.log(`🚀 Backend running on http://localhost:${PORT}`));
