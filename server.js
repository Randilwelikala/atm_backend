const express = require('express');
const cors = require('cors');
const session = require('express-session');
const app = express();

app.use(express.json());
app.use(session({
  secret: 'sessionForUserLogin',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 5 * 60 * 1000
  }
}));

app.use(cors({
  origin: 'http://localhost:3000', 
  credentials: true               
}));


const users = [
  { 
    name: 'User 1', 
    bankName: 'Smart Bank', 
    accountType: 'smartgen', 
    branch: 'Homagama', 
    accountNumber: '123456789012', 
    pin: '1234', 
    balance: 900000, 
    cardNumber: '1234123412341234', 
    mobile: '0711186189' 
  },
  { 
    name: 'User 2', 
    bankName: 'Smart Bank', 
    accountType: 'ran kekulu', 
    branch: 'Kottawa', 
    accountNumber: '123456789101', 
    pin: '4321', 
    balance: 2000, 
    cardNumber: '1235123512351235', 
    mobile: '0712345679'
  },
  { 
    name: 'User 3', 
    bankName: 'Prime Bank', 
    accountType: 'premium', 
    branch: 'Colombo', 
    accountNumber: '987654321098', 
    pin: '5678', 
    balance: 15000, 
    cardNumber: '9876987698769876', 
    mobile: '0771234567' 
  },
  { 
    name: 'User 4', 
    bankName: 'Future Bank', 
    accountType: 'standard', 
    branch: 'Galle', 
    accountNumber: '456789123456', 
    pin: '8765', 
    balance: 5000, 
    cardNumber: '4567456745674567', 
    mobile: '0759876543' 
  },
  { 
    name: 'User 5', 
    bankName: 'City Bank', 
    accountType: 'basic', 
    branch: 'Matara', 
    accountNumber: '321098765432', 
    pin: '1122', 
    balance: 7500, 
    cardNumber: '3210321032103210', 
    mobile: '0701234567' 
  }
];




const transactions = [];

function createTransaction(accountNumber, type, amount) {
  return { accountNumber, type, amount, timestamp: new Date() };
}



// ✅ Login endpoint (session set)
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

  if (!cardNumber) {
    return res.status(401).json({ success: false, message: 'Enter a card number' });
  }
  if (!pin) {
    return res.status(401).json({ success: false, message: 'Enter a pin number' });
  }

  const user = users.find(u => u.cardNumber === cardNumber.toString() && u.pin === pin);

  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid card number or PIN' });
  }

  if (cardNumber.toString().length !== 16) {
    return res.status(401).json({ success: false, message: 'Card number must be exactly 16 characters long.' });
  }
  return res.json({ success: true, balance: user.balance, accountNumber: user.accountNumber });
});

app.get('/balance/:accountNumber',  (req, res) => {
  const user = users.find(u => u.accountNumber === req.params.accountNumber);
  if (user) {
    res.json({ balance: user.balance });
  } else {
    res.status(404).json({ message: 'User not found' });
  }
});

app.post('/deposit',  (req, res) => {
  const { accountNumber, amount } = req.body;
  const user = users.find(u => u.accountNumber === accountNumber);
  const MAX_DEPOSIT = 50000;

  if (amount === undefined || amount === null) {
    return res.status(400).json({ message: 'Amount is required' });
  }
  if (amount < 100) {
    return res.status(400).json({ message: 'Amount must be greater than RS.100.00' });
  }
  if (amount > MAX_DEPOSIT) {
    return res.status(400).json({ message: `Deposit limit exceeded (max ${MAX_DEPOSIT})` });
  }
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  user.balance += amount;
  res.json({ balance: user.balance, message: 'Deposit successful' });
});

app.post('/withdraw',  (req, res) => {
  const maxWithdraw = 200000;
  const { accountNumber, amount } = req.body;
  const user = users.find(u => u.accountNumber === accountNumber);

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (user.balance < amount) {
    return res.status(400).json({ message: 'Insufficient balance' });
  }

  if (amount <= 100) {
    return res.status(400).json({ message: 'Amount must be greater than zero' });
  }

  if (amount > maxWithdraw) {
    return res.status(400).json({ message: `Withdraw limit exceeded (max ${maxWithdraw})` });
  }

  user.balance -= amount;
  res.json({ balance: user.balance, message: 'Withdraw successful' });
});

app.get('/user/:accountNumber',  (req, res) => {
  const user = users.find(u => u.accountNumber === req.params.accountNumber);
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ message: 'User not found' });
  }
});

