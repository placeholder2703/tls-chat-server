// basic client i dont work on it much, run with "node client.mjs <replace-wih-token>"
import tls from "tls";
import readline from "node:readline";
const token = process.argv[2];
const socket = tls.connect({
  host: "127.0.0.1",
  port: 9000,
  rejectUnauthorized: false
});

function send(obj) {
  const json = Buffer.from(JSON.stringify(obj));
  const header = Buffer.alloc(4);
  header.writeUInt32BE(json.length);
  socket.write(Buffer.concat([header, json]));
}

let buffer = Buffer.alloc(0);
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
      console.log("Server sent invalid JSON");
      continue;}
    handle(msg);
  }
});

function handle(msg) {
  if (msg.type === "PING") {
    send({ type: "PONG" });
    return;}
  if (msg.type === "DATA") {
    console.log(msg.DATA);
    return;}
}

// code your payload here
socket.on("connect", () => {
  send({ type: "HELLO", token: token });
  const rl = readline.createInterface({
    input: process.stdin,
   output: process.stdout
  });
  rl.on("line", line => {
    send({ type: "DATA", DATA: line });
  });
});

