/**
 * The request was well formed, but the image can't be used: it couldn't be downloaded,
 * was too large or too slow, or couldn't be decoded. Routes report it as a 422.
 */
class UnusableImageError extends Error {
  constructor(message) {
    super(message);
    this.name = "UnusableImageError";
  }
}

module.exports = { UnusableImageError };
