const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const app = express();
const path = require('path');
const jwt = require('jsonwebtoken');
const { sendEmailReceipt } = require('./emailService');
const axios = require('axios');




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

const SECRET_KEY = 'your_secret_key';


const exchangeRates = {
  USD: 350,
  EUR: 370,
  GBP: 430,
};

const atmCash = {
    5000: 10,
    2000: 20,
    1000: 50,
    500: 41,
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
    mobile: '0711186189', 
    countyr:'Sri Lanka',
    email:"randilgimantha646@gmail.com"
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

const admins = [

  { name: 'admin1',
    id: 'admin1', 
    password: 'admin1',
    adminEmails:'randilgimantha646@gmail.com'
  }  
];

const dbFile = path.join(__dirname, 'transactions.json');
const adapter = new JSONFile(dbFile);
const db = new Low(adapter, { transactions: [] });
const adminEmails = admins.map(admin => admin.adminEmails);



function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token missing' });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token invalid' });
    req.user = user; 
    next();
  });
}

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



app.post('/auth', (req, res) => {
  const { accountNumber } = req.body;

  const user = users.find(u => u.accountNumber === accountNumber);

  if (!user) {
    return res.status(401).json({ message: 'Invalid account number' });
  }

  
  const payload = {
    accountNumber: user.accountNumber,
    name: user.name,
  };

  const token = jwt.sign(payload, SECRET_KEY, { expiresIn: '1h' });

  res.json({ token });
});

app.listen(3001, () => {
  console.log('Server started on port 3001');
});




