const path = require('path');
const { Events, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const cfg = require('../config');

const FONTS = path.join(__dirname, '..', '..', 'assets', 'fonts');
GlobalFonts.registerFromPath(path.join(FONTS, 'Poppins-Bold.ttf'), 'Poppins');
GlobalFonts.registerFromPath(path.join(FONTS, 'DejaVuSans-Bold.ttf'), 'DejaVu');
GlobalFonts.registerFromPath(path.join(FONTS, 'NotoColorEmoji.ttf'), 'Emoji');
// Letras "fancy" de los nombres (𝕸𝖊𝖑𝖆𝖓𝖞, 𝚂𝚑𝚊𝚍𝚘𝚠), japonés (ミ 彡) y otros símbolos
GlobalFonts.registerFromPath(path.join(FONTS, 'FancyMath.ttf'), 'FancyMath');
GlobalFonts.registerFromPath(path.join(FONTS, 'CJK.otf'), 'CJK');
GlobalFonts.registerFromPath(path.join(FONTS, 'Extra.otf'), 'Extra');
const FONT_STACK = 'Poppins, DejaVu, FancyMath, CJK, Extra, Emoji, sans-serif';

const W = 1000;
const H = 420;

function coverImage(ctx, img, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const iw = img.width * scale;
  const ih = img.height * scale;
  ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function renderCard(member, opts = {}) {
  const user = await member.user.fetch(true).catch(() => member.user); // trae banner y color
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  roundRect(ctx, 0, 0, W, H, 28);
  ctx.clip();

  // Fondo: banner del usuario, o degradado con su color de perfil
  const bannerUrl = user.bannerURL({ size: 1024, extension: 'png' });
  let drewBanner = false;
  if (bannerUrl) {
    const banner = await loadImage(bannerUrl).catch(() => null);
    if (banner) {
      coverImage(ctx, banner, W, H);
      drewBanner = true;
    }
  }
  if (!drewBanner) {
    const accent = user.hexAccentColor || '#5865f2';
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, accent);
    g.addColorStop(1, '#0d0d14');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // Capa oscura para que se lea el texto
  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(0,0,0,0.25)');
  shade.addColorStop(1, 'rgba(0,0,0,0.65)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);

  // Tinte de color opcional (ej. rosa Nitro para boosts)
  if (opts.tint) {
    const t = ctx.createLinearGradient(0, 0, W, H);
    opts.tint.forEach((c, i) => t.addColorStop(i / (opts.tint.length - 1), c));
    ctx.fillStyle = t;
    ctx.fillRect(0, 0, W, H);
  }

  // Partículas / brillos opcionales
  if (opts.sparkles) {
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const r = Math.random() * 2.6 + 0.6;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${(Math.random() * 0.6 + 0.25).toFixed(2)})`;
      ctx.fill();
    }
  }

  // Texto superior opcional
  if (opts.badge) {
    ctx.save();
    ctx.font = `22px ${FONT_STACK}`;
    const bw = ctx.measureText(opts.badge).width + 44;
    roundRect(ctx, W / 2 - bw / 2, 16, bw, 38, 19);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(opts.badge, W / 2, 36);
    ctx.restore();
  }

  // Foto de perfil al centro
  const R = 95;
  const cx = W / 2;
  const cy = opts.badge ? 172 : 165;
  const avatar = await loadImage(member.displayAvatarURL({ size: 512, extension: 'png', forceStatic: true })).catch(() => null);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 25;
  ctx.beginPath();
  ctx.arc(cx, cy, R + (opts.ring ? 9 : 7), 0, Math.PI * 2);
  if (opts.ring) {
    const rg = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    opts.ring.forEach((c, i) => rg.addColorStop(i / (opts.ring.length - 1), c));
    ctx.shadowColor = opts.ring[0];
    ctx.shadowBlur = 40;
    ctx.fillStyle = rg;
  } else ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();
  if (avatar) ctx.drawImage(avatar, cx - R, cy - R, R * 2, R * 2);
  else {
    ctx.fillStyle = '#2b2d31';
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  }
  ctx.restore();

  // DisplayName en blanco
  const name = member.displayName || user.globalName || user.username;
  let size = 56;
  ctx.font = `${size}px ${FONT_STACK}`;
  while (ctx.measureText(name).width > W - 120 && size > 26) {
    size -= 2;
    ctx.font = `${size}px ${FONT_STACK}`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.75)';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(name, cx, opts.badge ? 330 : 325);

  ctx.shadowBlur = 8;
  ctx.font = `24px ${FONT_STACK}`;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(opts.subtitle ?? `Miembro #${member.guild.memberCount}`, cx, opts.badge ? 380 : 375);

  return canvas.encode('png');
}

const serverName = (guild) => cfg.welcome.serverName || guild.name;

/* ---------- Tarjetas con las imágenes del server ---------- */
const IMG = path.join(__dirname, '..', '..', 'assets', 'img');
const bgCache = {};
async function bg(kind) {
  if (!bgCache[kind]) bgCache[kind] = await loadImage(path.join(IMG, `${kind}.png`));
  return bgCache[kind];
}

// Dónde va la foto y el nombre en cada imagen (escala 1000x1000) para no tapar su texto
const LAYOUT = {
  welcome: { avatar: { x: 500, y: 392, r: 82 }, nameY: 935, ring: ['#c084fc', '#7c3aed', '#c084fc'], glow: '#a855f7' },
  bye: { avatar: { x: 868, y: 150, r: 92 }, nameY: 955, ring: ['#86efac', '#16a34a', '#86efac'], glow: '#22c55e' },
};

async function renderImageCard(member, kind) {
  const S = 1000;
  const L = LAYOUT[kind];
  const c = createCanvas(S, S);
  const ctx = c.getContext('2d');
  ctx.drawImage(await bg(kind), 0, 0, S, S);

  // foto de perfil con aro brillante
  const { x, y, r } = L.avatar;
  const avatar = await loadImage(member.displayAvatarURL({ size: 512, extension: 'png', forceStatic: true })).catch(() => null);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r + 8, 0, Math.PI * 2);
  const rg = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  L.ring.forEach((col, i) => rg.addColorStop(i / (L.ring.length - 1), col));
  ctx.fillStyle = rg;
  ctx.shadowColor = L.glow;
  ctx.shadowBlur = 40;
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  if (avatar) ctx.drawImage(avatar, x - r, y - r, r * 2, r * 2);
  ctx.restore();

  // nombre en una píldora oscura abajo
  const name = member.displayName || member.user.globalName || member.user.username;
  let size = 46;
  ctx.font = `${size}px ${FONT_STACK}`;
  while (ctx.measureText(name).width > S - 220 && size > 24) ctx.font = `${(size -= 2)}px ${FONT_STACK}`;
  const tw = ctx.measureText(name).width;
  const ph = size + 30;
  roundRect(ctx, S / 2 - tw / 2 - 34, L.nameY - ph / 2, tw + 68, ph, ph / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fill();
  ctx.strokeStyle = L.glow;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 10;
  ctx.fillText(name, S / 2, L.nameY + 2);

  return c.encode('jpeg', 90);
}

async function onJoin(member) {
  if (member.guild.id !== cfg.guildId || member.user.bot) return;
  const ch = await member.guild.channels.fetch(cfg.welcome.channelId).catch(() => null);
  if (!ch?.isTextBased()) return;
  const emoji = member.guild.emojis.cache.find((e) => e.name === cfg.welcome.emojiName);
  const img = await renderImageCard(member, 'welcome');
  await ch.send({
    content: `${member} **Bienvenid@ a ${serverName(member.guild)}** ${emoji ? emoji.toString() : '👋'}`,
    embeds: [new EmbedBuilder().setColor(0x8b5cf6).setImage('attachment://welcome.jpg')],
    files: [new AttachmentBuilder(img, { name: 'welcome.jpg' })],
    allowedMentions: { users: [member.id] },
  });
}

async function onLeave(member) {
  if (member.guild.id !== cfg.guildId || member.user?.bot) return;
  const ch = await member.guild.channels.fetch(cfg.welcome.goodbyeChannelId).catch(() => null);
  if (!ch?.isTextBased() || !member.user) return;
  const fake = {
    user: member.user,
    displayName: member.displayName || member.user.globalName || member.user.username,
    displayAvatarURL: (o) => member.user.displayAvatarURL(o),
  };
  const img = await renderImageCard(fake, 'bye');
  await ch.send({
    content: `**${fake.displayName}** se fue de **${serverName(member.guild)}** 💔`,
    embeds: [new EmbedBuilder().setColor(0x22c55e).setImage('attachment://bye.jpg')],
    files: [new AttachmentBuilder(img, { name: 'bye.jpg' })],
    allowedMentions: { parse: [] },
  });
}

function init(client) {
  client.on(Events.GuildMemberAdd, (m) =>
    // pequeño retraso: si el anti-raid lo expulsa, no se da la bienvenida
    setTimeout(() => {
      if (!m.guild.members.cache.has(m.id)) return;
      onJoin(m).catch((e) => console.error('[welcome]', e));
    }, 2500)
  );
  client.on(Events.GuildMemberRemove, (m) => onLeave(m).catch((e) => console.error('[goodbye]', e)));
}

module.exports = { init, renderCard, renderImageCard, FONT_STACK };
