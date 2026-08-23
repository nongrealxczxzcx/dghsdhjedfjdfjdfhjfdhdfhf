const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'giveaways.json');

// คิวป้องกันการเขียนไฟล์พร้อมกันจนข้อมูลเพี้ยน
let writeQueue = Promise.resolve();

function ensureFile() {
  if (!fs.existsSync(DATA_PATH)) {
    fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
    fs.writeFileSync(DATA_PATH, JSON.stringify({ giveaways: [] }, null, 2));
  }
}

function readData() {
  ensureFile();
  const raw = fs.readFileSync(DATA_PATH, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch {
    return { giveaways: [] };
  }
}

function writeData(data) {
  writeQueue = writeQueue.then(() => {
    const tmpPath = DATA_PATH + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
    fs.renameSync(tmpPath, DATA_PATH);
  });
  return writeQueue;
}

module.exports = { readData, writeData };
