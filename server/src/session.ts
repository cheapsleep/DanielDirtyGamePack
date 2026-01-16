import session from 'express-session'
import connectPgSimple from 'connect-pg-simple'
import { pgPool } from './db'

const PgSession = connectPgSimple(session)

const SESSION_SECRET = process.env.SESSION_SECRET || 'replace_me'
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production'

export const sessionMiddleware = session({
  store: new PgSession({ pool: pgPool }),
  name: 'sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    domain: COOKIE_DOMAIN
  }
})

export default sessionMiddleware
