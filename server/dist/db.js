"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.pgPool = exports.prisma = void 0;
const client_1 = require("@prisma/client");
const pg_1 = __importDefault(require("pg"));
const { Pool } = pg_1.default;
exports.prisma = (_a = global.prisma) !== null && _a !== void 0 ? _a : new client_1.PrismaClient();
if (process.env.NODE_ENV !== 'production')
    global.prisma = exports.prisma;
exports.pgPool = (_b = global.pgPool) !== null && _b !== void 0 ? _b : new Pool({ connectionString: process.env.DATABASE_URL });
if (process.env.NODE_ENV !== 'production')
    global.pgPool = exports.pgPool;
exports.default = exports.prisma;
