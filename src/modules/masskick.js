// Expulsión masiva al arrancar (una sola vez): saca a todos los que tienen rol Member,
// menos el owner y los que tienen rol Bots. A cada uno le manda DM "regresamos pronto".
const cfg = require('../config');
const db = require('../discordStore');
const { log } = require('../logger');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Roles protegidos por nombre: Bots, Manager, Support (staff y bots no se tocan)
const PROTECTED_NAMES = ['bots', 'bot', cfg.roles.manager.toLowerCase(), cfg.roles.support.toLowerCase()];
function isProtectedByRole(member) {
  return member.roles.cache.some((r) => PROTECTED_NAMES.includes(r.name.toLowerCase())) || (cfg.trustedRoles || []).some((id) => member.roles.cache.has(id));
}

async function run(guild) {
  if (!cfg.massKick.enabled) return;
  if (db.get('massKickDone', false)) return console.log('[masskick] Ya se hizo antes, no repito');

  // Saca a TODOS (tengan rol Member o ningún rol) menos: owner, bots y staff (Bots/Manager/Support)
  const targets = guild.members.cache.filter(
    (m) => m.id !== guild.ownerId && !cfg.ownerIds.includes(m.id) && !m.user.bot && !isProtectedByRole(m)
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
  log('danger', 'Expulsión masiva', `Se expulsó a ${ok} miembros (Member y sin rol)${fail ? ` (${fail} no se pudieron, ¿rol más alto que el bot?)` : ''}.`);
  console.log(`[masskick] Listo: ${ok} expulsados, ${fail} fallidos`);
}

module.exports = { run };
