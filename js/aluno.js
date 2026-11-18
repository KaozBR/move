(async function () {
  "use strict";

  const S = window.MoveStudentStore;

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

  function addDays(amount, from = new Date()) {
    const date = new Date(from);

    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + amount);

    return S.todayLocal(date);
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
      const dashboard = $("#student-dashboard-content");
      const successPanel = $("#student-logout-success");

      S.signOut();

      closeDialog("logout-dialog");

      if (!dashboard || !successPanel) {
        location.replace("login.html");
        return;
      }

      dashboard.hidden = true;
      successPanel.hidden = false;
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

  function handleStudent(user) {
    $("#student-name").textContent = firstName(user.name);

    let editingId = null;
    let cancelId = null;

    const dateInput = $("#student-date");
    const timeSelect = $("#student-time");

    dateInput.min = S.todayLocal();

    const currentBooking = (id) =>
      S.bookingsFor(user.id).find((booking) => booking.id === id);

    function render() {
      const bookings = S.bookingsFor(user.id);
      const container = $("#student-bookings");

      $("#student-count").textContent =
        `${bookings.length} ${bookings.length === 1 ? "aula" : "aulas"}`;

      if (!bookings.length) {
        container.innerHTML = `
          <div class="empty-state">
            <span class="empty-icon" aria-hidden="true">◷</span>
            <strong>Você ainda não tem agendamentos</strong>
            <p>
              Escolha uma data e um horário disponível
              clicando no botão Agendar aula.
            </p>
          </div>
        `;

        return;
      }

      container.innerHTML = bookings
        .map((booking) => {
          const [day, month, year] = booking.date.split("-").reverse();
          const weekday = S.dateLabel(booking.date);

          const isPast =
            new Date(`${booking.date}T${booking.time}:00`).getTime() <=
            Date.now();

          const status = isPast ? "Encerrado" : "Confirmado";

          return `
      <article class="booking-card">
        <div class="booking-main">
          <div class="date-tile">
            <strong>${esc(day)}</strong>
            <span>${esc(month)}/${esc(year)}</span>
          </div>

          <div class="booking-info">
            <strong>${esc(weekday)}</strong>
            <small>
              Horário: ${esc(booking.time)} · Pilates
            </small>
            <span class="status-dot">${status}</span>
          </div>
        </div>

        ${
          !isPast
            ? `
              <div class="booking-actions">
                <button
                  class="btn-outline btn-sm"
                  type="button"
                  data-change-id="${esc(booking.id)}"
                >
                  Alterar
                </button>

                <button
                  class="btn-danger btn-sm"
                  type="button"
                  data-cancel-id="${esc(booking.id)}"
                >
                  Cancelar
                </button>
              </div>
            `
            : ""
        }
      </article>
    `;
        })
        .join("");
    }

    function updateSummary() {
      const date = dateInput.value;
      const time = timeSelect.value;

      $("#student-summary").textContent =
        date && time
          ? `Aula de Pilates — ${S.shortDate(date)} às ${time}. Confira os dados antes de confirmar.`
          : "Escolha uma data e um horário para conferir sua aula.";
    }

    function updateOptions(preferred = "") {
      const date = dateInput.value;

      const availableTimes = date ? S.available(date, editingId) : [];

      fillTimes(timeSelect, availableTimes, preferred);
      updateSummary();
    }

    function openBooking(id = null) {
      editingId = id;

      const oldBooking = id ? currentBooking(id) : null;
      const date = oldBooking?.date || addDays(2);

      dateInput.value = date;

      $("#student-book-title").textContent = id
        ? "Alterar agendamento"
        : "Agendar aula";

      $("#student-confirm-btn").textContent = id
        ? "Salvar alteração"
        : "Confirmar agendamento";

      error("student-book-error");

      updateOptions(oldBooking?.time || "");

      showDialog("student-book-dialog");
    }

    $("#new-student-booking").addEventListener("click", () => {
      openBooking();
    });

    dateInput.addEventListener("change", () => {
      updateOptions();
    });

    timeSelect.addEventListener("change", updateSummary);

    $("#student-book-form").addEventListener("submit", (event) => {
      event.preventDefault();

      error("student-book-error");

      try {
        if (editingId) {
          S.change(editingId, {
            date: dateInput.value,
            time: timeSelect.value,
          });
        } else {
          S.book({
            userId: user.id,
            date: dateInput.value,
            time: timeSelect.value,
          });
        }

        closeDialog("student-book-dialog");
        render();

        notice(
          "student-notice",
          editingId
            ? "Aula alterada com sucesso!"
            : "Aula agendada com sucesso!",
        );
      } catch (e) {
        error("student-book-error", e.message);
      }
    });

    $("#student-bookings").addEventListener("click", (event) => {
      const changeButton = event.target.closest("[data-change-id]");
      const cancelButton = event.target.closest("[data-cancel-id]");

      if (changeButton) {
        openBooking(changeButton.dataset.changeId);
      }

      if (cancelButton) {
        cancelId = cancelButton.dataset.cancelId;

        const booking = currentBooking(cancelId);

        if (!booking) return;

        $("#student-cancel-detail").textContent =
          `Deseja cancelar a aula de ${S.shortDate(booking.date)} às ${booking.time}?`;

        error("student-cancel-error");

        showDialog("student-cancel-dialog");
      }
    });

    $("#student-do-cancel").addEventListener("click", () => {
      error("student-cancel-error");

      try {
        S.cancel(cancelId);

        closeDialog("student-cancel-dialog");

        render();

        notice("student-notice", "Aula cancelada com sucesso!");
      } catch (e) {
        error("student-cancel-error", e.message);
      }
    });

    render();
  }

  try {
    if (!S) {
      throw new Error("Armazenamento do aluno não encontrado.");
    }

    await S.init();

    bindDialogs();
    bindLogout();

    const user = setProtectedRole("aluno");

    if (user) {
      handleStudent(user);
    }
  } catch (e) {
    console.error("Move — erro ao iniciar a área do aluno:", e);

    const main = $("#conteudo");

    if (main) {
      const message = document.createElement("p");

      message.className = "form-alert";
      message.setAttribute("role", "alert");
      message.textContent =
        "Não foi possível carregar sua agenda. Tente atualizar a página.";

      main.prepend(message);
    }
  }
})();
