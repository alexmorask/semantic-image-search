const { EMBEDDING_MODEL } = require("./model");

const { embedImage, embedText } = process.env.EMBEDDING_URL
  ? require("./remote-embedder").createRemoteEmbedder(process.env.EMBEDDING_URL)
  : require("./embedder");

module.exports = { EMBEDDING_MODEL, embedImage, embedText };
