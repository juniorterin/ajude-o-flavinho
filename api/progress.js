const { getRedis, KEYS } = require("../lib/redis");

const GOAL_CENTS = parseInt(process.env.GOAL_CENTS || "1500000", 10);

// Le o total arrecadado e o numero de apoiadores direto do banco. O banco e
// a unica fonte de verdade: doacoes feitas pela Stripe entram via
// api/webhook.js, e o valor ja arrecadado antes deste site existir (ex: Pix
// na vaquinha original) e gravado uma unica vez com scripts/seed-total.js.
module.exports = async (req, res) => {
  try {
    const redis = getRedis();

    const [totalCentsRaw, supportersCount] = await Promise.all([
      redis.get(KEYS.totalCents),
      redis.llen(KEYS.donations),
    ]);

    const totalCents = Number(totalCentsRaw) || 0;

    res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=45");
    res.status(200).json({
      goalCents: GOAL_CENTS,
      raisedCents: totalCents,
      supportersCount: supportersCount || 0,
    });
  } catch (err) {
    console.error("[progress]", err.message);
    // Se o banco ainda nao estiver configurado ou estiver fora do ar,
    // mostramos zero em vez de quebrar a pagina.
    res.status(200).json({
      goalCents: GOAL_CENTS,
      raisedCents: 0,
      supportersCount: 0,
    });
  }
};
