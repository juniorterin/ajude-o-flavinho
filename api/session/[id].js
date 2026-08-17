const Stripe = require("stripe");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Usado pela pagina de sucesso para confirmar o valor doado e mostrar uma
// mensagem de agradecimento personalizada apos o redirecionamento da Stripe.
module.exports = async (req, res) => {
  try {
    const { id } = req.query;
    const session = await stripe.checkout.sessions.retrieve(id);
    res.status(200).json({
      status: session.payment_status,
      amountCents: session.amount_total,
      name: session.customer_details && session.customer_details.name,
    });
  } catch (err) {
    res.status(404).json({ error: "Sessao nao encontrada." });
  }
};