app.post('/login', (req, res) => {
  const { accountNumber, pin } = req.body;
  const user = users.find(u => u.accountNumber === accountNumber && u.pin === pin);
  if (user) {    
    
     const token = jwt.sign({ id: user.id, accountNumber }, SECRET_KEY, { expiresIn: '1h' }); 
     res.json({ success: true, balance: user.balance,token }); 
     return res.json({ token });  
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
  

  const generatedToken = jwt.sign(
    { cardNumber: user.cardNumber, accountNumber: user.accountNumber },
    'your_secret_key', 
    { expiresIn: '1h' }
  );

  return res.json({
    success: true,
    balance: user.balance,
    accountNumber: user.accountNumber,
    token: generatedToken
  });
});




app.get('/balance/:accountNumber',authenticateToken,  (req, res) => {
  const user = users.find(u => u.accountNumber === req.params.accountNumber);
  if (user) {
    res.json({ balance: user.balance });
  } else {
    res.status(404).json({ message: 'User not found' });
  }
});




app.post('/deposit', authenticateToken, async (req, res) => {
  const { email, accountNumber, amount, } = req.body;
  const MAX_DEPOSIT = 50000;

  try {
    if (!accountNumber) return res.status(400).json({ message: 'Account number is required' });
    if (amount === undefined || amount === null || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }
    if (amount < 100) return res.status(400).json({ message: 'Amount must be greater than RS.100.00' });
    if (amount > MAX_DEPOSIT) return res.status(400).json({ message: `Deposit limit exceeded (max ${MAX_DEPOSIT})` });

    const user = users.find(u => u.accountNumber === accountNumber);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.balance += amount;

    const subject = 'Deposit Receipt - YourBankName';
    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Colombo' });

    const message = `
      Dear Customer,

      This is a confirmation of your recent deposit.

      Transaction Details:
      ---------------------
      Date & Time     : ${now}
      Account Number  : ${accountNumber}
      Deposited Amount: Rs.${amount}.00

      New Balance    : Rs.${user.balance}.00

      Thank you for banking with us.
      YourBankName
    `.trim();

    const userEmail = email || user.email;
    if (!userEmail) {
      console.warn('No email provided or found, skipping email sending.');
    } else {
      try {
        await sendEmailReceipt(userEmail, subject, message);
      } catch (emailError) {
        console.error('Failed to send deposit email:', emailError);
      }
    }

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

    res.json({
      balance: user.balance,
      message: 'Deposit successful',
      breakdown: {},
      transactionId: txn.id
    });
  } catch (error) {
    console.error('Error during deposit:', error);
    res.status(500).json({ message: "Something went wrong" });
  }
});



app.post('/withdraw', authenticateToken, async (req, res) => {
  const maxWithdraw = 200000;
  try {
    const { email, accountNumber, amount, denominations: selectedDenominations } = req.body;

    if (!accountNumber) return res.status(400).json({ message: 'Account number is required' });
    if (!amount || typeof amount !== 'number' || amount <= 0) return res.status(400).json({ message: 'Invalid amount' });

    const user = users.find(u => u.accountNumber === accountNumber);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.balance < amount) return res.status(400).json({ message: 'Insufficient balance' });
    if (amount <= 100) return res.status(400).json({ message: 'Amount must be greater than RS.100.00' });
    if (amount > maxWithdraw) return res.status(400).json({ message: `Withdraw limit exceeded (max ${maxWithdraw})` });

    if (!selectedDenominations || !Array.isArray(selectedDenominations) || selectedDenominations.length === 0) {
      return res.status(400).json({ message: 'Please select at least one denomination' });
    }

    let remaining = amount;
    const breakdown = {};
    const tempATM = { ...atmCash };

    const sortedSelected = selectedDenominations.map(Number).sort((a, b) => b - a);

    for (let note of sortedSelected) {
      const needed = Math.floor(remaining / note);
      const available = tempATM[note] || 0;

      if (needed > 0 && available > 0) {
        const count = Math.min(needed, available);
        breakdown[note] = count;
        remaining -= count * note;
        tempATM[note] -= count;
      }
    }

    if (remaining > 0) {
      return res.status(400).json({ message: 'ATM does not have enough selected notes to fulfill this request' });
    }
    
    for (let note in breakdown) {
      atmCash[note] -= breakdown[note];
    }
    try {
      await axios.post('http://localhost:3001/check-atm-cash');
    } catch (err) {
      console.error('ATM cash check failed:', err.message);
    }
    
    user.balance -= amount;

    const subject = 'ATM Withdrawal Receipt - YourBankName';
    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Colombo' });

    const breakdownText = Object.entries(breakdown)
      .map(([note, count]) => `Rs.${note} x ${count} = Rs.${note * count}`)
      .join('\n');

    const message = `
      Dear Customer,

      This is a confirmation of your recent ATM withdrawal.

      Transaction Details:
      ---------------------
      Date & Time     : ${now}
      Account Number  : ${accountNumber}
      Withdrawn Amount: Rs.${amount}.00
      Note Breakdown  :
      ${breakdownText}

      Remaining Balance: Rs.${user.balance}.00

      Thank you for banking with us.
      YourBankName
      `.trim();

   
    const userEmail = email || user.email;
    if (!userEmail) {
      console.warn('No email provided or found, skipping email sending.');
    } else {
      try {
        await sendEmailReceipt(userEmail, subject, message);
      } catch (emailError) {
        console.error('Failed to send withdrawal email:', emailError);       
      }
    }

    return res.json({
      message: 'Withdraw successful',
      balance: user.balance,
      breakdown,
    });

  } catch (error) {
    console.error('Error during withdrawal:', error);
    res.status(500).json({ message: "Something went wrong" });
  }
});


app.get('/transactions/:accountNumber', authenticateToken,async (req, res) => {
  const { accountNumber } = req.params;
  await db.read();

  const txns = db.data.transactions.filter(t =>
    t.accountNumber === accountNumber || t.from === accountNumber || t.to === accountNumber
  );

  const formatted = txns.map(t => {
    if (t.from === accountNumber) {
      return {
        ...t,
        direction: 'debit',
        displayAmount: `-${t.amount}`
      };
    } else if (t.to === accountNumber) {
      return {
        ...t,
        direction: 'credit',
        displayAmount: `+${t.amount}`
      };
    } else if (t.accountNumber === accountNumber) {
      const isDeposit = t.type.toLowerCase().includes('deposit') || t.type.toLowerCase().includes('in');
      return {
        ...t,
        direction: isDeposit ? 'credit' : 'debit',
        displayAmount: (isDeposit ? '+' : '-') + t.amount
      };
    } else {
      return t; 
    }
  });

  res.json(formatted);
});


