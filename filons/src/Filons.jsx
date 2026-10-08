import React, { useState, useMemo, useEffect } from "react";

/* =========================================================================
   FILONS — Partie complète (8 tours). Duel : 1 Ministre / 1 Firme.
   v3 — La Firme peut acquérir PLUSIEURS blocs par tour (écart assumé au
   livret v2). Le rationnement ne vient plus de la règle, mais du prix et
   de la trésorerie : c'est l'enveloppe qui fait la contrainte.

   Autres arbitrages intégrés :
   · Captation ET taux effectif affichés ; ils diffèrent par le prix du permis.
   · Tolérance au coût réel : seuil des frais de siège = max(forfait, coût réel).
   ========================================================================= */

const C = { paper: "#E4E5DF", card: "#F2F2EE", ink: "#1D2733", ink2: "#5A6670",
  line: "#C3C6BF", brass: "#A9822B", patina: "#3B6A58", oxblood: "#8A2E2E", dark: "#161C21" };
const F = {
  display: 'Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif',
  body: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
};

const PRIX_REF = 200;
const DE_COURS = [0.6, 0.8, 0.9, 1.1, 1.2, 1.4];
const HORIZON = 8;

const GISEMENTS = [
  { nom: "Stérile", q: 0 }, { nom: "Marginal", q: 3 }, { nom: "Moyen", q: 6 },
  { nom: "Riche", q: 10 }, { nom: "Classe mondiale", q: 16 },
];

const TUILES = [
  { id: 1, nom: "Sous-traitée", inv: 10, cap: 1, local: 130,
    pt: { reel: 20, lo: 20, hi: 25, plaf: 30 }, sc: { reel: 2, lo: 2, hi: 4, plaf: 9 }, fs: { reel: 10, plaf: 25 } },
  { id: 2, nom: "Conventionnelle", inv: 150, cap: 2, local: 90,
    pt: { reel: 60, lo: 60, hi: 75, plaf: 90 }, sc: { reel: 15, lo: 15, hi: 20, plaf: 35 }, fs: { reel: 20, plaf: 50 } },
  { id: 3, nom: "Mécanisée", inv: 400, cap: 4, local: 50,
    pt: { reel: 160, lo: 160, hi: 180, plaf: 210 }, sc: { reel: 30, lo: 30, hi: 40, plaf: 70 }, fs: { reel: 40, plaf: 100 } },
  { id: 4, nom: "Intégrée", inv: 750, cap: 8, local: 10,
    pt: { reel: 400, lo: 400, hi: 450, plaf: 510 }, sc: { reel: 60, lo: 60, hi: 80, plaf: 140 }, fs: { reel: 80, plaf: 200 } },
];

const REGIMES = [
  { id: "R1", is: 35, red: 0, note: "Tout sur le profit. Efficient, et maximalement érodable." },
  { id: "R2", is: 30, red: 2, note: "Ambitieux, orthodoxe." },
  { id: "R3", is: 25, red: 3, note: "Le standard international." },
  { id: "R4", is: 20, red: 4, note: "Régime de référence." },
  { id: "R5", is: 20, red: 0, note: "Assiette nue : tout repose sur le bénéfice déclaré." },
  { id: "R6", is: 15, red: 5, note: "Attractif, mais verrouillé." },
  { id: "R7", is: 15, red: 2, note: "Attractif, et exposé." },
  { id: "R8", is: 10, red: 8, note: "Renonce à l'IS, prélève à la source." },
  { id: "R9", is: 10, red: 3, note: "Généreux des deux côtés." },
  { id: "R10", is: 5, red: 10, note: "Le profit est libre ; la rente est prise avant lui." },
  { id: "R11", is: 0, red: 6, note: "Aucun impôt sur le bénéfice. Pari sur le volume." },
  { id: "R12", is: 0, red: 0, note: "Paradis minier." },
];

const CM = {
  pt: { nom: "Documentation des prix de transfert", canal: "Achats intragroupe", src: "OCDE, Actions 8–10 et 13" },
  sc: { nom: "Plafonnement des intérêts (30 % EBITDA)", canal: "Sous-capitalisation", src: "OCDE, Action 4" },
  fs: { nom: "Test du bénéfice réel", canal: "Frais de siège", src: "Principes OCDE, ch. VII" },
};

const r0 = (x) => Math.round(Number.isFinite(x) ? x : 0);
const fmt = (x) => (x === null || x === undefined || !Number.isFinite(Number(x)) ? "—" : r0(x).toLocaleString("fr-FR"));
const pct = (x) => (x === null || x === undefined || !Number.isFinite(x) ? "—" : (x * 100).toFixed(1).replace(".", ",") + " %");
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const d6 = () => 1 + Math.floor(Math.random() * 6);

/* ---------------- moteur ---------------- */
function bornes(tuile, units, CA) {
  const cap = tuile && tuile.cap > 0 ? tuile.cap : 1;
  const r = units / cap;
  const s = (x) => r0(x * r);
  const fsReel = s(tuile.fs.reel);
  const forfait = r0(CA / 20);
  return {
    pt: { reel: s(tuile.pt.reel), lo: s(tuile.pt.lo), hi: s(tuile.pt.hi), plaf: Math.max(s(tuile.pt.plaf), s(tuile.pt.hi)), med: s((tuile.pt.lo + tuile.pt.hi) / 2) },
    sc: { reel: s(tuile.sc.reel), lo: s(tuile.sc.lo), hi: s(tuile.sc.hi), plaf: Math.max(s(tuile.sc.plaf), s(tuile.sc.hi)), med: s((tuile.sc.lo + tuile.sc.hi) / 2) },
    fs: { reel: fsReel, forfait, seuil: Math.max(forfait, fsReel), plaf: Math.max(s(tuile.fs.plaf), forfait, fsReel) },
  };
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));

function calculMine(mine, terr, units, price, cm) {
  const bloc = terr[mine.bloc];
  const reg = bloc.regime || REGIMES[3];
  const tuile = mine.tuile;
  const CA = units * price;
  const b = bornes(tuile, units, CA);
  const redevance = r0((reg.red / 100) * CA);
  const amort = bloc.q > 0 ? r0((mine.invCumul / bloc.q) * units) : 0;
  const local = tuile.local * units;

  const cu = mine.curseurs || { pt: b.pt.hi, sc: b.sc.hi, fs: b.fs.seuil };
  const dPT = units > 0 ? clamp(cu.pt, b.pt.reel, b.pt.plaf) : 0;
  const dSC = units > 0 ? clamp(cu.sc, b.sc.reel, b.sc.plaf) : 0;
  const dFS = units > 0 ? clamp(cu.fs, 0, b.fs.plaf) : 0;

  const totalCharges = amort + local + dPT + dSC + dFS;
  const beneficeDeclare = CA - redevance - totalCharges;
  const chargesZoneSure = amort + local + b.pt.hi + b.sc.hi + b.fs.seuil;
  const chargesCoutReel = amort + local + b.pt.reel + b.sc.reel + b.fs.reel;
  const horsZoneSure = Math.max(0, totalCharges - chargesZoneSure);
  const deplace = Math.max(0, totalCharges - chargesCoutReel);

  let reprise = 0;
  if (units > 0) {
    if (cm === "pt" && dPT > b.pt.hi) reprise = dPT - b.pt.med;
    if (cm === "sc" && dSC > b.sc.hi) reprise = dSC - b.sc.med;
    if (cm === "fs" && dFS > b.fs.seuil) reprise = dFS - b.fs.seuil;
  }
  reprise = Math.max(0, r0(reprise));

  const beneficeRedresse = beneficeDeclare + reprise;
  const IS = Math.max(0, r0((reg.is / 100) * beneficeRedresse));
  const impotReintegre = r0((reg.is / 100) * reprise);
  const penalite = r0(0.4 * impotReintegre);
  const prelev = redevance + IS + penalite;
  const renteEco = CA - amort - local - b.pt.reel - b.sc.reel - b.fs.reel;

  return { mine, bloc, reg, tuile, units, CA, redevance, amort, local, b, dPT, dSC, dFS,
    totalCharges, beneficeDeclare, chargesZoneSure, chargesCoutReel, horsZoneSure, deplace,
    reprise, beneficeRedresse, IS, impotReintegre, penalite, prelev, renteEco };
}

/* ---------------- IA ---------------- */
function iaMinistreOffre(g) {
  const tours = g.cum.tours;
  const rien = tours.length > 0 && tours[tours.length - 1].permis === 0;
  const attirer = rien || g.mines.length === 0;
  const pool = attirer ? ["R6", "R7", "R9", "R4", "R8"] : ["R2", "R3", "R4", "R4", "R6"];
  const regime = REGIMES.find((x) => x.id === pool[Math.floor(Math.random() * pool.length)]) || REGIMES[3];
  const mode = Math.random() < 0.7 ? "admin" : "enchere";
  const montant = (attirer ? 20 : 60) + Math.floor(Math.random() * 9) * 10;
  const libres = g.terr.filter((t) => !t.revele).length;
  const blocs = Math.min(libres, (attirer ? 3 : 2) + Math.floor(Math.random() * 3));
  const raison = attirer
    ? `Rien ne s'est vendu. J'assouplis : ${regime.id} (IS ${regime.is} %, redevance ${regime.red} %), prix ${montant} M€ par bloc, ${blocs} bloc(s) ouvert(s).`
    : mode === "admin"
      ? `Prix affiché : ${montant} M€ par bloc, sous ${regime.id}. J'ouvre ${blocs} bloc(s) — le prix est mon seul rationnement.`
      : `Enchère sous ${regime.id}, réserve à ${montant} M€ par bloc, ${blocs} bloc(s) ouvert(s).`;
  return { offre: { mode, montant, blocs, regime }, raison };
}

function iaMinistreControle(mines) {
  const exp = { pt: 0, sc: 0, fs: 0 };
  const ecart = mines.reduce((s, m) => s + m.horsZoneSure, 0);
  mines.forEach((m) => {
    exp.pt += Math.max(0, m.b.pt.plaf - m.b.pt.hi);
    exp.sc += Math.max(0, m.b.sc.plaf - m.b.sc.hi);
    exp.fs += Math.max(0, m.b.fs.plaf - m.b.fs.seuil);
  });
  if (ecart <= 0) {
    const k = ["pt", "sc", "fs"].sort((a, b) => exp[b] - exp[a])[0];
    return { choix: k, raison: "Tous les totaux tiennent dans les zones sûres. Rien ne dépasse — et pourtant du bénéfice a bougé. J'ouvre le canal le plus large, par principe." };
  }
  const score = {};
  ["pt", "sc", "fs"].forEach((k) => {
    const autres = ["pt", "sc", "fs"].filter((x) => x !== k).reduce((s, x) => s + exp[x], 0);
    score[k] = Math.max(0, ecart - autres) * 10 + Math.min(ecart, exp[k]) + Math.random() * 10;
  });
  const choix = ["pt", "sc", "fs"].sort((a, b) => score[b] - score[a])[0];
  const autres = ["pt", "sc", "fs"].filter((x) => x !== choix).reduce((s, x) => s + exp[x], 0);
  const raison = ecart > autres
    ? `${fmt(ecart)} M€ sortent des zones sûres. Les deux autres canaux réunis ne peuvent en porter que ${fmt(autres)} : celui-ci est forcément chargé.`
    : `${fmt(ecart)} M€ hors zone sûre, sans savoir par quelle porte. Je parie sur le canal dont la marge exposée est la plus large.`;
  return { choix, raison };
}

function iaFirmeEnveloppe(offre, cash, toursRestants) {
  const N = offre.blocs;
  if (N === 0) return { depose: false, k: 0, mise: 0, raison: "Aucun bloc ouvert. Rien à demander." };
  if (toursRestants <= 2) return { depose: false, k: 0, mise: 0, raison: "Deux tours au plus : une mine ouverte maintenant n'aurait pas le temps de s'amortir. Je n'achète plus." };
  const attrait = (30 - offre.regime.is) + (8 - offre.regime.red) * 1.5;
  const plafondUnitaire = Math.min(cash * 0.3, 40 + attrait * 6);
  if (offre.montant > plafondUnitaire) return { depose: false, k: 0, mise: 0, raison: `À ${fmt(offre.montant)} M€ le bloc sous ${offre.regime.id}, le permis coûte plus cher que ce que j'espère en tirer. Je passe.` };
  const mise = offre.mode === "admin" ? offre.montant : r0(offre.montant + Math.random() * 20);
  // combien de blocs ? il faut garder de quoi investir : au moins 150 M€ par mine ouverte
  let k = 1;
  while (k < N && (k + 1) * mise + (k + 1) * 150 <= cash && k < 3) k++;
  const raison = offre.mode === "admin"
    ? `Prix ${fmt(mise)} M€ le bloc sous ${offre.regime.id}. Je prends ${k} bloc${k > 1 ? "s" : ""} : ${fmt(k * mise)} M€ engagés, le reste doit financer les mines.`
    : `Seule en lice : je rase la réserve à ${fmt(mise)} M€ le bloc, pour ${k} bloc${k > 1 ? "s" : ""}. Une enchère sans concurrence est une attribution administrative, en plus lent.`;
  return { depose: true, k, mise, raison };
}

