import tls from "tls";
import fs from "fs";
import readline from "node:readline";
let users = null
function genToken() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 32; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));}
  return out;}
function updateUserList() {
  users = JSON.parse(fs.readFileSync("./users.json", "utf8"));}
function isMalicious(str) {
  const regex = /^[A-Za-z0-9._-]{1,32}$/;
  return !regex.test(str);}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout});
const clients = new Set();
const server = tls.createServer({
  key: fs.readFileSync("./key.pem"),
  cert: fs.readFileSync("./cert.pem")
}, socket => {
  let buffer = Buffer.alloc(0);
  let state = "INIT";
  let user = null;
  socket.on("data", chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 4) {
      const length = buffer.readUInt32BE(0);
      if (buffer.length < 4 + length) break;
      const payload = buffer.slice(4, 4 + length);
      buffer = buffer.slice(4 + length);
      let msg;
      try {
        msg = JSON.parse(payload.toString("utf8"));
      } catch {
        socket.destroy();
        return;}
      handle(msg);}});
  rl.on("line", line => {
    const msg = line.trim();
    if (!msg) return;
    console.log(`[SERVER] ${msg}`);
    broadcast(`[SERVER] ${msg}`);});

  function startKeepAliveFor(socket) {
    let lastPong = Date.now();
    const interval = setInterval(() => {
      send(socket, { type: "PING" });
      if (Date.now() - lastPong > 15000) {
        clearInterval(interval);
        console.log(`${user} got timed out.`);
        broadcast(`[SERVER] ${user} got timed out.`);
        socket.end();}}, 5000);
    socket.on("close", () => {
      console.log(`${user} went offline.`);
      broadcast(`[SERVER] ${user} went offline.`);
      clearInterval(interval);})
    socket.on("error", () => {
      console.log(`${user} crashed and went offline.`);
      broadcast(`[SERVER] ${user} crashed and went offline.`);
      clearInterval(interval);})
    socket._pong = () => {
      lastPong = Date.now();};}

  function broadcast(text) {
    for (const client of clients) {
      send(client, { type: "DATA", DATA: text });}}

  function send(socket, obj) {
    const json = Buffer.from(JSON.stringify(obj));
    const header = Buffer.alloc(4);
    header.writeUInt32BE(json.length);
    socket.write(Buffer.concat([header, json]));}

  function handle(msg) {
    if (msg.type === "SIGNUP") {
      const exists = Object.values(users).includes(msg.username);
      if (isMalicious(msg.username) || exists) {
        send(socket, { type: "DATA", DATA: "[SERVER] Username is invalid or already taken." });
        socket.end();
        return;}
      const token = genToken();
      users[token] = msg.username;
      fs.writeFileSync("./users.json", JSON.stringify(users, null, 2));
      send(socket, { type: "DATA", DATA: `[SERVER] Successfully signed up.\nDO NOT share this auth token with ANYONE.\n${token}` });
      socket.end();
      return;}
    if (msg.type === "RENAME") {
      const exists = Object.values(users).includes(msg.username);
      if (isMalicious(msg.username) || exists || !users[msg.token]) {
        send(socket, { type: "DATA", DATA: "[SERVER] Invalid username or already, or invalid token." });
        socket.end();
        return;}
      users[msg.token] = msg.username;
      fs.writeFileSync("./users.json", JSON.stringify(users, null, 2));
      send(socket, { type: "DATA", DATA: `[SERVER] Username changed to ${msg.username}` });
      socket.end();
      return;}
    if (msg.type === "RETOKEN") {
      const username = users[msg.token];
      if (typeof msg.token !== "string" || !username) {
        send(socket, { type: "DATA", DATA: "[SERVER] Invalid token." });
        socket.end();
        return;}
      const newToken = genToken();
      delete users[msg.token];
      users[newToken] = username;
      fs.writeFileSync("./users.json", JSON.stringify(users, null, 2));
      send(socket, { type: "DATA", DATA: `[SERVER] Token refreshed. New token:\n${newToken}\nAgain DO NOT share your token with ANYONE` });
      socket.end();
      return;}
    if (msg.type === "DELETE") {
      const username = users[msg.token];
      if (!username) {
        send(socket, { type: "DATA", DATA: "[SERVER] User doesn't exist." });
        socket.end();
        return;}
      send(socket, { type: "DATA", DATA: `[SERVER] Successfully deleted ${username}` });
      delete users[msg.token];
      fs.writeFileSync("./users.json", JSON.stringify(users, null, 2));
      socket.end();
      return;}
    if (state === "INIT") {
      if (msg.type !== "HELLO" || typeof msg.token !== "string") {
        socket.end();
        return;}
      const username = users[msg.token];
      if (!username) {
        send(socket, { type: "DATA", DATA: "Invalid token." });
        socket.end();
        return;}
      user = username;
      state = "READY";
      clients.add(socket);
      send(socket, { type: "DATA", DATA: `[SERVER] You've successfully authenticated as ${user}` });
      console.log(`${user} went online.`);
      broadcast(`[SERVER] ${user} went online.`);
      startKeepAliveFor(socket);
      return;}
    if (msg.type === "PONG") {
      if (socket._pong) socket._pong();
      return;}
    if (msg.type === "DATA") {
      console.log(`${user}: ${msg.DATA}`);
      broadcast(`${user}: ${msg.DATA}`);
      return;}
    if (msg.type === "CLOSE") {
      clients.delete(socket)
      console.log(`${user} went offline.`);
      broadcast(`[SERVER] ${user} went offline.`);
      socket.end();}
  }
});

updateUserList()
server.listen(9000);
