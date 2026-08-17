const { Redis } = require("@upstash/redis");

let client;

// Conexao "preguicosa" com o Redis (Upstash): so tenta conectar quando
// alguma rota realmente precisa dele, e joga um erro claro se as variaveis
// de ambiente ainda nao foram configuradas, em vez de derrubar a funcao
// inteira ao carregar o modulo.
function getRedis() {
  if (client) return client;

  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    throw new Error(
      "Banco de dados nao configurado: defina UPSTASH_REDIS_REST_URL e " +
        "UPSTASH_REDIS_REST_TOKEN (Vercel > Storage > Upstash for Redis)."
    );
  }

  client = new Redis({ url, token });
  return client;
}

// Chaves usadas no Redis para guardar o estado das doacoes desta campanha.
const KEYS = {
  totalCents: "flavinho:total_cents",
  donations: "flavinho:donations",
  processedSessions: "flavinho:processed_sessions",
};

module.exports = { getRedis, KEYS };