app.get('/user/:accountNumber', authenticateToken, (req, res) => {
  const accountNumber = req.params.accountNumber;
  if (req.user.accountNumber !== accountNumber) {
    return res.status(403).json({ message: 'Access denied' });
  }

  const user = users.find(u => u.accountNumber === accountNumber);
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ message: 'User not found' });
  }
});




app.post('/changepin', authenticateToken, async (req, res) => {
  const { accountNumber, oldPin, newPin,} = req.body;
  const user = users.find(u => u.accountNumber === accountNumber && u.pin === oldPin);

  if (!user) return res.status(400).json({ message: 'Invalid account number or old PIN' });
  if (newPin === oldPin) return res.status(400).json({ message: 'New PIN cannot be same as old PIN' });
  if (!/^\d{4}$/.test(newPin)) return res.status(400).json({ message: 'New PIN must be exactly 4 digits' });

  user.pin = newPin;

 
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: user.email,
    subject: 'ATM PIN Changed',
    text: `Dear Customer,\n\nYour ATM PIN was successfully changed for account ${user.accountNumber}.\n\nIf you did not perform this action, please contact support immediately.\n\nThank you.`
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ message: 'PIN changed successfully and email sent' });
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ message: 'PIN changed but email failed to send' });
  }
});





app.post('/transfer',authenticateToken, async (req, res) => {
  const { from, to, amount } = req.body;
  if (from === to) return res.status(400).json({ message: 'Cannot transfer to the same account' });

  const sender = users.find(u => u.accountNumber === from);
  const receiver = users.find(u => u.accountNumber === to);

  if (!sender || !receiver) return res.status(404).json({ message: 'Invalid account number' });
  if (sender.balance < amount) return res.status(400).json({ message: 'Insufficient funds' });

  sender.balance -= amount;
  receiver.balance += amount;

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
    balanceAfter: receiver.balance,
    timestamp,
    status: 'success',
    from,
  };

  await db.read();
  if (!db.data) {
    db.data = { transactions: [] };
  }
  db.data.transactions.push(senderTxn, receiverTxn);
  await db.write();
 
  res.json({
    message: 'Transfer successful',
    senderBalance: sender.balance,
    receiverBalance: recipient .balance,
    transactions: [senderTxn, receiverTxn],
  });
});

require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});


app.post('/verify-mobile',  (req, res) => {
  const { mobile } = req.body;
  if (!/^07\d{8}$/.test(mobile)) {
    return res.status(400).json({ message: 'Invalid mobile number format' });
  }
  res.json({ otp: '1234' }); 
});


const otpStore = {};




app.post('/send-otp', (req, res) => {
  const { email } = req.body;

  if (!email || !/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  const otp = Math.floor(1000 + Math.random() * 9000).toString();

  otpStore[email] = {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000
  };

  
  const mailOptions = {
    from: 'rangran425@gmail.com',    
    to: email,
    subject: 'Your OTP Code',
    text: `Your OTP is ${otp}. It will expire in 5 minutes.`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
      return res.status(500).json({ message: 'Failed to send OTP email' });
    }
    console.log(`Sending OTP ${otp} to email ${email}`); 
    res.json({ message: 'OTP sent successfully to email',otp });
   
  });
});


app.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and OTP are required' });
  }

  const record = otpStore[email];
  if (!record) {
    return res.status(400).json({ message: 'No OTP sent to this email' });
  }

  if (Date.now() > record.expiresAt) {
    delete otpStore[email];
    return res.status(400).json({ message: 'OTP expired' });
  }

  if (record.otp !== otp) {
    return res.status(400).json({ message: 'Invalid OTP' });
  }

  delete otpStore[email];

  // Optional: check if user exists
  const user = users.find(u => u.email === email); // assuming 'users' exists
  if (!user) {
    return res.status(404).json({ message: 'User not found for this email' });
  }

  const token = jwt.sign({ accountNumber: user.accountNumber }, SECRET_KEY, { expiresIn: '1h' });

  res.json({ message: 'OTP verified successfully', email: user.email, token,accountNumber: user.accountNumber });
});




