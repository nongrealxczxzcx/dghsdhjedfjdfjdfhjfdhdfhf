const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('ตั้งค่าและสร้าง giveaway ผ่านฟอร์ม (สำหรับแอดมิน)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const button = new ButtonBuilder()
      .setCustomId('setup_giveaway_open_modal')
      .setLabel('🎁 ตั้งค่า Giveaway')
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(button);

    await interaction.reply({
      content: 'กดปุ่มด้านล่างเพื่อกรอกรายละเอียด giveaway — รวมถึงยศที่จะมอบให้ผู้ชนะ (เฉพาะแอดมิน)',
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  },
};
