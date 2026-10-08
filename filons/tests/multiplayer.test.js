import { test } from "node:test";
import assert from "node:assert/strict";
import { createRoom, joinRoom, publicState, decide, MAX_PLAYERS } from "../server/game.js";

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
 decide(r,"a",{plan:{1:3}});assert.equal(r.stage,"planning");
 decide(r,"b",{plan:{2:2}});assert.equal(r.stage,"audit");
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
