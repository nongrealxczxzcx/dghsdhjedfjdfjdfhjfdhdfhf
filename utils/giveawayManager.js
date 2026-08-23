const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  SeparatorSpacingSize,
  EmbedBuilder,
} = require('discord.js');
const { randomUUID } = require('crypto');
const { readData, writeData } = require('./storage');
const { checkRoleAssignable } = require('./resolveRole');

const activeTimers = new Map(); 

function fmtTimestamp(ms, style = 'R') {
  return `<t:${Math.floor(ms / 1000)}:${style}>`;
}

function buildGiveawayContainer(giveaway) {
  const ended = giveaway.ended;

  const header = new TextDisplayBuilder().setContent(
    `## STIF SHOP \n### **ของรางวัล** ${giveaway.prize}`
  );

const infoLines = [
    `- ** \`👤\` ผู้จัด:** <@${giveaway.hostId}>\n`,
    `- ** \`🎁\` รางวัล (ยศ):** <@&${giveaway.roleId}>\n`,
    `- ** \`👑\` ผู้ชนะ:** ${giveaway.winnerCount} คน\n`,
    `- ** \`👤\` ผู้เข้าร่วม:** ${giveaway.participants.length} คน\n`,
    ended
      ? `- ** \`⌛️\` สถานะ:** จบแล้ว ${fmtTimestamp(giveaway.endAt)}`
      : `- ** \`⏳\` สิ้นสุด:** ${fmtTimestamp(giveaway.endAt)} (${fmtTimestamp(giveaway.endAt, 'F')})`,
  ];

  if (ended && giveaway.winners?.length) {
    infoLines.push(
      `- ** \`👑\` ผู้ชนะ:** ${giveaway.winners.map((id) => `<@${id}>`).join(', ')}`
    );
  } else if (ended) {
    infoLines.push(`- ** \`👑\` ผู้ชนะ:** ไม่มีผู้เข้าร่วม`);
  }

  const info = new TextDisplayBuilder().setContent(infoLines.join('\n'));

  const container = new ContainerBuilder()
    .setAccentColor(ended ? 0x000000 : 0x000000)
    .addTextDisplayComponents(header)
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(info);

  if (!ended) {
    const joinButton = new ButtonBuilder()
      .setCustomId(`giveaway_join_${giveaway.id}`)
      .setLabel(' เข้าร่วม')
      .setEmoji('<a:mimmygift:1445483516195246090>')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(joinButton);
    container.addActionRowComponents(row);
  } else {
    const endedRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`giveaway_join_${giveaway.id}`)
        .setLabel('จบแล้ว')
        .setEmoji('<a:a_Cross:1175259607216693268>')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
    container.addActionRowComponents(endedRow);
  }

  return container;
}

function buildResultContainer({ accentColor, title, lines }) {
  const header = new TextDisplayBuilder().setContent(title);
  const body = new TextDisplayBuilder().setContent(lines.join('\n'));

  return new ContainerBuilder()
    .setAccentColor(accentColor)
    .addTextDisplayComponents(header)
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(body);
}

function buildPayload(giveaway) {
  return {
    flags: MessageFlags.IsComponentsV2,
    components: [buildGiveawayContainer(giveaway)],
  };
}

function buildResultPayload(container, mentionUserIds = []) {
  return {
    flags: MessageFlags.IsComponentsV2,
    components: [container],
    allowedMentions: { users: mentionUserIds },
  };
}

async function createGiveaway(client, { channel, prize, durationMs, winnerCount, hostId, guildId, roleId }) {
  const id = randomUUID();
  const endAt = Date.now() + durationMs;

  const giveaway = {
    id,
    guildId,
    channelId: channel.id,
    messageId: null,
    prize,
    roleId,
    endAt,
    winnerCount,
    hostId,
    participants: [],
    winners: [],
    ended: false,
  };

  const message = await channel.send(buildPayload(giveaway));
  giveaway.messageId = message.id;

  const data = readData();
  data.giveaways.push(giveaway);
  await writeData(data);

  scheduleEnd(client, giveaway.id, durationMs);
  return giveaway;
}

