import * as crypto from "crypto";
const bcrypt = require('bcryptjs');

const saltRounds = 10;

export async function generateToken(): Promise<string> {
    const token = crypto.randomUUID();
    const hash = await bcrypt.hash(token, saltRounds);
    return hash.slice(-31);
}
