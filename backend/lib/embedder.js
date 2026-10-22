const {
  AutoProcessor,
  AutoTokenizer,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  RawImage,
} = require("@huggingface/transformers");
const { normalize } = require("./vectors");
const { UnusableImageError } = require("./errors");
const { EMBEDDING_MODEL } = require("./model");

const MODEL_OPTIONS = { dtype: "fp32" };

let loading;

async function loadClip() {
  const [tokenizer, textModel, processor, visionModel] = await Promise.all([
    AutoTokenizer.from_pretrained(EMBEDDING_MODEL),
    CLIPTextModelWithProjection.from_pretrained(EMBEDDING_MODEL, MODEL_OPTIONS),
    AutoProcessor.from_pretrained(EMBEDDING_MODEL),
    CLIPVisionModelWithProjection.from_pretrained(EMBEDDING_MODEL, MODEL_OPTIONS),
  ]);
  return { tokenizer, textModel, processor, visionModel };
}

/**
 * Loads CLIP once per process. Concurrent callers share the same load, and a failed load can be retried.
 * @returns {Promise<{tokenizer: object, textModel: object, processor: object, visionModel: object}>}
 */
function loadModel() {
  loading ??= loadClip().catch((error) => {
    loading = undefined;
    throw error;
  });
  return loading;
}

async function decodeImage(bytes) {
  try {
    return await RawImage.fromBlob(new Blob([bytes]));
  } catch (error) {
    throw new UnusableImageError(`image could not be decoded: ${error.message}`);
  }
}

/**
 * Embeds an image with CLIP's image encoder.
 * @param {Buffer|Uint8Array} bytes Encoded image bytes (JPEG, PNG, WebP, ...).
 * @returns {Promise<number[]>} A normalized 512-number vector.
 * @throws {UnusableImageError} if the bytes can't be decoded as an image.
 */
async function embedImage(bytes) {
  const { processor, visionModel } = await loadModel();
  const image = await decodeImage(bytes);
  const { image_embeds } = await visionModel(await processor(image));
  return normalize(image_embeds.data);
}

/**
 * Embeds query text with CLIP's text encoder, in the same space as embedImage.
 * Text longer than CLIP's 77-token limit is truncated.
 * @param {string} text
 * @returns {Promise<number[]>} A normalized 512-number vector.
 */
async function embedText(text) {
  const { tokenizer, textModel } = await loadModel();
  const { text_embeds } = await textModel(tokenizer([text], { padding: true, truncation: true }));
  return normalize(text_embeds.data);
}

module.exports = { EMBEDDING_MODEL, loadModel, embedImage, embedText };
