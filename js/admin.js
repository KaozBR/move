(async function () {
  "use strict";

  const S = window.MoveAdminStore;

  const $ = (selector, scope = document) => scope.querySelector(selector);

  const $$ = (selector, scope = document) => [
    ...scope.querySelectorAll(selector),
  ];

  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );

  const firstName = (name) =>
    String(name || "")
      .trim()
      .split(" ")[0];

  function error(id, message = "") {
    const element = $(`#${id}`);

    if (!element) return;

    element.textContent = message;
    element.hidden = !message;
  }

  function notice(id, message = "", isError = false) {
    const element = $(`#${id}`);

    if (!element) return;

    element.textContent = message;
    element.classList.toggle("error", isError);
    element.hidden = !message;
  }

  function showDialog(id) {
    const dialog = $(`#${id}`);

    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }

  function closeDialog(id) {
    $(`#${id}`)?.close();
  }

  function fillTimes(select, times, preferred = "") {
    select.replaceChildren();

    select.add(
      new Option(
        times.length ? "Selecione um horário" : "Sem horários disponíveis",
        "",
      ),
    );

    times.forEach((time) => {
      select.add(new Option(time, time));
    });

    if (times.includes(preferred)) {
      select.value = preferred;
    }
  }

  function bindDialogs() {
    $$("[data-close]").forEach((button) => {
      button.addEventListener("click", () => {
        closeDialog(button.dataset.close);
      });
    });

    $$(".move-dialog").forEach((dialog) => {
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) {
          dialog.close();
        }
      });
    });
  }

  function bindLogout() {
    $$("[data-logout]").forEach((button) => {
      button.addEventListener("click", () => {
        showDialog("logout-dialog");
      });
    });

    $("#confirm-logout")?.addEventListener("click", () => {
      S.signOut();

      $("#logout-dialog")?.close();

      const dashboard = $(".dashboard-area");
      const logoutSuccess = $("#admin-logout-success");
      const header = $(".site-header");
      const footer = $(".site-footer");

      if (dashboard) dashboard.hidden = true;
      if (header) header.hidden = true;
      if (footer) footer.hidden = true;
      if (logoutSuccess) logoutSuccess.hidden = false;
    });
  }

  function setProtectedRole(expected) {
    const user = S.account();

    if (!user) {
      location.replace("login.html");
      return null;
    }

    if (user.role !== expected) {
      location.replace(user.role === "admin" ? "admin.html" : "aluno.html");

      return null;
    }

    return user;
  }
  function handleAdmin(user) {
    $("#admin-name").textContent = firstName(user.name);

    const datePicker = $("#admin-date");

    datePicker.value = S.todayLocal();

    let editingId = null;
    let cancellingId = null;

    const bookDate = $("#admin-book-date");
    const bookTime = $("#admin-book-time");

    const changeReasonField = $("#admin-change-reason-field");
    const changeReasonSelect = $("#admin-change-reason");

    const cancelReasonField = $("#admin-cancel-reason-field");
    const cancelReasonSelect = $("#admin-cancel-reason");

    const users = S.members();

    const getBooking = (id) =>
      S.allBookings().find((booking) => booking.id === id);

    const getMember = (id) => users.find((member) => member.id === id);

    const membersSelect = $("#admin-student");

    membersSelect.add(new Option("Selecione um aluno", ""));

    users.forEach((member) => {
      membersSelect.add(
        new Option(`${member.name} (${member.email})`, member.id),
      );
    });

    $("#stat-students").textContent = String(users.length);

    function renderSchedule() {
      const date = datePicker.value;
      const slots = S.daySlots(date);
      const bookings = S.bookingsOn(date);

      $("#stat-booked").textContent = String(bookings.length);

      $("#stat-free").textContent = String(
        S.available(date).filter(
          (time) => S.dateTime(date, time).getTime() > Date.now(),
        ).length,
      );

      const container = $("#admin-day");

      if (!slots.length) {
        container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon" aria-hidden="true">◷</span>
        <strong>Nenhum horário definido para esta data</strong>
        <p>Clique em Definir horários para disponibilizar aulas.</p>
      </div>
    `;
        return;
      }

      container.innerHTML = slots
        .map((time) => {
          const booking = bookings.find((item) => item.time === time);
          const student = booking ? getMember(booking.userId) : null;
          const past = S.isPast(date, time);
          const blocked = !booking && S.isBlocked(date, time);

          return `
        <div class="slot-row">
          <span class="slot-time">${esc(time)}</span>

          <span class="slot-name">
            ${
              booking
                ? esc(student?.name || "Aluno")
                : blocked
                  ? "Indisponível pela administração"
                  : "Horário disponível"
            }
          </span>

          <span class="slot-status ${
            booking && !past ? "busy" : blocked && !past ? "blocked" : ""
          }">
            ${
              past
                ? "Encerrado"
                : booking
                  ? "Confirmado"
                  : blocked
                    ? "Bloqueado"
                    : "Livre"
            }
          </span>

          <div class="slot-actions">
            ${
              past || blocked
                ? ""
                : booking
                  ? `
                    <button
                      type="button"
                      class="btn-outline btn-sm"
                      data-admin-change="${esc(booking.id)}"
                    >
                      Alterar
                    </button>

                    <button
                      type="button"
                      class="btn-danger btn-sm"
                      data-admin-cancel="${esc(booking.id)}"
                    >
                      Cancelar
                    </button>
                  `
                  : `
                    <button
                      type="button"
                      class="btn-outline btn-sm"
                      data-admin-free="${esc(time)}"
                    >
                      Agendar
                    </button>
                  `
            }
          </div>
        </div>
      `;
        })
        .join("");
    }

    function renderInbox() {
      const messages = S.inbox().slice().reverse();

      $("#contact-count").textContent = String(messages.length);

      $("#admin-messages").innerHTML = messages.length
        ? messages
            .map(
              (message) => `
                <article class="inbox-item">
                  <strong>
                    ${esc(message.subject)} — ${esc(message.name)}
                  </strong>

                  <div class="inbox-meta">
                    ${esc(message.email)}
                    · Retorno: ${esc(message.returnMode)}
                    · ${esc(
                      new Date(message.createdAt).toLocaleDateString("pt-BR"),
                    )}
                  </div>

                  <p>${esc(message.message)}</p>
                </article>
              `,
            )
            .join("")
        : `
          <div class="empty-state">
            <strong>Nenhuma mensagem recebida</strong>
            <p>
              Mensagens enviadas pelo formulário de Contato
              aparecerão aqui.
            </p>
          </div>
        `;
    }

    datePicker.addEventListener("change", renderSchedule);

    function updateBookTimes(preferred = "") {
      const date = bookDate.value;

      const list = date
        ? S.available(date, editingId).filter(
            (time) => S.dateTime(date, time).getTime() > Date.now(),
          )
        : [];

      fillTimes(bookTime, list, preferred);
      updateSummary();
    }

    function updateSummary() {
      const member = getMember(membersSelect.value);

      $("#admin-summary").textContent =
        member && bookDate.value && bookTime.value
          ? `${member.name} — ${S.shortDate(bookDate.value)} às ${bookTime.value}.`
          : "Confira o aluno, a data e o horário antes de salvar.";
    }

    function openAdminBooking(id = null, freeTime = "") {
      editingId = id;

      const booking = id ? getBooking(id) : null;

      const needsChangeReason =
        booking &&
        !S.isPast(booking.date, booking.time) &&
        S.requiresReason(booking);

      changeReasonField.hidden = !needsChangeReason;
      changeReasonSelect.required = needsChangeReason;
      changeReasonSelect.value = "";

      $("#admin-book-title").textContent = id
        ? "Alterar agendamento"
        : "Agendar aula para um aluno";

      $("#admin-book-form button[type=submit]").textContent = id
        ? "Salvar alteração"
        : "Salvar agendamento";

      membersSelect.value = booking?.userId || "";
      membersSelect.disabled = Boolean(id);

      bookDate.min = S.todayLocal();
      bookDate.value = booking?.date || datePicker.value;

      error("admin-book-error");

      updateBookTimes(booking?.time || freeTime);

      showDialog("admin-book-dialog");
    }

    $("#admin-new-booking").addEventListener("click", () => {
      openAdminBooking();
    });

    membersSelect.addEventListener("change", updateSummary);

    bookDate.addEventListener("change", () => {
      updateBookTimes();
    });

    bookTime.addEventListener("change", updateSummary);

    $("#admin-book-form").addEventListener("submit", (event) => {
      event.preventDefault();

      error("admin-book-error");

      try {
        if (editingId) {
          S.change(editingId, {
            date: bookDate.value,
            time: bookTime.value,
            reason: changeReasonSelect.value,
          });
        } else {
          S.book({
            userId: membersSelect.value,
            date: bookDate.value,
            time: bookTime.value,
          });
        }

        closeDialog("admin-book-dialog");

        datePicker.value = bookDate.value;

        renderSchedule();

        notice(
          "admin-notice",
          editingId
            ? "Agendamento alterado com sucesso!"
            : "Aula agendada com sucesso!",
        );
      } catch (e) {
        error("admin-book-error", e.message);
      }
    });

    $("#admin-day").addEventListener("click", (event) => {
      const changeButton = event.target.closest("[data-admin-change]");

      const cancelButton = event.target.closest("[data-admin-cancel]");

      const freeButton = event.target.closest("[data-admin-free]");

      if (changeButton) {
        openAdminBooking(changeButton.dataset.adminChange);
      }

      if (freeButton) {
        openAdminBooking(null, freeButton.dataset.adminFree);
      }

      if (cancelButton) {
        cancellingId = cancelButton.dataset.adminCancel;

        const booking = getBooking(cancellingId);

        if (!booking) return;

        const needsCancelReason =
          !S.isPast(booking.date, booking.time) && S.requiresReason(booking);

        cancelReasonField.hidden = !needsCancelReason;
        cancelReasonSelect.required = needsCancelReason;
        cancelReasonSelect.value = "";

        const member = getMember(booking.userId);

        $("#admin-cancel-detail").textContent =
          `${member?.name || "Aluno"} — ${S.shortDate(booking.date)} às ${booking.time}. Deseja realmente cancelar?`;

        error("admin-cancel-error");

        showDialog("admin-cancel-dialog");
      }
    });

    $("#admin-do-cancel").addEventListener("click", () => {
      error("admin-cancel-error");

      try {
        S.cancel(cancellingId, cancelReasonSelect.value);

        closeDialog("admin-cancel-dialog");

        renderSchedule();

        notice("admin-notice", "Agendamento cancelado com sucesso!");
      } catch (e) {
        error("admin-cancel-error", e.message);
      }
    });

    const hoursDate = $("#hours-date");

    hoursDate.min = S.todayLocal();

    function renderHours() {
      const selected = new Set(S.daySlots(hoursDate.value));

      $("#hours-checkboxes").innerHTML = S.TIMES.map(
        (time) => `
          <label class="time-choice">
            <input
              type="checkbox"
              value="${time}"
              ${selected.has(time) ? "checked" : ""}
            >
            <span>${time}</span>
          </label>
        `,
      ).join("");
    }

    function openHours() {
      hoursDate.value = datePicker.value;

      error("admin-hours-error");

      renderHours();

      showDialog("admin-hours-dialog");
    }

    $("#admin-define-hours").addEventListener("click", openHours);

    $$("[data-set-hours]").forEach((button) => {
      button.addEventListener("click", openHours);
    });

    hoursDate.addEventListener("change", renderHours);

    $("#admin-hours-form").addEventListener("submit", (event) => {
      event.preventDefault();

      error("admin-hours-error");

      try {
        const selected = $$("#hours-checkboxes input:checked").map(
          (input) => input.value,
        );

        S.setDaySlots(hoursDate.value, selected);

        closeDialog("admin-hours-dialog");

        datePicker.value = hoursDate.value;

        renderSchedule();

        notice("admin-notice", "Horários disponíveis atualizados com sucesso!");
      } catch (e) {
        error("admin-hours-error", e.message);
      }
    });

    renderSchedule();
    renderInbox();
  }

  try {
    if (!S) {
      throw new Error("Armazenamento administrativo não encontrado.");
    }

    await S.init();

    bindDialogs();
    bindLogout();

    const user = setProtectedRole("admin");

    if (user) {
      handleAdmin(user);
    }
  } catch (e) {
    console.error("Move — erro ao iniciar a área administrativa:", e);

    const main = $("#conteudo");

    if (main) {
      const message = document.createElement("p");

      message.className = "form-alert";
      message.setAttribute("role", "alert");
      message.textContent =
        "Não foi possível carregar a área administrativa. Tente atualizar a página.";

      main.prepend(message);
    }
  }
})();