function iaFirmeTuile(q, cash, toursRestants) {
  if (q === 0) return { tuile: null, raison: "Gisement stérile. Je renonce : je ne perds que le permis." };
  let best = null, bestVal = -Infinity;
  TUILES.forEach((t) => {
    if (t.inv > cash) return;
    const extractible = Math.min(q, t.cap * toursRestants);
    const val = extractible * (PRIX_REF - t.local) - (t.pt.reel + t.sc.reel + t.fs.reel) * (extractible / t.cap) - t.inv;
    if (val > bestVal) { bestVal = val; best = t; }
  });
  if (!best || bestVal < 0) return { tuile: null, raison: "Aucune capacité ne dégage une valeur positive sur l'horizon restant, ou la trésorerie ne suit pas. Je renonce." };
  const tours = Math.ceil(q / best.cap);
  return { tuile: best, raison: `${q} unités : la ${best.nom.toLowerCase()} les vide en ${tours} tour${tours > 1 ? "s" : ""} (horizon restant : ${toursRestants}). Investissement ${fmt(best.inv)} M€.` };
}

function iaFirmeCurseurs(bs, regs) {
  const canaux = ["pt", "sc", "fs"];
  const out = [], raisons = [];
  bs.forEach((b, i) => {
    const reg = regs[i] || REGIMES[3];
    const cur = { pt: b.pt.hi, sc: b.sc.hi, fs: b.fs.seuil };
    if (Math.random() < 0.5 && reg.is >= 15) {
      const k = canaux[Math.floor(Math.random() * 3)];
      cur[k] = k === "fs" ? b.fs.plaf : b[k].plaf;
      raisons.push(`mine ${i + 1} : ${k === "pt" ? "achats intragroupe" : k === "sc" ? "intérêts" : "frais de siège"} au plafond`);
    } else raisons.push(`mine ${i + 1} : sommet des intervalles, rien d'exposé`);
    out.push(cur);
  });
  return { curseurs: out, raison: `Une seule contre-mesure frappe tout le territoire : je ne charge pas le même canal partout. ${raisons.join(" ; ")}.` };
}

/* ---------------- UI ---------------- */
const Bloc = ({ children, style }) => (
  <div style={{ background: C.card, border: `1px solid ${C.line}`, ...style }} className="p-5 mb-5">{children}</div>
);
const Eyebrow = ({ children }) => (
  <div style={{ fontFamily: F.mono, color: C.ink2, letterSpacing: "0.14em" }} className="text-xs uppercase mb-3">{children}</div>
);
const Btn = ({ children, onClick, disabled, kind = "solid" }) => (
  <button onClick={onClick} disabled={disabled}
    style={{ fontFamily: F.body, background: disabled ? C.line : kind === "solid" ? C.ink : "transparent",
      color: disabled ? "#8B8F89" : kind === "solid" ? C.paper : C.ink,
      border: `1px solid ${disabled ? C.line : C.ink}`, cursor: disabled ? "not-allowed" : "pointer" }}
    className="px-5 py-2.5 text-sm font-medium hover:opacity-80">{children}</button>
);
const Row = ({ l, v, strong, color, indent, sign }) => (
  <div className="flex justify-between items-baseline py-1" style={{ borderBottom: `1px solid ${C.line}55` }}>
    <span style={{ fontFamily: F.body, color: color || C.ink, paddingLeft: indent ? 14 : 0, fontWeight: strong ? 600 : 400 }} className="text-sm">{l}</span>
    <span style={{ fontFamily: F.mono, color: color || C.ink, fontWeight: strong ? 700 : 400, fontVariantNumeric: "tabular-nums" }} className="text-sm">
      {sign === "-" ? "− " : ""}{fmt(v)}
    </span>
  </div>
);
const Note = ({ children, color }) => (
  <div style={{ borderLeft: `3px solid ${color || C.brass}`, background: `${color || C.brass}11` }} className="pl-4 pr-3 py-3 my-4">
    <p style={{ fontFamily: F.display, lineHeight: 1.55 }} className="text-sm italic">{children}</p>
  </div>
);
const IAsays = ({ who, children }) => (
  <div style={{ background: C.dark, color: C.paper }} className="p-4 my-4">
    <div style={{ fontFamily: F.mono, color: C.brass, letterSpacing: "0.12em" }} className="text-xs uppercase mb-2">{who}</div>
    <p style={{ fontFamily: F.display, lineHeight: 1.6 }} className="text-sm">« {children} »</p>
  </div>
);

/* La révélation — ce que le contrôle a mis au jour, et ce qu'il n'a pas vu */
function Revelation({ r, cm }) {
  const canal = cm === "pt" ? { titre: "Achats intragroupe", decl: r.dPT, reel: r.b.pt.reel, sur: r.b.pt.hi, repriseA: r.b.pt.med, mot: "la médiane de l'intervalle de pleine concurrence" }
    : cm === "sc" ? { titre: "Intérêts intragroupe", decl: r.dSC, reel: r.b.sc.reel, sur: r.b.sc.hi, repriseA: r.b.sc.med, mot: "la médiane de l'intervalle" }
    : { titre: "Frais de siège", decl: r.dFS, reel: r.b.fs.reel, sur: r.b.fs.seuil, repriseA: r.b.fs.seuil, mot: "le forfait" };
  const max = Math.max(canal.decl, canal.sur, 1);
  const w = (x) => `${Math.min(100, Math.max(0, (x / max) * 100))}%`;
  return (
    <div style={{ border: `2px solid ${C.oxblood}`, background: `${C.oxblood}0D` }} className="p-4 my-3">
      <div style={{ fontFamily: F.mono, color: C.oxblood, letterSpacing: "0.12em" }} className="text-xs uppercase mb-1">Optimisation mise au jour · bloc {r.mine.bloc + 1}</div>
      <div style={{ fontFamily: F.display, fontWeight: 600 }} className="text-lg mb-3">{canal.titre}</div>

      <div className="relative h-8 mb-1" style={{ background: C.line }}>
        <div className="absolute top-0 h-8" style={{ width: w(canal.reel), background: C.patina }} />
        <div className="absolute top-0 h-8" style={{ left: w(canal.reel), width: w(canal.sur - canal.reel), background: `${C.patina}77` }} />
        <div className="absolute top-0 h-8" style={{ left: w(canal.sur), width: w(canal.decl - canal.sur), background: C.oxblood }} />
        <div className="absolute top-0 h-8 w-0.5" style={{ left: w(canal.repriseA), background: C.ink }} />
      </div>
      <div className="flex justify-between mb-3" style={{ fontFamily: F.mono, fontSize: 10, color: C.ink2 }}>
        <span>coût réel {fmt(canal.reel)}</span>
        <span>plafond de la zone sûre {fmt(canal.sur)}</span>
        <span style={{ color: C.oxblood }}>déclaré {fmt(canal.decl)}</span>
      </div>

      <Row l="Charge déclarée" v={canal.decl} strong />
      <Row l={`Ramenée à ${canal.mot}`} v={canal.repriseA} indent />
      <Row l="Charge refusée — réintégrée au bénéfice" v={r.reprise} strong color={C.oxblood} />
      <Row l={`Impôt supplémentaire (${r.reg.is} %)`} v={r.impotReintegre} color={C.patina} />
      <Row l="Pénalité (40 % de l'impôt réintégré)" v={r.penalite} color={C.patina} />
      <Row l="Coût total du redressement pour la Firme" v={r.impotReintegre + r.penalite} strong color={C.oxblood} />

      <p style={{ fontFamily: F.display }} className="text-sm italic mt-3">
        La reprise se fait à {canal.mot}, non à la borne : franchir le sommet a coûté à la Firme{" "}
        <b>{fmt(canal.sur - canal.repriseA)} M€</b> de déplacement qui, lui, était parfaitement acquis.
        {r.deplace - r.reprise > 0 && <> Il lui reste néanmoins <b>{fmt(r.deplace - r.reprise)} M€</b> déplacés sur cette mine, hors d'atteinte.</>}
      </p>
    </div>
  );
}

function Curseur({ label, val, setVal, min, max, safeLo, safeHi, sub, reel }) {
  const lo = Math.min(min, max), hi = Math.max(min, max);
  const span = Math.max(1, hi - lo);
  const pos = (x) => `${Math.min(100, Math.max(0, ((clamp(x, lo, hi) - lo) / span) * 100))}%`;
  const sHi = clamp(safeHi, lo, hi), sLo = clamp(safeLo, lo, hi);
  const v = clamp(val, lo, hi);
  const expose = v > sHi;
  return (
    <div className="mb-5">
      <div className="flex justify-between items-baseline">
        <span style={{ fontFamily: F.body, fontWeight: 600 }} className="text-sm">{label}</span>
        <span style={{ fontFamily: F.mono, color: expose ? C.oxblood : C.patina, fontWeight: 700 }} className="text-sm">{fmt(v)} · {expose ? "exposé" : "à l'abri"}</span>
      </div>
      <div style={{ fontFamily: F.body, color: C.ink2 }} className="text-xs mb-1">coût réel {fmt(reel)} · {sub}</div>
      <div className="relative h-5">
        <div className="absolute top-2 h-1.5 w-full" style={{ background: C.line }} />
        <div className="absolute top-2 h-1.5" style={{ background: `${C.patina}66`, left: pos(sLo), width: `${((sHi - sLo) / span) * 100}%` }} />
        <div className="absolute top-2 h-1.5" style={{ background: `${C.oxblood}55`, left: pos(sHi), width: `${((hi - sHi) / span) * 100}%` }} />
        <input type="range" min={lo} max={hi} step={1} value={v} onChange={(e) => setVal(parseInt(e.target.value, 10))}
          className="absolute w-full top-0 h-5 opacity-0 cursor-pointer" style={{ zIndex: 2 }} />
        <div className="absolute top-0 h-5 w-1.5 pointer-events-none" style={{ left: `calc(${pos(v)} - 3px)`, background: expose ? C.oxblood : C.ink }} />
      </div>
    </div>
  );
}

/* ---------------- garde d'erreur ---------------- */
class Garde extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) {
      return (
        <div style={{ background: C.paper, minHeight: "100vh", padding: 32, fontFamily: F.body, color: C.ink }}>
          <div style={{ border: `2px solid ${C.oxblood}`, background: C.card }} className="p-5 max-w-2xl mx-auto">
            <div style={{ fontFamily: F.mono, color: C.oxblood, letterSpacing: "0.12em" }} className="text-xs uppercase mb-2">Le jeu s'est arrêté</div>
            <p className="text-sm mb-3">Copiez le message ci-dessous et envoyez-le-moi : il indique exactement la ligne fautive.</p>
            <pre style={{ fontFamily: F.mono, background: C.dark, color: "#E0A0A0", whiteSpace: "pre-wrap" }} className="p-3 text-xs">{String(this.state.err && this.state.err.stack ? this.state.err.stack : this.state.err)}</pre>
            <div className="mt-4"><Btn onClick={() => window.location.reload()}>Recommencer une partie</Btn></div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const STORAGE_KEY = "filons-partie-v4-2";
const PHASES_GUIDE = { P1M:["Code minier","Fixez le prix des permis et le régime fiscal avant la révélation des gisements."], P1F:["Candidature","Achetez des permis, mais réservez des fonds pour équiper les mines."], P1R:["Octroi","Vérifiez le montant et révélez les gisements choisis."], P3:["Investissement","Comparez le coût et la capacité des équipements avant de vous engager."], P4:["Cours","Tirez le cours de l’or ; les décisions d’investissement sont déjà prises."], P5:["Déclaration","Répartissez les charges : une seule catégorie sera contrôlée."], P6:["Contrôle","Choisissez un seul canal fiscal à contrôler."], P7:["Résultats","Analysez les redressements et les recettes avant le tour suivant."] };
const ETAPES = ["Code minier","Permis","Investissement","Cours","Déclaration","Contrôle","Résultats"];
function restoreFilons(){
  try { const raw = window.localStorage.getItem(STORAGE_KEY); if(!raw) return initGame();
    const saved = JSON.parse(raw); const g = saved.game;
    return saved.version === 2 && g && Array.isArray(g.terr) && g.terr.length === GISEMENTS.length &&
      Array.isArray(g.mines) && g.cum && Array.isArray(g.cum.tours) && Number.isInteger(g.turn) &&
      g.turn >= 1 && g.turn <= HORIZON && typeof g.phase === "string" ? g : initGame();
  } catch { return initGame(); }
}
/* ---------------- jeu ---------------- */
const initGame = () => ({
  phase: "setup", mode: null, turn: 1, dernierTour: HORIZON,
  terr: shuffle(GISEMENTS).map((g) => ({ ...g, revele: false, restant: g.q, regime: null, modeOctroi: null, prix: 0 })),
  offre: { mode: "admin", montant: 60, blocs: 2, regime: REGIMES[3] },
  offreRaison: null, env: { depose: false, k: 0, mise: 0 }, envRaison: null,
  selection: [], pendingBlocs: [],
  mines: [], cash: 1000, de: null, cm: null, cmRaison: null, curseursRaison: null,
  permisDuTour: 0, voile: false,
  cum: { recettes: 0, permis: 0, prelev: 0, rente: 0, inv: 0, net: 0, deplace: 0, repris: 0, tours: [] },
  handoff: null,
});

function Jeu() {
  const [g, setG] = useState(restoreFilons);
  const [showGuide, setShowGuide] = useState(false);
  const [saveOk, setSaveOk] = useState(true);
  const [pendingControl, setPendingControl] = useState(null);
  useEffect(() => { try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({version:2,game:g})); setSaveOk(true); } catch { setSaveOk(false); } }, [g]);
  const resetFilons = () => {
    if (!window.confirm("Recommencer ? La partie enregistrée sur cet appareil sera remplacée.")) return;
    setG(initGame()); setDebrief(null); setShowGuide(false);
  };
  const [debrief, setDebrief] = useState(null);
  const [loading, setLoading] = useState(false);
  const up = (patch) => setG((p) => ({ ...p, ...(typeof patch === "function" ? patch(p) : patch) }));

