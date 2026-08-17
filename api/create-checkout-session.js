const Stripe = require("stripe");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Textos localizados do produto exibido no Checkout e o idioma da propria
// interface da Stripe (botoes, rotulos de campo, etc).
const CONTENT = {
  "pt-br": {
    stripeLocale: "pt-BR",
    name: "Doação - Tratamento do Flavinho",
    description: "Ajuda para custear medicamentos e tratamento oftalmológico do Flavio.",
  },
  jap: {
    stripeLocale: "ja",
    name: "フラビオの治療費支援",
    description: "フラビオの眼科治療・医薬品費用の支援のためのご寄付です。",
  },
};

// Cria uma sessao do Stripe Checkout (pagina de pagamento hospedada pela
// propria Stripe). Apple Pay e Google Pay aparecem automaticamente nessa
// pagina quando estao habilitados na conta e o navegador/dispositivo do
// doador os suporta - nao precisa de nenhum codigo extra nem verificacao de
// dominio para isso (isso so seria necessario se usassemos o botao de
// pagamento embutido na propria pagina via Stripe Elements).
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Metodo nao permitido." });
  }

  try {
    const amountReais = Number(req.body && req.body.amount);
    const lang = CONTENT[req.body && req.body.lang] ? req.body.lang : "pt-br";
    const content = CONTENT[lang];

    if (!Number.isFinite(amountReais) || amountReais < 5 || amountReais > 50000) {
      return res.status(400).json({ error: "Valor de doacao invalido." });
    }

    const amountCents = Math.round(amountReais * 100);
    const origin = process.env.DOMAIN
      ? process.env.DOMAIN.replace(/\/$/, "")
      : `https://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      submit_type: "donate",
      locale: content.stripeLocale,
      metadata: { campaign: "flavinho", lang },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "brl",
            unit_amount: amountCents,
            product_data: {
              name: content.name,
              description: content.description,
            },
          },
        },
      ],
      success_url: `${origin}/${lang}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/${lang}/cancel.html`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("[create-checkout-session]", err.message);
    res.status(500).json({ error: "Nao foi possivel iniciar o pagamento." });
  }
};
