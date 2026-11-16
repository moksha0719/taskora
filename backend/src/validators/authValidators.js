const REGISTRATION_FIELDS = new Set(["name", "email", "password"]);
const LOGIN_FIELDS = new Set(["email", "password"]);

function validateCredentials(body, includeName = false) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { error: "A JSON object is required" };
    }

    const allowedFields = includeName ? REGISTRATION_FIELDS : LOGIN_FIELDS;
    const unsupportedField = Object.keys(body).find((field) => !allowedFields.has(field));
    if (unsupportedField) {
        return { error: `Unsupported authentication field: ${unsupportedField}` };
    }

    let name;
    if (includeName) {
        if (
            typeof body.name !== "string" ||
            !body.name.trim() ||
            body.name.trim().length > 100
        ) {
            return { error: "Name is required and must be 100 characters or fewer" };
        }
        name = body.name.trim();
    }

    if (typeof body.email !== "string" || !body.email.trim()) {
        return { error: "Email is required" };
    }

    const email = body.email.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { error: "A valid email is required" };
    }

    if (typeof body.password !== "string" || !body.password) {
        return { error: "Password is required" };
    }

    const passwordBytes = Buffer.byteLength(body.password, "utf8");
    if (passwordBytes < 8 || passwordBytes > 72) {
        return { error: "Password must be between 8 and 72 bytes" };
    }

    return { data: { email, ...(includeName ? { name } : {}) } };
}

module.exports = { validateCredentials };
