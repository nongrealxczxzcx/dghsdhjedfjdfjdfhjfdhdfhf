const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { parseDuration } = require('../utils/parseDuration');
const { checkRoleAssignable } = require('../utils/resolveRole');
const {
  createGiveaway,
  endGiveaway,
  rerollGiveaway,
  findByShortRef,
} = require('../utils/giveawayManager');
const { readData } = require('../utils/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('จัดการ giveaway')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('start')
        .setDescription('เริ่ม giveaway ใหม่')
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('ยศที่จะมอบให้ผู้ชนะ (ของรางวัล)').setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('duration')
            .setDescription('ระยะเวลา เช่น 10m, 1h, 1d12h')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('prize').setDescription('ชื่อรางวัลที่จะแสดง (ไม่ใส่ = ใช้ชื่อยศ)')
        )
        .addIntegerOption((opt) =>
          opt
            .setName('winners')
            .setDescription('จำนวนผู้ชนะ (ค่าเริ่มต้น 1)')
            .setMinValue(1)
            .setMaxValue(50)
        )
        .addChannelOption((opt) =>
          opt.setName('channel').setDescription('ช่องที่จะโพสต์ (ค่าเริ่มต้นคือช่องปัจจุบัน)')
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('end')
        .setDescription('จบ giveaway ทันที')
        .addStringOption((opt) =>
          opt.setName('id').setDescription('Giveaway ID หรือ Message ID').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('reroll')
        .setDescription('สุ่มผู้ชนะใหม่จาก giveaway ที่จบแล้ว')
        .addStringOption((opt) =>
          opt.setName('id').setDescription('Giveaway ID หรือ Message ID').setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt.setName('winners').setDescription('จำนวนผู้ชนะใหม่').setMinValue(1).setMaxValue(50)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('แสดง giveaway ที่กำลังดำเนินอยู่ในเซิร์ฟเวอร์นี้')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      const role = interaction.options.getRole('role');
      const durationStr = interaction.options.getString('duration');
      const winnerCount = interaction.options.getInteger('winners') ?? 1;
      const channel = interaction.options.getChannel('channel') ?? interaction.channel;
      const prize = interaction.options.getString('prize')?.trim() || `ยศ ${role.name}`;

      const roleCheck = checkRoleAssignable(interaction.guild, role);
      if (!roleCheck.ok) {
        return interaction.reply({ content: `❌ ${roleCheck.reason}`, flags: MessageFlags.Ephemeral });
      }

      const durationMs = parseDuration(durationStr);
      if (!durationMs) {
        return interaction.reply({
          content: '❌ รูปแบบเวลาไม่ถูกต้อง ลองแบบ `10m`, `1h`, `1d12h` เป็นต้น',
          flags: MessageFlags.Ephemeral,
        });
      }
      if (!channel.isTextBased()) {
        return interaction.reply({
          content: '❌ กรุณาเลือกช่องข้อความ',
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.reply({
        content: `✅ เริ่ม giveaway **${prize}** (รางวัลยศ: ${role}) ที่ ${channel} แล้ว!`,
        flags: MessageFlags.Ephemeral,
      });

      await createGiveaway(interaction.client, {
        channel,
        prize,
        roleId: role.id,
        durationMs,
        winnerCount,
        hostId: interaction.user.id,
        guildId: interaction.guildId,
      });
      return;
    }

    if (sub === 'end') {
      const ref = interaction.options.getString('id');
      const giveaway = findByShortRef(ref);
      if (!giveaway) {
        return interaction.reply({ content: '❌ ไม่พบ giveaway นี้', flags: MessageFlags.Ephemeral });
      }
      if (giveaway.ended) {
        return interaction.reply({ content: '⚠️ giveaway นี้จบไปแล้ว', flags: MessageFlags.Ephemeral });
      }
      await endGiveaway(interaction.client, giveaway.id);
      return interaction.reply({ content: '✅ จบ giveaway แล้ว', flags: MessageFlags.Ephemeral });
    }

    if (sub === 'reroll') {
      const ref = interaction.options.getString('id');
      const winnerCount = interaction.options.getInteger('winners');
      const giveaway = findByShortRef(ref);
      if (!giveaway) {
        return interaction.reply({ content: '❌ ไม่พบ giveaway นี้', flags: MessageFlags.Ephemeral });
      }
      const result = await rerollGiveaway(interaction.client, giveaway.id, winnerCount);
      if (result.error) {
        return interaction.reply({ content: `❌ ${result.error}`, flags: MessageFlags.Ephemeral });
      }
      return interaction.reply({ content: '🔄 รีโรลผู้ชนะเรียบร้อย', flags: MessageFlags.Ephemeral });
    }

    if (sub === 'list') {
      const data = readData();
      const active = data.giveaways.filter(
        (g) => g.guildId === interaction.guildId && !g.ended
      );
      if (!active.length) {
        return interaction.reply({
          content: 'ไม่มี giveaway ที่กำลังดำเนินอยู่ในตอนนี้',
          flags: MessageFlags.Ephemeral,
        });
      }
      const lines = active.map(
        (g) =>
          `• **${g.prize}** (ยศ <@&${g.roleId}>) — ID: \`${g.id}\` — <#${g.channelId}> — จบ <t:${Math.floor(
            g.endAt / 1000
          )}:R>`
      );
      return interaction.reply({ content: lines.join('\n'), flags: MessageFlags.Ephemeral });
    }
  },
};
