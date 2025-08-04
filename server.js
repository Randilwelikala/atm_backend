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
const fs = require('fs');
// const path = require('path');
const transactionsFilePath = path.join(__dirname, 'transaction.json');
app.use(express.json());
const { logAction } = require('./logger');


function getTransactions() {
  const data = fs.readFileSync(transactionsFilePath, 'utf-8');
  return JSON.parse(data).transactions;
}



function getGroupedTransactions() {
  const transactions = getTransactions();

  const groupedTransactions = {};

  transactions.forEach(tx => {
    const bankName = accountToBankMap[tx.accountNumber] || 'Unknown Bank';
    if (!groupedTransactions[bankName]) groupedTransactions[bankName] = [];
    groupedTransactions[bankName].push(tx);
  });

  return groupedTransactions;
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
    country:'Sri Lanka',
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
    mobile: '0712345679',
    country:'Japan',
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
    mobile: '0759876543' ,
    country:'Australia',
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
    mobile: '0701234567',
    country:'China',
  }
];

const admins = [

  { name: 'admin1',
    id: 'admin1', 
    password: 'admin1',
    adminEmails:'randilgimantha646@gmail.com'
  }  
];

const audits = [

  { name: 'audit1',
    id: 'audit1', 
    password: 'audit1',
    adminEmails:'randilgimantha646@gmail.com'
  }  
];

const dbFile = path.join(__dirname, 'transactions.json');
const adapter = new JSONFile(dbFile);
const db = new Low(adapter, { transactions: [] });
const adminEmails = admins.map(admin => admin.adminEmails);

const accountToBankMap = {};
users.forEach(user => {
  accountToBankMap[user.accountNumber] = user.bankName;
});


const auditFile = path.join(process.cwd(), 'audit.json');
const auditAdapter = new JSONFile(auditFile);
const auditDB = new Low(auditAdapter, { audits: [] });

async function initAuditDB() {
  await auditDB.read();
  if (!auditDB.data) {
    auditDB.data = { audits: [] };
    await auditDB.write();
  }
}

async function startAudit() {
  await initAuditDB();
}

startAudit();



async function logAuditEvent(event) {
  await auditDB.read();
  auditDB.data.audits.push({
    id: `AUDIT${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`,
    timestamp: new Date().toISOString(),
    ...event,
  });
  await auditDB.write();
}

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
  const maskedAccount = accountNumber.replace(/\d(?=\d{4})/g, '*');
  logAction(`Login attempt: Account ${maskedAccount}`);
  const user = users.find(u => u.accountNumber === accountNumber && u.pin === pin);
  if (user) {    
    
     const token = jwt.sign({ id: user.id, accountNumber }, SECRET_KEY, { expiresIn: '1h' }); 
     res.json({ success: true, balance: user.balance,token }); 
     logAction(`Login successful: Account ${maskedAccount}`);
     return res.json({ token });  
  } else {
     logAction(`Login failed: Invalid PIN or account ${maskedAccount}`);
    res.status(401).json({ success: false, message: 'Invalid card number or PIN' });
  }
});



app.post('/cardLogin', (req, res) => {
  const { cardNumber, pin } = req.body;
  const maskedCard = cardNumber ? cardNumber.toString().replace(/\d(?=\d{4})/g, '*') : 'undefined';

  if (!cardNumber) {
    logAction(`Card login failed: No card number entered`);
    return res.status(401).json({ success: false, message: 'Enter a card number' });
  }
  if (!pin) {
    logAction(`Card login failed: Invalid card length for card ${maskedCard}`);
    return res.status(401).json({ success: false, message: 'Enter a pin number' });
  }

  const user = users.find(u => u.cardNumber === cardNumber.toString() && u.pin === pin);

  if (!user) {
    logAction(`Card login failed: Invalid credentials for card ${maskedCard}`);
    return res.status(401).json({ success: false, message: 'Invalid card number or PIN' });
  }

  if (cardNumber.toString().length !== 16) {
    logAction(`Card login failed: Invalid character count for card ${maskedCard}`);
    return res.status(401).json({ success: false, message: 'Card number must be exactly 16 characters long.' });
  }
  

  const generatedToken = jwt.sign(
    { cardNumber: user.cardNumber, accountNumber: user.accountNumber },
    'your_secret_key', 
    { expiresIn: '1h' }
  );
  logAction(`Card login successful: Card ${maskedCard}`);
  return res.json({
    success: true,
    balance: user.balance,
    accountNumber: user.accountNumber,
    token: generatedToken
  });
});




