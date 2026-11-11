const { Events, SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, MessageFlags } = require('discord.js');
const cfg = require('../config');
const store = require('../store');
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

function init(client) {
  client.on(Events.InteractionCreate, (i) =>
    onInteraction(i).catch((e) => {
      console.error('[commands]', e);
      if (i.isRepliable() && !i.replied && !i.deferred) i.reply({ content: `❌ ${e.message}`, flags: MessageFlags.Ephemeral }).catch(() => {});
    })
  );
}

const register = (guild) => guild.commands.set(defs);

module.exports = { init, register };