app.post('/transfer-same-bank', authenticateToken, async (req, res) => {
  const { email, from, to, amount } = req.body;

  const sender = users.find(u => u.accountNumber === from);
  const recipient = users.find(u => u.accountNumber === to);

  if (!sender) return res.status(404).json({ error: 'Sender account not found' });
  if (!recipient) return res.status(404).json({ error: 'Recipient account not found' });

  if (sender.bankName !== recipient.bankName) {
    return res.status(400).json({ error: 'You can do this transaction by using Other Bank Transfer Section' });
  }

  if (sender.balance < amount) {
    return res.status(400).json({ error: 'Insufficient funds' });
  }

  sender.balance -= amount;
  recipient.balance += amount;

  await db.read();

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

  // Send email
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email || sender.email,
    subject: 'Fund Transfer Receipt',
    text: `Dear Customer,\n\nYou have successfully transferred Rs.${amount} from account ${from} to account ${to} on ${new Date().toLocaleString()}.\n\nThank you for using our service.`
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Email sending failed:', error);
    // Email failure is not critical, do not interrupt transaction
  }

  res.json({
    message: 'Transfer successful',
    senderBalance: sender.balance,
    recipientBalance: recipient.balance,
    transactions: [senderTxn, receiverTxn],
    from,
    to,
    transferred: amount,
    bank: 'Same Bank',
    senderNewBalance: sender.balance,
    senderName: sender.name,
    recipientName: recipient.name,
    transactionId: senderTxn.id,
    timestamp,
    senderBankName: sender.bankName,
    recipientBankName: recipient.bankName,
  });
});




app.post('/transfer-other-bank',authenticateToken, async (req, res) => {
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
  recipientBalance: recipient.balance,
  transactions: [senderTxn, receiverTxn],
  from,
  to,
  transferred: amount,
  bank: 'Other Bank',
  senderNewBalance: sender.balance,
  senderName: sender.name,
  recipientName: recipient.name,
  transactionId: senderTxn.id, 
  timestamp,
  senderBankName: sender.bankName,
  recipientBankName: recipient.bankName,
});
});


app.post('/foreign-transfer', async (req, res) => {
  const { fromAccount, toAccount, amount, currency, branch, email } = req.body;

  if (!fromAccount || !toAccount || !amount || !currency) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const sender = users.find(u => u.accountNumber === fromAccount);
  const receiver = users.find(u => u.accountNumber === toAccount);

  if (!sender) return res.status(404).json({ message: 'Sender not found' });
  if (!receiver) return res.status(404).json({ message: 'Receiver not found' });
  if (!exchangeRates[currency]) return res.status(400).json({ message: 'Unsupported currency' });

  const rbank = receiver.bankName;
  const sbank = sender.bankName;

  const requiredLKR = amount * exchangeRates[currency];
  if (sender.balance < requiredLKR) return res.status(400).json({ message: 'Insufficient balance' });

  sender.balance -= requiredLKR;

  const transaction = {
    id: `TXN${Date.now()}`,
    branch,
    fromAccount,
    toAccount,
    amount,
    rbank,
    sbank,
    currency,
    requiredLKR,
    timestamp: new Date().toISOString(),
    status: 'Success',
  };

  await db.read();
  db.data.transactions.push(transaction);
  await db.write();

  // Prepare email
  const subject = 'Foreign Transfer Receipt - YourBankName';
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Colombo' });

  const message = `
Dear Customer,

This is a confirmation of your recent foreign transfer.

Transaction Details:
---------------------
Date & Time     : ${now}
From Account    : ${fromAccount} (${sbank})
To Account      : ${toAccount} (${rbank})
Transferred Amount: ${amount} ${currency} (Equivalent to Rs.${requiredLKR.toFixed(2)})

Remaining Balance: Rs.${sender.balance.toFixed(2)}

Thank you for banking with us.
YourBankName
  `.trim();

  const userEmail = email || sender.email;
  if (!userEmail) {
    console.warn('No email provided or found, skipping email sending.');
  } else {
    try {
      await sendEmailReceipt(userEmail, subject, message);
    } catch (emailError) {
      console.error('Failed to send foreign transfer email:', emailError);
    }
  }

  res.json({
    transaction,
    sender,
    receiver,
  });
});