async function toggleParticipant(interaction, giveawayId) {
  const data = readData();
  const giveaway = data.giveaways.find((g) => g.id === giveawayId);

  if (!giveaway) {
    return interaction.reply({ content: '❌ ไม่พบ giveaway นี้แล้ว', flags: MessageFlags.Ephemeral });
  }
  if (giveaway.ended) {
    return interaction.reply({ content: '⛔ giveaway นี้จบไปแล้ว', flags: MessageFlags.Ephemeral });
  }

  const userId = interaction.user.id;
  const user = interaction.user; 
  const idx = giveaway.participants.indexOf(userId);
  let embedColor, embedTitle, embedDesc;

  if (idx === -1) {
    giveaway.participants.push(userId);
    embedColor = 0x000000; 
    embedTitle = '`✅` **เข้าร่วมสำเร็จ!**';
    embedDesc = '- **ลงทะเบียนเข้าร่วมกิจกรรมเรียบร้อยแล้วครับ**\n- **ขอให้คุณโชคดีได้รับรางวัลใหญ่** `💜` `🙏`';
  } else {
    giveaway.participants.splice(idx, 1);
    embedColor = 0x000000; 
    embedTitle = '`❌` **ยกเลิกการเข้าร่วมแล้ว**';
    embedDesc = '- **คุณได้ถอนตัวจากการเข้าร่วมกิจกรรมนี้เรียบร้อยแล้ว**\n- **ไว้โอกาสหน้ามาร่วมสนุกกันใหม่นะครับ!**';
  }

  await writeData(data);

  try {
    const channel = await interaction.client.channels.fetch(giveaway.channelId);
    const message = await channel.messages.fetch(giveaway.messageId);
    await message.edit(buildPayload(giveaway));
  } catch (err) {
    console.error('แก้ไขข้อความ giveaway ไม่สำเร็จ:', err);
  }

  const replyEmbed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(embedTitle)
    .setDescription(embedDesc)
    .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setTimestamp();

  return interaction.reply({ 
    embeds: [replyEmbed], 
    flags: MessageFlags.Ephemeral 
  });
  }

function pickWinners(participants, count) {
  const pool = [...participants];
  const winners = [];
  while (pool.length && winners.length < count) {
    const i = Math.floor(Math.random() * pool.length);
    winners.push(pool.splice(i, 1)[0]);
  }
  return winners;
}

async function grantRoleToWinners(guild, roleId, winnerIds) {
  const granted = [];
  const failed = [];

  const role = await guild.roles.fetch(roleId).catch(() => null);
  if (!role) {
    return { granted, failed: winnerIds.map((id) => ({ id, reason: 'ไม่พบยศรางวัลแล้ว (อาจถูกลบไปแล้ว)' })) };
  }

  const check = checkRoleAssignable(guild, role);
  if (!check.ok) {
    return { granted, failed: winnerIds.map((id) => ({ id, reason: check.reason })) };
  }

  for (const userId of winnerIds) {
    try {
      const member = await guild.members.fetch(userId);
      await member.roles.add(role, 'ได้รับรางวัลจาก giveaway');
      granted.push(userId);
    } catch (err) {
      failed.push({ id: userId, reason: 'มอบยศไม่สำเร็จ (อาจออกจากเซิร์ฟเวอร์ไปแล้ว หรือติดสิทธิ์)' });
    }
  }

  return { granted, failed };
}

async function endGiveaway(client, giveawayId, { silent = false } = {}) {
  const data = readData();
  const giveaway = data.giveaways.find((g) => g.id === giveawayId);
  if (!giveaway || giveaway.ended) return null;

  giveaway.ended = true;
  giveaway.winners = pickWinners(giveaway.participants, giveaway.winnerCount);
  await writeData(data);

  clearTimeout(activeTimers.get(giveawayId));
  activeTimers.delete(giveawayId);

  try {
    const channel = await client.channels.fetch(giveaway.channelId);
    const message = await channel.messages.fetch(giveaway.messageId);
    await message.edit(buildPayload(giveaway));

    if (silent) return giveaway;

    if (!giveaway.winners.length) {
      const container = buildResultContainer({
        accentColor: 0xed4245,
        title: `## 😢 ไม่มีผู้เข้าร่วม`,
        lines: [`giveaway **${giveaway.prize}** จบแล้วโดยไม่มีใครเข้าร่วมเลย`],
      });
      await channel.send(buildResultPayload(container));
      return giveaway;
    }

    const guild = await client.guilds.fetch(giveaway.guildId);
    const { granted, failed } = await grantRoleToWinners(guild, giveaway.roleId, giveaway.winners);
    
    let winnerUser = null;
    if (giveaway.winners.length > 0) {
      winnerUser = await client.users.fetch(giveaway.winners[0]).catch(() => null);
    }

    const winnersList = giveaway.winners.map((id) => `<@${id}>`).join(', ');

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('`👑` **ประกาศผลรางวัลจาก STIF SHOP** `👑`')
      .setDescription('- **ขอแสดงความยินดีกับผู้โชคดีทุกท่านด้วยนะครับ!**')
      .addFields(
        {
          name: '`🎁` **ของรางวัล**',
          value: `>>> **${giveaway.prize}**`,
          inline: false
        },
        {
          name: '`👑` **ผู้ชนะ**',
          value: `>>> ${winnersList}`,
          inline: false
        }
      )
      .setTimestamp()
      .setFooter({ text: 'STIF SHOP System', iconURL: guild.iconURL() });

    if (winnerUser) {
      embed.setThumbnail(winnerUser.displayAvatarURL({ dynamic: true, size: 256 }));
    }

    if (granted.length) {
      embed.addFields({
        name: '`✅` **มอบยศสำเร็จ**',
        value: `${granted.map((id) => `<@${id}>`).join(', ')} (ได้รับยศ <@&${giveaway.roleId}> เรียบร้อย)`,
        inline: false
      });
    }

    if (failed.length) {
      embed.addFields({
        name: '⚠️ มอบยศไม่สำเร็จ',
        value: failed.map((f) => `• <@${f.id}> (เหตุผล: ${f.reason})`).join('\n'),
        inline: false
      });
    }

    await channel.send({
      content: `- \`👑\` **${winnersList}** **ยินดีด้วยค้าบ**!`,
      embeds: [embed]
    });

  } catch (err) {
    console.error('จบ giveaway แต่แก้ไขข้อความไม่สำเร็จ:', err);
  }

  return giveaway;
}

