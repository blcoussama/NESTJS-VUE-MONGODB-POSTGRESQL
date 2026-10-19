# Faux serveur SMTP local (port 2525) : accepte tous les e-mails et les écrit dans un dossier.
# Sert uniquement au test de bout en bout de PROFYLE (récupérer le lien de vérification d'e-mail).
import asyncio, os, sys, time

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

async def handle(reader, writer):
    def send(line):
        writer.write((line + "\r\n").encode())
    send("220 sink ESMTP")
    await writer.drain()
    data_mode, buf = False, []
    while True:
        line = await reader.readline()
        if not line:
            break
        text = line.decode(errors="replace")
        if data_mode:
            if text in (".\r\n", ".\n"):
                data_mode = False
                with open(os.path.join(OUT, f"{time.time_ns()}.eml"), "w") as f:
                    f.write("".join(buf))
                buf = []
                send("250 OK queued")
            else:
                buf.append(text[1:] if text.startswith("..") else text)
            await writer.drain()
            continue
        cmd = text.strip().upper()
        if cmd.startswith(("EHLO", "HELO")):
            writer.write(b"250-sink\r\n250-AUTH PLAIN\r\n250 OK\r\n")
        elif cmd.startswith("AUTH"):
            send("235 Authentication successful")
        elif cmd.startswith(("MAIL", "RCPT", "RSET", "NOOP")):
            send("250 OK")
        elif cmd == "DATA":
            data_mode = True
            send("354 End data with <CR><LF>.<CR><LF>")
        elif cmd == "QUIT":
            send("221 Bye")
            await writer.drain()
            break
        else:
            send("250 OK")
        await writer.drain()
    writer.close()

async def main():
    server = await asyncio.start_server(handle, "127.0.0.1", 2525)
    async with server:
        await server.serve_forever()

asyncio.run(main())
