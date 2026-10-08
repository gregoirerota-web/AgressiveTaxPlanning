import { randomInt, randomBytes } from "node:crypto";

export const MAX_PLAYERS = 6;
export const HORIZON = 8;
const GEOLOGY = [
  { name: "Stérile", ore: 0 }, { name: "Marginal", ore: 3 },
  { name: "Moyen", ore: 6 }, { name: "Riche", ore: 10 },
  { name: "Classe mondiale", ore: 16 }
];
const TECHNOLOGIES = [
  { id: 1, name: "Sous-traitée", cost: 10, capacity: 1, local: 130, pt: 20, sc: 2, fs: 10 },
  { id: 2, name: "Conventionnelle", cost: 150, capacity: 2, local: 90, pt: 60, sc: 15, fs: 20 },
  { id: 3, name: "Mécanisée", cost: 400, capacity: 4, local: 50, pt: 160, sc: 30, fs: 40 },
  { id: 4, name: "Intégrée", cost: 750, capacity: 8, local: 10, pt: 400, sc: 60, fs: 80 }
];
const round = x => Math.round(x);
const bound = (x, lo, hi) => typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi;
const publicPlayer = p => ({ id: p.id, name: p.name, role: p.role, connected: p.connected, ready: p.ready, cash: p.role === "firm" ? p.cash : undefined, score: p.score });
const mkCode = () => randomBytes(3).toString("hex").toUpperCase();

