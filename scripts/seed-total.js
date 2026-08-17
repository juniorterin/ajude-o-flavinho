// Define o total ja arrecadado (fora da Stripe, ex: doacoes via Pix na
// vaquinha original) direto no banco, para que api/progress.js nao precise
// mais somar um valor fixo vindo de variavel de ambiente.
//
// Uso:
//   node scripts/seed-total.js 538.29
//
// Le as credenciais do banco de .env.local (ou .env, como alternativa).

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { getRedis, KEYS } = require("../lib/redis");

async function main() {
  const amountReais = Number(process.argv[2]);

  if (!Number.isFinite(amountReais) || amountReais < 0) {
    console.error("Uso: node scripts/seed-total.js <valor em reais>");
    console.error("Exemplo: node scripts/seed-total.js 538.29");
    process.exit(1);
  }

  const redis = getRedis();
  const amountCents = Math.round(amountReais * 100);

  await redis.set(KEYS.totalCents, amountCents);

  console.log(
    `OK: total de doacoes no banco definido para R$ ${amountReais.toFixed(2)} (${amountCents} centavos).`
  );
}

main().catch((err) => {
  console.error("Erro ao gravar no banco:", err.message);
  process.exit(1);
});
