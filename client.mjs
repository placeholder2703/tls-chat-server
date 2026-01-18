import tls from "tls";
import readline from "node:readline";
const args = process.argv;
const mode = args[2];

if (mode == 'HELP' || !mode) {
	console.log(`
Usage: prefix: node client.mjs (please the node prefix is important)
	Log in:                      LOGIN <token> <otp>
	Create account:              SIGNUP <username>
	Change userrname:            RENAME <token> <otp> <newUsername>
	Refresh token:               RETOKEN <token> <otp>
	Refresh OTP secret(wip):     REOTP <token> <otp>
	Delete account:              DELETE <token> <otp>
Example usages: 
	node client.mjs RENAME ASDF1234 123456 imblue
	node client.mjs LOGIN delulu 343242
	node client.mjs SIGNUP imblue
u still have to change ip and port in code tho
	`);
	process.exit(1);
}

function send(obj) {
	const json = Buffer.from(JSON.stringify(obj));
	const header = Buffer.alloc(4);
	header.writeUInt32BE(json.length);
	socket.write(Buffer.concat([header, json]));
}

function handle(msg) {
	if (msg.type === "PING") {
		send({ type: "PONG" });
		return;
	}
	if (msg.type === "DATA") {
		console.log(msg.DATA);
		return;
	}
}

const socket = tls.connect({
	host: "127.0.0.1",
	port: 25565,
	rejectUnauthorized: false
});

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
			console.log("[CLIENT] Server sent invalid JSON");
			continue;
		}
		handle(msg);
	}
});


socket.on("end", () => {
	console.log("[CLIENT] Server closed connection.");
	process.exit(1);
})

// code your payload here
socket.on("connect", () => {
	switch (mode) {
		case "SIGNUP":
			send({ type: "SIGNUP", username: args[3] });
			break;
		case "LOGIN":
			send({ type: "HELLO", token: args[3], code: args[4] });
			{
				const rl = readline.createInterface({
					input: process.stdin,
					output: process.stdout
				});
				rl.on("line", line => send({ type: "DATA", DATA: line }));
			}
			break;
		case "RENAME":
			send({ type: "RENAME", token: args[3], code: args[4], username: args[5] });
			break;
		case "RETOKEN":
			send({ type: "RETOKEN", token: args[3], code: args[4] });
			break;
		case "REOTP":
			send({ type: "REOTP", token: args[3], code: args[4] });
			break;
		case "DELETE":
			send({ type: "DELETE", token: args[3], code: args[4] });
			break;
		default:
			console.log("[CLIENT] Invalid mode.");
			process.exit(1);
	}
});
