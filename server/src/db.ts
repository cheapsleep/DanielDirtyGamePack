import { PrismaClient } from '@prisma/client'
import pkg from 'pg'

const { Pool } = pkg

declare global {
  // allow global prisma during dev to avoid multiple clients
  // @ts-ignore
  var prisma: PrismaClient | undefined
  // @ts-ignore
  var pgPool: any
}

export const prisma: PrismaClient = global.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') global.prisma = prisma

export const pgPool = global.pgPool ?? new Pool({ connectionString: process.env.DATABASE_URL })
if (process.env.NODE_ENV !== 'production') global.pgPool = pgPool

export default prisma