app.get('/balance/:accountNumber',authenticateToken,  (req, res) => {
  const maskedAccount = accountNumber.replace(/\d(?=\d{4})/g, '*');
  const user = users.find(u => u.accountNumber === req.params.accountNumber);
  logAction(`Balance check requested for account ${maskedAccount}`);
  if (user) {
    logAction(`Balance check successful for account ${maskedAccount}: Balance is ${user.balance}`);
    res.json({ balance: user.balance });
  } else {
    logAction(`Balance check failed: Account ${maskedAccount} not found`);
    res.status(404).json({ message: 'User not found' });
  }
});




app.post('/deposit', authenticateToken, async (req, res) => {
  const { email, accountNumber, amount, } = req.body;
  const MAX_DEPOSIT = 50000;
  const maskedAccount = accountNumber?.replace(/\d(?=\d{4})/g, '*') || 'undefined';

  try {
    logAction(`Deposit attempt: Account ${maskedAccount}, Amount Rs.${amount}`);
    if (!accountNumber) return res.status(400).json({ message: 'Account number is required' });
    logAction(`Deposit failed: No account number provided`);
    if (amount === undefined || amount === null || typeof amount !== 'number' || amount <= 0) {
      logAction(`Deposit failed: Invalid amount for account ${maskedAccount}`);
      return res.status(400).json({ message: 'Invalid amount' });
    }
    if (amount < 100) {
      logAction(`Deposit failed: Amount is low than RS. 100 for account ${maskedAccount}`);
      return res.status(400).json({ message: 'Amount must be greater than RS.100.00' });
      
    }
    if (amount > MAX_DEPOSIT) {
      logAction(`Deposit failed: Amount exceeds Rs.${MAX_DEPOSIT} for account ${maskedAccount}`);
      return res.status(400).json({ message: `Deposit limit exceeded (max ${MAX_DEPOSIT})` });
    }

    const user = users.find(u => u.accountNumber === accountNumber);
    if (!user) {
      logAction(`Deposit failed: Account ${maskedAccount} not found`);
      return res.status(404).json({ message: 'User not found' });
    }

    user.balance += amount;

    await logAuditEvent({
      type: 'deposit',
      accountNumber,
      amount,
      balanceAfter: user.balance,
      performedBy: req.user.accountNumber,
      ip: req.ip,
    });

    logAction(`Deposit successful: Rs.${amount} to account ${maskedAccount}, New Balance Rs.${user.balance}`);

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
       logAction(`Deposit warning: No email provided or found for account ${maskedAccount}, skipping email.`);
      console.warn('No email provided or found, skipping email sending.');
    } else {
      try {
        await sendEmailReceipt(userEmail, subject, message);
      } catch (emailError) {
        logAction(`Deposit warning: Failed to send email for account ${maskedAccount}`);
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
    logAction(`Deposit error: ${error.message || error}`);
    console.error('Error during deposit:', error);
    res.status(500).json({ message: "Something went wrong" });
  }
});



app.post('/withdraw', authenticateToken, async (req, res) => {
  const maxWithdraw = 200000;
  try {
    const { email, accountNumber, amount, denominations: selectedDenominations } = req.body;
    const maskedAccount = accountNumber?.replace(/\d(?=\d{4})/g, '*') || 'undefined';


    logAction(`Withdraw attempt: Account ${maskedAccount}, Amount Rs.${amount}`);

    if (!accountNumber) {
      logAction(`Withdraw failed: No account number provided`);
      return res.status(400).json({ message: 'Account number is required' });
  }
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      logAction(`Withdraw failed: Invalid amount for account ${maskedAccount}`);
      return res.status(400).json({ message: 'Invalid amount' });
    }

    const user = users.find(u => u.accountNumber === accountNumber);
    if (!user) {
      logAction(`Withdraw failed: User not found for account ${maskedAccount}`);
      return res.status(404).json({ message: 'User not found' });}

    if (user.balance < amount) {
      logAction(`Withdraw failed: Insufficient balance for account ${maskedAccount}`);
      return res.status(400).json({ message: 'Insufficient balance' });
    }
    if (amount <= 100) {
      logAction(`Withdraw failed: Amount below minimum (Rs.100.00) for account ${maskedAccount}`);
      return res.status(400).json({ message: 'Amount must be greater than RS.100.00' });
    }
    if (amount > maxWithdraw) {
      logAction(`Withdraw failed: Amount exceeds Rs.${maxWithdraw} for account ${maskedAccount}`);
      return res.status(400).json({ message: `Withdraw limit exceeded (max ${maxWithdraw})` });
    }

    if (!selectedDenominations || !Array.isArray(selectedDenominations) || selectedDenominations.length === 0) {
      logAction(`Withdraw failed: No denominations selected for account ${maskedAccount}`);
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
      logAction(`Withdraw failed: Not enough selected notes to fulfill request for account ${maskedAccount}`);
      return res.status(400).json({ message: 'ATM does not have enough selected notes to fulfill this request' });
    }
    
    for (let note in breakdown) {
      atmCash[note] -= breakdown[note];
    }
    try {
      await axios.post('http://localhost:3001/check-atm-cash');
    } catch (err) {
      logAction(`ATM cash check failed after withdrawal for account ${maskedAccount}: ${err.message}`);
      console.error('ATM cash check failed:', err.message);
    }
    
    user.balance -= amount;
    await logAuditEvent({
      type: 'withdraw',
      accountNumber,
      amount,
      denominations: selectedDenominations,
      balanceAfter: user.balance,
      performedBy: req.user.accountNumber,
      ip: req.ip,
    });

    logAction(`Withdraw successful: Rs.${amount} from account ${maskedAccount}, New Balance Rs.${user.balance}`);

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
      logAction(`Withdraw warning: No email provided or found for account ${maskedAccount}`);
      console.warn('No email provided or found, skipping email sending.');
    } else {
      try {
        await sendEmailReceipt(userEmail, subject, message);
      } catch (emailError) {
        logAction(`Withdraw warning: Failed to send email to ${userEmail} for account ${maskedAccount}`);
        console.error('Failed to send withdrawal email:', emailError);       
      }
    }

    return res.json({
      message: 'Withdraw successful',
      balance: user.balance,
      breakdown,
    });

  } catch (error) {
    logAction(`Withdraw error for account ${req.body.accountNumber || 'unknown'}: ${error.message}`);
    console.error('Error during withdrawal:', error);
    res.status(500).json({ message: "Something went wrong" });
  }
});


