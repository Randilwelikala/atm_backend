const express = require('express');
const cors = require('cors');
const session = require('express-session');
const app = express();

app.use(cors());
app.use(express.json());
app.use(session({
  secret: 'sessionForUserLogin',         
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 5 * 60 * 1000 
  }
}));

const users = [
  { name:'User 1',accountType:'smartgen',branch:'Homagama', accountNumber: '1234', pin: '1234', balance: 900000, cardNumber: '1234123412341234' },
  { name:'User 2',accountType:'ran kekulu',branch:'Kottawa', accountNumber: '4321', pin: '4321', balance: 2000, cardNumber: 1235123512351235},
];

const transactions = [];

function createTransaction(accountNumber, type, amount) {
  return { accountNumber, type, amount, timestamp: new Date() };
}
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

app.post('/cardLogin', (req, res) => {
  const { cardNumber, pin } = req.body;
  const user = users.find(u => u.cardNumber === cardNumber && u.pin === pin);
  if (user) {
    
  }
  if (user.cardNumber.length !== 16) {
    return res.status(401).json({ success: false, message: 'Card number must be exactly 16 characters long.' });
  }
  if (!cardNumber) {
    return res.status(401).json({ success: false, message: 'Enter a card number' });
  }
  if (!pin) {
    return res.status(401).json({ success: false, message: 'Enter a pin number' });
  } 
  if (user) {
    req.session.user = {cardNumber: user.cardNumber,accountNumber: user.accountNumber};
    return res.json({ success: true, balance: user.balance, accountNumber: user.accountNumber });
  }

  res.json({ success: true, balance: user.balance, accountNumber:user.accountNumber });
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
  const MAX_DEPOSIT = 50000; 
 
  if(amount === undefined || amount === null){
    return res.status(400).json({ message: 'Amount is required' });
  }
  if(amount < 100){
    return res.status(400).json({ message: 'Amount must be greater than RS.100.00' });
  }
  if (amount > MAX_DEPOSIT){
   return res.status(400).json({ message: `Deposit limit exceeded (max ${MAX_DEPOSIT})` });
  }
  if(!user){
    return res.status(404).json({ message: 'User not found' });
  }
  if(amount === undefined || amount === null){
    return res.status(400).json({ message: 'Amount is required' });
  }
  user.balance += amount;
  res.json({ balance: user.balance, message: 'Deposit successful' });

});


// Withdraw money
app.post('/withdraw', (req, res) => {
  const maxWithdraw=200000;
  const { accountNumber, amount } = req.body;
  const user = users.find(u => u.accountNumber === accountNumber);

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (user.balance < amount) {
    return res.status(400).json({ message: 'Insufficient balance' });
  } 

  if(amount <= 100){
    return res.status(400).json({ message: 'Amount must be greater than zero' });
  }
  if (amount > maxWithdraw){
   return res.status(400).json({ message: `Deposit limit exceeded (max ${MAX_DEPOSIT})` });
  }

  user.balance -= amount;
  res.json({ balance: user.balance, message: 'Withdraw successful' });
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