const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const users = [
  { name:'User 1',accountType:'smartgen',branch:'Homagama', accountNumber: '1234', pin: '1234', balance: 1000, cardNumber: 1234123412341234 },
  { name:'User 2',accountType:'ran kekulu',branch:'Kottawa', accountNumber: '4321', pin: '4321', balance: 2000, cardNumber: 1235123512351235},
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

  if (!user) return res.status(404).json({ message: 'User not found' });
  if (amount > 50000) return res.status(400).json({ message: 'Deposit limit exceeded (max 50,000)' });

  user.balance += amount;
  const tx = createTransaction(accountNumber, 'deposit', amount);
  transactions.push(tx);

  res.json({ balance: user.balance, receipt: tx });
});


// Withdraw money
app.post('/withdraw', (req, res) => {
  const { accountNumber, amount } = req.body;
  const user = users.find(u => u.accountNumber === accountNumber);

  if (!user) return res.status(404).json({ message: 'User not found' });

  if (user.balance < amount) {
    return res.status(400).json({ message: 'Insufficient balance' });
  }

  const denominations = [5000, 1000, 500, 50, 20];
  const notesToDispense = {};
  let remaining = amount;

  for (const denom of denominations) {
    const available = atmCash[denom];
    const count = Math.min(Math.floor(remaining / denom), available);
    if (count > 0) {
      notesToDispense[denom] = count;
      remaining -= denom * count;
    }
  }

  if (remaining !== 0) {
    return res.status(400).json({ message: 'Cannot dispense amount with available denominations' });
  }

  // Update ATM cash
  for (const denom in notesToDispense) {
    atmCash[denom] -= notesToDispense[denom];
  }

  // Deduct and record transaction
  user.balance -= amount;
  const tx = createTransaction(accountNumber, 'withdraw', amount);
  transactions.push(tx);

  res.json({ balance: user.balance, receipt: tx, notes: notesToDispense });
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

// Change PIN
app.post('/changepin', (req, res) => {
  const { accountNumber, oldPin, newPin } = req.body;
  const user = users.find(u => u.accountNumber === accountNumber && u.pin === oldPin);

  if (!user) return res.status(400).json({ message: 'Invalid account number or old PIN' });
  if (newPin === oldPin) return res.status(400).json({ message: 'New PIN cannot be same as old PIN' });

  user.pin = newPin;
  res.json({ message: 'PIN changed successfully' });
});

//get transaction history
app.get('/transactions/:accountNumber', (req, res) => {
  const { accountNumber } = req.params;
  const userTxs = transactions.filter(tx => tx.accountNumber === accountNumber);
  res.json(userTxs);
});


app.post('/transfer', (req, res) => {
  const { from, to, amount } = req.body;
  if (from === to) return res.status(400).json({ message: 'Cannot transfer to the same account' });

  const sender = users.find(u => u.accountNumber === from);
  const receiver = users.find(u => u.accountNumber === to);

  if (!sender || !receiver) return res.status(404).json({ message: 'Invalid account number' });
  if (sender.balance < amount) return res.status(400).json({ message: 'Insufficient funds' });

  sender.balance -= amount;
  receiver.balance += amount;

  const tx = createTransaction(from, 'transfer-out', amount);
  const rx = createTransaction(to, 'transfer-in', amount);
  transactions.push(tx, rx);

  res.json({ message: 'Transfer successful', senderBalance: sender.balance });
});


// OTP
app.post('/verify-mobile', (req, res) => {
  const { mobile } = req.body;
  if (!/^07\d{8}$/.test(mobile)) {
    return res.status(400).json({ message: 'Invalid mobile number format' });
  }
  res.json({ otp: '1234' }); // Simulated OTP
});




const PORT = 3001;
app.listen(PORT, () => console.log(`🚀 Backend running on http://localhost:${PORT}`));