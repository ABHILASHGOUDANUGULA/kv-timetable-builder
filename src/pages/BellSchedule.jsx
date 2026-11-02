
import "../styles/bell-schedule.css";
import { useEffect, useRef, useState } from "react";

const toMinutes = (time) => {
  if (!time) return 0;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const toTime = (minutes) => {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

const displayTime = (time) => {
  if (!time) return "";
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
};


function BellSchedule({ project, onSave }) {
  const saved = project?.data?.bellSchedule || {};
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const [schoolStart, setSchoolStart] = useState(
    () => saved.schoolStart ?? "08:10"
  );
  const [assemblyEnabled, setAssemblyEnabled] = useState(
    () => saved.assemblyEnabled ?? true
  );
  const [assemblyStart, setAssemblyStart] = useState(
    () => saved.assemblyStart ?? "08:20"
  );
  const [assemblyEnd, setAssemblyEnd] = useState(
    () => saved.assemblyEnd ?? "08:50"
  );
  const [firstPeriodStart, setFirstPeriodStart] = useState(
    () => saved.firstPeriodStart ?? "08:50"
  );
  const [periodDuration, setPeriodDuration] = useState(
    () => saved.periodDuration ?? 40
  );
  const [periodCount, setPeriodCount] = useState(
    () => saved.periodCount ?? 8
  );
  const [breaks, setBreaks] = useState(
    () => saved.breaks ?? [
      { id: 1, name: "Short Break", start: "10:10", duration: 20 },
      { id: 2, name: "Lunch Break", start: "12:30", duration: 30 },
    ]
  );
  const [schedule, setSchedule] = useState(
    () => saved.schedule ?? []
  );
  const [message, setMessage] = useState("");
  // Load the selected school's saved bell schedule when switching projects
useEffect(() => {
  const savedSchedule = project?.data?.bellSchedule || {};

  setSchoolStart(savedSchedule.schoolStart ?? "08:10");

  setAssemblyEnabled(savedSchedule.assemblyEnabled ?? true);
  setAssemblyStart(savedSchedule.assemblyStart ?? "08:20");
  setAssemblyEnd(savedSchedule.assemblyEnd ?? "08:50");

  setFirstPeriodStart(savedSchedule.firstPeriodStart ?? "08:50");

  setPeriodDuration(savedSchedule.periodDuration ?? 40);
  setPeriodCount(savedSchedule.periodCount ?? 8);

  setBreaks(
    savedSchedule.breaks ?? [
      { id: 1, name: "Short Break", start: "10:10", duration: 20 },
      { id: 2, name: "Lunch Break", start: "12:30", duration: 30 },
    ]
  );

  setSchedule(savedSchedule.schedule ?? []);
  setMessage("");
}, [project?.id]);
  // Automatically save Bell Schedule to the current school project
  useEffect(() => {
    const timer = setTimeout(() => {
      onSaveRef.current?.({
        schoolStart,
        assemblyEnabled,
        assemblyStart,
        assemblyEnd,
        firstPeriodStart,
        periodDuration: Number(periodDuration),
        periodCount: Number(periodCount),
        breaks,
        schedule,
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [
    project?.id,
    schoolStart,
    assemblyEnabled,
    assemblyStart,
    assemblyEnd,
    firstPeriodStart,
    periodDuration,
    periodCount,
    breaks,
    schedule,
  ]);



  const addBreak = () => {
    setBreaks((previous) => [
      ...previous,
      {
        id: Date.now(),
        name: `Break ${previous.length + 1}`,
        start: "",
        duration: 15,
      },
    ]);
    setSchedule([]);
    setMessage("");
  };

  const updateBreak = (id, field, value) => {
    setBreaks((previous) =>
      previous.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
    setSchedule([]);
    setMessage("");
  };

  const removeBreak = (id) => {
    setBreaks((previous) => previous.filter((item) => item.id !== id));
    setSchedule([]);
    setMessage("");
  };

  const generateSchedule = () => {
    const start = toMinutes(firstPeriodStart);
    const duration = Number(periodDuration);
    const count = Number(periodCount);

    if (!firstPeriodStart || !duration || duration < 1 || !count || count < 1) {
      setMessage("Please enter a valid first period time, duration and period count.");
      setSchedule([]);
      return;
    }

    if (assemblyEnabled) {
      const school = toMinutes(schoolStart);
      const assemblyFrom = toMinutes(assemblyStart);
      const assemblyTo = toMinutes(assemblyEnd);

      if (
        !schoolStart ||
        !assemblyStart ||
        !assemblyEnd ||
        assemblyFrom < school ||
        assemblyTo <= assemblyFrom ||
        assemblyTo > start
      ) {
        setMessage("Please check the school opening, assembly and first-period timings.");
        setSchedule([]);
        return;
      }
    }

    const preparedBreaks = breaks.map((item) => ({
      ...item,
      startMinutes: toMinutes(item.start),
      duration: Number(item.duration),
    }));

    if (
      preparedBreaks.some(
        (item) => !item.start || !item.duration || item.duration < 1
      )
    ) {
      setMessage("Enter a start time and a positive duration for every break.");
      setSchedule([]);
      return;
    }

    preparedBreaks.sort((a, b) => a.startMinutes - b.startMinutes);

    for (let i = 1; i < preparedBreaks.length; i++) {
      const previous = preparedBreaks[i - 1];
      const current = preparedBreaks[i];

      if (
        current.startMinutes <
        previous.startMinutes + previous.duration
      ) {
        setMessage("Breaks overlap. Please adjust their start times.");
        setSchedule([]);
        return;
      }
    }

    let currentTime = start;
    let breakIndex = 0;
    const generated = [];

    for (let period = 1; period <= count; period++) {
      const periodEnd = currentTime + duration;
      const nextBreak = preparedBreaks[breakIndex];

      if (nextBreak && nextBreak.startMinutes < periodEnd) {
        setMessage(
          `${nextBreak.name} must start at a period boundary. It currently falls inside Period ${period} or before it.`
        );
        setSchedule([]);
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

      if (nextBreak && nextBreak.startMinutes === currentTime) {
        generated.push({
  id: `break-${nextBreak.id}`,
  type: "break",
  name: nextBreak.name,
  start: toTime(currentTime),
  end: toTime(currentTime + nextBreak.duration),
});

        currentTime += nextBreak.duration;
        breakIndex++;
      }
    }

    if (breakIndex < preparedBreaks.length) {
      setMessage(
        `${preparedBreaks[breakIndex].name} does not fit within the configured teaching periods. Increase the number of periods or adjust the break time.`
      );
      setSchedule([]);
      return;
    }

    setSchedule(generated);
    setMessage("Bell schedule generated successfully.");
  };

  const closingTime =
    schedule.length > 0 ? schedule[schedule.length - 1].end : "";

const printBellSchedule = () => {
  const card = document.querySelector(".bell-print-card");

  if (!card) {
    alert("Please generate the Bell Schedule first.");
    return;
  }

  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    alert("Please allow pop-ups to print.");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>School Bell Schedule</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 12mm;
        }

        body {
          font-family: Arial, sans-serif;
          color: #111;
          margin: 0;
        }

        .bell-print-header {
          display: block;
          text-align: center;
          margin-bottom: 20px;
        }

        .bell-print-header h1 {
          font-size: 20px;
        }

        .bell-print-header h2 {
          font-size: 16px;
        }

        .bell-summary {
          display: flex;
          gap: 12px;
          margin-bottom: 15px;
        }

        .bell-summary div {
          flex: 1;
          padding: 10px;
          border: 1px solid #ddd;
        }

        .bell-summary span,
        .bell-summary strong {
          display: block;
          margin-bottom: 5px;
        }

        .bell-table-wrap {
          overflow: visible;
        }

        .bell-table {
          width: 100%;
          border-collapse: collapse;
        }

        .bell-table th,
        .bell-table td {
          border: 1px solid #555;
          padding: 9px;
          font-size: 11px;
          text-align: left;
        }

        .bell-table th {
          background: #eee;
        }

        .break-row {
          background: #fff5df;
          font-weight: bold;
        }

        .bell-valid {
          display: none;
        }
      </style>
    </head>
    <body>
      ${card.innerHTML}
    </body>
    </html>
  `);

  printWindow.document.close();

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
          <p>Configure school timings, periods and breaks.</p>
        </div>
      </div>

      <section className="bell-card">
        <h2>1. School Timings</h2>

        <div className="bell-grid">
          <label>
            School Opening Time
            <input
              type="time"
              value={schoolStart}
              onChange={(e) => setSchoolStart(e.target.value)}
            />
          </label>

          <label>
            First Period Starting Time
            <input
              type="time"
              value={firstPeriodStart}
              onChange={(e) => setFirstPeriodStart(e.target.value)}
            />
          </label>
        </div>

        <div className="bell-checkbox">
          <input
            type="checkbox"
            checked={assemblyEnabled}
            onChange={(e) => setAssemblyEnabled(e.target.checked)}
            id="assemblyEnabled"
          />
          <label htmlFor="assemblyEnabled">
            Include Assembly / Prayer
          </label>
        </div>

        {assemblyEnabled && (
          <div className="bell-grid">
            <label>
              Assembly Starting Time
              <input
                type="time"
                value={assemblyStart}
                onChange={(e) => setAssemblyStart(e.target.value)}
              />
            </label>

            <label>
              Assembly Ending Time
              <input
                type="time"
                value={assemblyEnd}
                onChange={(e) => setAssemblyEnd(e.target.value)}
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
              value={periodDuration}
              onChange={(e) => setPeriodDuration(e.target.value)}
            />
          </label>

          <label>
            Number of Teaching Periods
            <input
              type="number"
              min="1"
              max="20"
              value={periodCount}
              onChange={(e) => setPeriodCount(e.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="bell-card">
        <div className="bell-section-heading">
          <h2>3. Break Configuration</h2>
          <button className="bell-secondary-btn" onClick={addBreak}>
            + Add Break
          </button>
        </div>

        {breaks.map((item, index) => (
          <div className="break-item" key={item.id}>
            <div className="break-item-heading">
              <strong>Break {index + 1}</strong>
              <button
                className="bell-remove-btn"
                onClick={() => removeBreak(item.id)}
              >
                Remove
              </button>
            </div>

            <div className="bell-grid">
              <label>
                Break Name
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) =>
                    updateBreak(item.id, "name", e.target.value)
                  }
                  placeholder="e.g. Lunch Break"
                />
              </label>

              <label>
                Break Starting Time
                <input
                  type="time"
                  value={item.start}
                  onChange={(e) =>
                    updateBreak(item.id, "start", e.target.value)
                  }
                />
              </label>

              <label>
                Duration (minutes)
                <input
                  type="number"
                  min="1"
                  value={item.duration}
                  onChange={(e) =>
                    updateBreak(item.id, "duration", e.target.value)
                  }
                />
              </label>
            </div>
          </div>
        ))}

        {breaks.length === 0 && (
          <p className="bell-muted">No breaks added yet.</p>
        )}
      </section>

      <button className="bell-generate-btn" onClick={generateSchedule}>
        Generate Bell Schedule
      </button>

      {message && (
        <div
          className={`bell-message ${
            schedule.length > 0 ? "success" : "error"
          }`}
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
              <strong>{periodCount}</strong>
            </div>
            <div>
              <span>Breaks</span>
              <strong>{breaks.length}</strong>
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
                  <th>Slot</th>
                  <th>Starting Time</th>
                  <th>Ending Time</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((item, index) => (
                  <tr
                    key={index}
                    className={item.type === "break" ? "break-row" : ""}
                  >
                    <td>{item.name}</td>
                    <td>{displayTime(item.start)}</td>
                    <td>{displayTime(item.end)}</td>
                    <td>
                      {toMinutes(item.end) >= toMinutes(item.start)
                        ? toMinutes(item.end) - toMinutes(item.start)
                        : 0}{" "}
                      min
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
  className="bell-secondary-btn"
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
