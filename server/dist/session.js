"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionMiddleware = void 0;
const express_session_1 = __importDefault(require("express-session"));
const connect_pg_simple_1 = __importDefault(require("connect-pg-simple"));
const db_1 = require("./db");
const PgSession = (0, connect_pg_simple_1.default)(express_session_1.default);
const SESSION_SECRET = process.env.SESSION_SECRET || 'replace_me';
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
exports.sessionMiddleware = (0, express_session_1.default)({
    store: new PgSession({ pool: db_1.pgPool }),
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
});
exports.default = exports.sessionMiddleware;
