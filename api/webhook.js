const Stripe = require("stripe");
const { getRedis, KEYS } = require("../lib/redis");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Este webhook agora e OBRIGATORIO: e ele quem grava cada doacao confirmada
// no banco (total arrecadado + lista de doacoes). Sem ele configurado, a
// barra de progresso do site fica travada no BASE_RAISED_CENTS. Veja o
// README para o passo a passo de configuracao na Stripe e no Vercel.
module.exports = async (req, res) => {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.warn("[webhook] STRIPE_WEBHOOK_SECRET nao configurado - evento ignorado.");
    return res.status(200).send("Webhook nao configurado, ignorando.");
  }

  const sig = req.headers["stripe-signature"];
  const buf = await buffer(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("[webhook] assinatura invalida:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const isThisCampaign = session.metadata && session.metadata.campaign === "flavinho";

    if (session.payment_status === "paid" && isThisCampaign) {
      try {
        await recordDonation(session);
      } catch (err) {
        // Devolvemos 500 para a Stripe tentar reenviar o evento depois
        // (ex: se o banco estiver temporariamente fora do ar).
        console.error("[webhook] falha ao gravar doacao:", err.message);
        return res.status(500).send("Falha ao gravar doacao.");
      }
    }
  }

  res.status(200).send("ok");
};

// Precisamos do corpo "cru" (nao convertido em JSON) para validar a
// assinatura enviada pela Stripe.
module.exports.config = { api: { bodyParser: false } };

async function recordDonation(session) {
  const redis = getRedis();

  // Idempotencia: a Stripe pode reenviar o mesmo evento mais de uma vez, e
  // isso nao pode contar a mesma doacao duas vezes no total.
  const alreadyProcessed = await redis.sismember(KEYS.processedSessions, session.id);
  if (alreadyProcessed) {
    console.log(`[webhook] sessao ${session.id} ja tinha sido registrada, ignorando.`);
    return;
  }

  const record = {
    sessionId: session.id,
    amountCents: session.amount_total,
    currency: session.currency,
    name: (session.customer_details && session.customer_details.name) || null,
    email: (session.customer_details && session.customer_details.email) || null,
    lang: session.metadata.lang || "pt-br",
    status: "paid",
    createdAt: new Date().toISOString(),
  };

  await redis.rpush(KEYS.donations, JSON.stringify(record));
  await redis.incrby(KEYS.totalCents, record.amountCents);
  await redis.sadd(KEYS.processedSessions, session.id);

  console.log(
    `[doacao registrada] R$ ${(record.amountCents / 100).toFixed(2)} de ${
      record.name || "doador anonimo"
    }`
  );
}

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}
