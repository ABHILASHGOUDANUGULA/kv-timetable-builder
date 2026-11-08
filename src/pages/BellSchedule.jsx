import "../styles/bell-schedule.css";
import { useEffect, useRef, useState } from "react";

const DEFAULT_BREAKS = [
  { id: "break-short", name: "Short Break", start: "10:10", duration: 20 },
  { id: "break-lunch", name: "Lunch Break", start: "12:30", duration: 30 },
];

const DEFAULTS = {
  schoolStart: "08:10",
  assemblyEnabled: true,
  assemblyStart: "08:20",
  assemblyEnd: "08:50",
  firstPeriodStart: "08:50",
  periodDuration: 40,
  periodCount: 8,
  breaks: DEFAULT_BREAKS,
  schedule: [],
};

const MAX_PERIODS = 20;
const MAX_PERIOD_DURATION = 180;
const MAX_BREAK_DURATION = 240;
const MINUTES_PER_DAY = 24 * 60;

const toMinutes = (time) => {
  if (typeof time !== "string" || !/^([01]\\d|2[0-3]):([0-5]\\d)$/.test(time)) {
    return NaN;
  }
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const toTime = (minutes) => {
  if (!Number.isFinite(minutes) || minutes < 0 || minutes >= MINUTES_PER_DAY) {
    return "";
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

const displayTime = (time) => {
  const minutes = toMinutes(time);
  if (!Number.isFinite(minutes)) return "—";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${String(mins).padStart(2, "0")} ${suffix}`;
};

const safePositiveInteger = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : NaN;
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const makeDefaultBreaks = () => DEFAULT_BREAKS.map((item) => ({ ...item }));

const normalizeBreaks = (value) =>
  Array.isArray(value)
    ? value.map((item, index) => ({
        id: item?.id ?? `break-${index + 1}`,
        name: String(item?.name ?? `Break ${index + 1}`),
        start: String(item?.start ?? ""),
        duration: item?.duration ?? 15,
      }))
    : makeDefaultBreaks();

const readSettings = (project) => {
  const saved = project?.data?.bellSchedule ?? {};
  return {
    schoolStart: saved.schoolStart ?? DEFAULTS.schoolStart,
    assemblyEnabled: saved.assemblyEnabled ?? DEFAULTS.assemblyEnabled,
    assemblyStart: saved.assemblyStart ?? DEFAULTS.assemblyStart,
    assemblyEnd: saved.assemblyEnd ?? DEFAULTS.assemblyEnd,
    firstPeriodStart: saved.firstPeriodStart ?? DEFAULTS.firstPeriodStart,
    periodDuration: saved.periodDuration ?? DEFAULTS.periodDuration,
    periodCount: saved.periodCount ?? DEFAULTS.periodCount,
    breaks: normalizeBreaks(saved.breaks),
    schedule: Array.isArray(saved.schedule) ? saved.schedule : [],
  };
};

function BellSchedule({ project, onSave }) {
  const [settings, setSettings] = useState(() => readSettings(project));
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [schedule, setSchedule] = useState(() => readSettings(project).schedule);
  const onSaveRef = useRef(onSave);
  const projectIdRef = useRef(project?.id);
  const saveTimerRef = useRef(null);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Reset the form when switching projects; do not carry settings across projects.
  useEffect(() => {
    const next = readSettings(project);
    setSettings(next);
    setSchedule(next.schedule);
    setMessage("");
    setMessageType("info");
    projectIdRef.current = project?.id;
    hasInitializedRef.current = true;
  }, [project?.id]);

  // Debounced save. Saving the schedule together with the configuration keeps the
  // persisted object consistent. The parent onSave callback is expected to merge
  // this object into project.data.bellSchedule.
  useEffect(() => {
    if (!hasInitializedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    const projectIdAtSchedule = project?.id;
    const payload = {
      ...settings,
      periodDuration: Number(settings.periodDuration),
      periodCount: Number(settings.periodCount),
      breaks: settings.breaks.map((item) => ({
        ...item,
        duration: Number(item.duration),
      })),
      schedule,
    };

    saveTimerRef.current = setTimeout(() => {
      // Avoid saving a previous project's form after a project switch.
      if (projectIdRef.current !== projectIdAtSchedule) return;
      onSaveRef.current?.(payload);
    }, 500);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [project?.id, settings, schedule]);

  const updateSetting = (field, value) => {
    setSettings((previous) => ({ ...previous, [field]: value }));
    setSchedule([]);
    setMessage("");
    setMessageType("info");
  };

  const addBreak = () => {
    setSettings((previous) => {
      const nextNumber = previous.breaks.length + 1;
      return {
        ...previous,
        breaks: [
          ...previous.breaks,
          {
            id: `break-${Date.now()}-${nextNumber}`,
            name: `Break ${nextNumber}`,
            start: "",
            duration: 15,
          },
        ],
      };
    });
    setSchedule([]);
    setMessage("");
  };

  const updateBreak = (id, field, value) => {
    setSettings((previous) => ({
      ...previous,
      breaks: previous.breaks.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }));
    setSchedule([]);
    setMessage("");
  };

  const removeBreak = (id) => {
    setSettings((previous) => ({
      ...previous,
      breaks: previous.breaks.filter((item) => item.id !== id),
    }));
    setSchedule([]);
    setMessage("");
  };

  const validateAndGenerate = () => {
    const {
      schoolStart,
      assemblyEnabled,
      assemblyStart,
      assemblyEnd,
      firstPeriodStart,
      periodDuration,
      periodCount,
      breaks,
    } = settings;

    const schoolStartMinutes = toMinutes(schoolStart);
    const firstStartMinutes = toMinutes(firstPeriodStart);
    const duration = safePositiveInteger(periodDuration);
    const count = safePositiveInteger(periodCount);

    const fail = (text) => {
      setSchedule([]);
      setMessage(text);
      setMessageType("error");
    };

    if (!Number.isFinite(schoolStartMinutes)) {
      fail("Enter a valid school opening time.");
      return;
    }
    if (!Number.isFinite(firstStartMinutes)) {
      fail("Enter a valid first-period starting time.");
      return;
    }
    if (!Number.isFinite(duration) || duration > MAX_PERIOD_DURATION) {
      fail(`Period duration must be a whole number between 1 and ${MAX_PERIOD_DURATION} minutes.`);
      return;
    }
    if (!Number.isFinite(count) || count > MAX_PERIODS) {
      fail(`Number of teaching periods must be a whole number between 1 and ${MAX_PERIODS}.`);
      return;
    }
    if (firstStartMinutes <= schoolStartMinutes) {
      fail("The first period must start after the school opening time.");
      return;
    }

    let assemblyStartMinutes = null;
    let assemblyEndMinutes = null;
    if (assemblyEnabled) {
      assemblyStartMinutes = toMinutes(assemblyStart);
      assemblyEndMinutes = toMinutes(assemblyEnd);
      if (!Number.isFinite(assemblyStartMinutes) || !Number.isFinite(assemblyEndMinutes)) {
        fail("Enter valid assembly start and end times.");
        return;
      }
      if (
        assemblyStartMinutes < schoolStartMinutes ||
        assemblyEndMinutes <= assemblyStartMinutes ||
        assemblyEndMinutes > firstStartMinutes
      ) {
        fail("Assembly must begin at or after school opening, finish after it begins, and end no later than the first period.");
        return;
      }
    }

    const preparedBreaks = breaks.map((item, index) => {
      const startMinutes = toMinutes(item.start);
      const breakDuration = safePositiveInteger(item.duration);
      return {
        ...item,
        name: String(item.name ?? "").trim(),
        startMinutes,
        duration: breakDuration,
        originalIndex: index,
      };
    });

    if (preparedBreaks.some((item) => !item.name)) {
      fail("Give every break a name.");
      return;
    }
    if (preparedBreaks.some((item) => !Number.isFinite(item.startMinutes))) {
      fail("Enter a valid starting time for every break.");
      return;
    }
    if (
      preparedBreaks.some(
        (item) => !Number.isFinite(item.duration) || item.duration > MAX_BREAK_DURATION
      )
    ) {
      fail(`Each break duration must be a whole number between 1 and ${MAX_BREAK_DURATION} minutes.`);
      return;
    }

    preparedBreaks.sort((a, b) => a.startMinutes - b.startMinutes);

    for (let index = 1; index < preparedBreaks.length; index += 1) {
      const previous = preparedBreaks[index - 1];
      const current = preparedBreaks[index];
      if (current.startMinutes < previous.startMinutes + previous.duration) {
        fail(`“${previous.name}” and “${current.name}” overlap. Adjust their times.`);
        return;
      }
    }

    // Assembly must not overlap a break.
    if (assemblyEnabled) {
      const overlapsAssembly = preparedBreaks.find(
        (item) =>
          item.startMinutes < assemblyEndMinutes &&
          item.startMinutes + item.duration > assemblyStartMinutes
      );
      if (overlapsAssembly) {
        fail(`“${overlapsAssembly.name}” overlaps assembly. Adjust its time.`);
        return;
      }
    }

    let currentTime = firstStartMinutes;
    let breakIndex = 0;
    const generated = [];

    if (assemblyEnabled) {
      generated.push({
        id: "assembly",
        type: "assembly",
        name: "Assembly / Prayer",
        start: assemblyStart,
        end: assemblyEnd,
      });
    }

    // A break can be placed at a period boundary, including just before Period 1.
    // It cannot fall inside a teaching period. Period lengths remain unchanged.
    for (let period = 1; period <= count; period += 1) {
      const nextBreak = preparedBreaks[breakIndex];

      if (nextBreak && nextBreak.startMinutes === currentTime) {
        const breakEnd = currentTime + nextBreak.duration;
        if (breakEnd >= MINUTES_PER_DAY) {
          fail(`“${nextBreak.name}” extends beyond midnight. Adjust the break.`);
          return;
        }
        generated.push({
          id: `break-${nextBreak.id}`,
          type: "break",
          name: nextBreak.name,
          start: toTime(currentTime),
          end: toTime(breakEnd),
        });
        currentTime = breakEnd;
        breakIndex += 1;
      }

      const periodEnd = currentTime + duration;
      if (periodEnd >= MINUTES_PER_DAY) {
        fail("The generated school day extends beyond midnight. Reduce the periods or adjust the timings.");
        return;
      }

      const breakWithinPeriod = preparedBreaks[breakIndex];
      if (breakWithinPeriod && breakWithinPeriod.startMinutes < periodEnd) {
        fail(
          `“${breakWithinPeriod.name}” must start at a period boundary. Its time falls inside Period ${period} (or before the current boundary).`
        );
        return;
      }

      generated.push({
        id: `period-${period}`,
        type: "period",
        name: `Period ${period}`,
        start: toTime(currentTime),
        end: toTime(periodEnd),
      });
      currentTime = periodEnd;

      if (preparedBreaks[breakIndex]?.startMinutes === currentTime) {
        const item = preparedBreaks[breakIndex];
        const breakEnd = currentTime + item.duration;
        if (breakEnd >= MINUTES_PER_DAY) {
          fail(`“${item.name}” extends beyond midnight. Adjust the break.`);
          return;
        }
        generated.push({
          id: `break-${item.id}`,
          type: "break",
          name: item.name,
          start: toTime(currentTime),
          end: toTime(breakEnd),
        });
        currentTime = breakEnd;
        breakIndex += 1;
      }
    }

    if (breakIndex < preparedBreaks.length) {
      const remaining = preparedBreaks[breakIndex];
      fail(
        `“${remaining.name}” is not placed within the teaching periods. Move it to a period boundary or increase the number of periods.`
      );
      return;
    }

    setSchedule(generated);
    setMessage("Bell schedule generated. Review the timings below; changes are saved automatically.");
    setMessageType("success");
  };

  const closingTime = schedule.length ? schedule[schedule.length - 1].end : "";
  const teachingPeriodCount = schedule.filter((item) => item.type === "period").length;
  const breakCount = schedule.filter((item) => item.type === "break").length;

  const printBellSchedule = () => {
    if (!schedule.length) {
      setMessage("Generate a valid bell schedule before printing.");
      setMessageType("error");
      return;
    }

    const schoolName = escapeHtml(project?.schoolName || "School Name");
    const academicYear = escapeHtml(project?.academicYear || "________");
    const rows = schedule
      .map((item) => {
        const rowClass =
          item.type === "break"
            ? "break-row"
            : item.type === "assembly"
              ? "assembly-row"
              : "";
        const startMinutes = toMinutes(item.start);
        const endMinutes = toMinutes(item.end);
        const slotDuration =
          Number.isFinite(startMinutes) && Number.isFinite(endMinutes)
            ? endMinutes - startMinutes
            : 0;
        return `<tr class="${rowClass}">
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(displayTime(item.start))}</td>
          <td>${escapeHtml(displayTime(item.end))}</td>
          <td>${slotDuration} min</td>
        </tr>`;
      })
      .join("");

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      setMessage("The print window was blocked. Allow pop-ups for this site and try again.");
      setMessageType("error");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
      <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>School Bell Schedule</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #111; margin: 0; }
          header { text-align: center; margin-bottom: 18px; }
          header h1 { font-size: 20px; margin: 0 0 8px; }
          header h2 { font-size: 15px; margin: 0 0 6px; }
          header p { margin: 0; font-size: 12px; }
          .summary { display: flex; gap: 10px; margin: 14px 0; }
          .summary div { flex: 1; border: 1px solid #bbb; padding: 8px; }
          .summary span, .summary strong { display: block; margin-bottom: 4px; }
          .summary span { font-size: 10px; color: #444; }
          .summary strong { font-size: 13px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #555; padding: 8px; font-size: 11px; text-align: left; }
          th { background: #eee; }
          .break-row { background: #fff5df; font-weight: bold; }
          .assembly-row { background: #eef2ff; font-weight: bold; }
          tr { break-inside: avoid; }
        </style>
      </head>
      <body>
        <header>
          <h1>${schoolName}</h1>
          <h2>SCHOOL BELL SCHEDULE</h2>
          <p>Academic Year: ${academicYear}</p>
        </header>
        <div class="summary">
          <div><span>Teaching Periods</span><strong>${teachingPeriodCount}</strong></div>
          <div><span>Breaks</span><strong>${breakCount}</strong></div>
          <div><span>School Closing</span><strong>${escapeHtml(displayTime(closingTime))}</strong></div>
        </div>
        <table>
          <thead><tr><th>Slot</th><th>Starting Time</th><th>Ending Time</th><th>Duration</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
      </html>`);
    printWindow.document.close();

    // Print after the new document is ready.
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      printWindow.onafterprint = () => printWindow.close();
    };
  };

  return (
    <div className="bell-page">
      <div className="bell-header">
        <div>
          <h1>Bell Schedule</h1>
          <p>Configure school opening, assembly, period lengths and breaks.</p>
        </div>
      </div>

      <section className="bell-card">
        <h2>1. School Timings</h2>
        <div className="bell-grid">
          <label>
            School Opening Time
            <input
              type="time"
              value={settings.schoolStart}
              onChange={(event) => updateSetting("schoolStart", event.target.value)}
              required
            />
          </label>
          <label>
            First Period Starting Time
            <input
              type="time"
              value={settings.firstPeriodStart}
              onChange={(event) => updateSetting("firstPeriodStart", event.target.value)}
              required
            />
          </label>
        </div>
        <div className="bell-checkbox">
          <input
            type="checkbox"
            checked={settings.assemblyEnabled}
            onChange={(event) => updateSetting("assemblyEnabled", event.target.checked)}
            id="assemblyEnabled"
          />
          <label htmlFor="assemblyEnabled">Include Assembly / Prayer</label>
        </div>
        {settings.assemblyEnabled && (
          <div className="bell-grid">
            <label>
              Assembly Starting Time
              <input
                type="time"
                value={settings.assemblyStart}
                onChange={(event) => updateSetting("assemblyStart", event.target.value)}
                required
              />
            </label>
            <label>
              Assembly Ending Time
              <input
                type="time"
                value={settings.assemblyEnd}
                onChange={(event) => updateSetting("assemblyEnd", event.target.value)}
                required
              />
            </label>
          </div>
        )}
      </section>

      <section className="bell-card">
        <h2>2. Period Configuration</h2>
        <div className="bell-grid">
          <label>
            Duration of Each Period (minutes)
            <input
              type="number"
              min="1"
              max={MAX_PERIOD_DURATION}
              step="1"
              value={settings.periodDuration}
              onChange={(event) => updateSetting("periodDuration", event.target.value)}
              required
            />
          </label>
          <label>
            Number of Teaching Periods (1–{MAX_PERIODS})
            <input
              type="number"
              min="1"
              max={MAX_PERIODS}
              step="1"
              value={settings.periodCount}
              onChange={(event) => updateSetting("periodCount", event.target.value)}
              required
            />
          </label>
        </div>
        <p className="bell-muted">
          Period durations stay fixed. Breaks must be scheduled exactly at period boundaries.
        </p>
      </section>

      <section className="bell-card">
        <div className="bell-section-heading">
          <h2>3. Break Configuration</h2>
          <button type="button" className="bell-secondary-btn" onClick={addBreak}>
            + Add Break
          </button>
        </div>
        {settings.breaks.map((item, index) => (
          <div className="break-item" key={item.id}>
            <div className="break-item-heading">
              <strong>{item.name.trim() || `Break ${index + 1}`}</strong>
              <button
                type="button"
                className="bell-remove-btn"
                onClick={() => removeBreak(item.id)}
                aria-label={`Remove ${item.name || `Break ${index + 1}`}`}
              >
                Remove
              </button>
            </div>
            <div className="bell-grid">
              <label>
                Break Name
                <input
                  type="text"
                  maxLength="60"
                  value={item.name}
                  onChange={(event) => updateBreak(item.id, "name", event.target.value)}
                  required
                />
              </label>
              <label>
                Break Starting Time
                <input
                  type="time"
                  value={item.start}
                  onChange={(event) => updateBreak(item.id, "start", event.target.value)}
                  required
                />
              </label>
              <label>
                Duration (minutes)
                <input
                  type="number"
                  min="1"
                  max={MAX_BREAK_DURATION}
                  step="1"
                  value={item.duration}
                  onChange={(event) => updateBreak(item.id, "duration", event.target.value)}
                  required
                />
              </label>
            </div>
          </div>
        ))}
        {settings.breaks.length === 0 && (
          <p className="bell-muted">No breaks added yet. Use “Add Break” to create one.</p>
        )}
      </section>

      <button type="button" className="bell-generate-btn" onClick={validateAndGenerate}>
        Generate Bell Schedule
      </button>

      {message && (
        <div
          className={`bell-message ${messageType === "success" ? "success" : messageType === "error" ? "error" : ""}`}
          role={messageType === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {message}
        </div>
      )}

      {schedule.length > 0 && (
        <section className="bell-card bell-print-card">
          <div className="bell-print-header">
            <h1>{project?.schoolName || "School Name"}</h1>
            <h2>SCHOOL BELL SCHEDULE</h2>
            <p>Academic Year: {project?.academicYear || "________"}</p>
          </div>
          <div className="bell-section-heading">
            <h2>4. Generated Bell Schedule</h2>
            <span className="bell-valid">Valid Schedule</span>
          </div>
          <div className="bell-summary">
            <div>
              <span>Teaching Periods</span>
              <strong>{teachingPeriodCount}</strong>
            </div>
            <div>
              <span>Breaks</span>
              <strong>{breakCount}</strong>
            </div>
            <div>
              <span>School Closing</span>
              <strong>{displayTime(closingTime)}</strong>
            </div>
          </div>
          <div className="bell-table-wrap">
            <table className="bell-table">
              <thead>
                <tr>
                  <th scope="col">Slot</th>
                  <th scope="col">Starting Time</th>
                  <th scope="col">Ending Time</th>
                  <th scope="col">Duration</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((item) => {
                  const startMinutes = toMinutes(item.start);
                  const endMinutes = toMinutes(item.end);
                  const slotDuration =
                    Number.isFinite(startMinutes) && Number.isFinite(endMinutes)
                      ? endMinutes - startMinutes
                      : 0;
                  return (
                    <tr
                      key={item.id}
                      className={
                        item.type === "break"
                          ? "break-row"
                          : item.type === "assembly"
                            ? "assembly-row"
                            : ""
                      }
                    >
                      <td>{item.name}</td>
                      <td>{displayTime(item.start)}</td>
                      <td>{displayTime(item.end)}</td>
                      <td>{slotDuration} min</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="bell-secondary-btn bell-no-print"
            onClick={printBellSchedule}
          >
            Print Bell Schedule
          </button>
        </section>
      )}
    </div>
  );
}

export default BellSchedule;