app.get('/transactions/:accountNumber', authenticateToken,async (req, res) => {
  const { accountNumber } = req.params;
  const maskedAccount = accountNumber.replace(/\d(?=\d{4})/g, '*');
  logAction(`Transaction history requested for account ${maskedAccount}`);
  try{

  await db.read();

  const txns = db.data.transactions.filter(t =>
    t.accountNumber === accountNumber || t.from === accountNumber || t.to === accountNumber
  );

  if (txns.length === 0) {
      logAction(`Transaction history: No records found for account ${maskedAccount}`);
    } else {
      logAction(`Transaction history: ${txns.length} records found for account ${maskedAccount}`);
    }


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
} catch (error) {
    logAction(`Transaction history error for account ${maskedAccount}: ${error.message || error}`);
    console.error('Error fetching transactions:', error);
    res.status(500).json({ message: 'Failed to fetch transaction history' });
  }
});


app.get('/user/:accountNumber', authenticateToken, (req, res) => {
  const accountNumber = req.params.accountNumber;
  const maskedAccount = accountNumber.replace(/\d(?=\d{4})/g, '*');
  logAction(`User info requested for account ${maskedAccount} by ${req.user.accountNumber}`);

  if (req.user.accountNumber !== accountNumber) {
    logAction(`Access denied for user ${req.user.accountNumber} to account ${maskedAccount}`);
    return res.status(403).json({ message: 'Access denied' });
  }

  const user = users.find(u => u.accountNumber === accountNumber);
  if (user) {
    logAction(`User info retrieved for account ${maskedAccount}`);
    res.json(user);
  } else {
    logAction(`User info request failed: Account ${maskedAccount} not found`);
    res.status(404).json({ message: 'User not found' });
  }
});




