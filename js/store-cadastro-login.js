(function () {
  "use strict";

  const KEY = "move";
  const SESSION_KEY = "move-session";
  const DEMO_PASSWORD = "move@2026";
  const HOUR_MS = 60 * 60 * 1000;

  const TIMES = [
    "07:00",
    "08:00",
    "09:00",
    "10:00",
    "11:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00",
    "19:00",
  ];

  const defaults = {
    contasDemo: [
      {
        nome: "Cristiane Silva",
        email: "admin@move.com.br",
        perfil: "admin",
      },
      {
        nome: "Camila Souza",
        email: "aluno@move.com.br",
        perfil: "aluno",
      },
      {
        nome: "Mariana Oliveira",
        email: "mariana@move.com.br",
        perfil: "aluno",
      },
    ],
    horariosPadrao: {
      diasUteis: ["07:00", "09:00", "10:00", "14:00", "16:00", "18:00"],
      sabado: ["08:00", "09:00", "10:00"],
      domingo: [],
    },
  };

  function read() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "null");
    } catch {
      return null;
    }
  }

  function write(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function fail(message) {
    throw new Error(message);
  }

  function safeEmail(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function uid() {
    return crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
  }

  function todayLocal(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function dateTime(date, time) {
    return new Date(`${date}T${time}:00`);
  }

  function saltValue() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
  }

  async function passwordHash(password, salt) {
    const bytes = new TextEncoder().encode(`${salt}:${password}`);
    const result = await crypto.subtle.digest("SHA-256", bytes);

    return Array.from(new Uint8Array(result), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  }

  async function demoUser(name, email, password, role) {
    const salt = saltValue();

    return {
      id: uid(),
      name,
      email: safeEmail(email),
      salt,
      hash: await passwordHash(password, salt),
      role,
    };
  }

  function validFixtures(data) {
    return (
      data &&
      Array.isArray(data.contasDemo) &&
      data.contasDemo.some((account) => account.perfil === "admin") &&
      data.contasDemo.some((account) => account.perfil === "aluno") &&
      data.horariosPadrao &&
      Array.isArray(data.horariosPadrao.diasUteis) &&
      Array.isArray(data.horariosPadrao.sabado) &&
      Array.isArray(data.horariosPadrao.domingo)
    );
  }

  async function fixtures() {
    try {
      const response = await fetch("data/dados-iniciais.json", {
        cache: "no-store",
      });

      if (response.ok) {
        const parsed = await response.json();

        if (validFixtures(parsed)) {
          return parsed;
        }
      }
    } catch {
      // Utiliza os dados padrão caso o JSON não esteja disponível.
    }

    return defaults;
  }

  function normalizedSlots(date, config) {
    const dateObj = new Date(`${date}T12:00:00`);
    const day = dateObj.getDay();

    const scheduled =
      day === 0 ? config.domingo : day === 6 ? config.sabado : config.diasUteis;

    return Array.isArray(scheduled)
      ? scheduled.filter((time) => TIMES.includes(time))
      : [];
  }

  async function init() {
    const storedValue = localStorage.getItem(KEY);

    if (storedValue !== null) {
      const existing = read();

      if (!existing || !Array.isArray(existing.users)) {
        fail(
          "Os dados armazenados estão inválidos. Não foi possível iniciar o protótipo sem risco de perder informações.",
        );
      }

      const seed = await fixtures();
      const existingEmails = new Set(
        existing.users.map((user) => safeEmail(user.email)),
      );

      let changed = false;

      for (const demo of seed.contasDemo) {
        if (
          !demo ||
          !demo.nome ||
          !demo.email ||
          !["admin", "aluno"].includes(demo.perfil)
        ) {
          continue;
        }

        const email = safeEmail(demo.email);

        if (existingEmails.has(email)) {
          continue;
        }

        const user = await demoUser(
          demo.nome,
          email,
          DEMO_PASSWORD,
          demo.perfil,
        );

        existing.users.push(user);
        existingEmails.add(email);
        changed = true;
      }

      if (changed) {
        write(existing);
      }

      return;
    }

    const seed = await fixtures();

    const demoAccounts = seed.contasDemo.filter(
      (account) =>
        account &&
        typeof account.nome === "string" &&
        typeof account.email === "string" &&
        ["admin", "aluno"].includes(account.perfil),
    );

    const users = await Promise.all(
      demoAccounts.map((account) =>
        demoUser(account.nome, account.email, DEMO_PASSWORD, account.perfil),
      ),
    );

    const students = users.filter((user) => user.role === "aluno");

    const days = [];

    for (let i = 0; i < 42; i++) {
      const date = new Date();

      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() + i);

      const formattedDate = todayLocal(date);

      days.push({
        date: formattedDate,
        times: normalizedSlots(formattedDate, seed.horariosPadrao),
      });
    }

    const eligible = days.filter(
      (day) =>
        day.times.length &&
        dateTime(day.date, "16:00").getTime() > Date.now() + 48 * HOUR_MS,
    );

    const bookings = students
      .slice(0, eligible.length)
      .map((student, index) => {
        const day = eligible[index];
        const preferredTime = index % 2 === 0 ? "16:00" : "09:00";

        return {
          id: uid(),
          userId: student.id,
          date: day.date,
          time: day.times.includes(preferredTime)
            ? preferredTime
            : day.times[0],
          status: "ativo",
          createdAt: new Date().toISOString(),
        };
      });

    write({
      users,
      days,
      bookings,
      messages: [],
    });
  }

  function publicUser(user) {
    return user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        }
      : null;
  }

  function account() {
    const session = sessionStorage.getItem(SESSION_KEY);

    if (!session) return null;

    const database = read();

    return database?.users?.find((user) => user.id === session) || null;
  }

  function role() {
    return account()?.role || null;
  }

  function signOut() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function members() {
    return (read()?.users || [])
      .filter((user) => user.role === "aluno")
      .map(publicUser);
  }

  async function register({ name, email, password, confirm }) {
    name = String(name || "").trim();
    email = safeEmail(email);
    password = String(password || "");
    confirm = String(confirm || "");

    if (!name) {
      fail("Informe seu nome completo.");
    }

    if (name.length > 100) {
      fail("O nome deve conter no máximo 100 caracteres.");
    }

    if (!email) {
      fail("Informe seu e-mail.");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length < 6) {
      fail("Informe um endereço de e-mail válido.");
    }

    if (!password) {
      fail("Informe uma senha.");
    }

    if (password.length < 8) {
      fail("A senha deve ter pelo menos 8 caracteres.");
    }

    if (!confirm) {
      fail("Confirme sua senha.");
    }

    if (password !== confirm) {
      fail("As senhas não coincidem. Confira e tente novamente.");
    }

    const database = read();

    if (!database || !Array.isArray(database.users)) {
      fail(
        "Não foi possível acessar os dados. Atualize a página e tente novamente.",
      );
    }

    if (database.users.some((user) => user.email === email)) {
      fail("Este e-mail já está cadastrado.");
    }

    const user = await demoUser(name, email, password, "aluno");

    database.users.push(user);
    write(database);

    return publicUser(user);
  }

  async function login(email, password) {
    const normalizedEmail = safeEmail(email);
    password = String(password || "");

    if (!normalizedEmail) {
      fail("Informe seu e-mail.");
    }

    if (!password) {
      fail("Informe sua senha.");
    }

    const database = read();

    if (!database || !Array.isArray(database.users)) {
      fail(
        "Não foi possível acessar os dados. Atualize a página e tente novamente.",
      );
    }

    const user = database.users.find((item) => item.email === normalizedEmail);

    const genericError = "E-mail ou senha inválidos.";

    if (!user) {
      fail(genericError);
    }

    const hash = await passwordHash(password, user.salt);

    if (hash !== user.hash) {
      fail(genericError);
    }

    sessionStorage.setItem(SESSION_KEY, user.id);

    return publicUser(user);
  }

  const authStore = {
    init,
 cadastro-login
    read,
    write,
    account,
    role,
    publicUser,
    members,
    register,
    login,
    signOut,
  };

  window.MoveAuthStore = authStore;

  // Compatibilidade com o armazenamento geral, quando carregado.
  if (window.MoveStore) {
    Object.assign(window.MoveStore, authStore);
  }
})();
