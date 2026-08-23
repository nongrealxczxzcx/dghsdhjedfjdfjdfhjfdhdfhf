/**
 * รับ input จาก modal (เช่น "@VIP", "<@&123456789012345678>", "123456789012345678", "VIP")
 * แล้วพยายามหา Role ที่ตรงกันในกิลด์
 * คืนค่า null ถ้าหาไม่เจอ
 */
async function resolveRole(guild, input) {
  if (!input || !input.trim()) return null;

  const trimmed = input.trim();
  const mentionMatch = trimmed.match(/^<@&(\d+)>$/);
  const idOrName = mentionMatch ? mentionMatch[1] : trimmed;

  // ลองหาแบบ ID ก่อน
  if (/^\d{15,25}$/.test(idOrName)) {
    const role = await guild.roles.fetch(idOrName).catch(() => null);
    if (role) return role;
  }

  // ลองหาแบบชื่อ (ตัด @ ออกถ้ามี, ไม่สนตัวพิมพ์เล็กใหญ่)
  const nameQuery = idOrName.replace(/^@/, '').toLowerCase();
  const all = await guild.roles.fetch();
  const found = all.find((r) => r.name.toLowerCase() === nameQuery);

  return found ?? null;
}

/**
 * เช็คว่าบอทสามารถมอบยศนี้ให้สมาชิกได้จริงไหม
 * คืนค่า { ok: true } หรือ { ok: false, reason: string }
 */
function checkRoleAssignable(guild, role) {
  const botMember = guild.members.me;

  if (!botMember) {
    return { ok: false, reason: 'บอทไม่พบข้อมูลตัวเองในเซิร์ฟเวอร์นี้' };
  }
  if (!botMember.permissions.has('ManageRoles')) {
    return { ok: false, reason: 'บอทไม่มีสิทธิ์ `Manage Roles` กรุณาเปิดสิทธิ์นี้ให้บอทก่อน' };
  }
  if (role.id === guild.id) {
    return { ok: false, reason: 'ไม่สามารถใช้ยศ @everyone เป็นรางวัลได้' };
  }
  if (role.managed) {
    return { ok: false, reason: 'ยศนี้ถูกจัดการโดยระบบ/บอทอื่น (integration role) ไม่สามารถมอบให้สมาชิกได้' };
  }
  if (role.position >= botMember.roles.highest.position) {
    return {
      ok: false,
      reason: `ยศ **${role.name}** อยู่สูงกว่าหรือเท่ากับยศสูงสุดของบอท กรุณาเลื่อนยศบอทให้อยู่เหนือยศนี้ในหน้า Server Settings > Roles`,
    };
  }

  return { ok: true };
}

module.exports = { resolveRole, checkRoleAssignable };
