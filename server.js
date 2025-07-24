const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const app = express();
const path = require('path');       
     


function generateTransactionId() {
  return 'TXN' + Date.now() + Math.floor(Math.random() * 10000);
}



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

const atmCash = {
    5000: 10,
    2000: 20,
    1000: 50,
    500: 100,
    100: 200,
    50: 100
  };
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

const dbFile = path.join(__dirname, 'transactions.json');
const adapter = new JSONFile(dbFile);
const db = new Low(adapter, { transactions: [] });


async function initDB() {
  await db.read();
  if (!db.data) {
    db.data = { transactions: [] };
    await db.write();
  }
}


function createTransaction(accountNumber, type, amount) {
  return { 
    id: `TXN${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`,
    accountNumber, 
    type, 
    amount, 
    timestamp: new Date().toISOString() 
  };
}



const transactions = [];




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




app.post('/deposit', async (req, res) => {
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
  // res.json({ balance: user.balance, message: 'Deposit successful' });

  const txn = {
    id: `TXN${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`,
    accountNumber,
    type: 'deposit',
    amount,
    balanceAfter: user.balance,
    timestamp: new Date().toISOString(),
    status: 'success',
    breakdown: {}
  };

  await db.read();
  db.data.transactions.push(txn);
  await db.write();

  // transactions.push(txn);

  res.json({
    balance: user.balance,
    message: 'Deposit successful',
    breakdown,
    transactionId: txn.id
  });
});




app.post('/withdraw',async (req, res) => {
  const maxWithdraw = 200000;
  const { accountNumber, amount } = req.body;
  const user = users.find(u => u.accountNumber === accountNumber);

  if (!user) return res.status(404).json({ message: 'User not found' });
  if (user.balance < amount) return res.status(400).json({ message: 'Insufficient balance' });
  if (amount <= 100) return res.status(400).json({ message: 'Amount must be greater than zero' });
  if (amount > maxWithdraw) return res.status(400).json({ message: `Withdraw limit exceeded (max ${maxWithdraw})` });

  const denominations = [5000, 2000, 1000, 500, 100, 50];
  let remaining = amount;
  const breakdown = {};
  const tempATM = { ...atmCash };

  for (let note of denominations) {
    const needed = Math.floor(remaining / note);
    const available = tempATM[note];

    if (needed > 0 && available > 0) {
      const count = Math.min(needed, available);
      breakdown[note] = count;
      remaining -= count * note;
      tempATM[note] -= count;
    }
  }

  if (remaining > 0) {
    return res.status(400).json({ message: 'ATM does not have enough notes to fulfill this request' });
  }

  for (let note in breakdown) {
    atmCash[note] -= breakdown[note];
  }

  user.balance -= amount;
  const txn = {
    id: `TXN${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`,
    accountNumber,
    type: 'withdraw',
    amount,
    balanceAfter: user.balance,
    timestamp: new Date().toISOString(),
    status: 'success',
    breakdown
  };

  await db.read();
  db.data.transactions.push(txn);
  await db.write();

  // transactions.push(txn);

  res.json({
    balance: user.balance,
    message: 'Withdraw successful',
    breakdown,
    transactionId: txn.id
  });

  
});





// app.get('/transactions/:accountNumber', async (req, res) => {
//   const { accountNumber } = req.params;
//   await db.read();

//   const txns = db.data.transactions.filter(t =>
//     t.accountNumber === accountNumber || t.from === accountNumber || t.to === accountNumber
//   );

//   const formatted = txns.map(t => {
//     if (t.from === accountNumber) {
//       return {
//         ...t,
//         direction: 'debit',
//         displayAmount: `-${t.amount}`
//       };
//     } else if (t.to === accountNumber) {
//       return {
//         ...t,
//         direction: 'credit',
//         displayAmount: `+${t.amount}`
//       };
//     } else if (t.accountNumber === accountNumber) {
//       const isDeposit = t.type.toLowerCase().includes('deposit') || t.type.toLowerCase().includes('in');
//       return {
//         ...t,
//         direction: isDeposit ? 'credit' : 'debit',
//         displayAmount: (isDeposit ? '+' : '-') + t.amount
//       };
//     } else {
//       return t; // fallback
//     }
//   });