  const jeSuisFirme = g.mode === "solo_firme";
  const jeSuisMinistre = g.mode === "solo_ministre";
  const hot = g.mode === "hotseat";
  const toursRestants = g.dernierTour - g.turn + 1;
  const price = g.de ? r0(PRIX_REF * DE_COURS[g.de - 1]) : null;
  const libres = g.terr.filter((t) => !t.revele).length;
  const nOuverts = Math.min(g.offre.blocs, libres);
  const openIdx = g.terr.map((t, i) => (t.revele ? -1 : i)).filter((i) => i >= 0).slice(0, nOuverts);

  const unitsOf = (m) => (m.cocon ? 0 : Math.min(m.tuile.cap, g.terr[m.bloc].restant));
  const resMines = useMemo(() => {
    if (price === null) return [];
    return g.mines.map((m) => calculMine(m, g.terr, m.cocon ? 0 : Math.min(m.tuile.cap, g.terr[m.bloc].restant), price, g.cm));
  }, [g.mines, g.terr, price, g.cm]);

  const T = resMines.reduce((s, r) => ({
    CA: s.CA + r.CA, prelev: s.prelev + r.prelev, rente: s.rente + r.renteEco,
    redevance: s.redevance + r.redevance, IS: s.IS + r.IS, penalite: s.penalite + r.penalite,
    reprise: s.reprise + r.reprise, deplace: s.deplace + r.deplace, hors: s.hors + r.horsZoneSure,
  }), { CA: 0, prelev: 0, rente: 0, redevance: 0, IS: 0, penalite: 0, reprise: 0, deplace: 0, hors: 0 });

  const go = (next, role) => (hot && role ? up({ handoff: { role, next } }) : up({ phase: next }));

  /* Début d'un tour : si tout le territoire est retourné, le code minier est figé
     — plus rien à allouer. On saute directement à l'exploitation. */
  const debutTour = (p) => {
    const libresP = p.terr.filter((t) => !t.revele).length;
    const socle = { ...p, permisDuTour: 0, pendingBlocs: [], selection: [], voile: false, env: { depose: false, k: 0, mise: 0 }, envRaison: null };
    if (libresP === 0) return { ...socle, phase: "P3" };
    if (p.mode === "solo_firme") {
      const o = iaMinistreOffre(socle);
      return { ...socle, offre: o.offre, offreRaison: o.raison, env: { depose: false, k: 1, mise: o.offre.montant }, phase: "P1F" };
    }
    if (p.mode === "solo_ministre") return { ...socle, phase: "P1M" };
    return { ...socle, handoff: { role: "Ministre des Finances", next: "P1M" } };
  };

  const lancer = (m) => setG((p) => debutTour({ ...p, mode: m }));

  /* Temps 1 */
  const validerOffre = () => {
    if (jeSuisMinistre) {
      const e = iaFirmeEnveloppe({ ...g.offre, blocs: nOuverts }, g.cash, toursRestants);
      up({ env: e, envRaison: e.raison, selection: [], phase: "P1R" });
    } else {
      up({ env: { depose: false, k: 1, mise: g.offre.montant } });
      go("P1F", "Direction de la multinationale");
    }
  };
  const deposer = (depose, k, mise) => {
    up({ env: { depose, k, mise }, selection: [] });
    if (hot) up({ handoff: { role: "Table", next: "P1R" } });
    else up({ phase: "P1R" });
  };
  const toggleCol = (i) => setG((p) => {
    const s = p.selection.includes(i) ? p.selection.filter((x) => x !== i) : (p.selection.length < p.env.k ? [...p.selection, i] : p.selection);
    return { ...p, selection: s };
  });
  const confirmerOctroi = () => setG((p) => {
    const sel = p.selection.length ? p.selection : openIdx.slice(0, p.env.k);
    const total = sel.length * p.env.mise;
    if (!p.env.depose || sel.length !== p.env.k || !Number.isFinite(total) || total < 0 || total > p.cash || sel.some(i => p.terr[i]?.revele)) return p;
    const terr = p.terr.map((t, i) => sel.includes(i) ? { ...t, revele: true, regime: p.offre.regime, modeOctroi: p.offre.mode, prix: p.env.mise } : t);
    return { ...p, terr, cash: p.cash - total, permisDuTour: total, pendingBlocs: [...sel].sort((a, b) => a - b), selection: [], phase: "P3" };
  });
  const sansOctroi = () => up({ permisDuTour: 0, pendingBlocs: [], phase: "P3" });

  /* Temps 3 — on peut équiper tout bloc détenu et non équipé, à n'importe quel tour */
  const investir = (bloc, t) => setG((p) => {
    if (!t || t.inv > p.cash || !p.terr[bloc]?.revele || p.terr[bloc]?.restant <= 0 || p.mines.some(m => m.bloc === bloc)) return p;
    const mines = [...p.mines, { bloc, tuile: t, invCumul: t.inv, pending: null, pendingActif: null, cocon: false, curseurs: null }];
    return { ...p, mines, cash: p.cash - t.inv, cum: { ...p.cum, inv: p.cum.inv + t.inv },
      pendingBlocs: p.pendingBlocs.filter((b) => b !== bloc) };
  });
  const investirIA = () => setG((p) => {
    let cash = p.cash, invSup = 0;
    const mines = [...p.mines];
    const restants = p.dernierTour - p.turn + 1;
    p.terr.forEach((t, i) => {
      if (!t.revele || t.q === 0 || t.restant === 0 || mines.some((m) => m.bloc === i)) return;
      const d = iaFirmeTuile(t.restant, cash, restants);
      if (d.tuile) { mines.push({ bloc: i, tuile: d.tuile, invCumul: d.tuile.inv, pending: null, pendingActif: null, cocon: false, curseurs: null }); cash -= d.tuile.inv; invSup += d.tuile.inv; }
    });
    return { ...p, mines, cash, cum: { ...p.cum, inv: p.cum.inv + invSup }, pendingBlocs: [] };
  });
  const etendre = (mi, t) => setG((p) => {
    const m = p.mines[mi];
    const cout = r0((t.inv - m.tuile.inv) * 1.25);
    if (cout > p.cash) return p;
    return { ...p, cash: p.cash - cout, cum: { ...p.cum, inv: p.cum.inv + cout },
      mines: p.mines.map((x, i) => i === mi ? { ...x, pending: t, invCumul: x.invCumul + cout } : x) };
  });
  const cocon = (mi) => setG((p) => ({ ...p, mines: p.mines.map((x, i) => i === mi ? { ...x, cocon: !x.cocon } : x) }));
  const finT3 = () => setG((p) => {
    const mines = p.mines.map((m) => m.pendingActif ? { ...m, tuile: m.pendingActif, pendingActif: null } : m);
    const p2 = { ...p, mines, de: null };
    const actives = mines.filter((m) => !m.cocon && p2.terr[m.bloc].restant > 0).length;
    if (actives === 0) return avancerTour(p2); // rien à extraire : pas de cours, pas de déclaration
    return { ...p2, phase: "P4" };
  });

  /* Temps 4-5 */
  const lancerDe = () => up({ de: d6() });
  const versDeclaration = () => setG((p) => {
    const pr = r0(PRIX_REF * DE_COURS[p.de - 1]);
    const u = (m) => (m.cocon ? 0 : Math.min(m.tuile.cap, p.terr[m.bloc].restant));
    if (p.mines.filter((m) => u(m) > 0).length === 0) return avancerTour({ ...p, de: null });
    const bs = p.mines.map((m) => bornes(m.tuile, u(m), u(m) * pr));
    if (p.mode === "solo_ministre") {
      const d = iaFirmeCurseurs(bs, p.mines.map((m) => p.terr[m.bloc].regime));
      return { ...p, mines: p.mines.map((m, i) => ({ ...m, curseurs: d.curseurs[i] })), curseursRaison: d.raison, phase: "P6" };
    }
    const mines = p.mines.map((m, i) => ({ ...m, curseurs: { pt: bs[i].pt.hi, sc: bs[i].sc.hi, fs: bs[i].fs.seuil } }));
    if (p.mode === "hotseat") return { ...p, mines, handoff: { role: "Direction de la multinationale", next: "P5" } };
    return { ...p, mines, phase: "P5" };
  });
  const setCur = (mi, k, v) => setG((p) => ({ ...p, mines: p.mines.map((m, i) => i === mi ? { ...m, curseurs: { ...m.curseurs, [k]: v } } : m) }));
  const validerCurseurs = () => {
    if (jeSuisFirme) {
      const rs = g.mines.map((m) => calculMine(m, g.terr, unitsOf(m), price, null));
      const d = iaMinistreControle(rs);
      up({ cm: d.choix, cmRaison: d.raison, phase: "P7" });
    } else go("P6", "Ministre des Finances");
  };
  const poserCM = (k) => setPendingControl(k);
  const confirmerCM = () => {
    if (!pendingControl || !CM[pendingControl]) return;
    up({ cm: pendingControl, phase: "P7" });
    setPendingControl(null);
  };
  const appliquerZoneSure = () => setG((p) => ({
    ...p,
    mines: p.mines.map((m) => {
      if (m.cocon || !p.de || p.terr[m.bloc].restant <= 0) return m;
      const units = Math.min(m.tuile.cap, p.terr[m.bloc].restant);
      const prix = r0(PRIX_REF * DE_COURS[p.de - 1]);
      const b = bornes(m.tuile, units, units * prix);
      return { ...m, curseurs: { pt: b.pt.hi, sc: b.sc.hi, fs: b.fs.seuil } };
    })
  }));

  /* Temps 7 — avancement du tour. Fonctionne aussi sans dé (aucune extraction). */
  function avancerTour(p) {
    const pr = p.de ? r0(PRIX_REF * DE_COURS[p.de - 1]) : 0;
    const u = (m) => (!p.de || m.cocon ? 0 : Math.min(m.tuile.cap, p.terr[m.bloc].restant));
    const rs = p.de ? p.mines.map((m) => calculMine(m, p.terr, u(m), pr, p.cm)) : [];
    const terr = p.terr.map((t) => ({ ...t }));
    rs.forEach((r) => { terr[r.mine.bloc].restant = Math.max(0, terr[r.mine.bloc].restant - r.units); });
    const tot = rs.reduce((s, r) => ({
      prelev: s.prelev + r.prelev, rente: s.rente + r.renteEco, CA: s.CA + r.CA,
      cash: s.cash + (r.CA - r.redevance - r.local - r.IS - r.penalite),
      deplace: s.deplace + r.deplace, repris: s.repris + r.reprise,
    }), { prelev: 0, rente: 0, CA: 0, cash: 0, deplace: 0, repris: 0 });

    const cum = {
      recettes: p.cum.recettes + tot.prelev + p.permisDuTour,
      permis: p.cum.permis + p.permisDuTour,
      prelev: p.cum.prelev + tot.prelev,
      rente: p.cum.rente + tot.rente,
      inv: p.cum.inv,
      net: p.cum.net + tot.rente - tot.prelev - p.permisDuTour,
      deplace: p.cum.deplace + tot.deplace,
      repris: p.cum.repris + tot.repris,
      tours: [...p.cum.tours, { t: p.turn, de: p.de, prix: pr, CA: tot.CA, prelev: tot.prelev, permis: p.permisDuTour, rente: tot.rente, cm: p.cm, reprise: tot.repris }],
    };

    // Fin : à l'horizon, ou quand plus rien ne peut arriver — aucun bloc à vendre,
    // aucun minerai à extraire. Aucun tour où de la valeur pourrait encore naître n'est supprimé.
    const rienAVendre = terr.every((t) => t.revele);
    const rienAExtraire = terr.every((t) => t.q === 0 || t.restant === 0);
    const dernierTour = p.dernierTour;

    const mines = p.mines.map((m) => m.pending ? { ...m, pendingActif: m.pending, pending: null } : m);
    const base = { ...p, terr, cum, mines, cash: p.cash + tot.cash };

    if (p.turn >= dernierTour || (rienAVendre && rienAExtraire)) return { ...base, phase: "FIN" };

    const suite = { ...base, turn: p.turn + 1, de: null, cm: null, cmRaison: null, curseursRaison: null, dernierTour };
    return debutTour(suite);
  }
  const tourSuivant = () => {
    // The current round is committed only once, when the player sees the public summary.
    setG((p) => p.phase === "P7" ? avancerTour(p) : p);
    setPendingControl(null);
  };