app.post('/changepin',  (req, res) => {
  const { accountNumber, oldPin, newPin } = req.body;
  const user = users.find(u => u.accountNumber === accountNumber && u.pin === oldPin);

  if (!user) return res.status(400).json({ message: 'Invalid account number or old PIN' });
  if (newPin === oldPin) return res.status(400).json({ message: 'New PIN cannot be same as old PIN' });
  if (!/^\d{4}$/.test(newPin)) return res.status(400).json({ message: 'New PIN must be exactly 4 digits' });

  user.pin = newPin;
  res.json({ message: 'PIN changed successfully' });
});

app.post('/transfer',  (req, res) => {
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

app.post('/verify-mobile',  (req, res) => {
  const { mobile } = req.body;
  if (!/^07\d{8}$/.test(mobile)) {
    return res.status(400).json({ message: 'Invalid mobile number format' });
  }
  res.json({ otp: '1234' }); // Simulated OTP
});

// Simple in-memory store for OTPs for demo only
const otpStore = {};

// Generate and send OTP for cardless withdraw
app.post('/send-otp', (req, res) => {
  const { mobile } = req.body;
  if (!mobile || !/^07\d{8}$/.test(mobile)) {
    return res.status(400).json({ message: 'Invalid mobile number format' });
  }
  
  // Generate 4-digit OTP for testing (e.g., 1234)
  const otp = Math.floor(1000 + Math.random() * 9000).toString();

  // Store OTP against mobile number, expires after 5 minutes
  otpStore[mobile] = {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000
  };

  console.log(`Sending OTP ${otp} to mobile ${mobile}`); // For testing display in console

  res.json({ message: 'OTP sent successfully', otp }); // Sending OTP back in response for testing
});

// Verify OTP
app.post('/verify-otp', (req, res) => {
  const { mobile, otp } = req.body;
  if (!mobile || !otp) {
    return res.status(400).json({ message: 'Mobile and OTP are required' });
  }
  
  const record = otpStore[mobile];
  if (!record) {
    return res.status(400).json({ message: 'No OTP sent to this mobile' });
  }
  
  if (Date.now() > record.expiresAt) {
    delete otpStore[mobile];
    return res.status(400).json({ message: 'OTP expired' });
  }
  
  if (record.otp !== otp) {
    return res.status(400).json({ message: 'Invalid OTP' });
  }
  
  // OTP verified, delete it to prevent reuse
  delete otpStore[mobile];
  
  // For this demo, assume we also find the user's account number by mobile number
  // You can modify this logic depending on your user data
  const user = users.find(u => u.mobile === mobile);
  
  if (!user) {
    return res.status(404).json({ message: 'User not found for this mobile' });
  }
  
  // Send back success + user account number for frontend redirection
  res.json({ message: 'OTP verified successfully', accountNumber: user.accountNumber });
});


// Assuming users array with bankName as before

app.post('/transfer-same-bank', (req, res) => {
  const { from, to, amount } = req.body;

  const sender = users.find(u => u.accountNumber === from);
  const recipient = users.find(u => u.accountNumber === to);

  if (!sender) return res.status(404).json({ error: 'Sender account not found' });
  if (!recipient) return res.status(404).json({ error: 'Recipient account not found' });

  // Check if banks are the same
  if (sender.bankName !== recipient.bankName) {
    return res.status(400).json({ error: 'Accounts belong to different banks. Use the other bank transfer API.' });
  }

  if (sender.balance < amount) {
    return res.status(400).json({ error: 'Insufficient funds' });
  }

  // Deduct and add balance
  sender.balance -= amount;
  recipient.balance += amount;

  res.json({
    from,
    to,
    transferred: amount,
    senderNewBalance: sender.balance,
    bank: 'Same Bank',
  });
});

app.post('/transfer-other-bank', (req, res) => {
  const { from, to, amount } = req.body;

  const sender = users.find(u => u.accountNumber === from);
  const recipient = users.find(u => u.accountNumber === to);

  if (!sender) return res.status(404).json({ error: 'Sender account not found' });
  if (!recipient) return res.status(404).json({ error: 'Recipient account not found' });

  // Check if banks are different
  if (sender.bankName === recipient.bankName) {
    return res.status(400).json({ error: 'Both accounts belong to the same bank. Use the same bank transfer API.' });
  }

  if (sender.balance < amount) {
    return res.status(400).json({ error: 'Insufficient funds' });
  }

  // Deduct and add balance
  sender.balance -= amount;
  recipient.balance += amount;

  res.json({
    from,
    to,
    transferred: amount,
    senderNewBalance: sender.balance,
    bank: 'Other Bank',
  });
});



const PORT = 3001;
app.listen(PORT, () => console.log(`🚀 Backend running on http://localhost:${PORT}`));
