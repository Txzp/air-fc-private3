# ⚽ AirFc

Bot de Discord para un solo server. **Made By: zk (k940)**

## Qué trae

**🛡️ Anti-nuke** — lee el registro de auditoría en tiempo real
- Bot añadido por alguien sin confianza → expulsado al instante.
- Bot sin confianza que borre/cree/banee lo que sea → sin permisos y baneado a la primera.
- Humanos que borren 2 canales/roles, baneen 3, etc. en 15 s → sin roles y aislados 28 días.
- Restaura canales y roles borrados (y se los devuelve a los miembros), revierte permisos peligrosos, baneos del nuker y cambios del server.

**🔇 Anti-spam**
- 15 mensajes en 10 s → silencio **60 s**.
- 10 menciones (sumando mensajes) en 10 s → silencio **60 s**.
- Borra invitaciones de otros servers, muros de raid y webhooks que spamean.

**👋 Bienvenida y despedida** — tarjeta con banner, foto y nombre en sus canales.

**🎭 Roles y autorol** — al arrancar crea **Manager** (todos los permisos), **Support** (moderación) y **Member** (normal). Quien entra recibe Member.

**📈 Niveles** — 15 XP cada 3 mensajes y 5 XP por minuto en vc. `/rank` (tarjeta) y `/top`.

**📢 Anuncios** — `/ann` abre un formulario (Title, Description, Ping) y manda `# Title` + **Description**. Solo Manager/Support.

**⚙️ Admin** — `/lockdown`, `/unlock`, `/whitelist`, `/status`.

Los datos (XP, roles, etc.) se guardan en el canal oculto `airfc-data` → sobreviven a los redeploys de Render. No lo borren.

## Configurar

1. Developer Portal → Bot → activa **SERVER MEMBERS INTENT** y **MESSAGE CONTENT INTENT**.
2. Invítalo con Administrador:
   `https://discord.com/oauth2/authorize?client_id=TU_CLIENT_ID&permissions=8&scope=bot%20applications.commands`
3. Sube su rol **arriba del todo**.
4. Render → New Web Service → este repo → Build `npm install`, Start `npm start`, plan Free → variable `DISCORD_TOKEN`.
5. UptimeRobot → monitor HTTP(s) con la URL de Render cada 5 min.
