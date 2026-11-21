"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const PROFILE_PHOTO_URL_PREFIX = "/uploads/profile-photos/";
const IMAGE_TYPES = {
    "image/jpeg": { extension: "jpg", signature: (buffer) =>
        buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    },
    "image/png": { extension: "png", signature: (buffer) =>
        buffer.length >= 8 &&
        buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    },
    "image/webp": { extension: "webp", signature: (buffer) =>
        buffer.length >= 12 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP"
    }
};

function identifyImageType(buffer) {
    if (!Buffer.isBuffer(buffer)) return null;
    return Object.entries(IMAGE_TYPES).find(([, imageType]) => imageType.signature(buffer))?.[0] || null;
}

function createProfilePhotoStorage({
    directory = process.env.PROFILE_UPLOAD_DIR ||
        path.resolve(process.cwd(), "uploads", "profile-photos")
} = {}) {
    const resolvedDirectory = path.resolve(directory);

    async function save(userId, buffer, contentType) {
        const imageType = IMAGE_TYPES[contentType];
        if (!imageType || identifyImageType(buffer) !== contentType) {
            throw new Error("Profile photo type does not match its image content");
        }

        await fs.mkdir(resolvedDirectory, { recursive: true });
        const filename = `${userId}-${crypto.randomUUID()}.${imageType.extension}`;
        const destination = path.join(resolvedDirectory, filename);
        const temporary = path.join(resolvedDirectory, `.${crypto.randomUUID()}.tmp`);

        try {
            await fs.writeFile(temporary, buffer, { flag: "wx", mode: 0o644 });
            await fs.rename(temporary, destination);
        } catch (error) {
            try {
                await fs.rm(temporary, { force: true });
            } catch (cleanupError) {
                throw new AggregateError(
                    [error, cleanupError],
                    "Profile photo write and temporary-file cleanup failed"
                );
            }
            throw error;
        }

        return {
            url: `${PROFILE_PHOTO_URL_PREFIX}${filename}`,
            filename
        };
    }

    async function removeOwnedPhoto(userId, avatarUrl) {
        if (typeof avatarUrl !== "string" || !avatarUrl.startsWith(PROFILE_PHOTO_URL_PREFIX)) {
            return;
        }

        const filename = avatarUrl.slice(PROFILE_PHOTO_URL_PREFIX.length);
        const ownerPrefix = `${userId}-`;
        if (
            path.basename(filename) !== filename ||
            !filename.startsWith(ownerPrefix) ||
            !/^[0-9a-f-]{36}\.(?:jpg|png|webp)$/.test(filename.slice(ownerPrefix.length))
        ) {
            return;
        }

        await fs.rm(path.join(resolvedDirectory, filename), { force: true });
    }

    return { directory: resolvedDirectory, save, removeOwnedPhoto };
}

module.exports = {
    createProfilePhotoStorage,
    identifyImageType,
    PROFILE_PHOTO_URL_PREFIX
};
