const { getRedis, KEYS } = require("../lib/redis");

const GOAL_CENTS = parseInt(process.env.GOAL_CENTS || "1500000", 10);
const BASE_RAISED_CENTS = parseInt(process.env.BASE_RAISED_CENTS || "0", 10);

// Le o total arrecadado e o numero de apoiadores direto do banco (gravados
// pelo webhook em api/webhook.js a cada doacao confirmada).
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
      raisedCents: BASE_RAISED_CENTS + totalCents,
      supportersCount: supportersCount || 0,
    });
  } catch (err) {
    console.error("[progress]", err.message);
    // Se o banco ainda nao estiver configurado ou estiver fora do ar,
    // mostramos pelo menos o valor base conhecido em vez de quebrar a pagina.
    res.status(200).json({
      goalCents: GOAL_CENTS,
      raisedCents: BASE_RAISED_CENTS,
      supportersCount: 0,
    });
  }
};
