import WebSocket from "ws";

const URL   = "ws://localhost:3000";
const COUNT = Number(process.argv[2] || 6);
const jobs  = ["Police","Mechanic","EMS","Taxi","Gang","Civilian","Medic","Dealer","Mayor","Firefighter"];
const vehs  = ["infernus","sultan","ambulance","taxi","bison","police","bus","firetruck","helicopter","bmx"];
const wths  = ["sunny","rain","storm","fog","snow","chaos"];
const items = ["pistol","shotgun","medkit","armor","grenade","knife","radio","drug","money_bag","keycard"];

const pick = (a) => a[Math.floor(Math.random() * a.length)];

function makeBot(i) {
  const id  = `Player${100+i}`;
  const bot = {
    id, angle: i*0.9, radius: 6+i*2.8,
    speed: 0.022+i*0.003,
    job:  pick(jobs), vehicle: pick(vehs),
    wanted: Math.floor(Math.random()*3),
    health: 70+Math.floor(Math.random()*31),
    ws: null, timer: null
  };

  bot.ws = new WebSocket(URL);

  bot.ws.on("open", () => {
    console.log(`[SIM] ${id} connecte | job:${bot.job} | vehicle:${bot.vehicle}`);
    bot.timer = setInterval(() => {
      bot.angle += bot.speed;
      const x = +(Math.cos(bot.angle)*bot.radius).toFixed(2);
      const z = +(Math.sin(bot.angle)*bot.radius).toFixed(2);
      bot.ws.send(JSON.stringify({
        type:"player_update", playerId:id,
        position:{x,y:0,z}, job:bot.job,
        vehicle:bot.vehicle, wanted:bot.wanted, health:bot.health
      }));
    }, 400);
  });

  bot.ws.on("close", () => { if(bot.timer) clearInterval(bot.timer); });
  bot.ws.on("error", (e) => console.log(`[SIM] ${id} erreur: ${e.message}`));
  return bot;
}

const bots = Array.from({ length:COUNT }, (_,i) => makeBot(i+1));

const admin = new WebSocket(URL);

admin.on("open", () => {
  console.log("\n[SIM] AdminBot connecte - envoi de commandes aleatoires\n");

  setInterval(() => {
    const b   = pick(bots);
    const cmd = pick([
      `/scan ${b.id}`,
      `/money ${b.id} ${pick([250,500,1000,2000,5000])}`,
      `/wanted ${b.id} ${Math.floor(Math.random()*6)}`,
      `/vehicle ${b.id} ${pick(vehs)}`,
      `/give ${b.id} ${pick(items)}`,
      `/setjob ${b.id} ${pick(jobs)}`,
      `/heal ${b.id}`,
      `/weather ${pick(wths)}`,
      `/time ${Math.floor(Math.random()*24)}`,
      `/tp ${b.id} ${Math.floor(Math.random()*30)-15} 0 ${Math.floor(Math.random()*30)-15}`
    ]);

    admin.send(JSON.stringify({ type:"command", player:"AdminBot", cmd }));
    console.log(`[SIM] CMD -> ${cmd}`);
  }, 3000);
});

admin.on("message", (raw) => {
  try {
    const m = JSON.parse(raw);
    if (m.type === "command_result") console.log(`[SIM] -> ${m.result?.result}`);
  } catch {}
});

process.on("SIGINT", () => {
  console.log("\n[SIM] Arret des bots...");
  bots.forEach(b => { if(b.timer) clearInterval(b.timer); b.ws?.close(); });
  admin.close();
  process.exit(0);
});
