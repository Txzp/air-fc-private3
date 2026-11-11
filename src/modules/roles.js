// Crea los roles del server (Manager, Support, Member) y da Member a quien entra
const { Events, PermissionFlagsBits: P } = require('discord.js');
const cfg = require('../config');
const db = require('../discordStore');
const { log } = require('../logger');

const DEFS = {
  manager: {
    name: () => cfg.roles.manager,
    color: 0xe74c3c,
    hoist: true,
    permissions: [P.Administrator],
  },
  support: {
    name: () => cfg.roles.support,
    color: 0x3498db,
    hoist: true,
    permissions: [
      P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AddReactions, P.AttachFiles, P.EmbedLinks, P.UseExternalEmojis,
      P.UseExternalStickers, P.UseApplicationCommands, P.ChangeNickname, P.CreatePublicThreads, P.SendMessagesInThreads,
      P.Connect, P.Speak, P.Stream, P.UseVAD,
      // moderación
      P.ViewAuditLog, P.KickMembers, P.ModerateMembers, P.ManageMessages, P.ManageNicknames, P.ManageThreads,
      P.MoveMembers, P.MuteMembers, P.DeafenMembers, P.PrioritySpeaker,
    ],
  },
  member: {
    name: () => cfg.roles.member,
    color: 0x2ecc71,
    hoist: false,
    permissions: [
      P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AddReactions, P.AttachFiles, P.EmbedLinks, P.UseExternalEmojis,
      P.UseExternalStickers, P.UseApplicationCommands, P.ChangeNickname, P.CreatePublicThreads, P.SendMessagesInThreads,
      P.Connect, P.Speak, P.Stream, P.UseVAD,
    ],
  },
};

const ids = {}; // manager/support/member -> roleId

async function setup(guild) {
  const saved = db.get('roleIds', {});
  const created = [];
  for (const [key, def] of Object.entries(DEFS)) {
    let role = (saved[key] && guild.roles.cache.get(saved[key])) || guild.roles.cache.find((r) => r.name === def.name() && !r.managed);
    if (!role) {
      role = await guild.roles.create({
        name: def.name(),
        color: def.color,
        hoist: def.hoist,
        mentionable: key !== 'member',
        permissions: def.permissions,
        reason: 'AirFc: roles del servidor',
      });
      created.push(role);
    }
    ids[key] = role.id;
    saved[key] = role.id;
  }
  db.markDirty();

  // Orden: Manager > Support > Member, justo debajo del rol del bot
  if (created.length) {
    const top = guild.members.me.roles.highest.position;
    await guild.roles
      .setPositions([
        { role: ids.manager, position: Math.max(1, top - 1) },
        { role: ids.support, position: Math.max(1, top - 2) },
        { role: ids.member, position: Math.max(1, top - 3) },
      ])
      .catch((e) => console.error('[roles] No pude ordenar los roles:', e.message));
    log('ok', 'Roles creados', created.map((r) => `${r}`).join(', '));
  }

  // Para el anti-nuke: Manager es de confianza, Member se respalda
  cfg.trustedRoles = [ids.manager];
  cfg.protectedRoles = { member: ids.member };

  // Primera vez: los que ya estaban y no tienen ningún rol reciben Member
  if (!db.get('membersBackfilled', false)) {
    let n = 0;
    for (const m of guild.members.cache.values()) {
      if (m.user.bot || m.roles.cache.size > 1) continue;
      if (await m.roles.add(ids.member, 'AirFc: rol Member inicial').then(() => true).catch(() => false)) n++;
    }
    db.set('membersBackfilled', true);
    if (n) log('ok', 'Member repartido', `${n} miembros sin rol recibieron <@&${ids.member}>.`);
  }
}

function init(client) {
  client.on(Events.GuildMemberAdd, (m) => {
    if (m.guild.id !== cfg.guildId || m.user.bot || !ids.member) return;
    // pequeño retraso por si el anti-raid lo saca
    setTimeout(() => {
      if (!m.guild.members.cache.has(m.id)) return;
      m.roles.add(ids.member, 'AirFc: autorol').catch((e) => console.error('[autorol]', e.message));
    }, 2000);
  });
}

module.exports = { setup, init, ids };
