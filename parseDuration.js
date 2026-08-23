const UNITS = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

/**
 * แปลงรูปแบบ "1d12h30m" หรือ "10m" หรือ "2h" เป็นมิลลิวินาที
 * คืนค่า null ถ้ารูปแบบไม่ถูกต้อง
 */
function parseDuration(input) {
  if (!input) return null;
  const regex = /(\d+)\s*(s|m|h|d|w)/gi;
  let match;
  let total = 0;
  let found = false;

  while ((match = regex.exec(input.toLowerCase())) !== null) {
    found = true;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    total += value * UNITS[unit];
  }

  if (!found || total <= 0) return null;
  return total;
}

module.exports = { parseDuration };
