(function () {
  "use strict";

  const Auth = window.MoveAuthStore;

  if (!Auth) {
    console.error("Move — módulo de cadastro/login não encontrado.");
    return;
  }

  const HOUR_MS = 60 * 60 * 1000;

  const ADMIN_REASONS = [
    "Problema de saúde ou emergência",
    "Imprevisto pessoal ou familiar",
    "Outro motivo excepcional",
  ];

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

  function read() {
    return Auth.read();
  }

  function write(database) {
    Auth.write(database);
  }

  function account() {
    return Auth.account();
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

  function isPast(date, time) {
    return dateTime(date, time).getTime() <= Date.now();
  }

  function requiresReason(booking) {
    const remaining =
      dateTime(booking.date, booking.time).getTime() - Date.now();

    return remaining < 24 * HOUR_MS;
  }

  function shortDate(value) {
    if (!value) return "";

    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }

  function dateLabel(value) {
    if (!value) return "";

    const [year, month, day] = value.split("-").map(Number);

    return new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(year, month - 1, day));
  }

  function requireAdmin() {
    const me = account();

    if (!me || me.role !== "admin") {
      fail("Apenas a administradora pode realizar esta operação.");
    }

    return me;
  }

  function members() {
    return Auth.members();
  }

  function allBookings() {
    return (read()?.bookings || []).filter(
      (booking) => booking.status === "ativo",
    );
  }

  function bookingsOn(date) {
    return allBookings()
      .filter((booking) => booking.date === date)
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  function daySlots(date) {
    return read()?.days?.find((day) => day.date === date)?.times || [];
  }

  function isBlocked(date, time, database = read()) {
    return (database?.blockedSlots || []).some(
      (slot) => slot.date === date && slot.time === time,
    );
  }

  function blockSlot(database, date, time, reason) {
    if (!Array.isArray(database.blockedSlots)) {
      database.blockedSlots = [];
    }

    const alreadyBlocked = database.blockedSlots.some(
      (slot) => slot.date === date && slot.time === time,
    );

    if (!alreadyBlocked) {
      database.blockedSlots.push({
        date,
        time,
        reason,
        createdAt: new Date().toISOString(),
      });
    }
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
    return daySlots(date).filter((time) => !booked(date, time, ignoreId));
  }

  function validateDate(date, time) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date || "") ||
      !/^\d{2}:\d{2}$/.test(time || "")
    ) {
      fail("Selecione uma data e um horário.");
    }

    const when = dateTime(date, time).getTime();

    if (!Number.isFinite(when)) {
      fail("Data ou horário inválido.");
    }

    if (when <= Date.now()) {
      fail("Não é possível agendar aulas em horários que já passaram.");
    }

    if (!daySlots(date).includes(time)) {
      fail("Esse horário não foi disponibilizado pela administradora.");
    }
  }

  function book({ userId, date, time }) {
    requireAdmin();

    const database = read();

    if (
      !database?.users?.some(
        (user) => user.id === userId && user.role === "aluno",
      )
    ) {
      fail("Selecione um aluno válido.");
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

  function validateExistingBooking(booking, reason) {
    if (isPast(booking.date, booking.time)) {
      fail(
        "Não é possível alterar ou cancelar uma aula que já começou ou terminou.",
      );
    }

    if (requiresReason(booking) && !ADMIN_REASONS.includes(reason)) {
      fail("Selecione uma justificativa válida para esta operação.");
    }
  }

  function change(id, { date, time, reason }) {
    requireAdmin();

    const database = read();

    const booking = database?.bookings?.find(
      (item) => item.id === id && item.status === "ativo",
    );

    if (!booking) {
      fail("Agendamento não encontrado.");
    }

    validateExistingBooking(booking, reason);

    validateDate(date, time);

    if (booked(date, time, id)) {
      fail("Este horário já está ocupado. Escolha outro.");
    }

    const needsReason = requiresReason(booking);

    const originalDate = booking.date;
    const originalTime = booking.time;

    const hasChangedSlot = originalDate !== date || originalTime !== time;

    if (needsReason && hasChangedSlot) {
      blockSlot(database, originalDate, originalTime, reason);
    }

    booking.date = date;
    booking.time = time;
    booking.updatedAt = new Date().toISOString();

    if (needsReason) {
      booking.changeReason = reason;
    } else {
      delete booking.changeReason;
    }

    write(database);

    return booking;
  }

  function cancel(id, reason) {
    requireAdmin();

    const database = read();

    const booking = database?.bookings?.find(
      (item) => item.id === id && item.status === "ativo",
    );

    if (!booking) {
      fail("Agendamento não encontrado.");
    }

    validateExistingBooking(booking, reason);

    const needsReason = requiresReason(booking);

    if (needsReason) {
      blockSlot(database, booking.date, booking.time, reason);
    }

    booking.status = "cancelado";
    booking.cancelledAt = new Date().toISOString();

    if (needsReason) {
      booking.cancellationReason = reason;
    } else {
      delete booking.cancellationReason;
    }

    write(database);

    return booking;
  }

  function setDaySlots(date, slots) {
    requireAdmin();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
      fail("Selecione uma data válida.");
    }

    if (date < todayLocal()) {
      fail("Selecione hoje ou uma data futura.");
    }

    if (Number.isNaN(dateTime(date, "12:00").getTime())) {
      fail("Selecione uma data válida.");
    }

    if (!Array.isArray(slots)) {
      fail("Selecione os horários disponíveis.");
    }

    const sorted = [
      ...new Set(slots.filter((time) => TIMES.includes(time))),
    ].sort();

    const occupiedTimes = [
      ...bookingsOn(date).map((booking) => booking.time),
      ...(read()?.blockedSlots || [])
        .filter((slot) => slot.date === date)
        .map((slot) => slot.time),
    ];

    if (occupiedTimes.some((time) => !sorted.includes(time))) {
      fail(
        "Não é possível remover um horário que já possui uma aula agendada.",
      );
    }

    const database = read();

    if (!database) {
      fail("Não foi possível acessar os dados do Move.");
    }

    if (!Array.isArray(database.days)) {
      database.days = [];
    }

    const row = database.days.find((day) => day.date === date);

    if (row) {
      row.times = sorted;
    } else {
      database.days.push({
        date,
        times: sorted,
      });
    }

    write(database);

    return sorted;
  }

  function inbox() {
    return read()?.messages || [];
  }

  window.MoveAdminStore = {
    init: Auth.init,
    account,
    signOut: Auth.signOut,
    members,
    allBookings,
    bookingsOn,
    daySlots,
    available,
    book,
    change,
    cancel,
    setDaySlots,
    isBlocked,
    inbox,
    shortDate,
    dateLabel,
    todayLocal,
    dateTime,
    isPast,
    requiresReason,
    TIMES,
  };
})();
