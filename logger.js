// logger.js
const fs = require('fs');
const path = require('path');

const logPath = path.join(__dirname, 'atm_logs.txt');

function logAction(message) {
  const timestamp = new Date().toISOString();
  const fullMessage = `[${timestamp}] ${message}\n`;
  fs.appendFile(logPath, fullMessage, (err) => {
    if (err) console.error('Failed to write log:', err);
  });
}

module.exports = { logAction };