app.post('/changepin', authenticateToken, async (req, res) => {
  const { accountNumber, oldPin, newPin,} = req.body;
  const maskedAccount = accountNumber.replace(/\d(?=\d{4})/g, '*');

  logAction(`PIN change attempt for account ${maskedAccount}`);

  const user = users.find(u => u.accountNumber === accountNumber && u.pin === oldPin);  

  if (!user) {
    logAction(`PIN change failed: Invalid account or old PIN for account ${maskedAccount}`);
    return res.status(400).json({ message: 'Invalid account number or old PIN' });
  }
  if (newPin === oldPin) {
    logAction(`PIN change failed: New PIN is same as old PIN for account ${maskedAccount}`);
    return res.status(400).json({ message: 'New PIN cannot be same as old PIN' });
  }
  if (!/^\d{4}$/.test(newPin)) {
    logAction(`PIN change failed: New PIN format invalid for account ${maskedAccount}`);
    return res.status(400).json({ message: 'New PIN must be exactly 4 digits' });
  }

  user.pin = newPin;

    await logAuditEvent({
    type: 'pin-change',
    accountNumber,
    performedBy: req.user.accountNumber,
    ip: req.ip,    
  });
   logAction(`PIN change successful for account ${maskedAccount}`);


 
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
  const maskedFrom = from?.replace(/\d(?=\d{4})/g, '*') || 'undefined';
  const maskedTo = to?.replace(/\d(?=\d{4})/g, '*') || 'undefined';

  logAction(`Transfer attempt: From ${maskedFrom} to ${maskedTo}, Amount Rs.${amount}`);

  if (from === to) {
    logAction(`Transfer failed: Sender and receiver are the same (${maskedFrom})`);
    return res.status(400).json({ message: 'Cannot transfer to the same account' });
  }

  const sender = users.find(u => u.accountNumber === from);
  const receiver = users.find(u => u.accountNumber === to);

  if (!sender || !receiver) {
    logAction(`Transfer failed: Invalid account(s) - From: ${maskedFrom}, To: ${maskedTo}`);
    return res.status(404).json({ message: 'Invalid account number' });
  }

  if (sender.balance < amount) {
    logAction(`Transfer failed: Insufficient funds in account ${maskedFrom}`);
    return res.status(400).json({ message: 'Insufficient funds' });
  }

  sender.balance -= amount;
  receiver.balance += amount;

  await logAuditEvent({
    type: 'transfer',
    from,
    to,
    amount,
    fromBalanceAfter: sender.balance,
    toBalanceAfter: receiver.balance,
    performedBy: req.user.accountNumber,
    ip: req.ip,
  });

  logAction(`Transfer successful: Rs.${amount} from ${maskedFrom} to ${maskedTo}`);


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

  logAction(`Mobile verification attempt: ${mobile}`);

    if (!/^07\d{8}$/.test(mobile)) {
      logAction(`Mobile verification failed: Invalid format (${mobile})`);
      return res.status(400).json({ message: 'Invalid mobile number format' });
      // logAction(`OTP sent to mobile ${mobile}: ${otp}`);
  }
  res.json({ otp: '1234' }); 
  logAction(`OTP sent to mobile ${mobile}: ${otp}`);

});


const otpStore = {};




