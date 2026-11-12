const { Events, SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const cfg = require('../config');
const store = require('../store');
const db = require('../discordStore');
const { isOwner, isTrusted } = require('../trust');
const { log } = require('../logger');
const levels = require('./levels');
const ann = require('./ann');

const admin = [
  new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Usuarios/bots de confianza (el anti-nuke los ignora)')
    .addSubcommand((s) => s.setName('add').setDescription('Añadir').addUserOption((o) => o.setName('usuario').setDescription('Usuario o bot').setRequired(true)))
    .addSubcommand((s) => s.setName('remove').setDescription('Quitar').addUserOption((o) => o.setName('usuario').setDescription('Usuario o bot').setRequired(true)))
    .addSubcommand((s) => s.setName('list').setDescription('Ver la whitelist')),
  new SlashCommandBuilder().setName('lockdown').setDescription('Bloquea todos los canales de texto'),
  new SlashCommandBuilder().setName('unlock').setDescription('Quita el bloqueo'),
  new SlashCommandBuilder().setName('status').setDescription('Estado de AirFc'),
  new SlashCommandBuilder().setName('cln').setDescription('⚠️ Borra TODOS los canales (deja las categorías)'),
].map((c) => c.setDefaultMemberPermissions(PermissionFlagsBits.Administrator).toJSON());

const defs = [...admin, ...levels.defs, ...ann.defs];

async function onInteraction(i) {
  if (!i.isChatInputCommand() || i.guildId !== cfg.guildId) return;
  if (levels.names.includes(i.commandName)) return levels.handle(i);
  if (ann.names.includes(i.commandName)) return ann.handle(i);

  const guild = i.guild;
  const reply = (content) => i.reply({ content, flags: MessageFlags.Ephemeral });
  if (!isTrusted(guild, i.user.id)) return reply('🛡️ Solo el dueño, Manager y la whitelist.');

  switch (i.commandName) {
    case 'cln': {
      if (!isOwner(guild, i.user.id)) return reply('❌ Solo el dueño del server (o k940) puede usar /cln.');
      const n = guild.channels.cache.filter((c) => c.id !== cfg.cln.keepChannelId && c.name !== db.NAME && !c.isThread?.()).size;
      return i.reply({
        content: `⚠️ **¿Seguro?** Voy a borrar **TODO** (${n} canales y categorías), menos <#${cfg.cln.keepChannelId}>, y banear a **${cfg.cln.banIds.length}** usuarios.\nEsto **NO se puede deshacer**.`,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('cln_yes').setLabel('Sí, hacer limpieza').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cln_no').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }
    case 'whitelist': {
      const sub = i.options.getSubcommand();
      if (sub === 'list') {
        const ids = [...new Set([...cfg.whitelist, ...store.data.whitelist])];
        return reply(ids.length ? ids.map((id) => `• <@${id}> \`${id}\``).join('\n') : 'Vacía (solo el dueño y Manager son de confianza).');
      }
      if (!isOwner(guild, i.user.id)) return reply('Solo el dueño puede cambiar la whitelist.');
      const u = i.options.getUser('usuario');
      if (sub === 'add') {
        if (!store.data.whitelist.includes(u.id)) store.data.whitelist.push(u.id);
      } else store.data.whitelist = store.data.whitelist.filter((x) => x !== u.id);
      store.save();
      log('info', 'Whitelist', `${i.user} ${sub === 'add' ? 'añadió' : 'quitó'} a ${u} (\`${u.id}\`).`);
      return reply(sub === 'add' ? `✅ ${u} ahora es de confianza.` : `🗑️ ${u} fuera de la whitelist.`);
    }
    case 'lockdown':
    case 'unlock': {
      await i.deferReply();
      const lock = i.commandName === 'lockdown';
      let n = 0;
      for (const ch of guild.channels.cache.values()) {
        if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(ch.type)) continue;
        await ch.permissionOverwrites.edit(guild.id, { SendMessages: lock ? false : null }, { reason: `AirFc ${i.commandName}` }).then(() => n++).catch(() => {});
      }
      log(lock ? 'danger' : 'ok', lock ? 'LOCKDOWN' : 'Unlock', `${i.user} ${lock ? 'bloqueó' : 'desbloqueó'} ${n} canales.`);
      return i.editReply(lock ? `🔒 ${n} canales bloqueados.` : `🔓 ${n} canales desbloqueados.`);
    }
    case 'status': {
      const me = guild.members.me;
      const above = guild.roles.cache.filter((r) => r.position > me.roles.highest.position && !r.managed && !cfg.trustedRoles.includes(r.id)).size;
      return i.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle('🛡️ AirFc — estado')
            .addFields(
              { name: 'Ping', value: `${i.client.ws.ping} ms`, inline: true },
              { name: 'Encendido', value: `<t:${Math.floor((Date.now() - i.client.uptime) / 1000)}:R>`, inline: true },
              { name: 'Administrador', value: me.permissions.has(PermissionFlagsBits.Administrator) ? '✅' : '❌ (dámelo)', inline: true },
              { name: 'Posición de mi rol', value: above ? `⚠️ Hay ${above} roles encima de mí` : '✅ Bien' }
            )
            .setFooter({ text: cfg.creatorTag }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

/* ---------- /cln: borrar todos los canales menos categorías ---------- */
async function onClnButton(i) {
  if (!isOwner(i.guild, i.user.id)) return i.reply({ content: '❌ No.', flags: MessageFlags.Ephemeral });
  if (i.customId === 'cln_no') return i.update({ content: '✅ Cancelado, no borré nada.', components: [] });

  await i.update({ content: '🗑️ Haciendo limpieza...', components: [] });
  const guild = i.guild;

  // 1) banear a los usuarios de la lista
  let banned = 0;
  for (const id of cfg.cln.banIds) {
    await guild.bans.create(id, { reason: 'AirFc: /cln' }).then(() => banned++).catch(() => {});
  }

  // 2) borrar TODO menos el canal de data del bot
  const targets = guild.channels.cache.filter((c) => c.id !== cfg.cln.keepChannelId && c.name !== db.NAME && !c.isThread?.());
  let ok = 0;
  let fail = 0;
  for (const ch of targets.values()) {
    await ch.delete('AirFc: /cln').then(() => ok++).catch(() => fail++);
  }

  log('danger', '/cln', `${i.user} hizo limpieza: ${ok} canales borrados, ${banned} baneados${fail ? ` (${fail} canales no se pudieron)` : ''}.`);
  // el canal donde se usó el comando puede haber sido borrado → DM
  await i.user.send('listo se hizo limpieaza😊').catch(() => {});
}

function init(client) {
  client.on(Events.InteractionCreate, (i) => {
    if (i.isButton?.() && (i.customId === 'cln_yes' || i.customId === 'cln_no') && i.guildId === cfg.guildId) {
      return onClnButton(i).catch((e) => console.error('[cln]', e));
    }
    onInteraction(i).catch((e) => {
      console.error('[commands]', e);
      if (i.isRepliable() && !i.replied && !i.deferred) i.reply({ content: `❌ ${e.message}`, flags: MessageFlags.Ephemeral }).catch(() => {});
    });
  });
}

const register = (guild) => guild.commands.set(defs);

module.exports = { init, register };
