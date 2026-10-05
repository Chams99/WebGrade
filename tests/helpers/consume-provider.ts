import { consumeProviderCall } from "../../lib/guard-store"

const provider = process.argv[2] === "crux" ? "crux" : "pagespeed"
void consumeProviderCall(provider).then((result) => process.stdout.write(`${JSON.stringify(result)}\n`)).catch((error: unknown) => { process.stderr.write(String(error)); process.exitCode = 1 })
