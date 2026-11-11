// Niveles: XP cada 3 mensajes y por cada minuto en vc. /rank (tarjeta) y /top
const { Events, SlashCommandBuilder, AttachmentBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { FONT_STACK } = require('./welcome'); // registra fuentes
const cfg = require('../config');
const db = require('../discordStore');

const L = cfg.levels;
const FONT = FONT_STACK;
const users = () => db.get('xp', {}); // userId -> { xp, msgs, lastMsg, lastCh }

// XP para pasar del nivel n al n+1 (curva tipo MEE6)
const need = (n) => 5 * n * n + 50 * n + 100;

function levelInfo(total) {
  let lvl = 0;
  let rest = total;
  while (rest >= need(lvl)) {
    rest -= need(lvl);
    lvl++;
  }
  return { level: lvl, current: rest, needed: need(lvl) };
}

function rec(id) {
  const u = users();
  if (!u[id]) u[id] = { xp: 0, msgs: 0, lastMsg: 0, lastCh: null };
  return u[id];
}

async function addXp(guild, userId, amount, channelId) {
  const r = rec(userId);
  const before = levelInfo(r.xp).level;
  r.xp += amount;
  db.markDirty();
  const after = levelInfo(r.xp).level;
  if (after > before) await announce(guild, userId, after, channelId || r.lastCh).catch(() => {});
}

async function announce(guild, userId, level, channelId) {
  const chId = L.levelUpChannelId || channelId;
  if (!chId) return;
  const ch = await guild.channels.fetch(chId).catch(() => null);
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!ch?.isTextBased() || !member) return;
  const total = users()[userId]?.xp || 0;
  const png = await renderRank(member, { ...levelInfo(total), total, rank: rankOf(userId) });
  await ch.send({
    content: `🎉 ${member} subió a **nivel ${level}**! Sigue así 🔥`,
    files: [new AttachmentBuilder(png, { name: 'levelup.png' })],
    allowedMentions: { users: [userId] },
  });
}

function rankOf(userId) {
  const sorted = Object.entries(users()).sort((a, b) => b[1].xp - a[1].xp);
  return sorted.findIndex(([id]) => id === userId) + 1 || sorted.length + 1;
}

