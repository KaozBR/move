(function () {
  "use strict";

  const $ = (selector) => document.querySelector(selector);

  const form = $("#contact-form");
  const contactContent = $("#contact-content");
  const success = $("#contact-success");
  const errorElement = $("#contact-error");

  if (!form || !success || !errorElement || !contactContent) return;

  function showError(message) {
    errorElement.textContent = message;
    errorElement.hidden = false;
  }

  function clearError() {
    errorElement.textContent = "";
    errorElement.hidden = true;
  }

  function prefillContact() {
    try {
      const database = JSON.parse(localStorage.getItem("move") || "null");

      const sessionId = sessionStorage.getItem("move-sesion");

      if (!database || !sessionId || !Array.isArray(database.users)) {
        return;
      }

      const account = database.users.find((user) => user.id === sessionId);

      if (!account) return;

      $("#contact-name").value = account.name || "";
      $("#contact-email").value = account.email || "";
      $("#contact-phone").value = account.phone || account.tel || "";
    } catch {
      // O formulário continua disponível mesmo sem dados de sessão.
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    clearError();

    const store = window.MoveContactStore;

    if (!store || typeof store.sendMessage !== "function") {
      showError("Não foi possível carregar o formulário. Tente novamente.");
      return;
    }

    const fields = {
      name: $("#contact-name"),
      email: $("#contact-email"),
      phone: $("#contact-phone"),
      returnMode: $("#contact-return"),
      subject: $("#contact-subject"),
      message: $("#contact-message"),
    };

    if (Object.values(fields).some((field) => !field)) {
      showError("Não foi possível carregar todos os campos do formulário.");
      return;
    }

    const data = {
      name: fields.name.value.trim(),
      email: fields.email.value.trim(),
      phone: fields.phone.value.trim(),
      returnMode: fields.returnMode.value.trim(),
      subject: fields.subject.value.trim(),
      message: fields.message.value.trim(),
    };

    fields.email.value = data.email;

    Object.values(fields).forEach((field) => {
      field.removeAttribute("aria-invalid");
    });

    let invalidField = null;
    let errorMessage = "";

    if (!data.name) {
      invalidField = fields.name;
      errorMessage = "Informe seu nome.";
    } else if (!data.email) {
      invalidField = fields.email;
      errorMessage = "Informe seu e-mail.";
    } else if (!fields.email.checkValidity()) {
      invalidField = fields.email;
      errorMessage = "Informe um endereço de e-mail válido.";
    } else if (!data.phone) {
      invalidField = fields.phone;
      errorMessage = "Informe seu telefone.";
    } else if (![10, 11].includes(data.phone.replace(/\D/g, "").length)) {
      invalidField = fields.phone;
      errorMessage = "Informe um telefone válido com DDD.";
    } else if (!data.returnMode) {
      invalidField = fields.returnMode;
      errorMessage = "Selecione como deseja receber nosso retorno.";
    } else if (!data.subject) {
      invalidField = fields.subject;
      errorMessage = "Selecione o assunto da mensagem.";
    } else if (!data.message) {
      invalidField = fields.message;
      errorMessage = "Digite sua mensagem.";
    }

    if (invalidField) {
      showError(errorMessage);
      invalidField.setAttribute("aria-invalid", "true");
      invalidField.focus();
      return;
    }

    const submitButton = form.querySelector('[type="submit"]');

    if (submitButton) submitButton.disabled = true;

    try {
      store.sendMessage(data);

      contactContent.hidden = true;
      success.hidden = false;
    } catch (error) {
      showError(
        error.message ||
          "Não foi possível enviar sua mensagem. Tente novamente.",
      );
    } finally {
      if (submitButton && !form.hidden) {
        submitButton.disabled = false;
      }
    }
  }

  prefillContact();

  form.addEventListener("submit", handleSubmit);
})();
