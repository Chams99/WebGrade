import { readFile, readdir } from "node:fs/promises"
import postgres from "postgres"

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for migrations")
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false })
async function main() {
  try {
    const files = (await readdir(new URL("../db/", import.meta.url))).filter((file) => /^\d+_.*\.sql$/.test(file)).sort()
    for (const file of files) await sql.unsafe(await readFile(new URL(`../db/${file}`, import.meta.url), "utf8"))
    console.log("WebGrade database schema is ready")
  } finally { await sql.end() }
}
void main()
