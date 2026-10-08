import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { io } from "socket.io-client";
import { randomInt } from "node:crypto";

test("two distant sockets create/join and synchronise a round", {timeout:30000}, async () => {
  const port = 32000 + randomInt(10000);
  const child=spawn(process.execPath,["server/index.js"],{cwd:process.cwd(),env:{...process.env,PORT:String(port)},stdio:"ignore"});
  const sockets=[];
  const send=(sock,event,payload)=>new Promise((resolve,reject)=>{
    sock.timeout(7000).emit(event,payload,(err,response)=>err?reject(err):resolve(response));
  });
  try{
    const endpoint="http://127.0.0.1:"+port;
    const awake=async()=>{
      for(let tries=0;tries<70;tries++){
        try{const r=await fetch(endpoint+"/api/health");if(r.ok)return;}catch{}
        await new Promise(r=>setTimeout(r,100));
      }
      throw Error("server did not start");
    };
    await awake();
    for(let i=0;i<3;i++){
      const socket=io(endpoint,{transports:["websocket"],reconnection:false});
      sockets.push(socket);
      await new Promise((resolve,reject)=>{
        socket.once("connect",resolve);
        socket.once("connect_error",reject);
      });
    }
    const r=await send(sockets[0],"room:create",{name:"Ministre"});
    assert.equal(r.ok,true);
    const a=await send(sockets[1],"room:join",{name:"Firme Alpha",code:r.code});
    const b=await send(sockets[2],"room:join",{name:"Firme Beta",code:r.code});
    assert.equal(a.ok,true); assert.equal(b.ok,true);
    let stateA=await new Promise(resolve=>{
      sockets[1].once("room:state",resolve);
      sockets[0].emit("game:act",{},()=>{});
    });
    assert.equal(stateA.stage,"policy");
    assert.equal(stateA.blocks[0].name,undefined);
    assert.equal((await send(sockets[0],"game:act",{cit:20,royalty:4,reserve:60})).ok,true);
    assert.equal((await send(sockets[1],"game:act",{block:0,bid:60})).ok,true);
    assert.equal((await send(sockets[2],"game:act",{block:0,bid:70})).ok,true);
    const snapshot=await new Promise(resolve=>{
      sockets[1].once("room:state",resolve);
      send(sockets[1],"game:act",{investments:{}}).catch(()=>{});
    });
    assert.equal(snapshot.stage,"investment");
    assert.equal(snapshot.players.find(p=>p.name==="Firme Alpha").cash,1000);
    assert.equal(snapshot.players.find(p=>p.name==="Firme Beta").cash,930);
  } finally{
    for(const socket of sockets)socket.disconnect();
    child.kill("SIGTERM");
  }
});
