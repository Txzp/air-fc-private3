// Expulsión masiva al arrancar (una sola vez): saca a todos los que tienen rol Member,
// menos el owner y los que tienen rol Bots. A cada uno le manda DM "regresamos pronto".
const cfg = require('../config');
const db = require('../discordStore');
const { log } = require('../logger');
const { ids } = require('./roles');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function memberRoleId(guild) {
  return ids.member || guild.roles.cache.find((r) => r.name.toLowerCase() === cfg.roles.member.toLowerCase())?.id;
}

// ¿tiene rol "Bots"? (por nombre, por si el server ya lo tenía)
function isBotsRole(member) {
  return member.roles.cache.some((r) => r.name.toLowerCase() === 'bots' || r.name.toLowerCase() === 'bot');
}

async function run(guild) {
  if (!cfg.massKick.enabled) return;
  if (db.get('massKickDone', false)) return console.log('[masskick] Ya se hizo antes, no repito');

  const roleId = memberRoleId(guild);
  if (!roleId) return console.error('[masskick] No encuentro el rol Member');

  const targets = guild.members.cache.filter(
    (m) => m.roles.cache.has(roleId) && m.id !== guild.ownerId && !cfg.ownerIds.includes(m.id) && !m.user.bot && !isBotsRole(m)
  );
  console.log(`[masskick] Expulsando a ${targets.size} miembros...`);

  let ok = 0;
  let fail = 0;
  for (const m of targets.values()) {
    if (!m.kickable) {
      fail++;
      continue;
    }
    await m.send('regresamos pronto').catch(() => {}); // DM antes de patear
    await m.kick('AirFc: limpieza (regresamos pronto)').then(() => ok++).catch(() => fail++);
    await sleep(400); // suave con el rate limit
  }

  db.set('massKickDone', true);
  await db.save().catch(() => {});
  log('danger', 'Expulsión masiva', `Se expulsó a ${ok} miembros con rol Member${fail ? ` (${fail} no se pudieron, ¿rol más alto que el bot?)` : ''}.`);
  console.log(`[masskick] Listo: ${ok} expulsados, ${fail} fallidos`);
}

module.exports = { run };