async function rerollGiveaway(client, giveawayId, count) {
  const data = readData();
  const giveaway = data.giveaways.find((g) => g.id === giveawayId);
  if (!giveaway) return { error: 'ไม่พบ giveaway นี้' };
  if (!giveaway.ended) return { error: 'giveaway นี้ยังไม่จบ' };
  if (!giveaway.participants.length) return { error: 'ไม่มีผู้เข้าร่วมให้สุ่ม' };

  const newWinners = pickWinners(giveaway.participants, count || giveaway.winnerCount);
  giveaway.winners = newWinners;
  await writeData(data);

  try {
    const channel = await client.channels.fetch(giveaway.channelId);
    const message = await channel.messages.fetch(giveaway.messageId);
    await message.edit(buildPayload(giveaway));

    const guild = await client.guilds.fetch(giveaway.guildId);
    const { granted, failed } = await grantRoleToWinners(guild, giveaway.roleId, newWinners);

    const lines = [
      `🔄 รีโรลผู้ชนะใหม่สำหรับ **${giveaway.prize}**: ${newWinners.map((id) => `<@${id}>`).join(', ')}`,
    ];
    if (granted.length) {
      lines.push(`- \`✅\` **มอบยศ** **<@&${giveaway.roleId}>** **ให้เรียบร้อยแล้ว:** ${granted.map((id) => `<@${id}>`).join(', ')}`);
    }
    if (failed.length) {
      lines.push(`⚠️ มอบยศไม่สำเร็จ: ${failed.map((f) => `<@${f.id}> (${f.reason})`).join(', ')}`);
    }
    lines.push(`ℹ️ หากต้องการถอนยศจากผู้ชนะคนเก่า กรุณาถอนด้วยตัวเอง`);

    const container = buildResultContainer({
      accentColor: 0xfee75c,
      title: `## 🔄 รีโรลผู้ชนะ`,
      lines,
    });
    await channel.send(buildResultPayload(container, newWinners));
  } catch (err) {
    console.error('รีโรลแต่แก้ไขข้อความไม่สำเร็จ:', err);
  }

  return { giveaway };
}

function scheduleEnd(client, giveawayId, delayMs) {
  const MAX_DELAY = 2_147_000_000;
  clearTimeout(activeTimers.get(giveawayId));

  if (delayMs > MAX_DELAY) {
    const t = setTimeout(() => scheduleEnd(client, giveawayId, delayMs - MAX_DELAY), MAX_DELAY);
    activeTimers.set(giveawayId, t);
    return;
  }

  const t = setTimeout(() => {
    endGiveaway(client, giveawayId).catch((e) => console.error(e));
  }, Math.max(delayMs, 0));

  activeTimers.set(giveawayId, t);
}

function resumeActiveGiveaways(client) {
  const data = readData();
  const now = Date.now();

  for (const g of data.giveaways) {
    if (g.ended) continue;
    const remaining = g.endAt - now;
    if (remaining <= 0) {
      endGiveaway(client, g.id).catch((e) => console.error(e));
    } else {
      scheduleEnd(client, g.id, remaining);
    }
  }
}

function findByShortRef(ref) {
  const data = readData();
  return data.giveaways.find((g) => g.id === ref || g.messageId === ref);
}

module.exports = {
  createGiveaway,
  toggleParticipant,
  endGiveaway,
  rerollGiveaway,
  resumeActiveGiveaways,
  findByShortRef,
  buildPayload,
};