"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const email_1 = require("../email");
const router = express_1.default.Router();
router.post('/send-test-email', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    // Protect this endpoint with a secret in env to avoid open relay
    const secret = process.env.DEBUG_EMAIL_SECRET;
    const provided = req.headers['x-debug-secret'] || ((_a = req.body) === null || _a === void 0 ? void 0 : _a.secret);
    if (!secret || String(provided) !== String(secret)) {
        return res.status(403).json({ error: 'forbidden' });
    }
    const { to } = req.body;
    if (!to)
        return res.status(400).json({ error: 'missing to' });
    try {
        const info = yield (0, email_1.sendTestEmail)(String(to));
        res.json({ ok: true, info });
    }
    catch (err) {
        console.error('Test email failed', err);
        res.status(500).json({ error: 'failed', detail: (err === null || err === void 0 ? void 0 : err.message) || String(err) });
    }
}));
exports.default = router;
