(async function () {
  "use strict";

  const S = window.MoveAuthStore;

  const $ = (selector, scope = document) => scope.querySelector(selector);

  const page = document.body.dataset.page;

  function error(id, message = "") {
    const element = $(`#${id}`);

    if (!element) return;

    element.textContent = message;
    element.hidden = !message;
  }

  function success(id, message = "") {
    const element = $(`#${id}`);

    if (!element) return;

    element.textContent = message;
    element.hidden = !message;
  }

  function handleLogin() {
    const form = $("#login-form");

    if (!form) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      error("login-error");

      const emailField = $("#login-email");
      const passwordField = $("#login-password");
      const button = $("button[type=submit]", form);

      if (!emailField || !passwordField) {
        error("login-error", "Não foi possível carregar os campos de acesso.");
        return;
      }

      const email = emailField.value.trim();
      const password = passwordField.value;

      if (!email) {
        error("login-error", "Informe seu e-mail.");
        emailField.focus();
        return;
      }

      if (!emailField.checkValidity()) {
        error("login-error", "Informe um endereço de e-mail válido.");
        emailField.focus();
        return;
      }

      if (!password) {
        error("login-error", "Informe sua senha.");
        passwordField.focus();
        return;
      }

      if (button) button.disabled = true;

      try {
        const user = await S.login(email, password);

        window.location.href =
          user.role === "admin" ? "admin.html" : "aluno.html";
      } catch (e) {
        error("login-error", e.message || "Não foi possível entrar.");
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  function handleSignup() {
    const form = $("#signup-form");

    if (!form) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      error("signup-error");

      const nameField = $("#signup-name");
      const emailField = $("#signup-email");
      const passwordField = $("#signup-password");
      const confirmField = $("#signup-confirm");
      const button = $("button[type=submit]", form);

      if (!nameField || !emailField || !passwordField || !confirmField) {
        error(
          "signup-error",
          "Não foi possível carregar todos os campos do cadastro.",
        );
        return;
      }

      const data = {
        name: nameField.value,
        email: emailField.value,
        password: passwordField.value,
        confirm: confirmField.value,
      };

      if (!data.name.trim()) {
        error("signup-error", "Informe seu nome completo.");
        nameField.focus();
        return;
      }

      if (!data.email.trim()) {
        error("signup-error", "Informe seu e-mail.");
        emailField.focus();
        return;
      }

      if (!emailField.checkValidity()) {
        error("signup-error", "Informe um endereço de e-mail válido.");
        emailField.focus();
        return;
      }

      if (!data.password) {
        error("signup-error", "Informe uma senha.");
        passwordField.focus();
        return;
      }

      if (!data.confirm) {
        error("signup-error", "Confirme sua senha.");
        confirmField.focus();
        return;
      }

      if (data.password !== data.confirm) {
        error("signup-error", "As senhas não coincidem.");
        confirmField.focus();
        return;
      }

      if (button) button.disabled = true;

      try {
        await S.register(data);

        $("#signup-content").hidden = true;
        $("#signup-success").hidden = false;
      } catch (e) {
        error("signup-error", e.message || "Não foi possível criar a conta.");
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  try {
    if (!S || typeof S.init !== "function") {
      throw new Error("O armazenamento de autenticação não foi carregado.");
    }

    await S.init();

    if (page === "login") {
      handleLogin();
    }

    if (page === "cadastro") {
      handleSignup();
    }
  } catch (e) {
    console.error("Move — erro ao iniciar cadastro e login:", e);

    const main = $("#conteudo");

    if (main) {
      const message = document.createElement("p");

      message.className = "form-alert";
      message.setAttribute("role", "alert");
      message.textContent =
        e.message ||
        "Não foi possível iniciar o protótipo. Execute pelo Live Server do VS Code.";

      main.prepend(message);
    }
  }
})();