//   res.json(formatted);
// });







app.get('/transactions/:accountNumber', (req, res) => {
  const accountNumber = req.params.accountNumber;

  const userTransactions = transactions.filter(
    txn => txn.from === accountNumber || txn.to === accountNumber
  );

  // Optional: Format with status and balance type
  const formatted = userTransactions.map((txn, index) => ({
    type: txn.from === accountNumber ? 'transfer-out' : 'transfer-in',
    amount: txn.amount,
    status: txn.status,
    time: txn.timestamp,
    from: txn.from,
    to: txn.to
  }));

  res.json(formatted);
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
  res.json({ message: 'PIN changed successfull' });
});




// app.post('/transfer', async (req, res) => {
//   const { from, to, amount } = req.body;
//   if (from === to) return res.status(400).json({ message: 'Cannot transfer to the same account' });

//   const sender = users.find(u => u.accountNumber === from);
//   const receiver = users.find(u => u.accountNumber === to);

//   if (!sender || !receiver) return res.status(404).json({ message: 'Invalid account number' });
//   if (sender.balance < amount) return res.status(400).json({ message: 'Insufficient funds' });

//   sender.balance -= amount;
//   receiver.balance += amount;

//   const timestamp = new Date().toISOString();

//   // Prepare transactions
//   const senderTxn = {
//     id: `TXN${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`,
//     accountNumber: from,
//     type: 'transfer-out',
//     amount,
//     balanceAfter: sender.balance,
//     timestamp,
//     status: 'success',
//     to,
//   };

//   const receiverTxn = {
//     id: `TXN${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`,
//     accountNumber: to,
//     type: 'transfer-in',
//     amount,
//     balanceAfter: receiver.balance,
//     timestamp,
//     status: 'success',
//     from,
//   };

//   // Write transactions to DB
//   await db.read();
//   if (!db.data) {
//     db.data = { transactions: [] };
//   }
//   db.data.transactions.push(senderTxn, receiverTxn);
//   await db.write();

//   // Send response only once here
//   res.json({
//     message: 'Transfer successful',
//     senderBalance: sender.balance,
//     receiverBalance: receiver.balance,
//     transactions: [senderTxn, receiverTxn],
//   });
// });

app.post('/verify-mobile',  (req, res) => {
  const { mobile } = req.body;
  if (!/^07\d{8}$/.test(mobile)) {
    return res.status(400).json({ message: 'Invalid mobile number format' });
  }
  res.json({ otp: '1234' }); 
});


const otpStore = {};





app.post('/transfer', (req, res) => {
  const { sender, receiver, amount } = req.body;

  if (!sender || !receiver || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const senderAcc = accounts.find(acc => acc.number === sender);
  const receiverAcc = accounts.find(acc => acc.number === receiver);

  if (!senderAcc || !receiverAcc) {
    return res.status(404).json({ error: 'Account not found' });
  }

  if (senderAcc.balance < amount) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }

  // Perform transfer
  senderAcc.balance -= amount;
  receiverAcc.balance += amount;

  const txn = {
    id: generateTransactionId(),
    from: sender,
    to: receiver,
    amount,
    timestamp: new Date(),
    status: 'success'
  };

  transactions.push(txn);

  res.json({ message: 'Transfer successful', transaction: txn });
});



