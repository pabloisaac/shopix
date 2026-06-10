import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@cripex/db'

const connectionString = process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/cripex'

const queryClient = postgres(connectionString)
export const db = drizzle(queryClient, { schema })
