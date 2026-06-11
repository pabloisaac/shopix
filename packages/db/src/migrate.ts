import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

async function main() {
  const connectionString = process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/shopix'

  const migrationClient = postgres(connectionString, { max: 1 })
  const db = drizzle(migrationClient)

  console.log('Running migrations...')
  await migrate(db, { migrationsFolder: path.resolve(__dirname, '../migrations') })
  console.log('Migrations complete.')

  await migrationClient.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
