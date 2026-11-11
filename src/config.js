require('dotenv').config();

const list = (v) => (v || '').split(',').map((s) => s.trim()).filter(Boolean);
const bool = (v, def) => (v === undefined || v === '' ? def : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase()));
const num = (v, def) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? def : Number(v));

module.exports = {
  token: process.env.DISCORD_TOKEN,
  // Si no se pone, se detecta solo con el canal de bienvenida
  guildId: process.env.GUILD_ID || '',
  logChannelId: process.env.LOG_CHANNEL_ID || '1570120942439506143',
  port: num(process.env.PORT, 3000),
  botName: 'AirFc',
  creatorTag: 'Made By: zk (k940)',

  // Se llenan al arrancar con los ids reales de los roles que crea el bot
  protectedRoles: {},
  trustedRoles: [],

  // Roles que el bot crea si no existen
  roles: {
    manager: process.env.ROLE_MANAGER_NAME || 'Manager',
    support: process.env.ROLE_SUPPORT_NAME || 'Support',
    member: process.env.ROLE_MEMBER_NAME || 'Member',
  },

  // Dueños del bot (además del dueño del server)
  ownerIds: list(process.env.OWNER_IDS).length ? list(process.env.OWNER_IDS) : ['303188562168250369'], // k940
  whitelist: list(process.env.WHITELIST_IDS),

  welcome: {
    channelId: process.env.WELCOME_CHANNEL_ID || '1570098657305563227',
    goodbyeChannelId: process.env.GOODBYE_CHANNEL_ID || '1570098705686732852',
    serverName: process.env.SERVER_NAME || '', // vacío = nombre real del server
    emojiName: process.env.WELCOME_EMOJI || 'hola',
  },

  intro: {
    channelId: process.env.INTRO_CHANNEL_ID || '1567736117598490697',
  },

  levels: {
    xpPerMessages: 3, // cada 3 mensajes...
    xpForMessages: num(process.env.XP_PER_3_MESSAGES, 15), // ...da 15 XP
    xpPerVcMinute: num(process.env.XP_PER_VC_MINUTE, 5), // 5 XP por minuto en vc
    levelUpChannelId: process.env.LEVELUP_CHANNEL_ID || '', // vacío = en el mismo canal donde subió
  },

  antiSpam: {
    messages: num(process.env.SPAM_MESSAGES, 15), // 15 mensajes...
    windowMs: num(process.env.SPAM_WINDOW_MS, 10_000), // ...en 10 s
    mentions: num(process.env.SPAM_MENTIONS, 10), // 10 menciones en la ventana
    freeStrikes: Infinity, // siempre 60 s (sin escalar)
    strikeTimeoutMs: 60_000,
    finalTimeoutMs: 60_000,
    strikeResetMs: 60 * 60_000,
    maxMentions: num(process.env.SPAM_MENTIONS, 10),
    antiInvite: bool(process.env.ANTI_INVITE, true),
    webhookMessages: 8,
    webhookWindowMs: 5_000,
  },

  honeypot: { channelId: '', channelName: '', timeoutMs: 5 * 60_000 },

  antiNuke: {
    windowMs: num(process.env.NUKE_WINDOW_MS, 15_000),
    limits: { channelDelete: 2, channelCreate: 4, roleDelete: 2, roleCreate: 4, ban: 3, kick: 4, emojiDelete: 4, webhookCreate: 2, roleStrip: 5 },
    humanPunishment: (process.env.NUKE_HUMAN_PUNISHMENT || 'strip').toLowerCase(),
  },

  antiRaid: {
    joins: num(process.env.RAID_JOINS, 8),
    windowMs: num(process.env.RAID_WINDOW_MS, 10_000),
    raidModeMs: num(process.env.RAID_MODE_MS, 10 * 60_000),
    raidMinAccountAgeDays: num(process.env.RAID_MIN_ACCOUNT_AGE_DAYS, 7),
    minAccountAgeDays: num(process.env.MIN_ACCOUNT_AGE_DAYS, 0),
  },
};
