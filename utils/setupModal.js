const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const { parseDuration } = require('./parseDuration');
const { resolveChannel } = require('./resolveChannel');
const { resolveRole, checkRoleAssignable } = require('./resolveRole');
const { createGiveaway } = require('./giveawayManager');

const MODAL_ID = 'giveaway_setup_modal';

function buildSetupModal() {
  const modal = new ModalBuilder().setCustomId(MODAL_ID).setTitle('ตั้งค่า Giveaway');

  const roleInput = new TextInputBuilder()
    .setCustomId('role')
    .setLabel('ยศที่จะมอบให้ผู้ชนะ (รางวัล)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('เช่น @VIP หรือ ID ยศ หรือชื่อยศ')
    .setRequired(true)
    .setMaxLength(100);

  const prizeInput = new TextInputBuilder()
    .setCustomId('prize')
    .setLabel('ชื่อรางวัลที่จะแสดงในประกาศ (เว้นว่างได้)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('เช่น ยศ VIP สุดพิเศษ')
    .setRequired(false)
    .setMaxLength(200);

  const durationInput = new TextInputBuilder()
    .setCustomId('duration')
    .setLabel('ระยะเวลา (เช่น 10m, 1h, 1d12h)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('1h')
    .setRequired(true)
    .setMaxLength(30);

  const winnersInput = new TextInputBuilder()
    .setCustomId('winners')
    .setLabel('จำนวนผู้ชนะ')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('1')
    .setValue('1')
    .setRequired(true)
    .setMaxLength(3);

  const channelInput = new TextInputBuilder()
    .setCustomId('channel')
    .setLabel('ช่องที่จะส่ง (เว้นว่าง = ช่องนี้)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('ID ช่อง / #ชื่อช่อง / เว้นว่างไว้')
    .setRequired(false)
    .setMaxLength(100);

  modal.addComponents(
    new ActionRowBuilder().addComponents(roleInput),
    new ActionRowBuilder().addComponents(prizeInput),
    new ActionRowBuilder().addComponents(durationInput),
    new ActionRowBuilder().addComponents(winnersInput),
    new ActionRowBuilder().addComponents(channelInput)
  );

  return modal;
}

async function handleSetupButton(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({
      content: '⛔ ต้องมีสิทธิ์ Manage Server ถึงจะตั้งค่า giveaway ได้',
      flags: MessageFlags.Ephemeral,
    });
  }
  await interaction.showModal(buildSetupModal());
}

async function handleSetupModalSubmit(interaction) {
  const roleStr = interaction.fields.getTextInputValue('role').trim();
  const prizeInput = interaction.fields.getTextInputValue('prize')?.trim();
  const durationStr = interaction.fields.getTextInputValue('duration').trim();
  const winnersStr = interaction.fields.getTextInputValue('winners').trim();
  const channelStr = interaction.fields.getTextInputValue('channel')?.trim();

  // ตรวจสอบยศรางวัลก่อน เพราะเป็นของรางวัลหลัก
  const role = await resolveRole(interaction.guild, roleStr);
  if (!role) {
    return interaction.reply({
      content: `❌ ไม่พบยศ "${roleStr}" กรุณาใส่ ID, mention (@ยศ), หรือชื่อยศที่ถูกต้อง`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const roleCheck = checkRoleAssignable(interaction.guild, role);
  if (!roleCheck.ok) {
    return interaction.reply({
      content: `❌ ${roleCheck.reason}`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const durationMs = parseDuration(durationStr);
  if (!durationMs) {
    return interaction.reply({
      content: '❌ รูปแบบเวลาไม่ถูกต้อง ลองแบบ `10m`, `1h`, `1d12h` เป็นต้น',
      flags: MessageFlags.Ephemeral,
    });
  }

  const winnerCount = parseInt(winnersStr, 10);
  if (!Number.isInteger(winnerCount) || winnerCount < 1 || winnerCount > 50) {
    return interaction.reply({
      content: '❌ จำนวนผู้ชนะต้องเป็นตัวเลข 1-50',
      flags: MessageFlags.Ephemeral,
    });
  }

  const channel = await resolveChannel(interaction.guild, channelStr, interaction.channel);
  if (!channel) {
    return interaction.reply({
      content: `❌ ไม่พบช่อง "${channelStr}" กรุณาใส่ ID, mention (#ช่อง), หรือชื่อช่องที่ถูกต้อง`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const perms = channel.permissionsFor(interaction.client.user);
  if (!perms?.has(PermissionFlagsBits.SendMessages) || !perms?.has(PermissionFlagsBits.ViewChannel)) {
    return interaction.reply({
      content: `❌ บอทไม่มีสิทธิ์ส่งข้อความในช่อง ${channel}`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const prize = prizeInput?.length ? prizeInput : `ยศ ${role.name}`;

  await interaction.reply({
    content: `✅ สร้าง giveaway **${prize}** (รางวัลยศ: ${role}) ในช่อง ${channel} เรียบร้อยแล้ว!`,
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
}

module.exports = { MODAL_ID, handleSetupButton, handleSetupModalSubmit };