app.post('/send-otp', (req, res) => {
  const { email } = req.body;

  if (!email || !/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
    logAction(`OTP send failed: Invalid email format (${email || 'undefined'})`);
    return res.status(400).json({ message: 'Invalid email format' });
  }

  const otp = Math.floor(1000 + Math.random() * 9000).toString();

  otpStore[email] = {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000
  };

  logAction(`OTP generated and sent to ${email}`);

  
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

  logAction(`OTP verification attempt for email: ${email || 'undefined'}`);

  if (!email || !otp) {
    logAction(`OTP verification failed: Missing email or OTP`);
    return res.status(400).json({ message: 'Email and OTP are required' });
  }

  const record = otpStore[email];
  if (!record) {
    logAction(`OTP verification failed: No OTP sent to ${email}`);
    return res.status(400).json({ message: 'No OTP sent to this email' });
  }

  if (Date.now() > record.expiresAt) {
    delete otpStore[email];
    logAction(`OTP verification failed: OTP expired for ${email}`);
    return res.status(400).json({ message: 'OTP expired' });
  }

  if (record.otp !== otp) {
    logAction(`OTP verification failed: Invalid OTP for ${email}`);
    return res.status(400).json({ message: 'Invalid OTP' });
  }

  delete otpStore[email];
  logAction(`OTP verification successful for ${email}`);

  // Optional: check if user exists
  const user = users.find(u => u.email === email); // assuming 'users' exists
  if (!user) {
    logAction(`OTP verification failed: No user found for ${email}`);
    return res.status(404).json({ message: 'User not found for this email' });
  }

  const token = jwt.sign({ accountNumber: user.accountNumber }, SECRET_KEY, { expiresIn: '1h' });

  logAction(`Token issued for ${email}, account ${user.accountNumber.replace(/\d(?=\d{4})/g, '*')}`);
  res.json({ message: 'OTP verified successfully', email: user.email, token,accountNumber: user.accountNumber });
});