/* ---------- Tarjeta de rango ---------- */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function renderRank(member, data) {
  const W = 1000;
  const H = 300;
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');
  roundRect(ctx, 0, 0, W, H, 26);
  ctx.clip();

  const user = await member.user.fetch(true).catch(() => member.user);
  const bannerUrl = user.bannerURL?.({ size: 1024, extension: 'png' });
  const banner = bannerUrl ? await loadImage(bannerUrl).catch(() => null) : null;
  if (banner) {
    const s = Math.max(W / banner.width, H / banner.height);
    ctx.drawImage(banner, (W - banner.width * s) / 2, (H - banner.height * s) / 2, banner.width * s, banner.height * s);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, user.hexAccentColor || '#2b2d6e');
    g.addColorStop(1, '#0e0f17');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.fillStyle = 'rgba(8,8,14,0.62)';
  ctx.fillRect(0, 0, W, H);

  // panel de vidrio
  roundRect(ctx, 24, 24, W - 48, H - 48, 22);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // avatar
  const cx = 150;
  const cy = H / 2;
  const R = 92;
  const avatar = await loadImage(member.displayAvatarURL({ size: 256, extension: 'png', forceStatic: true })).catch(() => null);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R + 6, 0, Math.PI * 2);
  const ring = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  ring.addColorStop(0, '#57f287');
  ring.addColorStop(1, '#5865f2');
  ctx.fillStyle = ring;
  ctx.shadowColor = '#57f287';
  ctx.shadowBlur = 25;
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();
  if (avatar) ctx.drawImage(avatar, cx - R, cy - R, R * 2, R * 2);
  ctx.restore();

  // textos
  const x0 = 280;
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'alphabetic';
  let name = member.displayName;
  let size = 46;
  ctx.font = `${size}px ${FONT}`;
  while (ctx.measureText(name).width > 420 && size > 24) ctx.font = `${(size -= 2)}px ${FONT}`;
  ctx.fillText(name, x0, 118);

  ctx.textAlign = 'right';
  ctx.font = `22px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('RANGO', 800, 80);
  ctx.fillText('NIVEL', 935, 80);
  ctx.font = `48px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`#${data.rank}`, 800, 128);
  ctx.fillStyle = '#57f287';
  ctx.fillText(String(data.level), 935, 128);

  // barra
  const bx = x0;
  const by = 175;
  const bw = W - x0 - 64;
  const bh = 34;
  roundRect(ctx, bx, by, bw, bh, bh / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fill();
  const pct = Math.max(0.02, Math.min(1, data.current / data.needed));
  roundRect(ctx, bx, by, bw * pct, bh, bh / 2);
  const bar = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  bar.addColorStop(0, '#57f287');
  bar.addColorStop(1, '#5865f2');
  ctx.fillStyle = bar;
  ctx.fill();

  ctx.textAlign = 'right';
  ctx.font = `22px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(`${data.current.toLocaleString('es')} / ${data.needed.toLocaleString('es')} XP`, bx + bw, by + bh + 34);
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText(`Total: ${data.total.toLocaleString('es')} XP`, bx, by + bh + 34);

  return c.encode('png');
}

/* ---------- Comandos ---------- */
const defs = [
  new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Tu nivel y XP (o el de alguien)')
    .addUserOption((o) => o.setName('usuario').setDescription('De quién')),
  new SlashCommandBuilder().setName('top').setDescription('Top 10 de niveles del server'),
].map((c) => c.toJSON());
const names = ['rank', 'top'];

const autoDelete = (i) => setTimeout(() => i.deleteReply().catch(() => {}), L.replyDeleteMs);

async function handle(i) {
  if (L.rankChannelId && i.channelId !== L.rankChannelId) {
    return i.reply({ content: `Usa este comando en <#${L.rankChannelId}> 👀`, flags: MessageFlags.Ephemeral });
  }
  if (i.commandName === 'rank') {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const user = i.options.getUser('usuario') || i.user;
    const member = await i.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await i.editReply('Ese usuario no está en el server.');
      return autoDelete(i);
    }
    const total = users()[user.id]?.xp || 0;
    const info = levelInfo(total);
    const png = await renderRank(member, { ...info, total, rank: rankOf(user.id) });
    await i.editReply({ files: [new AttachmentBuilder(png, { name: 'rank.png' })] });
    return autoDelete(i);
  }
  if (i.commandName === 'top') {
    const top = Object.entries(users())
      .filter(([, v]) => v.xp > 0)
      .sort((a, b) => b[1].xp - a[1].xp)
      .slice(0, 10);
    const medals = ['🥇', '🥈', '🥉'];
    const lines = top.map(([id, v], n) => `${medals[n] || `**${n + 1}.**`} <@${id}> — Nivel **${levelInfo(v.xp).level}** · ${v.xp.toLocaleString('es')} XP`);
    await i.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xf1c40f)
          .setTitle(`🏆 Top niveles de ${i.guild.name}`)
          .setDescription(lines.join('\n') || 'Nadie tiene XP todavía 😭'),
      ],
      allowedMentions: { parse: [] },
      flags: MessageFlags.Ephemeral,
    });
    return autoDelete(i);
  }
}

/* ---------- Ganar XP ---------- */
function init(client) {
  client.on(Events.MessageCreate, (m) => {
    if (!m.guild || m.guild.id !== cfg.guildId || m.author.bot || m.webhookId) return;
    const r = rec(m.author.id);
    const now = Date.now();
    if (now - r.lastMsg < 1500) return; // anti-farm: mensajes muy seguidos no cuentan
    r.lastMsg = now;
    r.lastCh = m.channelId;
    r.msgs += 1;
    db.markDirty();
    if (r.msgs % L.xpPerMessages === 0) addXp(m.guild, m.author.id, L.xpForMessages, m.channelId).catch(() => {});
  });
}

function start(guild) {
  // cada minuto: XP para todos los que están en vc (menos el canal AFK)
  setInterval(() => {
    for (const vs of guild.voiceStates.cache.values()) {
      if (!vs.channelId || vs.channelId === guild.afkChannelId || vs.member?.user.bot) continue;
      addXp(guild, vs.id, L.xpPerVcMinute).catch(() => {});
    }
  }, 60_000).unref();
}

module.exports = { init, start, defs, names, handle, levelInfo, renderRank };