app.post('/send-otp', (req, res) => {
  const { mobile } = req.body;
  if (!mobile || !/^07\d{8}$/.test(mobile)) {
    return res.status(400).json({ message: 'Invalid mobile number format' });
  }
  

  const otp = Math.floor(1000 + Math.random() * 9000).toString();

  otpStore[mobile] = {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000
  };

  console.log(`Sending OTP ${otp} to mobile ${mobile}`); 

  res.json({ message: 'OTP sent successfully', otp }); 
});





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
  
   delete otpStore[mobile];
  
  
  const user = users.find(u => u.mobile === mobile);
  
  if (!user) {
    return res.status(404).json({ message: 'User not found for this mobile' });
  }
  
  
  res.json({ message: 'OTP verified successfully', accountNumber: user.accountNumber });
});





app.post('/transfer-same-bank', async (req, res) => {
  const { from, to, amount } = req.body;

  const sender = users.find(u => u.accountNumber === from);
  const recipient = users.find(u => u.accountNumber === to);

  if (!sender) return res.status(404).json({ error: 'Sender account not found' });
  if (!recipient) return res.status(404).json({ error: 'Recipient account not found' });

 
  if (sender.bankName !== recipient.bankName) {
    return res.status(400).json({ error: 'Accounts belong to different banks. Use the other bank transfer API.' });
  }

  if (sender.balance < amount) {
    return res.status(400).json({ error: 'Insufficient funds' });
  }
 
  sender.balance -= amount;
  recipient.balance += amount;

  // res.json({
  //   from,
  //   to,
  //   transferred: amount,
  //   senderNewBalance: sender.balance,
  //   bank: 'Same Bank',
  // });

await db.read();
if (!db.data) db.data = { transactions: [] };


const timestamp = new Date().toISOString();

const senderTxn = {
  id: `TXN${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`,
  accountNumber: from,
  type: 'transfer-out',
  amount,
  balanceAfter: sender.balance,
  timestamp,
  status: 'success',
  to,
};

const receiverTxn = {
  id: `TXN${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`,
  accountNumber: to,
  type: 'transfer-in',
  amount,
  balanceAfter: recipient.balance,
  timestamp,
  status: 'success',
  from,
};

db.data.transactions.push(senderTxn, receiverTxn);
await db.write();

res.json({
    message: 'Transfer successful',
    senderBalance: sender.balance,
    receiverBalance: recipient.balance,
    transactions: [senderTxn, receiverTxn],
  });
  
});






app.post('/transfer-other-bank', async (req, res) => {
  const { from, to, amount } = req.body;

  const sender = users.find(u => u.accountNumber === from);
  const recipient = users.find(u => u.accountNumber === to);

  if (!sender) return res.status(404).json({ error: 'Sender account not found' });
  if (!recipient) return res.status(404).json({ error: 'Recipient account not found' });


  if (sender.bankName === recipient.bankName) {
    return res.status(400).json({ error: 'Both accounts belong to the same bank. Use the same bank transfer API.' });
  }

  if (sender.balance < amount) {
    return res.status(400).json({ error: 'Insufficient funds' });
  }

  sender.balance -= amount;
  recipient.balance += amount;  


await db.read();
 if (!db.data) db.data = { transactions: [] };

const timestamp = new Date().toISOString();

const senderTxn = {
  id: `TXN${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`,
  accountNumber: from,
  type: 'transfer-out',
  amount,
  balanceAfter: sender.balance,
  timestamp,
  status: 'success',
  to,
};

const receiverTxn = {
  id: `TXN${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`,
  accountNumber: to,
  type: 'transfer-in',
  amount,
  balanceAfter: recipient.balance,
  timestamp,
  status: 'success',
  from,
};

db.data.transactions.push(senderTxn, receiverTxn);
await db.write();

  // transactions.push(txn);

 res.json({
  message: 'Transfer successful',
  senderBalance: sender.balance,
  receiverBalance: recipient.balance,
  transactions: [senderTxn, receiverTxn]
});

});



async function startServer() {
  await initDB();

  const PORT = 3001;
  app.listen(PORT, () => console.log(`🚀 Backend running on http://localhost:${PORT}`));
}

startServer();