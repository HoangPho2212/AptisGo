const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

/**
 * Accept only the 24-character hexadecimal text form of an ObjectId. Mongoose
 * `isValidObjectId` is intentionally not used because it also accepts ObjectId
 * instances, 12-byte Buffers, and Uint8Arrays, none of which can arrive in a
 * URL path.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isObjectId(value) {
  return typeof value === 'string' && OBJECT_ID_PATTERN.test(value);
}

module.exports = { OBJECT_ID_PATTERN, isObjectId };
