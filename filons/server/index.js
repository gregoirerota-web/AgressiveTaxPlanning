import http from "node:http";
import express from "express";
import { Server } from "socket.io";
import { randomUUID, randomBytes } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRoom, joinRoom, publicState, decide } from "./game.js";

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: process.env.CLIENT_ORIGIN || true } });
const rooms = new Map();
const identities = new Map();
const here = fileURLToPath(new URL(".", import.meta.url));
const dist = join(here,"..","dist");

app.get("/api/health", (_,res)=>res.json({ ok:true, rooms:rooms.size }));
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
  socket.on("room:create",({name,token}={},ack)=>{
    try {
      if(typeof name!=="string"||name.trim().length<2||name.trim().length>24)throw Error("Nom : 2 à 24 caractères");
      const userToken=typeof token==="string"&&token.length>20?token:randomBytes(24).toString("hex");
      const room=createRoom(randomUUID(),name.trim(),userToken);
      const p=room.players[0];p.socketId=socket.id;
      rooms.set(room.code,room);identities.set(socket.id,{ code:room.code,id:p.id });
      succeed(ack,{ code:room.code,token:userToken });
      broadcast(room);
    }catch(err){fail(ack,err.message)}
  });
  socket.on("room:join",({code,name,token}={},ack)=>{
    try {
      const room=rooms.get(String(code||"").trim().toUpperCase());
      if(!room)throw Error("Salle inconnue ou expirée");
      let p=typeof token==="string"?room.players.find(p=>p.token===token):null;
      let userToken=token;
      if(p) {
        if(p.connected&&p.socketId&&p.socketId!==socket.id)io.to(p.socketId).emit("room:displaced");
        p.connected=true;p.socketId=socket.id;
      }else {
        if(typeof name!=="string"||name.trim().length<2||name.trim().length>24)throw Error("Nom : 2 à 24 caractères");
        userToken=randomBytes(24).toString("hex");
        joinRoom(room,randomUUID(),name.trim(),userToken);
        p=room.players.at(-1);p.socketId=socket.id;
      }
      identities.set(socket.id,{ code:room.code,id:p.id });
      succeed(ack,{ code:room.code, token:userToken });
      broadcast(room);
    }catch(err){fail(ack,err.message)}
  });
  socket.on("game:act",(action,ack)=>{
    try {
      const identity=identities.get(socket.id);
      const room=identity&&rooms.get(identity.code);
      if(!room)throw Error("Rejoignez une salle");
      const player=room.players.find(p=>p.id===identity.id);
      if(!player||player.socketId!==socket.id)throw Error("Session révoquée");
      decide(room,player.id,action);
      succeed(ack);broadcast(room);
    }catch(err){fail(ack,err.message)}
  });
  socket.on("disconnect",()=>{
    const info=identities.get(socket.id);identities.delete(socket.id);
    const room=info&&rooms.get(info.code);if(!room)return;
    const player=room.players.find(p=>p.id===info.id);
    if(player?.socketId===socket.id){player.connected=false;player.socketId=null;broadcast(room)}
    if(room.players.every(p=>!p.connected))setTimeout(()=>{
      if(rooms.get(room.code)===room&&room.players.every(p=>!p.connected))rooms.delete(room.code);
    },30*60*1000).unref?.();
  });
});
const port=Number(process.env.PORT||3001);
httpServer.listen(port,()=>console.log("FILONS live on port "+port));
export { app, httpServer, io };
