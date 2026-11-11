const http = require('http');
const { Client, GatewayIntentBits, Partials, Events, ActivityType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const cfg = require('./config');
const logger = require('./logger');
const db = require('./discordStore');
const antispam = require('./modules/antispam');
const antinuke = require('./modules/antinuke');
const antiraid = require('./modules/antiraid');
const welcome = require('./modules/welcome');
const roles = require('./modules/roles');
const levels = require('./modules/levels');
const ann = require('./modules/ann');
const commands = require('./modules/commands');

if (!cfg.token) {
  console.error('Falta DISCORD_TOKEN en las variables de entorno.');
  process.exit(1);
}

/* ---------- Web (Render + UptimeRobot) ---------- */
let ready = false;
http
  .createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(ready ? 'AirFc online ⚽' : 'AirFc iniciando...');
  })
  .listen(cfg.port, () => console.log(`[web] Puerto ${cfg.port}`));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.GuildMember, Partials.User],
});

logger.init(client);
antispam.init(client);
antiraid.init(client);
welcome.init(client);
roles.init(client);
levels.init(client);
ann.init(client);
commands.init(client);

async function resolveGuild(c) {
  if (cfg.guildId) return c.guilds.fetch(cfg.guildId).catch(() => null);
  // sin GUILD_ID: el server es el del canal de bienvenida
  const ch = await c.channels.fetch(cfg.welcome.channelId).catch(() => null);
  if (ch?.guildId) cfg.guildId = ch.guildId;
  return ch?.guild || null;
}

async function intro(c, guild) {
  if (db.get('introSent', false)) return;
  const ch = await c.channels.fetch(cfg.intro.channelId).catch(() => null);
  if (!ch?.isTextBased()) return console.log('[intro] No veo el canal de presentación', cfg.intro.channelId);
  await ch.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('👋 Hola, soy AirFc')
        .setDescription(
          `Voy a ayudar a **${guild.name}** 💚\n\n` +
            '🛡️ **Anti-nuke y anti-spam** — nadie destruye el server\n' +
            '👋 **Bienvenidas y despedidas** con tarjeta\n' +
            '🎭 **Autorol** para los nuevos\n' +
            '📈 **Niveles** — XP por mensajes y por estar en vc (`/rank`, `/top`)\n' +
            '📢 **Anuncios** con `/ann`'
        )
        .setThumbnail(c.user.displayAvatarURL({ size: 256 }))
        .setFooter({ text: cfg.creatorTag }),
    ],
  });
  db.set('introSent', true);
  await db.save();
}

client.once(Events.ClientReady, async (c) => {
  console.log(`[bot] Conectado como ${c.user.tag}`);
  const guild = await resolveGuild(c);
  if (!guild) {
    console.error('[bot] No encuentro el server. Invítame o pon GUILD_ID.');
    return;
  }
  console.log(`[bot] Server: ${guild.name} (${guild.id})`);
  c.user.setPresence({ activities: [{ name: `Protegiendo ${guild.name} 👁️`, type: ActivityType.Watching }], status: 'online' });

  await guild.members.fetch().catch((e) => console.error('[bot] No pude cargar miembros (¿SERVER MEMBERS INTENT?)', e.message));
  await guild.roles.fetch().catch(() => {});
  await guild.channels.fetch().catch(() => {});
  await db.load(guild).catch((e) => console.error('[db]', e.message));
  db.start();
  await roles.setup(guild).catch((e) => console.error('[roles]', e.message));
  await antinuke.init(c, guild);
  await commands.register(guild).catch((e) => console.error('[bot] Comandos:', e.message));
  levels.start(guild);
  ready = true;

  const me = guild.members.me;
  logger.log(
    me.permissions.has(PermissionFlagsBits.Administrator) ? 'ok' : 'warn',
    'AirFc en línea',
    me.permissions.has(PermissionFlagsBits.Administrator) ? 'Anti-nuke, anti-spam, welcome, niveles y autorol activos.' : '❌ No tengo Administrador.'
  );
  await intro(c, guild).catch((e) => console.error('[intro]', e.message));
});

client.on(Events.Error, (e) => console.error('[client]', e));

let shuttingDown = false;
async function shutdown(sig) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[bot] ${sig}: guardando datos...`);
  db.markDirty();
  await Promise.race([db.save(), new Promise((r) => setTimeout(r, 8000))]).catch(() => {});
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (e) => console.error('[unhandled]', e));
process.on('uncaughtException', (e) => console.error('[uncaught]', e));

client.login(cfg.token);