  const bilan = useMemo(() => {
    const c = g.cum;
    const captation = c.rente > 0 ? c.recettes / c.rente : null;
    const etr = c.rente > 0 ? c.prelev / c.rente : null;
    const roic = c.inv > 0 ? c.net / c.inv : null;
    return { captation, etr, roic,
      minGagne: c.recettes >= 1500 && captation !== null && captation >= 0.4,
      firmGagne: roic !== null && roic >= 0.2 && etr !== null && etr < 0.24,
      defaite: etr !== null && etr < 0.12 };
  }, [g.cum]);

  const demanderDebrief = async () => {
    setLoading(true);
    try {
      const j = g.cum.tours.map((t) => `T${t.t}: dé ${t.de} (${t.prix}/u), CA ${t.CA}, prélèvements ${t.prelev}, permis ${t.permis}, rente ${t.rente}, contre-mesure ${t.cm ? CM[t.cm].canal : "—"}, reprise ${t.reprise}`).join("\n");
      const prompt = `Tu animes un jeu sérieux universitaire sur la fiscalité minière (master d'économie, fonctionnaires fiscaux). Débriefe cette partie en français, 6 à 8 phrases denses, sans flatterie, en reliant les chiffres à des mécanismes identifiés (rente de ressource, clause de stabilisation, arbitrage IS/redevance, intervalle de pleine concurrence, contrôle sous information incomplète, marchandage obsolescent). Termine par une question ouverte.

Territoire : ${g.terr.map((t, i) => `bloc ${i + 1} ${t.nom} (${t.q} u.)${t.revele ? ` — octroyé sous ${t.regime.id} IS ${t.regime.is}/redevance ${t.regime.red}, prix ${t.prix}, restant ${t.restant}` : " — jamais ouvert"}`).join(" ; ")}
Journal :
${j}
Cumuls : recettes ${g.cum.recettes} (dont permis ${g.cum.permis}), prélèvements fiscaux ${g.cum.prelev}, rente ${g.cum.rente}, investissement ${g.cum.inv}, résultat net Firme ${g.cum.net}, déplacé ${g.cum.deplace} dont repris ${g.cum.repris}.
Ratios : captation ${bilan.captation !== null ? (bilan.captation * 100).toFixed(1) : "—"} % (≥ 40 %), ETR ${bilan.etr !== null ? (bilan.etr * 100).toFixed(1) : "—"} % (objectif < 24 %), rendement des capitaux ${bilan.roic !== null ? (bilan.roic * 100).toFixed(1) : "—"} % (≥ 20 %).
Texte simple, sans titres ni listes.`;
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await r.json();
      setDebrief(data.content.map((i) => (i.type === "text" ? i.text : "")).join("").trim());
    } catch (e) {
      setDebrief("Le débriefing n'a pas pu être généré. Le journal ci-dessus reste entièrement recalculable à la main.");
    }
    setLoading(false);
  };

