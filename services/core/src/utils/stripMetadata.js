const fs = require('fs');
const path = require('path');

/**
 * Strips EXIF / GPS / device metadata from JPEG buffers
 */
function stripJpegMetadata(buffer) {
    if (buffer.length < 4 || buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
        return buffer; // Not a valid JPEG
    }

    const chunks = [];
    chunks.push(buffer.subarray(0, 2)); // Keep SOI (FF D8)

    let offset = 2;
    while (offset < buffer.length - 1) {
        if (buffer[offset] !== 0xFF) {
            // Reached image scan data (SOS)
            chunks.push(buffer.subarray(offset));
            break;
        }

        const marker = buffer[offset + 1];

        // SOS (Start of Scan) or EOI (End of Image)
        if (marker === 0xDA || marker === 0xD9) {
            chunks.push(buffer.subarray(offset));
            break;
        }

        // Standalone markers without length
        if (marker === 0xD8 || (marker >= 0xD0 && marker <= 0xD7)) {
            chunks.push(buffer.subarray(offset, offset + 2));
            offset += 2;
            continue;
        }

        if (offset + 4 > buffer.length) {
            chunks.push(buffer.subarray(offset));
            break;
        }

        const length = buffer.readUInt16BE(offset + 2);
        const segmentEnd = offset + 2 + length;
        if (segmentEnd > buffer.length) {
            chunks.push(buffer.subarray(offset));
            break;
        }

        // APP1 (0xE1) contains EXIF / GPS
        // COM (0xFE) contains comments
        if (marker === 0xE1 || marker === 0xFE) {
            // Skip this metadata segment
            offset = segmentEnd;
        } else {
            chunks.push(buffer.subarray(offset, segmentEnd));
            offset = segmentEnd;
        }
    }

    return Buffer.concat(chunks);
}

/**
 * Strips ancillary metadata chunks (eXIf, tEXt, zTXt, iTXt) from PNG buffers
 */
function stripPngMetadata(buffer) {
    const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    if (buffer.length < 8 || !buffer.subarray(0, 8).equals(pngSignature)) {
        return buffer; // Not a valid PNG
    }

    const chunks = [buffer.subarray(0, 8)];
    let offset = 8;

    while (offset + 8 <= buffer.length) {
        const length = buffer.readUInt32BE(offset);
        const type = buffer.toString('ascii', offset + 4, offset + 8);
        const chunkTotalLength = 4 + 4 + length + 4; // length + type + data + crc

        if (offset + chunkTotalLength > buffer.length) {
            chunks.push(buffer.subarray(offset));
            break;
        }

        // Strip metadata chunks
        if (['eXIf', 'tEXt', 'zTXt', 'iTXt'].includes(type)) {
            offset += chunkTotalLength;
        } else {
            chunks.push(buffer.subarray(offset, offset + chunkTotalLength));
            offset += chunkTotalLength;
        }

        if (type === 'IEND') break;
    }

    return Buffer.concat(chunks);
}

/**
 * Strips EXIF / device / location metadata from an uploaded image file on disk.
 */
function stripImageMetadata(filePath) {
    try {
        const ext = path.extname(filePath).toLowerCase();
        if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
            return;
        }

        const buffer = fs.readFileSync(filePath);
        let stripped = buffer;

        if (ext === '.jpg' || ext === '.jpeg') {
            stripped = stripJpegMetadata(buffer);
        } else if (ext === '.png') {
            stripped = stripPngMetadata(buffer);
        }

        if (stripped.length !== buffer.length) {
            fs.writeFileSync(filePath, stripped);
        }
    } catch (err) {
        console.warn(`[stripImageMetadata] Notice for ${filePath}: ${err.message}`);
    }
}

module.exports = { stripImageMetadata };
