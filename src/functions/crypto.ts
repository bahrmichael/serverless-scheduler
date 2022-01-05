import * as crypto from "crypto";
const bcrypt = require('bcrypt');

const saltRounds = 5;

export async function generateToken(): Promise<string> {
    const token = crypto.randomUUID();
    return await bcrypt.hash(token, saltRounds);
}
