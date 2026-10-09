import { test } from "node:test";
import assert from "node:assert/strict";
import { createRoomStore, normalizeRoom } from "../server/persistence.js";
import { createRoom, joinRoom, decide, publicState } from "../server/game.js";

test("durable snapshot preserves permissions, sealed decisions and deposits", () => {
 const room=createRoom("minister","Ministre","minister-token",n=>n-1);
 joinRoom(room,"firm","Firme","firm-token");
 room.players[0].socketId="old-socket";
 room.players[1].socketId="old-socket-2";
 decide(room,"minister",{});
 decide(room,"minister",{cit:22,royalty:5,reserve:65});
 decide(room,"firm",{block:1,bid:70});
 const copy=JSON.parse(JSON.stringify(normalizeRoom(room)));
 assert.equal(copy.players.every(p=>!p.connected && p.socketId===null),true);
 assert.equal(copy.players[1].token,"firm-token");
 assert.equal(copy.blocks[1].owner,"firm");
 assert.equal(copy.blocks[1].contract.cit,22);
 assert.equal(copy.players[1].cash,930);
 assert.equal(copy.stage,"investment");
 // Reconnecting a player with the original token resumes the same session.
 copy.players[1].connected=true;
 assert.equal(publicState(copy,"firm").blocks[1].name,copy.blocks[1].name);
 assert.equal(publicState(copy,"firm").players[1].ready,false);
});
test("database is optional for offline game development",async()=>{
 const store=createRoomStore("");
 assert.equal(store.enabled,false);
 assert.deepEqual(await store.loadAll(),[]);
 await store.initialize();
 await store.save({code:"ABCDEF"});
 await store.delete("ABCDEF");
 await store.close();
});
