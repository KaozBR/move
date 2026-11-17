(function () {
  "use strict";

  const DB_KEY = "move";
  const LEGACY_CONTACT_KEY = "move-app";

  function readDatabase() {
    try {
      const data = localStorage.getItem(DB_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  function writeDatabase(database) {
    localStorage.setItem(DB_KEY, JSON.stringify(database));
  }

  function createId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }

  function migrateMessages(database) {
    if (!Array.isArray(database.messages)) {
      database.messages = [];
    }

    try {
      const legacy = JSON.parse(
        localStorage.getItem(LEGACY_CONTACT_KEY) || "null",
      );

      if (Array.isArray(legacy)) {
        const existingIds = new Set(
          database.messages.map((message) => message.id),
        );

        legacy.forEach((message) => {
          if (!message.id || !existingIds.has(message.id)) {
            database.messages.push(message);
          }
        });

        localStorage.removeItem(LEGACY_CONTACT_KEY);
        writeDatabase(database);
      }
    } catch {
      // Preserva o banco principal mesmo se os dados antigos estiverem inválidos.
    }

    return database.messages;
  }

  function validateMessage(data = {}) {
    const name = String(data.name || "").trim();
    const email = String(data.email || "")
      .trim()
      .toLowerCase();
    const phone = String(data.phone || "").trim();
    const returnMode = String(data.returnMode || "").trim();
    const subject = String(data.subject || "").trim();
    const message = String(data.message || "").trim();

    if (!name) throw new Error("Informe seu nome.");

    if (!email) throw new Error("Informe seu e-mail.");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Informe um endereço de e-mail válido.");
    }

    if (!phone) throw new Error("Informe seu telefone.");

    if (![10, 11].includes(phone.replace(/\D/g, "").length)) {
      throw new Error("Informe um telefone válido com DDD.");
    }

    if (!["WhatsApp", "E-mail", "Ligação"].includes(returnMode)) {
      throw new Error("Selecione uma opção válida de retorno.");
    }

    if (
      !["Elogios", "Reclamações", "Dúvidas", "Aula de pilates"].includes(
        subject,
      )
    ) {
      throw new Error("Selecione um assunto válido.");
    }

    if (!message) throw new Error("Digite sua mensagem.");

    return { name, email, phone, returnMode, subject, message };
  }

  function sendMessage(data) {
    const validated = validateMessage(data);
    const database = readDatabase();

    if (!database || !Array.isArray(database.users)) {
      throw new Error(
        "Não foi possível acessar os dados. Atualize a página e tente novamente.",
      );
    }

    migrateMessages(database);

    const newMessage = {
      id: createId(),
      ...validated,
      createdAt: new Date().toISOString(),
    };

    database.messages.push(newMessage);
    writeDatabase(database);

    return newMessage;
  }

  function inbox() {
    const database = readDatabase();

    if (!database) return [];

    return migrateMessages(database).slice();
  }

  window.MoveContactStore = {
    sendMessage,
    inbox,
  };
})();
