const { EMBEDDING_MODEL } = require("./model");

const { embedImage, embedText } = process.env.EMBEDDING_URL
  ? require("./remote").createRemoteEmbedder(process.env.EMBEDDING_URL)
  : require("./local");

module.exports = { EMBEDDING_MODEL, embedImage, embedText };
