(function () {
  "use strict";

  var lang = (document.body && document.body.dataset.lang) || "pt-br";

  var STRINGS = {
    "pt-br": {
      locale: "pt-BR",
      supportersZero: "Seja o primeiro a apoiar",
      supportersOne: "1 pessoa já apoiou",
      supportersMany: function (n) {
        return n + " pessoas já apoiaram";
      },
      invalidAmount: "Escolha ou digite um valor válido para doar.",
      genericError: "Não foi possível iniciar o pagamento. Tente novamente em instantes.",
      redirecting: "Redirecionando para o pagamento seguro...",
      donateLabel: "Doar agora",
      confirming: "Estamos confirmando o seu pagamento...",
      thanksPaid: function (amount) {
        return "Sua doação de " + amount + " foi confirmada. Muito obrigado por ajudar o Flavio!";
      },
      thanksPending: "Recebemos o seu pagamento e ele está sendo processado.",
      thanksUnknown: "Não encontramos os detalhes desse pagamento, mas se você concluiu o checkout, ele foi registrado. Muito obrigado!",
    },
    jap: {
      locale: "ja-JP",
      supportersZero: "最初のご支援者になりませんか?",
      supportersOne: "1人が支援しました",
      supportersMany: function (n) {
        return n + "人が支援しました";
      },
      invalidAmount: "有効な寄付金額を選択または入力してください。",
      genericError: "決済を開始できませんでした。しばらくしてからもう一度お試しください。",
      redirecting: "安全な決済ページに移動しています...",
      donateLabel: "寄付する",
      confirming: "お支払いを確認しています...",
      thanksPaid: function (amount) {
        return "ご寄付(" + amount + ")を確認しました。フラビオへのご支援、誠にありがとうございます!";
      },
      thanksPending: "お支払いを受け付けました。現在処理中です。",
      thanksUnknown: "このお支払いの詳細が見つかりませんでしたが、決済が完了していれば正しく記録されています。ご支援ありがとうございます!",
    },
  };

  var t = STRINGS[lang] || STRINGS["pt-br"];

  function formatCurrency(cents) {
    var value = (cents || 0) / 100;
    try {
      return value.toLocaleString(t.locale, { style: "currency", currency: "BRL" });
    } catch (e) {
      return "R$ " + value.toFixed(2);
    }
  }

  // ---- Pagina principal (formulario de doacao) ----
  var amountGrid = document.getElementById("amount-grid");
  if (amountGrid) {
    var customInput = document.getElementById("custom-amount");
    var donateButton = document.getElementById("donate-button");
    var errorMessage = document.getElementById("error-message");
    var selectedAmount = null;

    function showError(msg) {
      errorMessage.textContent = msg;
      errorMessage.hidden = false;
    }

    function clearError() {
      errorMessage.hidden = true;
      errorMessage.textContent = "";
    }

    function selectPresetAmount(btn) {
      Array.prototype.forEach.call(
        amountGrid.querySelectorAll(".amount-btn"),
        function (b) {
          b.classList.remove("selected");
        }
      );
      btn.classList.add("selected");
      selectedAmount = Number(btn.dataset.amount);
      customInput.value = "";
      donateButton.disabled = false;
      clearError();
    }

    amountGrid.addEventListener("click", function (e) {
      var btn = e.target.closest(".amount-btn");
      if (btn) selectPresetAmount(btn);
    });

    customInput.addEventListener("input", function () {
      Array.prototype.forEach.call(
        amountGrid.querySelectorAll(".amount-btn"),
        function (b) {
          b.classList.remove("selected");
        }
      );
      var value = Number(customInput.value);
      if (customInput.value && Number.isFinite(value) && value > 0) {
        selectedAmount = value;
        donateButton.disabled = false;
        clearError();
      } else {
        selectedAmount = null;
        donateButton.disabled = true;
      }
    });

    donateButton.addEventListener("click", function () {
      if (!selectedAmount || selectedAmount < 5) {
        showError(t.invalidAmount);
        return;
      }

      clearError();
      donateButton.disabled = true;
      var originalLabel = donateButton.textContent;
      donateButton.textContent = t.redirecting;

      fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: selectedAmount, lang: lang }),
      })
        .then(function (r) {
          return r.json().then(function (data) {
            if (!r.ok) throw new Error(data.error || t.genericError);
            return data;
          });
        })
        .then(function (data) {
          window.location.href = data.url;
        })
        .catch(function (err) {
          showError(err.message || t.genericError);
          donateButton.disabled = false;
          donateButton.textContent = originalLabel;
        });
    });
  }

  // ---- Barra de progresso (aparece na pagina principal) ----
  var raisedEl = document.getElementById("raised-amount");
  if (raisedEl) {
    fetch("/api/progress")
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        var raised = data.raisedCents || 0;
        var goal = data.goalCents || 1;
        var percent = Math.min(100, Math.round((raised / goal) * 100));

        raisedEl.textContent = formatCurrency(raised);
        document.getElementById("goal-amount").textContent = formatCurrency(goal);
        document.getElementById("percent-label").textContent = percent + "%";
        document.getElementById("progress-fill").style.width = percent + "%";

        var supportersEl = document.getElementById("supporters-label");
        var count = data.supportersCount || 0;
        if (count === 0) supportersEl.textContent = t.supportersZero;
        else if (count === 1) supportersEl.textContent = t.supportersOne;
        else supportersEl.textContent = t.supportersMany(count);
      })
      .catch(function () {
        /* mantem os valores padrao se a chamada falhar */
      });
  }

  // ---- Pagina de sucesso (confirmacao apos o checkout) ----
  var resultDetail = document.getElementById("result-detail");
  if (resultDetail) {
    resultDetail.textContent = t.confirming;
    var params = new URLSearchParams(window.location.search);
    var sessionId = params.get("session_id");

    if (sessionId) {
      fetch("/api/session/" + encodeURIComponent(sessionId))
        .then(function (r) {
          if (!r.ok) throw new Error("not found");
          return r.json();
        })
        .then(function (data) {
          if (data.status === "paid") {
            resultDetail.textContent = t.thanksPaid(formatCurrency(data.amountCents));
          } else {
            resultDetail.textContent = t.thanksPending;
          }
        })
        .catch(function () {
          resultDetail.textContent = t.thanksUnknown;
        });
    } else {
      resultDetail.textContent = t.thanksUnknown;
    }
  }
})();