app.post('/foreign-deposit', authenticateToken, async (req, res) => {
  const { accountNumber, amount, currency } = req.body;

  if (!accountNumber || !amount || !currency) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  if (amount <= 0) {
    return res.status(400).json({ message: 'Amount must be greater than zero' });
  }

  const user = users.find(u => u.accountNumber === accountNumber);
  if (!user) return res.status(404).json({ message: 'User not found' });


  const exchangeRates = {
    USD: 350,  
    EUR: 370,
    GBP: 430,
  };

  const rate = exchangeRates[currency.toUpperCase()];
  if (!rate) {
    return res.status(400).json({ message: 'Unsupported currency' });
  }

  const localAmount = amount * rate;

  user.balance += localAmount;

  await db.read();
  const txn = {
    id: `TXN${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`,
    accountNumber,
    type: 'foreign-deposit',
    amount: localAmount,
    currency,
    rate,
    balanceAfter: user.balance,
    timestamp: new Date().toISOString(),
    status: 'success',
  };
  db.data.transactions.push(txn);
  await db.write();

  return res.json({
    message: `Foreign currency deposit successful. Credited LKR ${localAmount.toFixed(2)}`,
    balance: user.balance,
    transaction: txn,
  });
});


app.post('/admin/login', (req, res) => {
  const { id, password } = req.body;
  const isValid = admins.some(admin => admin.id === id && admin.password === password);
  if (isValid) {
    res.status(200).json({ message: 'Login successful' });
  } else {
    res.status(401).json({ message: 'Invalid ID or Password' });
  }
});



app.get('/atm-cash', (req, res) => {
  res.json(atmCash);
});

app.post('/check-atm-cash', async (req, res) => {
  try {
    const lowCashDenoms = Object.entries(atmCash)
      .filter(([note, count]) => count <= 5)
      .map(([note, count]) => `Rs.${note} - ${count} notes remaining`);

    if (lowCashDenoms.length === 0) {
      return res.json({ message: 'ATM cash is sufficient' });
    }

    const subject = '⚠️ Low Cash Alert in ATM';
    const message = `
      Attention Admin,

      The ATM is running low on the following denominations:

      ${lowCashDenoms.join('\n')}

      Please take necessary action to refill the ATM.

      Regards,
      ATM Monitoring System
    `.trim();

    for (const email of adminEmails) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject,
        text: message,
      });
    }

    return res.json({ message: 'Low cash alert sent to admins', lowCashDenoms });

  } catch (error) {
    console.error('Error checking ATM cash:', error);
    res.status(500).json({ message: 'Failed to check ATM cash or send alert' });
  }
});

app.post('/atm-cash/update', (req, res) => {
  const { denomination, count } = req.body;
  if (atmCash.hasOwnProperty(denomination)) {
    atmCash[denomination] += parseInt(count);
    res.json({ message: 'ATM cash updated', atmCash });
  } else {
    res.status(400).json({ message: 'Invalid denomination' });
  }
});


app.get('/check-hardware-status', (req, res) => {  
  const fail = Math.random() < 0;

  if (fail) {
    return res.status(500).json({ message: 'ATM Hardware Failure! Please contact support.' });
  }

  return res.status(200).json({ message: 'Hardware OK' });
});



async function startServer() {
  await initDB();
  const PORT = 3001;
  app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
}

startServer();