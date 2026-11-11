// /ann → formulario (Título, Descripción, Ping) → mensaje "# Título" + "**Descripción**"
const { Events, SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const cfg = require('../config');
const { isStaff } = require('../trust');

const defs = [new SlashCommandBuilder().setName('ann').setDescription('Hacer un anuncio 📢').toJSON()];
const names = ['ann'];

async function handle(i) {
  if (!isStaff(i.member)) return i.reply({ content: '❌ Solo Manager o Support pueden hacer anuncios.', flags: MessageFlags.Ephemeral });
  const modal = new ModalBuilder()
    .setCustomId('ann_modal')
    .setTitle('📢 Nuevo anuncio')
    .addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Title').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(150)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('desc').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1700)),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('ping').setLabel('Ping (everyone, here o vacío)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(10).setPlaceholder('vacío = sin ping')
      )
    );
  await i.showModal(modal);
}

async function onSubmit(i) {
  const title = i.fields.getTextInputValue('title').trim();
  const desc = i.fields.getTextInputValue('desc').trim();
  const ping = (i.fields.getTextInputValue('ping') || '').trim().toLowerCase().replace('@', '');
  // negrita línea por línea para que Discord la respete en todas
  const body = desc
    .split('\n')
    .map((l) => (l.trim() ? `**${l.trim().replace(/\*\*/g, '')}**` : ''))
    .join('\n');
  const pingText = ping === 'everyone' ? '@everyone\n' : ping === 'here' ? '@here\n' : '';
  await i.channel.send({
    content: `${pingText}# ${title}\n${body}`,
    allowedMentions: { parse: ping === 'everyone' || ping === 'here' ? ['everyone'] : [] },
  });
  await i.reply({ content: '✅ Anuncio enviado', flags: MessageFlags.Ephemeral });
}

function init(client) {
  client.on(Events.InteractionCreate, (i) => {
    if (!i.isModalSubmit() || i.customId !== 'ann_modal' || i.guildId !== cfg.guildId) return;
    onSubmit(i).catch((e) => {
      console.error('[ann]', e);
      if (!i.replied) i.reply({ content: `❌ ${e.message}`, flags: MessageFlags.Ephemeral }).catch(() => {});
    });
  });
}

module.exports = { init, defs, names, handle };
