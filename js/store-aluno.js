(function () {
  "use strict";

  const Auth = window.MoveAuthStore;

  if (!Auth) {
    console.error("Move — módulo de cadastro/login não encontrado.");
    return;
  }

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

  function fail(message) {
    throw new Error(message);
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

  function shortDate(value) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }

  function dateLabel(value) {
    if (!value) return "";

    const [year, month, day] = value.split("-").map(Number);

    const label = new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(year, month - 1, day));

    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  function read() {
    return Auth.read();
  }

  function write(database) {
    Auth.write(database);
  }

  function account() {
    return Auth.account();
  }

  function bookingsFor(userId) {
    return (read()?.bookings || [])
      .filter(
        (booking) => booking.userId === userId && booking.status === "ativo",
      )
      .sort((a, b) =>
        `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`),
      );
  }

  function allBookings() {
    return (read()?.bookings || []).filter(
      (booking) => booking.status === "ativo",
    );
  }

  function daySlots(date) {
    return read()?.days?.find((day) => day.date === date)?.times || [];
  }

  function isBlocked(date, time, database = read()) {
    return (database?.blockedSlots || []).some(
      (slot) => slot.date === date && slot.time === time,
    );
  }

  function booked(date, time, ignoreId = null) {
    const database = read();

    const hasActiveBooking = (database?.bookings || []).some(
      (booking) =>
        booking.status === "ativo" &&
        booking.date === date &&
        booking.time === time &&
        booking.id !== ignoreId,
    );

    return hasActiveBooking || isBlocked(date, time, database);
  }

  function available(date, ignoreId = null) {
    return daySlots(date).filter(
      (time) =>
        !booked(date, time, ignoreId) &&
        dateTime(date, time).getTime() > Date.now(),
    );
  }

  function validateDate(date, time) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date || "") ||
      !/^\d{2}:\d{2}$/.test(time || "")
    ) {
      fail("Selecione uma data e um horário.");
    }

    const when = dateTime(date, time).getTime();

    if (!Number.isFinite(when) || when <= Date.now()) {
      fail("Selecione uma data e um horário futuros.");
    }

    if (!daySlots(date).includes(time)) {
      fail("Esse horário não foi disponibilizado pela administradora.");
    }

    if (isBlocked(date, time)) {
      fail(
        "Este horário está bloqueado pela administração e não está disponível para agendamento.",
      );
    }
  }

  function book({ userId, date, time }) {
    const me = account();

    if (!me || me.role !== "aluno") {
      fail("Entre na sua conta de aluno para agendar.");
    }

    if (userId !== me.id) {
      fail("Você só pode agendar para sua própria conta.");
    }

    const database = read();

    if (
      !database?.users?.some(
        (user) => user.id === userId && user.role === "aluno",
      )
    ) {
      fail("Conta de aluno não encontrada.");
    }

    validateDate(date, time);

    if (booked(date, time)) {
      fail("Este horário já está ocupado. Escolha outro.");
    }

    const booking = {
      id: crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
      userId,
      date,
      time,
      status: "ativo",
      createdAt: new Date().toISOString(),
    };

    database.bookings.push(booking);
    write(database);

    return booking;
  }

  function change(id, { date, time }) {
    const me = account();

    if (!me || me.role !== "aluno") {
      fail("Entre na sua conta de aluno.");
    }

    const database = read();

    const booking = database?.bookings?.find(
      (item) => item.id === id && item.status === "ativo",
    );

    if (!booking) {
      fail("Agendamento não encontrado.");
    }

    if (booking.userId !== me.id) {
      fail("Você não pode alterar esse agendamento.");
    }

    if (
      dateTime(booking.date, booking.time).getTime() - Date.now() <
      24 * HOUR_MS
    ) {
      fail(
        "Não é possível alterar uma aula com menos de 24 horas de antecedência.",
      );
    }

    validateDate(date, time);

    if (booked(date, time, id)) {
      fail("Este horário já está ocupado. Escolha outro.");
    }

    booking.date = date;
    booking.time = time;
    booking.updatedAt = new Date().toISOString();

    write(database);

    return booking;
  }

  function cancel(id) {
    const me = account();

    if (!me || me.role !== "aluno") {
      fail("Entre na sua conta de aluno.");
    }

    const database = read();

    const booking = database?.bookings?.find(
      (item) => item.id === id && item.status === "ativo",
    );

    if (!booking) {
      fail("Agendamento não encontrado.");
    }

    if (booking.userId !== me.id) {
      fail("Você não pode cancelar esse agendamento.");
    }

    if (
      dateTime(booking.date, booking.time).getTime() - Date.now() <
      24 * HOUR_MS
    ) {
      fail(
        "Não é possível cancelar uma aula com menos de 24 horas de antecedência.",
      );
    }

    booking.status = "cancelado";
    booking.cancelledAt = new Date().toISOString();

    write(database);

    return booking;
  }

  window.MoveStudentStore = {
    init: Auth.init,
    read,
    write,
    account,
    signOut: Auth.signOut,
    bookingsFor,
    available,
    book,
    change,
    cancel,
    shortDate,
    dateLabel,
    todayLocal,
    TIMES,
  };
})();
