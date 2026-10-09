import { test } from "node:test";
import assert from "node:assert/strict";
import { createRoom, joinRoom, publicState, decide, decisionBands, MAX_PLAYERS } from "../server/game.js";

const getRoom=()=>{
  const r=createRoom("state","Ministre","secret-minister",n=>n-1);
  joinRoom(r,"a","Firme A","token-A");
  joinRoom(r,"b","Firme B","token-B");
  return r;
};
const policy={cit:20,royalty:4,reserve:60};
function moveToBidding(r){decide(r,"state",{});decide(r,"state",policy);}
test("Minister alone can publish fiscal rules",()=>{
 const r=getRoom();decide(r,"state",{});
 assert.throws(()=>decide(r,"a",policy),/ministre/);
 decide(r,"state",policy);assert.equal(r.stage,"bidding");
});
test("Bids are submitted independently; losing firm keeps its funds",()=>{
 const r=getRoom();moveToBidding(r);
 decide(r,"a",{block:1,bid:60});assert.equal(r.stage,"bidding");assert.equal(r.players[1].ready,true);
 decide(r,"b",{block:1,bid:70});
 assert.equal(r.stage,"investment");assert.equal(r.blocks[1].owner,"b");
 assert.equal(r.players[1].cash,1000);assert.equal(r.players[2].cash,930);
 assert.equal(r.players[0].score,70);
});
test("No deposit can exceed funds or reserve",()=>{
 const r=getRoom();moveToBidding(r);
 assert.throws(()=>decide(r,"a",{block:0,bid:59}),/Offre invalide/);
 assert.throws(()=>decide(r,"a",{block:0,bid:999}),/Offre invalide/);
});
test("Secret geology is not transmitted before award",()=>{
 const r=getRoom();moveToBidding(r);
 const state=publicState(r,"a");
 assert.equal(state.blocks[0].name,undefined);
 assert.equal(state.blocks[0].ore,undefined);
 assert.equal(state.players.find(p=>p.id==="b").decision,undefined);
});
test("Two firms settle a complete simultaneously submitted round",()=>{
 const r=getRoom();moveToBidding(r);
 decide(r,"a",{block:1,bid:60});decide(r,"b",{block:2,bid:60});
 assert.equal(r.stage,"investment");
 decide(r,"a",{investments:{1:2}});assert.equal(r.stage,"investment");
 decide(r,"b",{investments:{2:2}});assert.equal(r.stage,"planning");
 assert.ok([120,160,180,220,240,280].includes(r.price));
 const aBand=decisionBands(r.blocks[1],r.price);
 const bBand=decisionBands(r.blocks[2],r.price);
 decide(r,"a",{plan:{1:{pt:aBand.pt.max,sc:aBand.sc.safe,fs:aBand.fs.safe}}});assert.equal(r.stage,"planning");
 decide(r,"b",{plan:{2:{pt:bBand.pt.safe,sc:bBand.sc.safe,fs:bBand.fs.max}}});assert.equal(r.stage,"audit");
 assert.throws(()=>decide(r,"a",{channel:"pt"}),/Contrôle invalide/);
 decide(r,"state",{channel:"pt"});
 assert.equal(r.stage,"results");assert.equal(r.lastResult.details.length,2);
 assert.ok(Number.isFinite(r.lastResult.fiscalTotal));
 decide(r,"state",{});assert.equal(r.stage,"policy");assert.equal(r.turn,2);
});
test("Capacity: only five firms can join",()=>{
 const r=createRoom("host","Ministre","secret",n=>n-1);
 for(let i=0;i<MAX_PLAYERS-1;i++)joinRoom(r,String(i),"Firme "+i,"token"+i);
 assert.throws(()=>joinRoom(r,"too-many","Another","last"),/complète/);
});

test("Three adjustable fiscal channels with transfer-pricing audits",()=>{
 const r=createRoom("min","Ministre","secret",n=>n-1);
 joinRoom(r,"firm","Firme Test","token");
 decide(r,"min",{});decide(r,"min",policy);
 decide(r,"firm",{block:1,bid:60});
 assert.equal(r.blocks[1].owner,"firm");
 decide(r,"firm",{investments:{1:2}});
 const bands=decisionBands(r.blocks[1],r.price);
 const decl={pt:bands.pt.max,sc:bands.sc.safe,fs:bands.fs.safe};
 decide(r,"firm",{plan:{1:decl}});
 const privateView=publicState(r,"firm");
 const ministerView=publicState(r,"min");
 assert.equal(privateView.myDecision.plan[1].pt,decl.pt);
 assert.equal(ministerView.myDecision,null);
 assert.equal(ministerView.auditSignal[0].charges,decl.pt+decl.sc+decl.fs);
 assert.equal(ministerView.auditSignal[0].pt,undefined);
 decide(r,"min",{channel:"pt"});
 const d=r.lastResult.details[0];
 assert.ok(d.recovered>0);
 assert.equal(d.taxes,d.royalty+d.cit+d.penalty);
 assert.equal(d.profit,d.rent-d.taxes);
 assert.equal(r.lastResult.summary.companyProfit+d.taxes,d.rent);
 const publicView=publicState(r,"min");
 assert.equal(publicView.result.details[0].declared,undefined);
 assert.equal(publicState(r,"firm").result.details[0].declared.pt,decl.pt);
 assert.equal(publicView.result.summary.sales,d.sales);
 assert.equal(r.blocks[1].remaining,3-d.units);
});
test("Rejects amounts outside tax ranges and nonexistent mines",()=>{
 const r=createRoom("min","Ministre","secret",n=>n-1);
 joinRoom(r,"firm","Firme Test","token");
 decide(r,"min",{});decide(r,"min",policy);decide(r,"firm",{block:1,bid:60});
 decide(r,"firm",{investments:{1:2}});
 const bands=decisionBands(r.blocks[1],r.price);
 assert.throws(()=>decide(r,"firm",{plan:{1:{pt:bands.pt.max+1,sc:bands.sc.safe,fs:0}}}),/hors barème/);
 assert.throws(()=>decide(r,"firm",{plan:{3:{pt:20,sc:20,fs:20}}}),/non exploitée/);
 decide(r,"firm",{plan:{}});
 assert.equal(r.stage,"audit");
 assert.deepEqual(r.players[1].decision.plan[1],{pt:bands.pt.safe,sc:bands.sc.safe,fs:bands.fs.safe});
});