  /* Plateau : uniquement les informations publiques des blocs révélés.
     Jamais de propriété nom/q/capacité d'un bloc masqué dans le DOM. */
  const Colonnes = ({ pickable = false, onPick }) => {
    const revealed = g.terr.filter(t => t.revele).length;
    const equipped = g.mines.filter(m => g.terr[m.bloc]?.restant > 0).length;
    return (
      <section className="my-4" aria-label="Plateau minier interactif">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
          <div>
            <div style={{fontFamily:F.mono,fontSize:10,letterSpacing:"0.13em",color:C.ink2}}>TERRITOIRE MINIER · PLATEAU DE JEU</div>
            <div style={{fontFamily:F.display,fontWeight:700,fontSize:19}}>Cinq concessions, une ressource incertaine</div>
          </div>
          <div style={{fontFamily:F.mono,color:C.ink2,fontSize:11}}>{revealed}/5 blocs révélés · {equipped} mine{equipped>1?"s":""} équipée{equipped>1?"s":""}</div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2" role="group" aria-label="Concessions minières">
          {g.terr.map((t,i)=>{
            const opened = openIdx.includes(i);
            const selected = g.selection.includes(i);
            const mine = g.mines.find(m=>m.bloc===i);
            const blocked = !t.revele;
            const exhausted = t.revele && t.restant <= 0;
            const progress = t.revele && t.q > 0 ? 100 * Math.max(0,t.q-t.restant)/t.q : 0;
            const status = blocked ? (opened ? "Offert, encore inconnu" : "Non révélé") :
              exhausted ? "Épuisé" : mine ? mine.cocon ? "Mine en sommeil" : "En production" : t.q===0 ? "Stérile" : "À équiper";
            const surface = blocked ? C.dark : exhausted ? "#E6E9E3" : mine ? "#DBE9DF" : "#F0E6D2";
            return (
              <button key={i} type="button" disabled={!pickable || !opened || !blocked}
                aria-pressed={pickable ? selected : undefined}
                aria-label={blocked ? `Bloc ${i+1} : ${status}` : `Bloc ${i+1} : ${t.nom}, ${status}`}
                onClick={()=>onPick?.(i)}
                className="p-3 flex flex-col justify-between text-left"
                style={{minHeight:178,background:surface,color:blocked?"#E5E8E6":C.ink,
                  border:`2px solid ${selected?C.brass:opened&&blocked?C.brass:mine?C.patina:C.line}`,
                  boxShadow:selected?`inset 0 0 0 2px ${C.brass}`:"none",
                  cursor:pickable&&opened&&blocked?"pointer":"default",opacity:blocked&&!opened?.75:1}}>
                <div className="flex justify-between items-center gap-1">
                  <span style={{fontFamily:F.mono,fontSize:11,fontWeight:700}}>BLOC {i+1}</span>
                  <span style={{fontSize:15}} aria-hidden="true">{blocked?"◆":exhausted?"◌":mine?"⚒":"◇"}</span>
                </div>
                {blocked ? (
                  <div style={{textAlign:"center",margin:"15px 0 10px"}}>
                    <div style={{fontFamily:F.display,fontSize:29}}>?</div>
                    <div style={{fontFamily:F.mono,fontSize:10,marginTop:6}}>{selected?"✓ Sélectionné":opened?"Permis disponible":"Sous-sol inconnu"}</div>
                  </div>
                ):(
                  <div style={{margin:"12px 0 8px"}}>
                    <div style={{fontFamily:F.display,fontWeight:700,fontSize:17,lineHeight:1.15}}>{t.nom}</div>
                    <div style={{fontFamily:F.mono,fontSize:12,marginTop:5}}>{t.restant}/{t.q} unités restantes</div>
                    <div style={{height:5,background:C.line,marginTop:8}} aria-hidden="true">
                      <div style={{height:"100%",width:`${progress}%`,background:C.patina}} />
                    </div>
                  </div>
                )}
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:blocked?"#D8C39D":mine?C.patina:C.ink2}}>{status}</div>
                  {!blocked && <div style={{fontSize:10,marginTop:3}}>
                    {t.regime?.id} · IS {t.regime?.is}% · R {t.regime?.red}%
                    {mine && <div style={{marginTop:3}}>{mine.tuile.nom} · {mine.tuile.cap} u./tour</div>}
                  </div>}
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 mt-2 text-xs" style={{color:C.ink2}}>
          <span>◆ Non révélé</span><span>◇ Permis sans mine</span><span>⚒ Mine équipée</span><span>◌ Épuisé</span>
          {pickable && <strong style={{color:C.brass}}>Sélectionnez les blocs proposés pour acquérir les permis.</strong>}
        </div>
      </section>
    );
  };

  const FluxPublics = () => {
    const source = g.phase==="P7" ? {
      ca:T.CA,rede:T.redevance,is:T.IS,pen:T.penalite,permis:g.permisDuTour
    } : {
      ca:g.cum.tours.reduce((acc,t)=>acc+t.CA,0),
      rede:g.cum.prelev, is:0, pen:0, permis:g.cum.permis
    };
    const fiscal = source.rede + source.is + source.pen;
    const recette = fiscal + source.permis;
    return (
      <section aria-label="Circulation publique de la valeur" className="mb-5 p-3" style={{background:C.card,border:`1px solid ${C.line}`}}>
        <div style={{fontFamily:F.mono,color:C.ink2,fontSize:10,letterSpacing:"0.12em"}}>CIRCULATION DE LA VALEUR · {g.phase==="P7"?"TOUR EN COURS":"CUMUL DES TOURS TERMINÉS"}</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
          <div style={{background:"#E9E2CF",borderLeft:`3px solid ${C.brass}`}} className="p-3">
            <div style={{fontSize:11}}>Production vendue</div>
            <strong style={{fontFamily:F.mono,fontSize:20}}>{fmt(source.ca)} M€</strong>
            <div className="text-xs">Chiffre d'affaires</div>
          </div>
          <div style={{background:"#DFEDE5",borderLeft:`3px solid ${C.patina}`}} className="p-3">
            <div style={{fontSize:11}}>État hôte</div>
            <strong style={{fontFamily:F.mono,fontSize:20}}>{fmt(recette)} M€</strong>
            <div className="text-xs">Fiscalité et permis</div>
          </div>
          <div style={{background:"#E6E8EA",borderLeft:`3px solid ${C.ink2}`}} className="p-3">
            <div style={{fontSize:11}}>Redevances + IS + pénalités</div>
            <strong style={{fontFamily:F.mono,fontSize:20}}>{fmt(fiscal)} M€</strong>
            <div className="text-xs">Hors recettes des permis : {fmt(source.permis)} M€</div>
          </div>
        </div>
        <p className="text-xs mt-2" style={{color:C.ink2}}>Les flux détaillés de la firme et les trois canaux de charges restent derrière le paravent. Ce panneau affiche uniquement les montants publics.</p>
      </section>
    );
  };

  const Bandeau = () => (
    <>
      <div className="grid grid-cols-4 gap-2 mb-2">
        {[["Tour", `${g.turn} / ${g.dernierTour}`, C.ink],
          ["Trésorerie", fmt(g.cash), C.brass],
          ["Recettes cumulées", fmt(g.cum.recettes), C.patina],
          ["Déplacé / repris", `${fmt(g.cum.deplace)} / ${fmt(g.cum.repris)}`, C.oxblood]].map(([l, v, col]) => (
          <div key={l} style={{ border: `1px solid ${C.line}`, background: C.card }} className="p-2">
            <div style={{ fontFamily: F.mono, fontSize: 9, color: C.ink2, letterSpacing: "0.1em" }} className="uppercase">{l}</div>
            <div style={{ fontFamily: F.mono, fontWeight: 700, color: col }} className="text-base">{v}</div>
          </div>
        ))}
      </div>
      {blocsSansMine > 0 && (
        <div style={{ border: `1px solid ${C.oxblood}`, background: `${C.oxblood}12`, fontFamily: F.body }} className="p-2 mb-5 text-xs">
          <b style={{ color: C.oxblood }}>{blocsSansMine} bloc{blocsSansMine > 1 ? "s détenus" : " détenu"} sans mine.</b> Du minerai payé, un régime gelé, et pas un euro de recette — ni pour la Firme, ni pour l'État. Équipez au Temps 3, ou renoncez sciemment.
        </div>
      )}
    </>
  );

  const Jauge = ({ label, valeur, cible, texte, atteint, sens }) => (
    <div className="mb-2">
      <div className="flex justify-between items-baseline">
        <span style={{ fontFamily: F.body }} className="text-xs">{label}</span>
        <span style={{ fontFamily: F.mono, fontWeight: 700, color: atteint ? C.patina : C.oxblood }} className="text-xs">{texte}</span>
      </div>
      <div className="relative h-1.5 mt-1" style={{ background: C.line }}>
        <div className="absolute top-0 h-1.5" style={{ width: `${Math.min(100, Math.max(0, valeur * 100))}%`, background: atteint ? C.patina : C.oxblood }} />
        {sens === "plafond" && <div className="absolute top-0 h-1.5 w-0.5" style={{ left: `${Math.min(100, cible * 100)}%`, background: C.ink }} />}
      </div>
    </div>
  );

  const Objectifs = () => {
    const c = g.cum;
    const capt = bilan.captation, etr = bilan.etr, roic = bilan.roic;
    const joues = c.tours.length;
    return (
      <div className="grid grid-cols-2 gap-2 mb-5">
        <div style={{ border: `1px solid ${C.patina}`, background: `${C.patina}0A` }} className="p-3">
          <div style={{ fontFamily: F.mono, fontSize: 9, color: C.patina, letterSpacing: "0.1em" }} className="uppercase mb-2">Objectifs · Ministre</div>
          <Jauge label="Recettes cumulées ≥ 1 500" valeur={c.recettes / 1500} atteint={c.recettes >= 1500}
            texte={`${fmt(c.recettes)} / 1 500`} />
          <Jauge label="Captation de la rente ≥ 40 %" valeur={capt === null ? 0 : capt / 0.4} atteint={capt !== null && capt >= 0.4}
            texte={capt === null ? "—" : pct(capt)} />
          <div style={{ fontFamily: F.body, color: C.ink2 }} className="text-xs mt-1">
            recettes ÷ rente générée ({fmt(c.rente)}) · permis inclus
          </div>
        </div>
        <div style={{ border: `1px solid ${C.brass}`, background: `${C.brass}0A` }} className="p-3">
          <div style={{ fontFamily: F.mono, fontSize: 9, color: C.brass, letterSpacing: "0.1em" }} className="uppercase mb-2">Objectifs · Multinationale</div>
          <Jauge label="Rendement des capitaux ≥ 20 %" valeur={roic === null ? 0 : roic / 0.2} atteint={roic !== null && roic >= 0.2}
            texte={roic === null ? "—" : pct(roic)} />
          <Jauge label="Taux effectif < 24 %" valeur={etr === null ? 0 : etr / 0.24} cible={1} sens="plafond"
            atteint={etr !== null && etr < 0.24} texte={etr === null ? "—" : pct(etr)} />
          <div style={{ fontFamily: F.body, color: etr !== null && etr < 0.12 ? C.oxblood : C.ink2 }} className="text-xs mt-1">
            {etr !== null && etr < 0.12
              ? "Sous 12 % : défaite collective si la partie s'achevait ainsi."
              : `net ${fmt(c.net)} ÷ capital investi ${fmt(c.inv)} · impôt ${fmt(c.prelev)} ÷ rente ${fmt(c.rente)}`}
          </div>
        </div>
        <div style={{ fontFamily: F.body, color: C.ink2 }} className="col-span-2 text-xs -mt-1">
          Cumuls arrêtés à la fin du tour {joues || "—"} : le tour en cours n'y figure pas encore. Tous ces nombres sont calculables par les deux joueurs.
        </div>
      </div>
    );
  };

  const blocsSansMine = g.terr.filter((t, i) => t.revele && t.q > 0 && t.restant > 0 && !g.mines.some((m) => m.bloc === i)).length;
  const guide = PHASES_GUIDE[g.phase] || [g.phase === "FIN" ? "Bilan" : "Mise en place", "Suivez les décisions du tour et observez leur effet sur les résultats."];
  const etape = g.phase === "FIN" ? -1 : ["P1M","P1F","P1R"].includes(g.phase) ? (g.phase === "P1M" ? 0 : 1) :
    ["P3","P4","P5","P6","P7"].indexOf(g.phase) + 2;

  return (
    <div style={{ background: C.paper, color: C.ink, minHeight: "100vh", fontFamily: F.body }} className="p-5 md:p-10">
      <div className="max-w-3xl mx-auto">
        <header className="mb-6 pb-4" style={{ borderBottom: `2px solid ${C.ink}` }}>
          <div className="flex items-end justify-between flex-wrap gap-2">
            <div>
              <h1 style={{ fontFamily: F.display, letterSpacing: "0.22em" }} className="text-4xl font-bold">FILONS</h1>
              <p style={{ color: C.ink2 }} className="text-sm mt-1">Duel — huit tours. Un Ministre, une Firme, cinq blocs.</p>
            </div>
            {g.mode && <div style={{ fontFamily: F.mono, color: C.ink2 }} className="text-xs">{hot ? "HOTSEAT" : jeSuisFirme ? "VOUS : LA FIRME" : "VOUS : LE MINISTRE"}</div>}
          </div>
        </header>

        {g.mode && <section className="mb-4 p-3" style={{background:C.card,border:"1px solid "+C.line}} aria-label="Progression">
          <div className="flex flex-wrap gap-2 items-center justify-between mb-2">
            <div><b>{g.handoff ? "Passage de main" : guide[0]}</b> · Tour {g.turn}/{g.dernierTour}</div>
            <div className="flex gap-2 items-center">
              <span role="status" className="text-xs" style={{color:saveOk?C.patina:C.oxblood}}>{saveOk?"Sauvegarde automatique":"Sauvegarde indisponible"}</span>
              <button className="px-2 py-1 text-xs" style={{border:"1px solid "+C.line}} onClick={()=>setShowGuide(v=>!v)} aria-expanded={showGuide}>{showGuide?"Masquer l’aide":"Aide"}</button>
              <button className="px-2 py-1 text-xs" style={{border:"1px solid "+C.oxblood,color:C.oxblood}} onClick={resetFilons}>Recommencer</button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1" aria-label="Étapes du tour">
            {ETAPES.map((nom,i)=><div key={nom} title={nom} aria-current={!g.handoff && i===etape?"step":undefined} className="text-center py-1" style={{background:i===etape&&!g.handoff?C.patina:C.paper,color:i===etape&&!g.handoff?"white":C.ink2,border:"1px solid "+C.line}}><div className="text-xs font-bold">{i+1}</div><div className="hidden sm:block" style={{fontSize:10}}>{nom}</div></div>)}
          </div>
          {showGuide && <div className="mt-3 p-3 text-sm" style={{background:C.paper,borderLeft:"3px solid "+C.brass}}>{g.handoff?"Passez l’écran au joueur désigné. Les choix secrets sont masqués.":guide[1]} Les règles fiscales sont stabilisées pour chaque permis octroyé.</div>}
        </section>}
        {g.handoff ? (
          <div style={{ background: C.dark, color: C.paper }} className="p-10 text-center">
            <div style={{ fontFamily: F.mono, color: C.brass, letterSpacing: "0.18em" }} className="text-xs uppercase mb-4">Paravent · tour {g.turn} / {g.dernierTour}</div>
            <h2 style={{ fontFamily: F.display }} className="text-3xl mb-3">
              {g.handoff.role === "Table" ? "Décisions scellées" : g.handoff.role}
            </h2>
            <p style={{ color: "#A9B2B9", fontFamily: F.display, lineHeight: 1.6 }} className="text-base mb-2 max-w-md mx-auto">
              {g.handoff.role === "Table"
                ? "Les enveloppes sont fermées. On peut lever les paravents : la suite se joue à découvert."
                : g.handoff.next === "P1M"
                  ? "Vous allez fixer le code minier : mode d'octroi, prix par bloc, nombre de blocs ouverts, impôt et redevance. Vous ne savez rien du sous-sol."
                  : g.handoff.next === "P1F"
                    ? "Vous allez décider combien de blocs demander, et à quel prix. Ce qui part au permis ne financera pas la mine."
                    : g.handoff.next === "P5"
                      ? "Vous allez régler vos trois curseurs, mine par mine. Le Ministre ne lira que deux nombres."
                      : "Vous allez lire les déclarations et poser une contre-mesure — une seule, pour tout le territoire."}
            </p>
            {g.handoff.role !== "Table" && (
              <p style={{ color: C.oxblood, fontFamily: F.mono, letterSpacing: "0.08em" }} className="text-xs uppercase mb-6">
                Que l'autre joueur détourne les yeux
              </p>
            )}
            <Btn kind="ghost" onClick={() => up({ phase: g.handoff.next, handoff: null })}>
              <span style={{ color: C.paper }}>{g.handoff.role === "Table" ? "Continuer" : `Je suis seul devant l'écran — continuer`}</span>
            </Btn>
          </div>
        ) : (
        <>
        {g.mode && g.phase !== "setup" && <Bandeau />}
        {g.mode && ["P3","P4","P5","P6","P7"].includes(g.phase) && <Colonnes />}
        {g.mode && ["P7","FIN"].includes(g.phase) && <FluxPublics />}
        {g.mode && g.phase !== "setup" && g.phase !== "FIN" && <Objectifs />}

        {g.phase === "setup" && (
          <Bloc>
            <Eyebrow>Mise en place</Eyebrow>
            <p style={{ fontFamily: F.display, lineHeight: 1.65 }} className="text-base">
              Cinq blocs. Un stérile, un marginal, un moyen, un riche, un classe mondiale — la composition est publique,
              l'ordre est secret, et personne ne l'a regardé. Le Ministre fixe le prix de l'accès, l'impôt et la redevance
              avant de savoir ce qu'il vend. La Firme dispose de 1 000 M€ et de huit tours.
            </p>
            <Note>Ce qu'il signe, il le signe pour toute la partie. Le savoir arrive toujours après la signature.</Note>
            <div className="grid gap-3">
              <Btn onClick={() => lancer("solo_firme")}>Solo — je joue la Firme</Btn>
              <Btn onClick={() => lancer("solo_ministre")}>Solo — je joue le Ministre</Btn>
              <Btn kind="ghost" onClick={() => lancer("hotseat")}>Hotseat — deux joueurs, un paravent</Btn>
              <a href="/multiplayer.html" style={{display:"block",padding:"12px 16px",border:"2px solid "+C.patina,color:C.patina,textAlign:"center",fontWeight:700}}>En ligne — plusieurs joueurs à distance ↗</a>
            </div>
          </Bloc>
        )}

        {g.phase === "P1M" && (
          <Bloc>
            <Eyebrow>Tour {g.turn} · Temps 1 — le code minier</Eyebrow>
            <p style={{ fontFamily: F.display }} className="text-sm mb-4">
              Le code est unique pour tout le territoire, et révisable — mais seulement pour les blocs non retournés.
              Le prix s'entend <b>par bloc</b> : la Firme peut en prendre plusieurs. Votre prix est votre seul rationnement.
            </p>
            <div className="flex gap-2 mb-4">
              {[["admin", "Attribution administrative"], ["enchere", "Enchère (prix de réserve)"]].map(([k, l]) => (
                <button key={k} onClick={() => up({ offre: { ...g.offre, mode: k } })}
                  style={{ background: g.offre.mode === k ? C.ink : "transparent", color: g.offre.mode === k ? C.paper : C.ink, border: `1px solid ${C.ink}` }}
                  className="flex-1 px-3 py-2 text-sm">{l}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-5 mb-4">
              <div>
                <div className="text-sm mb-1 font-semibold">{g.offre.mode === "admin" ? "Prix affiché par bloc" : "Prix de réserve par bloc"} : <span style={{ fontFamily: F.mono, color: C.brass }}>{fmt(g.offre.montant)} M€</span></div>
                <input type="range" min={1} max={300} value={g.offre.montant} onChange={(e) => up({ offre: { ...g.offre, montant: +e.target.value } })} className="w-full" />
              </div>
              <div>
                <div className="text-sm mb-2 font-semibold">Blocs ouverts <span style={{ fontFamily: F.mono, color: C.ink2 }} className="font-normal">({libres} libre{libres > 1 ? "s" : ""})</span></div>
                <div className="flex gap-1 flex-wrap">
                  {Array.from({ length: libres + 1 }, (_, i) => i).map((n) => {
                    const actif = nOuverts === n;
                    return (
                      <button key={n} onClick={() => up({ offre: { ...g.offre, blocs: n } })}
                        style={{ background: actif ? C.ink : C.card, color: actif ? C.paper : C.ink, border: `1px solid ${C.ink}`, fontFamily: F.mono }}
                        className="px-4 py-2 text-base font-bold">{n}</button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {REGIMES.map((r) => (
                <button key={r.id} onClick={() => up({ offre: { ...g.offre, regime: r } })}
                  style={{ background: g.offre.regime.id === r.id ? C.patina : C.card, color: g.offre.regime.id === r.id ? C.paper : C.ink, border: `1px solid ${g.offre.regime.id === r.id ? C.patina : C.line}`, fontFamily: F.mono }}
                  className="px-2 py-1.5 text-xs text-left">
                  <div className="font-bold">{r.id}</div><div>IS {r.is} · R {r.red}</div>
                </button>
              ))}
            </div>
            <p style={{ fontFamily: F.display, color: C.ink2 }} className="text-sm italic mb-3">{g.offre.regime.note}</p>
            <Colonnes pickable={false} />
            <div className="flex gap-3">
              <Btn onClick={validerOffre} disabled={libres === 0 || nOuverts === 0}>Sceller l'offre</Btn>
              <Btn kind="ghost" onClick={sansOctroi}>Ne rien ouvrir ce tour</Btn>
            </div>
          </Bloc>
        )}

        {g.phase === "P1F" && (
          <Bloc>
            <Eyebrow>Tour {g.turn} · Temps 1 — candidature</Eyebrow>
            {jeSuisFirme && g.offreRaison && <IAsays who="Ministre des Finances (IA)">{g.offreRaison}</IAsays>}
            <div className="grid grid-cols-4 gap-2 my-3">
              {[["Mode", g.offre.mode === "admin" ? "Attribution" : "Enchère"],
                [g.offre.mode === "admin" ? "Prix / bloc" : "Réserve / bloc", fmt(g.offre.montant)],
                ["Blocs ouverts", `${nOuverts}`],
                ["Régime", `${g.offre.regime.id} · ${g.offre.regime.is}/${g.offre.regime.red}`]].map(([l, v]) => (
                <div key={l} style={{ border: `1px solid ${C.line}` }} className="p-2">
                  <div style={{ fontFamily: F.mono, fontSize: 9, color: C.ink2, letterSpacing: "0.1em" }} className="uppercase">{l}</div>
                  <div style={{ fontFamily: F.mono, fontWeight: 700 }} className="text-base">{v}</div>
                </div>
              ))}
            </div>
            <Colonnes pickable={false} />

            {nOuverts === 0 ? (
              <>
                <p style={{ fontFamily: F.display }} className="text-base mb-3">Aucun bloc ouvert. Rien à demander ce tour.</p>
                <Btn onClick={() => deposer(false, 0, 0)}>Poursuivre</Btn>
              </>
            ) : (
              <>
                <div className="mb-4">
                  <div className="text-sm mb-2 font-semibold">Combien de blocs demandez-vous ? <span style={{ fontFamily: F.mono, color: C.ink2 }} className="font-normal">({nOuverts} ouvert{nOuverts > 1 ? "s" : ""} par le Ministre)</span></div>
                  <div className="flex gap-2">
                    {Array.from({ length: nOuverts }, (_, i) => i + 1).map((n) => {
                      const actif = Math.max(1, Math.min(g.env.k || 1, nOuverts)) === n;
                      const mise0 = g.offre.mode === "admin" ? g.offre.montant : Math.max(g.offre.montant, g.env.mise || g.offre.montant);
                      const trop = n * mise0 > g.cash;
                      return (
                        <button key={n} disabled={trop}
                          onClick={() => setG((p) => ({ ...p, env: { ...p.env, k: n } }))}
                          style={{ background: actif ? C.ink : C.card, color: actif ? C.paper : C.ink,
                            border: `1px solid ${trop ? C.line : C.ink}`, opacity: trop ? 0.4 : 1, fontFamily: F.mono }}
                          className="px-5 py-3 text-lg font-bold">
                          {n}
                        </button>
                      );
                    })}
                  </div>
                  {nOuverts < 2 && (
                    <p style={{ fontFamily: F.body, color: C.ink2 }} className="text-xs mt-2">
                      Le Ministre n'a ouvert qu'un seul bloc. C'est lui qui décide de la surface mise sur le marché — vous ne pouvez pas en demander davantage.
                    </p>
                  )}
                </div>
                {g.offre.mode === "enchere" && (
                  <div className="mb-4">
                    <div className="text-sm mb-1 font-semibold">Mise par bloc : <span style={{ fontFamily: F.mono, color: C.brass }}>{fmt(Math.max(g.offre.montant, g.env.mise || g.offre.montant))} M€</span></div>
                    <input type="range" min={g.offre.montant} max={Math.max(g.offre.montant + 1, Math.min(400, g.cash))}
                      value={Math.max(g.offre.montant, g.env.mise || g.offre.montant)}
                      onChange={(e) => { const v = +e.target.value; setG((p) => ({ ...p, env: { ...p.env, mise: v } })); }} className="w-full" />
                  </div>
                )}
                {(() => {
                  const k = Math.max(1, Math.min(g.env.k || 1, nOuverts));
                  const mise = g.offre.mode === "admin" ? g.offre.montant : Math.max(g.offre.montant, g.env.mise || g.offre.montant);
                  const total = k * mise;
                  const reste = g.cash - total;
                  return (
                    <>
                      <Row l="Coût total de l'enveloppe" v={total} strong color={C.brass} />
                      <Row l="Trésorerie restante pour investir" v={reste} strong color={reste < 150 ? C.oxblood : C.patina} />
                      <p style={{ fontFamily: F.display, color: C.ink2 }} className="text-sm italic my-3">
                        L'enveloppe fait la contrainte budgétaire : ce qui part au permis ne financera pas la mine. Une mine conventionnelle coûte 150, une mécanisée 400.
                      </p>
                      <div className="flex gap-3">
                        <Btn disabled={total > g.cash} onClick={() => deposer(true, k, mise)}>Déposer l'enveloppe</Btn>
                        <Btn kind="ghost" onClick={() => deposer(false, 0, 0)}>Ne pas candidater</Btn>
                      </div>
                    </>
                  );
                })()}
              </>
            )}
          </Bloc>
        )}

        {g.phase === "P1R" && (
          <Bloc>
            <Eyebrow>Tour {g.turn} · Temps 1 — résolution et octroi</Eyebrow>
            {jeSuisMinistre && g.envRaison && <IAsays who="Direction de la multinationale (IA)">{g.envRaison}</IAsays>}
            {!g.env.depose || g.env.k === 0 ? (
              <>
                <p style={{ fontFamily: F.display }} className="text-lg mb-2">Aucune enveloppe. Le sous-sol reste sous terre.</p>
                <Note color={C.oxblood}>L'État sans trésorerie n'encaisse rien. Il gardera son minerai — et sa pauvreté.</Note>
                <Btn onClick={sansOctroi}>Poursuivre le tour</Btn>
              </>
            ) : jeSuisMinistre ? (
              <>
                <p className="text-sm mb-2">La Firme emporte <b>{g.env.k}</b> bloc{g.env.k > 1 ? "s" : ""} à <b style={{ fontFamily: F.mono }}>{fmt(g.env.mise)} M€</b> pièce — soit <b style={{ fontFamily: F.mono }}>{fmt(g.env.k * g.env.mise)} M€</b> pour vos recettes.</p>
                <Colonnes pickable={false} />
                <Btn onClick={confirmerOctroi}>Retourner les cartes</Btn>
              </>
            ) : (
              <>
                <p className="text-sm mb-1">
                  Enveloppe valide : <b style={{ fontFamily: F.mono }}>{g.env.k} × {fmt(g.env.mise)} = {fmt(g.env.k * g.env.mise)} M€</b>.
                  Choisissez {g.env.k} colonne{g.env.k > 1 ? "s" : ""} — elles sont indiscernables.
                </p>
                <Colonnes pickable onPick={toggleCol} />
                <Btn disabled={g.selection.length !== g.env.k} onClick={confirmerOctroi}>
                  {g.selection.length !== g.env.k ? `Sélectionnez ${g.env.k} colonne${g.env.k > 1 ? "s" : ""}` : "Retourner les cartes"}
                </Btn>
                <Note>Les cartes Régime {g.offre.regime.id} glissent sur les colonnes. Les contrats sont gelés pour toute la partie.</Note>
              </>
            )}
          </Bloc>
        )}

        {g.phase === "P3" && (() => {
          const sansMine = g.terr.map((t, i) => ({ t, i }))
            .filter(({ t, i }) => t.revele && t.q > 0 && t.restant > 0 && !g.mines.some((m) => m.bloc === i));
          return (
          <Bloc>
            <Eyebrow>Tour {g.turn} · Temps 3 — l'investissement</Eyebrow>

            {sansMine.length > 0 && (
              <>
                <div style={{ fontFamily: F.display, fontWeight: 600 }} className="text-lg mb-1">
                  Blocs détenus sans mine — {sansMine.length}
                </div>
                <p style={{ fontFamily: F.body, color: C.ink2 }} className="text-sm mb-3">
                  Un permis sans tuile ne produit rien : ni chiffre d'affaires, ni impôt. Ces blocs restent équipables aussi longtemps qu'ils contiennent du minerai.
                </p>

                {jeSuisMinistre ? (
                  <>
                    {sansMine.map(({ t, i }) => (
                      <IAsays key={i} who={`Direction de la multinationale (IA) — bloc ${i + 1}, ${t.nom}`}>
                        {iaFirmeTuile(t.restant, g.cash, toursRestants).raison}
                      </IAsays>
                    ))}
                    <Btn onClick={investirIA}>La Firme pose ses tuiles</Btn>
                  </>
                ) : (
                  sansMine.map(({ t, i }) => (
                    <div key={i} style={{ border: `1px solid ${C.brass}`, background: `${C.brass}0A` }} className="p-3 mb-3">
                      <div className="flex items-baseline gap-3 mb-2">
                        <span style={{ fontFamily: F.display, fontWeight: 600 }} className="text-base">Bloc {i + 1} — {t.nom}</span>
                        <span style={{ fontFamily: F.mono, color: C.brass, fontWeight: 700 }} className="text-lg">{t.restant} unités</span>
                        <span style={{ fontFamily: F.mono, color: C.ink2 }} className="text-xs">{t.regime.id} · IS {t.regime.is} % · redevance {t.regime.red} %</span>
                      </div>
                      <div className="grid gap-1">
                        {TUILES.map((x) => {
                          const tours = Math.ceil(t.restant / x.cap);
                          const trop = tours > toursRestants;
                          const cher = x.inv > g.cash;
                          // Repère illustratif : prix moyen, coûts réels et fiscalité du bloc.
                          const quantite = Math.min(t.restant, x.cap * toursRestants);
                          const coutVariable = x.local + (x.pt.reel + x.sc.reel + x.fs.reel) / x.cap;
                          const caPrevu = quantite * PRIX_REF;
                          const redevancePrevue = caPrevu * t.regime.red / 100;
                          const margeAvantIS = caPrevu - quantite * coutVariable - redevancePrevue - x.inv;
                          const impotEstime = Math.max(0, margeAvantIS) * t.regime.is / 100;
                          const surplusIndicatif = r0(margeAvantIS - impotEstime);
                          return (
                            <button key={x.id} disabled={cher} onClick={() => investir(i, x)}
                              style={{ border: `1px solid ${C.line}`, background: C.card, opacity: cher ? 0.4 : 1 }}
                              className="p-2 text-left flex items-center justify-between">
                              <div>
                                <span style={{ fontFamily: F.display, fontWeight: 600 }} className="text-sm">{x.nom}</span>
                                <span style={{ fontFamily: F.mono, color: C.ink2 }} className="text-xs"> · {fmt(x.inv)} M€ · capacité {x.cap}/tour · coût local {x.local}/u</span>
                                <div style={{fontSize:11,color:surplusIndicatif>=0?C.patina:C.oxblood,marginTop:4}}>
                                  Repère à prix moyen : {fmt(quantite)} unités extractibles ; solde net indicatif {surplusIndicatif>=0?"+":""}{fmt(surplusIndicatif)} M€ (après investissement)
                                </div>
                              </div>
                              <span style={{ fontFamily: F.mono, fontWeight: 700, color: trop ? C.oxblood : C.patina }} className="text-sm">
                                {tours} tour{tours > 1 ? "s" : ""}{trop ? " — au-delà de l'horizon" : ""}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {TUILES.every((x) => x.inv > g.cash) && (
                        <p style={{ fontFamily: F.body, color: C.oxblood }} className="text-xs mt-2">
                          Trésorerie insuffisante pour la moindre tuile. Ce bloc attendra un tour où vous aurez encaissé.
                        </p>
                      )}
                    </div>
                  ))
                )}
                <Note color={C.oxblood}>
                  Acheter plus de permis que l'on ne peut équiper, c'est immobiliser du minerai sous un régime gelé — et n'en tirer aucun euro. Le permis se paie ; la mine aussi.
                </Note>
              </>
            )}

            {g.mines.length > 0 && (
              <>
                <div style={{ fontFamily: F.display, fontWeight: 600 }} className="text-lg mb-2 mt-4">Mines en service</div>
                <div className="grid gap-2 mb-4">
                  {g.mines.map((m, i) => {
                    const t = g.terr[m.bloc];
                    const sup = TUILES.filter((x) => x.inv > m.tuile.inv);
                    return (
                      <div key={i} style={{ border: `1px solid ${C.line}`, background: C.card }} className="p-3">
                        <div className="flex justify-between items-baseline">
                          <span style={{ fontFamily: F.display, fontWeight: 600 }}>Bloc {m.bloc + 1} — {t.nom} · {m.tuile.nom}</span>
                          <span style={{ fontFamily: F.mono, color: C.brass }} className="text-sm">{t.restant} / {t.q} u.</span>
                        </div>
                        <div style={{ fontFamily: F.mono, color: C.ink2 }} className="text-xs mb-2">
                          {t.regime.id} gelé · investi {fmt(m.invCumul)} · amortissement {fmt(m.invCumul / (t.q || 1))} / unité
                          {m.pending && <span style={{ color: C.patina }}> · extension vers {m.pending.nom} au tour prochain</span>}
                          {m.pendingActif && <span style={{ color: C.patina }}> · {m.pendingActif.nom} entre en service ce tour</span>}
                        </div>
                        {!jeSuisMinistre && t.restant > 0 && (
                          <div className="flex gap-2 flex-wrap">
                            <button onClick={() => cocon(i)} style={{ border: `1px solid ${m.cocon ? C.oxblood : C.line}`, color: m.cocon ? C.oxblood : C.ink }} className="px-2 py-1 text-xs">
                              {m.cocon ? "Sous cocon — reprendre" : "Mettre sous cocon"}
                            </button>
                            {!m.pending && sup.map((x) => {
                              const cout = r0((x.inv - m.tuile.inv) * 1.25);
                              return (
                                <button key={x.id} disabled={cout > g.cash} onClick={() => etendre(i, x)}
                                  style={{ border: `1px solid ${C.line}`, opacity: cout > g.cash ? 0.4 : 1 }} className="px-2 py-1 text-xs">
                                  → {x.nom} ({fmt(cout)} M€, effet différé)
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {t.restant === 0 && <div style={{ fontFamily: F.mono, color: C.ink2 }} className="text-xs">Gisement épuisé.</div>}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {g.mines.length === 0 && sansMine.length === 0 && (
              <p style={{ fontFamily: F.display }} className="text-base mb-4">Aucun bloc détenu, aucune mine. Rien à investir ce tour.</p>
            )}

            <div className="p-3 mb-3" style={{background:C.card,border:"1px solid "+C.line}}>
              <p className="text-sm">Trésorerie disponible : <strong>{fmt(g.cash)} M€</strong> · Mines équipées : <strong>{g.mines.length}</strong> · Blocs à équiper : <strong>{sansMine.length}</strong></p>
              {sansMine.length > 0 && !jeSuisMinistre && <p className="text-xs mt-2" style={{color:C.ink2}}>Passer au cours laisse ces blocs inexploités pendant ce tour. Vous pourrez encore investir au prochain tour.</p>}
            </div>
            <Btn onClick={finT3}>{sansMine.length > 0 ? "Terminer les investissements et poursuivre" : "Passer au cours"}</Btn>
          </Bloc>
          );
        })()}

        {g.phase === "P4" && (
          <Bloc>
            <Eyebrow>Tour {g.turn} · Temps 4 — cours et extraction</Eyebrow>
            {g.de === null ? (
              <>
                <p style={{ fontFamily: F.display, lineHeight: 1.6 }} className="text-base mb-4">
                  La Firme a engagé son capital avant de connaître le cours. Le Ministre a gelé son régime avant de connaître le gisement.
                  C'est seulement maintenant que le monde parle.
                </p>
                <div className="grid grid-cols-6 gap-1 mb-4">
                  {DE_COURS.map((m, i) => (
                    <div key={i} style={{ border: `1px solid ${C.line}`, background: C.card }} className="p-2 text-center">
                      <div style={{ fontFamily: F.mono, color: C.ink2 }} className="text-xs">{i + 1}</div>
                      <div style={{ fontFamily: F.mono, fontWeight: 700 }} className="text-sm">{r0(200 * m)}</div>
                    </div>
                  ))}
                </div>
                <Btn onClick={lancerDe}>Lancer le dé de cours</Btn>
              </>
            ) : (
              <>
                <div className="flex items-center gap-5 mb-4">
                  <div style={{ background: C.dark, color: C.paper, width: 64, height: 64, fontFamily: F.mono }} className="flex items-center justify-center text-3xl font-bold">{g.de}</div>
                  <div>
                    <div style={{ fontFamily: F.mono, color: C.brass, fontWeight: 700 }} className="text-3xl">{fmt(price)} M€ / unité</div>
                    <div style={{ color: C.ink2 }} className="text-sm">multiplicateur {String(DE_COURS[g.de - 1]).replace(".", ",")}</div>
                  </div>
                </div>
                {g.mines.length === 0 ? <p style={{ fontFamily: F.display }} className="text-base mb-3">Aucune mine : aucune extraction.</p> :
                  g.mines.map((m, i) => (
                    <Row key={i} l={`Bloc ${m.bloc + 1} — ${m.tuile.nom}${m.cocon ? " (cocon)" : ""} · ${unitsOf(m)} u.`} v={unitsOf(m) * price} />
                  ))}
                <Row l="Chiffre d'affaires du tour (public)" v={g.mines.reduce((s, m) => s + unitsOf(m) * price, 0)} strong color={C.brass} />
                <div className="mt-4"><Btn onClick={versDeclaration}>Passer à la déclaration</Btn></div>
              </>
            )}
          </Bloc>
        )}

        {g.phase === "P5" && (
          <Bloc>
            <Eyebrow>Tour {g.turn} · Temps 5 — la déclaration, derrière le paravent</Eyebrow>
            <Note color={C.oxblood}>
              Une seule contre-mesure frappera tout le territoire. Charger le même canal sur toutes vos mines, c'est offrir au Ministre une prise unique.
            </Note>
            <div className="flex flex-wrap gap-3 items-center mb-4 p-3" style={{background:C.card,border:"1px solid "+C.line}}>
              <Btn kind="ghost" onClick={appliquerZoneSure}>Rétablir les charges dans les zones sûres</Btn>
              <span className="text-xs" style={{color:C.ink2}}>Applique les plafonds autorisés à chaque mine active. Vous pouvez ensuite ajuster les curseurs.</span>
            </div>
            {resMines.map((r, i) => r.units === 0 ? (
              <div key={i} style={{ border: `1px solid ${C.line}` }} className="p-3 mb-3">
                <span style={{ fontFamily: F.display }}>Bloc {r.mine.bloc + 1} — aucune extraction ce tour.</span>
              </div>
            ) : (
              <div key={i} style={{ border: `1px solid ${C.line}`, background: C.card }} className="p-4 mb-4">
                <div className="flex justify-between items-baseline mb-3">
                  <span style={{ fontFamily: F.display, fontWeight: 600 }} className="text-base">Bloc {r.mine.bloc + 1} — {r.bloc.nom} · {r.tuile.nom} · {r.reg.id}</span>
                  <span style={{ fontFamily: F.mono, color: C.brass }} className="text-sm">CA {fmt(r.CA)} · {r.units} u.</span>
                </div>
                <Curseur label="Achats intragroupe" val={r.dPT} setVal={(v) => setCur(i, "pt", v)} min={r.b.pt.reel} max={r.b.pt.plaf}
                  safeLo={r.b.pt.lo} safeHi={r.b.pt.hi} reel={r.b.pt.reel}
                  sub={`intervalle ${fmt(r.b.pt.lo)} – ${fmt(r.b.pt.hi)} · reprise à la médiane ${fmt(r.b.pt.med)}`} />
                <Curseur label="Intérêts" val={r.dSC} setVal={(v) => setCur(i, "sc", v)} min={r.b.sc.reel} max={r.b.sc.plaf}
                  safeLo={r.b.sc.lo} safeHi={r.b.sc.hi} reel={r.b.sc.reel}
                  sub={`intervalle ${fmt(r.b.sc.lo)} – ${fmt(r.b.sc.hi)} · reprise à la médiane ${fmt(r.b.sc.med)}`} />
                <Curseur label="Frais de siège" val={r.dFS} setVal={(v) => setCur(i, "fs", v)} min={0} max={r.b.fs.plaf}
                  safeLo={0} safeHi={r.b.fs.seuil} reel={r.b.fs.reel}
                  sub={`seuil = max(forfait ${fmt(r.b.fs.forfait)}, coût réel ${fmt(r.b.fs.reel)}) = ${fmt(r.b.fs.seuil)}`} />
                <div style={{ background: C.dark, color: C.paper }} className="p-3 mt-2">
                  <div className="flex justify-between" style={{ fontFamily: F.mono }}><span className="text-sm">Total des charges</span><span className="font-bold">{fmt(r.totalCharges)}</span></div>
                  <div className="flex justify-between" style={{ fontFamily: F.mono }}><span className="text-sm">Bénéfice déclaré</span><span className="font-bold">{fmt(r.beneficeDeclare)}</span></div>
                  <div className="flex justify-between" style={{ fontFamily: F.mono, color: r.horsZoneSure > 0 ? "#E0A0A0" : "#9FC0B2" }}>
                    <span className="text-xs">Hors zone sûre (visible pour lui)</span><span className="text-xs">{fmt(r.horsZoneSure)}</span>
                  </div>
                </div>
              </div>
            ))}
            <Btn onClick={validerCurseurs}>Sceller les déclarations</Btn>
          </Bloc>
        )}

        {g.phase === "P6" && (
          <Bloc>
            <Eyebrow>Tour {g.turn} · Temps 6 — le contrôle, une porte sur trois</Eyebrow>
            <div style={{ background: C.dark, color: C.paper }} className="p-4 mb-4">
              <div style={{ fontFamily: F.mono, color: C.brass, letterSpacing: "0.12em" }} className="text-xs uppercase mb-2">Les déclarations</div>
              {resMines.filter((r) => r.units > 0).map((r, i) => (
                <div key={i} className="py-1" style={{ borderBottom: "1px solid #2B333A" }}>
                  <div className="flex justify-between" style={{ fontFamily: F.mono }}>
                    <span className="text-sm">Bloc {r.mine.bloc + 1} · CA {fmt(r.CA)}</span>
                    <span className="text-sm">charges {fmt(r.totalCharges)} · bénéfice {fmt(r.beneficeDeclare)}</span>
                  </div>
                  <div style={{ fontFamily: F.mono, color: r.horsZoneSure > 0 ? "#E0A0A0" : "#9FC0B2" }} className="text-xs">
                    sommet des zones sûres {fmt(r.chargesZoneSure)} → {r.horsZoneSure > 0 ? `${fmt(r.horsZoneSure)} M€ dépassent` : "rien ne dépasse"}
                  </div>
                </div>
              ))}
              <div className="flex justify-between pt-2" style={{ fontFamily: F.mono }}>
                <span className="font-bold">Écart total hors zone sûre</span>
                <span className="font-bold" style={{ color: T.hors > 0 ? "#E0A0A0" : "#9FC0B2" }}>{fmt(T.hors)}</span>
              </div>
            </div>
            <p style={{ fontFamily: F.display }} className="text-sm mb-3 italic">
              {T.hors > 0 ? "Vous savez combien. Vous ignorez par quelle porte." : "Tout est dans les clous — et pourtant du bénéfice a bougé."}
            </p>
            <p className="text-xs mb-3" style={{color:C.ink2}}>La catégorie sélectionnée sera confirmée avant le redressement. Les montants par canal restent inconnus : aucun indice privé n'est révélé.</p>
            <div className="grid gap-2">
              {Object.entries(CM).map(([k, c]) => (
                <button key={k} onClick={() => poserCM(k)} aria-pressed={pendingControl === k}
                  style={{ border: `2px solid ${pendingControl === k ? C.patina : C.line}`, background: pendingControl===k ? `${C.patina}16` : C.card }} className="p-3 text-left">
                  <div style={{ fontFamily: F.display, fontWeight: 600 }} className="text-base">{c.nom}</div>
                  <div style={{ fontFamily: F.mono, color: C.ink2 }} className="text-xs">Ouvre : {c.canal} · {c.src}</div>
                </button>
              ))}
            </div>
            <div className="mt-4 p-3" style={{border:"1px solid "+C.line,background:C.paper}}>
              {pendingControl ? <p className="text-sm mb-3">Contrôle choisi : <strong>{CM[pendingControl].nom}</strong>. Ce choix s’appliquera à toutes les mines actives du territoire.</p> :
                <p className="text-sm mb-3">Sélectionnez un canal de contrôle pour poursuivre.</p>}
              <Btn disabled={!pendingControl} onClick={confirmerCM}>Confirmer le contrôle et révéler les résultats</Btn>
            </div>
            <Note color={C.patina}>La contre-mesure est une règle de droit : elle s'applique à toutes les mines du territoire. Un État ne légifère pas contre un contribuable.</Note>
          </Bloc>
        )}

        {g.phase === "P7" && (
          <Bloc>
            <Eyebrow>Tour {g.turn} · Temps 7 — les encaissements</Eyebrow>
            {jeSuisFirme && g.cmRaison && <IAsays who="Ministre des Finances (IA)">{g.cmRaison}</IAsays>}

            {g.cm && (
              <div style={{ background: T.reprise > 0 ? `${C.patina}14` : `${C.oxblood}12`, border: `1px solid ${T.reprise > 0 ? C.patina : C.oxblood}` }} className="p-3 mb-4">
                <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: "0.1em", color: C.ink2 }} className="uppercase">Contre-mesure posée · {CM[g.cm].canal}</div>
                <div style={{ fontFamily: F.display, fontWeight: 600 }}>{CM[g.cm].nom}</div>
                <div className="text-sm">
                  {T.reprise > 0
                    ? `Porte ouverte, et pleine : ${fmt(T.reprise)} M€ de charges refusées.`
                    : "Porte vide. Sur ce canal, tout était dans la zone sûre — le bénéfice est sorti par une autre porte, et il est parti pour de bon."}
                </div>
              </div>
            )}

            {g.cm && resMines.filter((r) => r.reprise > 0).map((r, i) => (
              <Revelation key={i} r={r} cm={g.cm} />
            ))}

            {resMines.filter((r) => r.units > 0).map((r, i) => (
              <div key={i} className="mb-4">
                <div style={{ fontFamily: F.display, fontWeight: 600 }} className="text-base mb-1">Bloc {r.mine.bloc + 1} — {r.bloc.nom} · {r.tuile.nom} · {r.reg.id}</div>
                <Row l={`Chiffre d'affaires — ${r.units} × ${fmt(price)}`} v={r.CA} strong />
                <Row l={`Redevance ${r.reg.red} %`} v={r.redevance} sign="-" indent />
                <Row l={`Amortissement — ${fmt(r.mine.invCumul)} ÷ ${r.bloc.q} × ${r.units}`} v={r.amort} sign="-" indent />
                <Row l="Coût local" v={r.local} sign="-" indent />
                {g.voile || jeSuisFirme ? (
                  <>
                    <Row l={`Achats intragroupe (réel ${fmt(r.b.pt.reel)})`} v={r.dPT} sign="-" indent color={r.dPT > r.b.pt.hi ? C.oxblood : C.ink} />
                    <Row l={`Intérêts (réel ${fmt(r.b.sc.reel)})`} v={r.dSC} sign="-" indent color={r.dSC > r.b.sc.hi ? C.oxblood : C.ink} />
                    <Row l={`Frais de siège (seuil ${fmt(r.b.fs.seuil)})`} v={r.dFS} sign="-" indent color={r.dFS > r.b.fs.seuil ? C.oxblood : C.ink} />
                  </>
                ) : (
                  <Row l="Services intragroupe déclarés — trois canaux confondus" v={r.dPT + r.dSC + r.dFS} sign="-" indent color={C.ink2} />
                )}
                <Row l="Total des charges déclarées" v={r.totalCharges} strong />
                <Row l="Charges au coût réel (calculable : tuile et gisement publics)" v={r.chargesCoutReel} color={C.ink2} />
                <Row l="Sommet des zones sûres" v={r.chargesZoneSure} color={C.ink2} />
                <Row l="Bénéfice déclaré" v={r.beneficeDeclare} strong />
                {r.reprise > 0 && <Row l="Réintégration après contrôle" v={r.reprise} strong color={C.oxblood} />}
                <Row l={`Impôt sur les sociétés ${r.reg.is} %`} v={r.IS} color={C.patina} />
                {r.penalite > 0 && <Row l="Pénalité (40 %)" v={r.penalite} color={C.oxblood} />}
                <Row l="Rente économique réelle" v={r.renteEco} strong color={C.brass} />
              </div>
            ))}

            {!jeSuisFirme && resMines.some((r) => r.units > 0) && (
              g.voile ? (
                <div style={{ border: `1px solid ${C.oxblood}`, background: `${C.oxblood}0D` }} className="p-3 mb-4">
                  <div style={{ fontFamily: F.mono, fontSize: 10, color: C.oxblood, letterSpacing: "0.1em" }} className="uppercase mb-1">Paravent levé — hors partie</div>
                  {g.curseursRaison && <p style={{ fontFamily: F.display }} className="text-sm italic mb-2">« {g.curseursRaison} »</p>}
                  <p style={{ fontFamily: F.body, color: C.ink2 }} className="text-xs">
                    Vous connaissez désormais la répartition par canal. Le Ministre, lui, n'y a pas droit : il ne saura jamais par quelle porte, sauf à l'ouvrir.
                  </p>
                </div>
              ) : (
                <div style={{ border: `1px dashed ${C.line}` }} className="p-3 mb-4">
                  <p style={{ fontFamily: F.display }} className="text-sm italic mb-2">
                    La répartition entre les trois canaux reste derrière le paravent de la Firme. Le Ministre sait combien a bougé — il ne saura par où qu'en ouvrant la bonne porte.
                  </p>
                  <Btn kind="ghost" onClick={() => up({ voile: true })}>Lever le paravent (débriefing — fausse le jeu)</Btn>
                </div>
              )
            )}

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div style={{ border: `2px solid ${C.patina}`, background: `${C.patina}0D` }} className="p-3">
                <div style={{ fontFamily: F.mono, fontSize: 10, color: C.patina, letterSpacing: "0.1em" }} className="uppercase">Recettes du tour</div>
                <div style={{ fontFamily: F.mono, fontWeight: 700, color: C.patina }} className="text-2xl">{fmt(T.prelev + g.permisDuTour)} M€</div>
                <div style={{ color: C.ink2 }} className="text-xs">redevance {fmt(T.redevance)} + IS {fmt(T.IS)} + pénalité {fmt(T.penalite)} + permis {fmt(g.permisDuTour)}</div>
              </div>
              <div style={{ border: `2px solid ${C.brass}`, background: `${C.brass}0D` }} className="p-3">
                <div style={{ fontFamily: F.mono, fontSize: 10, color: C.brass, letterSpacing: "0.1em" }} className="uppercase">Déplacé, net de reprise</div>
                <div style={{ fontFamily: F.mono, fontWeight: 700, color: C.brass }} className="text-2xl">{fmt(T.deplace - T.reprise)} M€</div>
                <div style={{ color: C.ink2 }} className="text-xs">déplacé {fmt(T.deplace)} − repris {fmt(T.reprise)} · rente {fmt(T.rente)}</div>
              </div>
            </div>
            <div className="mt-5 p-4" style={{border:`2px solid ${C.patina}`,background:C.card}}>
              <div style={{fontFamily:F.mono,fontSize:10,letterSpacing:"0.13em",color:C.ink2}}>SYNTHÈSE DU TOUR {g.turn}</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 mb-3">
                {[
                  ["Production",T.CA,C.brass],
                  ["État : recettes",T.prelev+g.permisDuTour,C.patina],
                  ["Rente économique",T.rente,C.ink],
                  ["Redressements",T.reprise,C.oxblood]
                ].map(([name,value,color])=>(
                  <div key={name} className="p-2" style={{background:C.paper,borderTop:`3px solid ${color}`}}>
                    <div className="text-xs">{name}</div>
                    <strong style={{fontFamily:F.mono,color}}>{fmt(value)} M€</strong>
                  </div>
                ))}
              </div>
              <p className="text-sm mb-3" style={{color:C.ink2}}>
                {g.turn===g.dernierTour ? "Dernier tour : vous allez découvrir le bilan final et les conditions de victoire." :
                  "Le passage au tour suivant enregistre les résultats, actualise les ressources restantes et prépare les prochaines décisions."}
              </p>
              <Btn onClick={tourSuivant}>{g.turn >= g.dernierTour ? "Valider le dernier tour → Bilan final" : `Valider le tour ${g.turn} → Tour ${g.turn+1}`}</Btn>
            </div>
          </Bloc>
        )}

        {g.phase === "FIN" && (
          <>
            <Bloc>
              <Eyebrow>Fin de partie — {g.cum.tours.length} tours joués</Eyebrow>
              <Colonnes pickable={false} />
              <div className="grid grid-cols-2 gap-4 my-4">
                <div style={{ border: `2px solid ${bilan.minGagne ? C.patina : C.line}`, background: `${C.patina}0D` }} className="p-4">
                  <div style={{ fontFamily: F.display, fontWeight: 600 }} className="text-lg mb-2">Ministre des Finances</div>
                  <Row l="Recettes cumulées" v={g.cum.recettes} strong color={g.cum.recettes >= 1500 ? C.patina : C.oxblood} />
                  <div style={{ color: C.ink2 }} className="text-xs mb-2">objectif ≥ 1 500 M€ · dont permis {fmt(g.cum.permis)}</div>
                  <div className="flex justify-between"><span className="text-sm font-semibold">Taux de captation</span>
                    <span style={{ fontFamily: F.mono, fontWeight: 700, color: bilan.captation >= 0.4 ? C.patina : C.oxblood }}>{pct(bilan.captation)}</span></div>
                  <div style={{ color: C.ink2 }} className="text-xs">objectif ≥ 40 % · recettes ÷ rente ({fmt(g.cum.rente)})</div>
                  <div style={{ fontFamily: F.mono, fontWeight: 700, color: bilan.minGagne ? C.patina : C.oxblood }} className="mt-3">{bilan.minGagne ? "OBJECTIFS ATTEINTS" : "OBJECTIFS MANQUÉS"}</div>
                </div>
                <div style={{ border: `2px solid ${bilan.firmGagne ? C.brass : C.line}`, background: `${C.brass}0D` }} className="p-4">
                  <div style={{ fontFamily: F.display, fontWeight: 600 }} className="text-lg mb-1">Direction de la multinationale</div>
                  <p style={{ fontFamily: F.body, color: C.ink2 }} className="text-xs mb-3">
                    Deux conditions, à remplir ensemble : rémunérer le capital, et ramener la charge fiscale sous le seuil que le siège tolère.
                  </p>
                  <Row l="Résultat net cumulé" v={g.cum.net} strong color={C.brass} />

                  <div className="flex justify-between mt-2"><span className="text-sm font-semibold">Rendement des capitaux investis</span>
                    <span style={{ fontFamily: F.mono, fontWeight: 700, color: bilan.roic !== null && bilan.roic >= 0.2 ? C.brass : C.oxblood }}>{pct(bilan.roic)}</span></div>
                  <div style={{ color: C.ink2 }} className="text-xs">
                    objectif : <b>au moins 20 %</b> · résultat net {fmt(g.cum.net)} ÷ capital investi {fmt(g.cum.inv)}
                  </div>

                  <div className="flex justify-between mt-3"><span className="text-sm font-semibold">Taux effectif d'imposition</span>
                    <span style={{ fontFamily: F.mono, fontWeight: 700, color: bilan.etr !== null && bilan.etr < 0.24 ? C.brass : C.oxblood }}>{pct(bilan.etr)}</span></div>
                  <div style={{ color: C.ink2 }} className="text-xs">
                    objectif : <b>strictement inférieur à 24 %</b> · impôt et redevance acquittés {fmt(g.cum.prelev)} ÷ bénéfice économique réel {fmt(g.cum.rente)}
                  </div>
                  <div style={{ color: C.ink2 }} className="text-xs mt-1">
                    Le prix des permis ({fmt(g.cum.permis)} M€) n'entre pas dans ce ratio : c'est un coût d'accès, non un impôt. Il pèse en revanche sur le résultat net.
                  </div>

                  <div style={{ fontFamily: F.mono, fontWeight: 700, color: bilan.firmGagne ? C.brass : C.oxblood }} className="mt-3">{bilan.firmGagne ? "OBJECTIFS ATTEINTS" : "OBJECTIFS MANQUÉS"}</div>
                  {!bilan.firmGagne && (
                    <div style={{ color: C.ink2 }} className="text-xs mt-1">
                      {bilan.roic !== null && bilan.roic < 0.2 && "Le capital n'est pas rémunéré. "}
                      {bilan.etr !== null && bilan.etr >= 0.24 && "La charge fiscale reste au-dessus du plafond de 24 %."}
                    </div>
                  )}
                </div>
              </div>
              {bilan.defaite && <Note color={C.oxblood}>Taux effectif moyen sous 12 %. La course vers le bas est consommée : défaite collective.</Note>}
              <Note>
                {fmt(g.cum.deplace - g.cum.repris)} M€ déplacés sur la partie sans jamais être repris — pas un euro n'est illégal.
                Le contrôle en a récupéré {fmt(g.cum.repris)}. Le débat public porte sur la fraude ; l'argent, lui, passe par la porte d'entrée.
              </Note>
            </Bloc>

            <Bloc>
              <Eyebrow>Évolution des recettes et de l'activité</Eyebrow>
              <p className="text-xs mb-3" style={{color:C.ink2}}>Les barres présentent les encaissements publics et le chiffre d'affaires de chaque tour, sur une échelle commune.</p>
              {(() => {
                const max = Math.max(1,...g.cum.tours.map(t=>Math.max(t.CA,t.prelev+t.permis)));
                return <div className="grid gap-3 mb-5">
                  {g.cum.tours.map(t=>(
                    <div key={t.t} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center">
                      <div className="text-xs font-semibold">Tour {t.t}</div>
                      <div className="sm:col-span-4 grid gap-1">
                        <div className="flex items-center gap-2"><span className="text-xs" style={{width:72}}>Activité</span>
                          <div style={{background:C.line,flex:1,height:9}}><div style={{background:C.brass,width:`${Math.max(0,t.CA)/max*100}%`,height:"100%"}} /></div><span style={{width:58,textAlign:"right",fontFamily:F.mono,fontSize:11}}>{fmt(t.CA)}</span></div>
                        <div className="flex items-center gap-2"><span className="text-xs" style={{width:72}}>État</span>
                          <div style={{background:C.line,flex:1,height:9}}><div style={{background:C.patina,width:`${Math.max(0,t.prelev+t.permis)/max*100}%`,height:"100%"}} /></div><span style={{width:58,textAlign:"right",fontFamily:F.mono,fontSize:11}}>{fmt(t.prelev+t.permis)}</span></div>
                      </div>
                    </div>
                  ))}
                </div>;
              })()}
              <Eyebrow>Journal de la partie</Eyebrow>
              <div style={{ fontFamily: F.mono }} className="text-xs overflow-x-auto">
                <div className="grid grid-cols-7 gap-2 py-1 font-bold" style={{ borderBottom: `1px solid ${C.ink}` }}>
                  <span>Tour</span><span>Dé</span><span>Prix</span><span>CA</span><span>Prélèv.</span><span>Contrôle</span><span>Reprise</span>
                </div>
                {g.cum.tours.map((t) => (
                  <div key={t.t} className="grid grid-cols-7 gap-2 py-1" style={{ borderBottom: `1px solid ${C.line}66` }}>
                    <span>{t.t}</span><span>{t.de}</span><span>{fmt(t.prix)}</span><span>{fmt(t.CA)}</span>
                    <span>{fmt(t.prelev)}</span><span>{t.cm ? CM[t.cm].canal.slice(0, 12) : "—"}</span><span>{fmt(t.reprise)}</span>
                  </div>
                ))}
              </div>
            </Bloc>

            <Bloc>
              <Eyebrow>Débriefing</Eyebrow>
              {!debrief && <Btn onClick={demanderDebrief} disabled={loading}>{loading ? "Analyse de la partie…" : "Débriefer la partie"}</Btn>}
              {debrief && <p style={{ fontFamily: F.display, lineHeight: 1.7 }} className="text-base whitespace-pre-wrap">{debrief}</p>}
              <div className="mt-5"><Btn kind="ghost" onClick={resetFilons}>Nouvelle partie</Btn></div>
            </Bloc>
          </>
        )}
        </>
        )}

        <footer className="mt-8 pt-4" style={{ borderTop: `1px solid ${C.line}`, fontFamily: F.mono, color: C.ink2 }}>
          <p className="text-xs">FILONS v4.2 — guide et sauvegarde automatique. Barèmes du livret v2. CERDI — Université Clermont Auvergne.</p>
        </footer>
      </div>
    </div>
  );
}

export default function App() {
  return <Garde><Jeu /></Garde>;
}