/**
 * รับ input จาก modal (เช่น "#general", "123456789012345678", "general")
 * แล้วพยายามหา TextChannel ที่ตรงกันในกิลด์
 * คืนค่า null ถ้าหาไม่เจอ
 */
async function resolveChannel(guild, input, fallbackChannel) {
  if (!input || !input.trim()) return fallbackChannel;

  const trimmed = input.trim();
  const mentionMatch = trimmed.match(/^<#(\d+)>$/);
  const idOrMention = mentionMatch ? mentionMatch[1] : trimmed;

  // ลองหาแบบ ID ก่อน
  if (/^\d{15,25}$/.test(idOrMention)) {
    const ch = await guild.channels.fetch(idOrMention).catch(() => null);
    if (ch && ch.isTextBased()) return ch;
  }

  // ลองหาแบบชื่อ (ตัด # ออกถ้ามี)
  const nameQuery = trimmed.replace(/^#/, '').toLowerCase();
  const all = await guild.channels.fetch();
  const found = all.find(
    (ch) => ch && ch.isTextBased?.() && ch.name?.toLowerCase() === nameQuery
  );

  return found ?? null;
}

module.exports = { resolveChannel };
