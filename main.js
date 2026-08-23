require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, MessageFlags } = require('discord.js');
const { SimpleShardingStrategy } = require('@discordjs/ws');
const { toggleParticipant, resumeActiveGiveaways } = require('./utils/giveawayManager');
const { MODAL_ID, handleSetupButton, handleSetupModalSubmit } = require('./utils/setupModal');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  ws: {
    buildStrategy: (manager) => {
      manager.options.identifyProperties = {
        os: "iOS",
        browser: "Discord iOS",
        device: "iOS",
      };
      return new SimpleShardingStrategy(manager);
    },
  },
});

client.commands = new Collection();

const V2 = MessageFlags.IsComponentsV2;
const V2_EPHEMERAL = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

const { Events } = require('discord.js');

client.once(Events.ClientReady, async (c) => {
  console.log(`ล็อกอินสำเร็จในชื่อ ${c.user.tag}`);

  const activity = {
    name: "🟢 > STIF SHOP GIVEAWAY <",
    type: 0,
  };

    await client.user.setPresence({
    status: "online",
    activities: [activity],
  });
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('giveaway_join_')) {
      const giveawayId = interaction.customId.replace('giveaway_join_', '');
      await toggleParticipant(interaction, giveawayId);
      return;
    }

    if (interaction.isButton() && interaction.customId === 'setup_giveaway_open_modal') {
      await handleSetupButton(interaction);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === MODAL_ID) {
      await handleSetupModalSubmit(interaction);
      return;
    }
  } catch (err) {
    console.error('เกิดข้อผิดพลาดตอนจัดการ interaction:', err);
    const payload = { content: '❌ เกิดข้อผิดพลาด ลองใหม่อีกครั้ง', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