app.post('/transfer-same-bank', authenticateToken, async (req, res) => {
  const { email, from, to, amount } = req.body;

  const maskedFrom = from?.replace(/\d(?=\d{4})/g, '*') || 'undefined';
  const maskedTo = to?.replace(/\d(?=\d{4})/g, '*') || 'undefined';

  logAction(`Same-bank transfer attempt: From ${maskedFrom} to ${maskedTo}, Amount Rs.${amount}`);

  const sender = users.find(u => u.accountNumber === from);
  const recipient = users.find(u => u.accountNumber === to);

  if (!sender) {
    logAction(`Transfer failed: Sender account ${maskedFrom} not found`);
    return res.status(404).json({ error: 'Sender account not found' });
  }
  if (!recipient) {
    logAction(`Transfer failed: Recipient account ${maskedTo} not found`);
    return res.status(404).json({ error: 'Recipient account not found' });
  }

  if (sender.bankName !== recipient.bankName) {
    logAction(`Transfer failed: Bank mismatch (sender: ${sender.bankName}, recipient: ${recipient.bankName})`);
    return res.status(400).json({ error: 'You can do this transaction by using Other Bank Transfer Section' });
  }

  if (sender.balance < amount) {
    logAction(`Transfer failed: Insufficient funds in account ${maskedFrom}`);
    return res.status(400).json({ error: 'Insufficient funds' });
  }

  sender.balance -= amount;
  recipient.balance += amount;

  await logAuditEvent({
    type: 'transfer-same-bank',
    from,
    to,
    amount,
    fromBalanceAfter: sender.balance,
    toBalanceAfter: recipient.balance,
    performedBy: req.user.accountNumber,
    ip: req.ip,
  });

  logAction(`Transfer successful: Rs.${amount} from ${maskedFrom} to ${maskedTo}. Sender new balance: Rs.${sender.balance}`);

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
    logAction(`Warning: Email sending failed for transaction ${senderTxn.id} - ${error.message}`);
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

  const maskedFrom = from?.replace(/\d(?=\d{4})/g, '*') || 'undefined';
  const maskedTo = to?.replace(/\d(?=\d{4})/g, '*') || 'undefined';

  logAction(`Transfer initiated: ${maskedFrom} → ${maskedTo}, Amount: Rs.${amount}`);

  const sender = users.find(u => u.accountNumber === from);
  const recipient = users.find(u => u.accountNumber === to);

  if (!sender) {
    logAction(`Transfer failed: Sender account ${maskedFrom} not found`);
    return res.status(404).json({ error: 'Sender account not found' });
  }
  if (!recipient) {
    logAction(`Transfer failed: Recipient account ${maskedTo} not found`);
    return res.status(404).json({ error: 'Recipient account not found' });
  }

  if (sender.bankName === recipient.bankName) {
    logAction(`Transfer failed: Both accounts (${maskedFrom}, ${maskedTo}) belong to the same bank`);
    return res.status(400).json({ error: 'Both accounts belong to the same bank. Use the same bank transfer API.' });
  }

  if (sender.balance < amount) {
    logAction(`Transfer failed: Insufficient funds in account ${maskedFrom}`);
    return res.status(400).json({ error: 'Insufficient funds' });
  }

  sender.balance -= amount;
  recipient.balance += amount;

  await db.read();
  await logAuditEvent({
    type: 'transfer-other-bank',
    from,
    to,
    amount,
    fromBalanceAfter: sender.balance,
    toBalanceAfter: recipient.balance,
    performedBy: req.user.accountNumber,
    ip: req.ip,
  });


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

  logAction(`Transfer successful: Rs.${amount} from ${maskedFrom} (${sender.bankName}) to ${maskedTo} (${recipient.bankName})`);

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

  const maskedFrom = fromAccount?.replace(/\d(?=\d{4})/g, '*') || 'undefined';
  const maskedTo = toAccount?.replace(/\d(?=\d{4})/g, '*') || 'undefined';

  logAction(`Foreign transfer attempt: From ${maskedFrom} to ${maskedTo}, Amount: ${amount} ${currency}`);

  if (!fromAccount || !toAccount || !amount || !currency) {
    logAction(`Foreign transfer failed: Missing required fields`);
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const sender = users.find(u => u.accountNumber === fromAccount);
  const receiver = users.find(u => u.accountNumber === toAccount);

  if (!sender) {
    logAction(`Foreign transfer failed: Sender ${maskedFrom} not found`);
    return res.status(404).json({ message: 'Sender not found' });
  }
  if (!receiver) {
    logAction(`Foreign transfer failed: Receiver ${maskedTo} not found`);
    return res.status(404).json({ message: 'Receiver not found' });
  }
  if (!exchangeRates[currency]) {
    logAction(`Foreign transfer failed: Unsupported currency "${currency}"`);
    return res.status(400).json({ message: 'Unsupported currency' });}

  const rbank = receiver.bankName;
  const sbank = sender.bankName;

  const requiredLKR = amount * exchangeRates[currency];
  if (sender.balance < requiredLKR) {
    logAction(`Foreign transfer failed: Insufficient balance in account ${maskedFrom}`);
    return res.status(400).json({ message: 'Insufficient balance' });
  }

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
  await logAuditEvent({
    type: 'foreign-transfer',
    fromAccount,
    toAccount,
    amount,
    currency,
    exchangeRate: exchangeRates[currency],
    requiredLKR,
    fromBalanceAfter: sender.balance,
    performedBy: req.user ? req.user.accountNumber : null,
    ip: req.ip,
  });

  db.data.transactions.push(transaction);
  await db.write();

  logAction(`Foreign transfer success: Rs.${requiredLKR.toFixed(2)} from ${maskedFrom} to ${maskedTo} (${amount} ${currency})`);

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
    logAction(`Foreign transfer warning: No email for account ${maskedFrom}, skipping email.`);
    console.warn('No email provided or found, skipping email sending.');
  } else {
    try {
      await sendEmailReceipt(userEmail, subject, message);
    } catch (emailError) {
      logAction(`Foreign transfer warning: Failed to send email for account ${maskedFrom}`);
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
  const maskedAccount = accountNumber?.replace(/\d(?=\d{4})/g, '*') || 'undefined';

  logAction(`Foreign deposit attempt: Account ${maskedAccount}, Amount ${amount} ${currency}`);

  if (!accountNumber || !amount || !currency) {
    logAction(`Foreign deposit failed: Missing fields for account ${maskedAccount}`);
    return res.status(400).json({ message: 'Missing required fields' });
  }
  if (amount <= 0) {
    logAction(`Foreign deposit failed: Invalid amount ${amount} for account ${maskedAccount}`);
    return res.status(400).json({ message: 'Amount must be greater than zero' });
  }

  const user = users.find(u => u.accountNumber === accountNumber);
  if (!user) {
    logAction(`Foreign deposit failed: Account ${maskedAccount} not found`);
    return res.status(404).json({ message: 'User not found' });
  }


  const exchangeRates = {
    USD: 350,  
    EUR: 370,
    GBP: 430,
  };

  const rate = exchangeRates[currency.toUpperCase()];
  if (!rate) {
    logAction(`Foreign deposit failed: Unsupported currency ${currency} for account ${maskedAccount}`);
    return res.status(400).json({ message: 'Unsupported currency' });
  }

  const localAmount = amount * rate;
  

  user.balance += localAmount;

  await db.read();
  await logAuditEvent({
    type: 'foreign-deposit',
    accountNumber,
    amount: localAmount,
    currency,
    exchangeRate: rate,
    balanceAfter: user.balance,
    performedBy: req.user.accountNumber,
    ip: req.ip,
  });

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

  logAction(`Foreign deposit successful: ${amount} ${currency} to account ${maskedAccount} (Rate: ${rate}), LKR ${localAmount.toFixed(2)} credited. New balance: Rs.${user.balance}`);

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
app.post('/audit/login', (req, res) => {
  const { id, password } = req.body;
  const isValid = audits.some(audit => audit.id === id && audit.password === password);
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

app.post('/atm-cash/update', authenticateToken, async (req, res) => {
  const { denomination, count } = req.body;
  if (atmCash.hasOwnProperty(denomination)) {
    atmCash[denomination] += parseInt(count);

    await logAuditEvent({
      type: 'atm-cash-update',
      denomination,
      count: parseInt(count),
      performedBy: req.user ? req.user.accountNumber : 'system',
      ip: req.ip,
    });

    return res.json({ message: 'ATM cash updated', atmCash });
  } else {
    return res.status(400).json({ message: 'Invalid denomination' });
  }
});

app.get('/check-hardware-status', (req, res) => {  
  const fail = Math.random() <0 ;

  if (fail) {
    return res.status(500).json({ message: 'ATM Hardware Failure! Please contact support.' });
  }

  return res.status(200).json({ message: 'Hardware OK' });
});

app.get('/admin/transactions', async (req, res) => {
  await db.read();

  const txns = db.data.transactions;

  const enrichedTxns = txns.map(txn => {
    const user = users.find(u => 
      u.accountNumber === txn.accountNumber || 
      u.accountNumber === txn.from || 
      u.accountNumber === txn.to
    );

    let direction = '';
    if (txn.from === user?.accountNumber) direction = 'debit';
    else if (txn.to === user?.accountNumber) direction = 'credit';
    else {
      const isDeposit = txn.type && (txn.type.toLowerCase().includes('deposit') || txn.type.toLowerCase().includes('in'));
      direction = isDeposit ? 'credit' : 'debit';
    }

    return {
      ...txn,
      bankName: user?.bankName || 'Unknown Bank',
      userName: user?.name || 'Unknown User',
      direction,
      displayAmount: (direction === 'credit' ? '+' : '-') + txn.amount,
    };
  });

  res.json(enrichedTxns);
});


app.get('/audits', async (req, res) => {
  await auditDB.read();
  res.json(auditDB.data.audits || []);
});





async function startServer() {
  await initDB();
  const PORT = 3001;
  app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
}

startServer();