export function createRoom(hostId, name, token, random = randomInt) {
  const geology = [...GEOLOGY];
  for (let i = geology.length - 1; i > 0; i--) { const j = random(i + 1); [geology[i], geology[j]] = [geology[j], geology[i]]; }
  return {
    code: mkCode(), hostId, stage: "lobby", turn: 1, price: null, policy: { cit: 20, royalty: 4, reserve: 60 },
    blocks: geology.map((g, id) => ({ id, ...g, revealed: false, owner: null, remaining: g.ore, investment: null, contract: null })),
    players: [{ id: hostId, token, name, role: "minister", connected: true, ready: false, cash: 0, score: 0, decision: null }],
    journal: [], lastResult: null
  };
}
export function publicState(room, viewerId) {
  const viewer = room.players.find(p => p.id === viewerId);
  if (!viewer) throw Error("Spectateur non autorisé");
  return {
    code: room.code, stage: room.stage, turn: room.turn, horizon: HORIZON, price: room.price,
    policy: room.policy,
    players: room.players.map(publicPlayer),
    blocks: room.blocks.map(b => b.revealed ? {
      id: b.id, name: b.name, ore: b.ore, remaining: b.remaining, owner: b.owner,
      investment: b.investment && { name: b.investment.name, capacity: b.investment.capacity }, contract: b.contract
    } : { id: b.id, revealed: false, owner: null }),
    me: viewer.id,
    myDecision: viewer.decision,
    log: room.journal.slice(-8),
    result: room.lastResult
  };
}
export function joinRoom(room, id, name, token) {
  if (room.stage !== "lobby") throw Error("Partie déjà commencée");
  if (room.players.length >= MAX_PLAYERS) throw Error("Salle complète");
  if (room.players.some(p => p.id === id || p.name.toLocaleLowerCase() === name.toLocaleLowerCase()))
    throw Error("Nom déjà utilisé");
  room.players.push({ id, token, name, role: "firm", connected: true, ready: false, cash: 1000, score: 0, decision: null });
}
const firms = room => room.players.filter(p => p.role === "firm");
const acting = room => firms(room).filter(p => p.connected);
function nextIfAll(room) {
  if (!acting(room).length || acting(room).some(p => !p.ready)) return;
  if (room.stage === "bidding") {
    const candidates = firms(room).filter(p => p.decision?.block !== null).sort((a,b) =>
      b.decision.bid - a.decision.bid || a.id.localeCompare(b.id));
    const issued = new Set();
    for (const p of candidates) {
      const { block, bid } = p.decision;
      const b = room.blocks[block];
      if (!b || b.owner || issued.has(block) || bid > p.cash) continue;
      p.cash -= bid; room.players[0].score += bid; issued.add(block);
      b.revealed = true; b.owner = p.id; b.contract = { ...room.policy };
      room.journal.push(p.name + " obtient le bloc " + (block + 1) + " pour " + bid + " M€.");
    }
    room.stage = "investment";
  } else if (room.stage === "investment") {
    for (const p of firms(room)) {
      if (!p.decision?.investments) continue;
      for (const [key, techId] of Object.entries(p.decision.investments)) {
        const b = room.blocks[Number(key)];
        const tech = TECHNOLOGIES.find(t => t.id === techId);
        if (b?.owner !== p.id || !b?.remaining || b.investment || !tech || tech.cost > p.cash) continue;
        p.cash -= tech.cost; b.investment = tech;
      }
    }
    room.price = round(200 * [0.6,0.8,0.9,1.1,1.2,1.4][randomInt(6)]);
    room.stage = "planning";
  } else if (room.stage === "planning") room.stage = "audit";
  if (room.stage === "investment" || room.stage === "planning" || room.stage === "audit")
    for (const p of room.players) p.ready = false;
}
export function decide(room, playerId, data) {
  const p = room.players.find(x => x.id === playerId);
  if (!p || !p.connected) throw Error("Joueur non connecté");
  if (room.stage === "lobby") {
    if (p.role !== "minister" || firms(room).length < 1 || !firms(room).every(f=>f.connected))
      throw Error("Il faut au moins une firme connectée pour démarrer");
    room.stage = "policy"; return;
  }
  if (room.stage === "policy") {
    if (p.role !== "minister") throw Error("Seul le ministre fixe le code minier");
    const { cit, royalty, reserve } = data || {};
    if (!bound(cit,0,50) || !bound(royalty,0,20) || !bound(reserve,0,300)) throw Error("Barème invalide");
    room.policy = { cit, royalty, reserve };
    room.stage = "bidding";
    for (const f of firms(room)) { f.ready = false; f.decision = null; }
    return;
  }
  if (["bidding","investment","planning"].includes(room.stage)) {
    if (p.role !== "firm" || p.ready) throw Error("Décision déjà transmise");
    if (room.stage === "bidding") {
      const { block, bid } = data || {};
      if (block !== null && (!Number.isInteger(block) || block < 0 || block >= 5 ||
          room.blocks[block].owner || !bound(bid,room.policy.reserve,Math.min(500,p.cash))))
        throw Error("Offre invalide ou trésorerie insuffisante");
      p.decision = { block, bid: block === null ? 0 : bid };
    } else if (room.stage === "investment") {
      const investments = data?.investments || {};
      if (typeof investments !== "object" || Array.isArray(investments)) throw Error("Investissement invalide");
      for (const [key, techId] of Object.entries(investments)) {
        const b = room.blocks[Number(key)], t = TECHNOLOGIES.find(t => t.id === techId);
        if (!b || b.owner !== p.id || b.investment || !t) throw Error("Choix de mine invalide");
      }
      if (Object.values(investments).reduce((sum,id)=>sum+TECHNOLOGIES.find(t=>t.id===id).cost,0)>p.cash)
        throw Error("Capital insuffisant");
      p.decision = { investments };
    } else {
      const plan = data?.plan || {};
      for (const [key, intensity] of Object.entries(plan)) {
        if (!room.blocks[Number(key)] || room.blocks[Number(key)].owner !== p.id ||
          !bound(intensity,0,3) || !Number.isInteger(intensity)) throw Error("Stratégie fiscale invalide");
      }
      p.decision = { plan };
    }
    p.ready = true; nextIfAll(room); return;
  }
  if (room.stage === "audit") {
    if (p.role !== "minister" || !["pt","sc","fs","none"].includes(data?.channel)) throw Error("Contrôle invalide");
    settle(room,data.channel); return;
  }
  if (room.stage === "results") {
    if (p.role !== "minister") throw Error("Le ministre lance le tour suivant");
    room.turn++;
    if (room.turn > HORIZON || room.blocks.every(b => b.revealed && b.remaining === 0)) { room.stage = "finished"; return; }
    room.stage = "policy"; room.price = null; room.lastResult = null;
    for (const player of room.players) { player.ready = false; player.decision = null; }
    return;
  }
  throw Error("Action indisponible à cette étape");
}
export function settle(room, channel) {
  if (room.stage !== "audit") throw Error("Étape de contrôle requise");
  const details = [];
  let fiscalTotal = 0;
  for (const b of room.blocks) {
    if (!b.owner || !b.investment || b.remaining<=0) continue;
    const owner = room.players.find(p=>p.id===b.owner), t=b.investment;
    const units=Math.min(b.remaining,t.capacity), sales=units*room.price;
    const factor=units/t.capacity, real={ pt:t.pt*factor,sc:t.sc*factor,fs:t.fs*factor };
    const extraRate=owner.decision?.plan?.[b.id] || 0;
    const extra = { pt:0, sc:0, fs:0 };
    const selected = ["pt","sc","fs"][Math.floor((b.id + room.turn) % 3)];
    extra[selected]=round(real[selected]*0.2*extraRate);
    const shifted=extra[selected], recovered=channel===selected ? shifted : 0;
    const depreciation=round(t.cost/b.ore*units);
    const royalties=round(sales*b.contract.royalty/100);
    const taxable=Math.max(0,sales-t.local*units-depreciation-Object.values(real).reduce((a,x)=>a+x,0)-shifted+recovered-royalties);
    const cit=round(taxable*b.contract.cit/100);
    const penalty=channel===selected?round(recovered*b.contract.cit/100*0.4):0;
    const taxes=cit+royalties+penalty;
    fiscalTotal+=taxes;room.players[0].score+=taxes;
    const economicCosts=t.local*units+Object.values(real).reduce((a,x)=>a+x,0);
    const yearlyNet=sales-economicCosts-taxes;
    owner.cash+=yearlyNet;
    owner.score+=yearlyNet; b.remaining-=units;
    details.push({ block:b.id+1, firm:owner.name, sales, units, royalty:royalties, cit, penalty, displaced:shifted, recovered, channel: channel==="none" ? null : channel });
  }
  room.lastResult={ price:room.price, fiscalTotal, details };
  room.journal.push("Tour "+room.turn+" : recettes fiscales "+fiscalTotal+" M€, prix "+room.price+" M€/unité.");
  room.stage="results";
}
export { TECHNOLOGIES };
