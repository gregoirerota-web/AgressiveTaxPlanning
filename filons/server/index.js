import http from "node:http";
import express from "express";
import { Server } from "socket.io";
import { randomUUID, randomBytes } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRoom, joinRoom, publicState, decide } from "./game.js";
import { createRoomStore } from "./persistence.js";

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: process.env.CLIENT_ORIGIN || true } });
const rooms = new Map();
const identities = new Map();
const store = createRoomStore();
const locks = new Map();
async function locked(code, task) {
  const prior = locks.get(code) || Promise.resolve();
  const current = prior.catch(() => {}).then(task);
  locks.set(code, current);
  try { return await current; } finally { if(locks.get(code) === current) locks.delete(code); }
}
const here = fileURLToPath(new URL(".", import.meta.url));
const dist = join(here,"..","dist");

app.get("/api/health", (_,res)=>res.json({ ok:true, rooms:rooms.size, durable:store.enabled }));
app.use(express.static(dist, { extensions:["html"] }));
app.get("/", (_,res)=>res.sendFile(join(dist,"index.html")));

const broadcast = room => {
  for (const player of room.players) if (player.connected && player.socketId) {
    io.to(player.socketId).emit("room:state",publicState(room,player.id));
  }
};
const fail = (ack,message)=>typeof ack==="function"&&ack({ ok:false, error:String(message||"Action impossible") });
const succeed = (ack,extra={})=>typeof ack==="function"&&ack({ok:true,...extra});
io.on("connection",socket=>{
  socket.on("room:create",({name}={},ack)=>{
    const codeKey="create:"+socket.id;
    void locked(codeKey, async()=>{
      if(typeof name!=="string"||name.trim().length<2||name.trim().length>24)throw Error("Nom : 2 à 24 caractères");
      const token=randomBytes(24).toString("hex");
      const room=createRoom(randomUUID(),name.trim(),token);
      // Save the room BEFORE acknowledging it to the host.
      await store.save(room);
      const player=room.players[0];
      player.socketId=socket.id;rooms.set(room.code,room);
      identities.set(socket.id,{code:room.code,id:player.id});
      succeed(ack,{code:room.code,token});
      broadcast(room);
    }).catch(e=>fail(ack,e.message));
  });
  socket.on("room:join",({code,name,token}={},ack)=>{
    const key=String(code||"").trim().toUpperCase();
    void locked(key,async()=>{
      const room=rooms.get(key);
      if(!room)throw Error("Salle inconnue ou expirée");
      let player=typeof token==="string"?room.players.find(p=>p.token===token):null;
      let newToken=token;
      if(!player){
        if(typeof name!=="string"||name.trim().length<2||name.trim().length>24)throw Error("Nom : 2 à 24 caractères");
        newToken=randomBytes(24).toString("hex");
        joinRoom(room,randomUUID(),name.trim(),newToken);
        player=room.players.at(-1);
        // Persist the new credential before sending it to the browser.
        try { await store.save(room); }
        catch(e){room.players.pop();throw e;}
      }else if(player.connected&&player.socketId&&player.socketId!==socket.id){
        io.to(player.socketId).emit("room:displaced");
        identities.delete(player.socketId);
      }
      player.connected=true;player.socketId=socket.id;
      identities.set(socket.id,{code:room.code,id:player.id});
      succeed(ack,{code:room.code,token:newToken});
      broadcast(room);
    }).catch(e=>fail(ack,e.message));
  });
  socket.on("game:act",(action,ack)=>{
    const identity=identities.get(socket.id);
    if(!identity){fail(ack,"Rejoignez une salle");return;}
    void locked(identity.code,async()=>{
      const room=rooms.get(identity.code);
      if(!room)throw Error("Salle expirée");
      const player=room.players.find(p=>p.id===identity.id);
      if(!player||player.socketId!==socket.id)throw Error("Session révoquée");
      // Apply the action on a clone, so a failed database write cannot
      // acknowledge or publish a state which was never saved.
      const next=structuredClone(room);
      decide(next,player.id,action);
      await store.save(next);
      rooms.set(room.code,next);
      succeed(ack);
      broadcast(next);
    }).catch(e=>fail(ack,e.message));
  });
  socket.on("disconnect",()=>{
    const identity=identities.get(socket.id);
    identities.delete(socket.id);
    if(!identity)return;
    void locked(identity.code,()=>{
      const room=rooms.get(identity.code);
      if(!room)return;
      const player=room.players.find(p=>p.id===identity.id);
      if(player?.socketId===socket.id){
        player.connected=false;player.socketId=null;broadcast(room);
      }
      // Disconnects are deliberately not persisted, since saved snapshots
      // always normalize players to disconnected. Rooms are never dropped
      // merely because the server or its sockets restart.
    }).catch(e=>console.error("Disconnect cleanup:",e));
  });
});

const port=Number(process.env.PORT||3001);
async function main() {
  try {
    await store.initialize();
    for(const room of await store.loadAll())rooms.set(room.code,room);
    httpServer.listen(port,()=>console.log("FILONS live on port "+port+"; saved rooms "+rooms.size+"; durable "+store.enabled));
  } catch (err) {
    console.error("Cannot initialize FILONS persistence:",err);
    process.exitCode=1;
    await store.close().catch(()=>{});
  }
}
if(process.env.NODE_ENV !== "test")void main();
export { app, httpServer, io };
