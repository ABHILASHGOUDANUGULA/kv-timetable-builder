import "../styles/bell-schedule.css";
import { useEffect, useRef, useState } from "react";

const toMinutes = (time) => {
  if (!time) return 0;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const toTime = (minutes) => {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const displayTime = (time) => {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const dh = h % 12 || 12;
  return `${dh}:${String(m).padStart(2, "0")} ${suffix}`;
};

function BellSchedule({ project, onSave }) {
  const saved = project?.data?.bellSchedule || {};
  const onSaveRef = useRef(onSave);

  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

  const [schoolStart, setSchoolStart] = useState(() => saved.schoolStart ?? "08:10");
  const [assemblyEnabled, setAssemblyEnabled] = useState(() => saved.assemblyEnabled ?? true);
  const [assemblyStart, setAssemblyStart] = useState(() => saved.assemblyStart ?? "08:20");
  const [assemblyEnd, setAssemblyEnd] = useState(() => saved.assemblyEnd ?? "08:50");
  const [firstPeriodStart, setFirstPeriodStart] = useState(() => saved.firstPeriodStart ?? "08:50");
  const [periodDuration, setPeriodDuration] = useState(() => saved.periodDuration ?? 40);
  const [periodCount, setPeriodCount] = useState(() => saved.periodCount ?? 8);
  const [breaks, setBreaks] = useState(() => saved.breaks ?? [
    { id: 1, name: "Short Break", start: "10:10", duration: 20 },
    { id: 2, name: "Lunch Break", start: "12:30", duration: 30 },
  ]);
  const [schedule, setSchedule] = useState(() => saved.schedule ?? []);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const s = project?.data?.bellSchedule || {};
    setSchoolStart(s.schoolStart ?? "08:10");
    setAssemblyEnabled(s.assemblyEnabled ?? true);
    setAssemblyStart(s.assemblyStart ?? "08:20");
    setAssemblyEnd(s.assemblyEnd ?? "08:50");
    setFirstPeriodStart(s.firstPeriodStart ?? "08:50");
    setPeriodDuration(s.periodDuration ?? 40);
    setPeriodCount(s.periodCount ?? 8);
    setBreaks(s.breaks ?? [
      { id: 1, name: "Short Break", start: "10:10", duration: 20 },
      { id: 2, name: "Lunch Break", start: "12:30", duration: 30 },
    ]);
    setSchedule(s.schedule ?? []);
    setMessage("");
  }, [project?.id]);

  useEffect(() => {
    const t = setTimeout(() => {
      onSaveRef.current?.({
        schoolStart, assemblyEnabled, assemblyStart, assemblyEnd,
        firstPeriodStart,
        periodDuration: Number(periodDuration),
        periodCount: Number(periodCount),
        breaks, schedule,
      });
    }, 500);
    return () => clearTimeout(t);
  }, [project?.id, schoolStart, assemblyEnabled, assemblyStart, assemblyEnd,
    firstPeriodStart, periodDuration, periodCount, breaks, schedule]);

  const addBreak = () => {
    setBreaks((p) => [...p, { id: Date.now(), name: `Break ${p.length + 1}`, start: "", duration: 15 }]);
    setSchedule([]); setMessage("");
  };

  const updateBreak = (id, field, value) => {
    setBreaks((p) => p.map((it) => it.id === id ? { ...it, [field]: value } : it));
    setSchedule([]); setMessage("");
  };

  const removeBreak = (id) => {
    setBreaks((p) => p.filter((it) => it.id !== id));
    setSchedule([]); setMessage("");
  };

  const generateSchedule = () => {
    const start = toMinutes(firstPeriodStart);
    const duration = Number(periodDuration);
    const count = Number(periodCount);

    if (!firstPeriodStart || !duration || duration < 1 || !count || count < 1) {
      setMessage("Please enter a valid first period time, duration and period count.");
      setSchedule([]); return;
    }

    if (assemblyEnabled) {
      const school = toMinutes(schoolStart);
      const aFrom = toMinutes(assemblyStart);
      const aTo = toMinutes(assemblyEnd);
      if (!schoolStart || !assemblyStart || !assemblyEnd ||
          aFrom < school || aTo <= aFrom || aTo > start) {
        setMessage("Please check the school opening, assembly and first-period timings.");
        setSchedule([]); return;
      }
    }

    const preparedBreaks = breaks.map((it) => ({
      ...it, startMinutes: toMinutes(it.start), duration: Number(it.duration),
    }));

    if (preparedBreaks.some((it) => !it.start || !it.duration || it.duration < 1)) {
      setMessage("Enter a start time and a positive duration for every break.");
      setSchedule([]); return;
    }

    preparedBreaks.sort((a, b) => a.startMinutes - b.startMinutes);

    for (let i = 1; i < preparedBreaks.length; i++) {
      const prev = preparedBreaks[i - 1];
      const cur = preparedBreaks[i];
      if (cur.startMinutes < prev.startMinutes + prev.duration) {
        setMessage(`${prev.name} and ${cur.name} overlap. Adjust the start times.`);
        setSchedule([]); return;
      }
    }

    let currentTime = start;
    let breakIndex = 0;
    const generated = [];

    // Include assembly as a first entry (this was the missing piece).
    if (assemblyEnabled) {
      generated.push({
        id: "assembly",
        type: "assembly",
        name: "Assembly / Prayer",
        start: assemblyStart,
        end: assemblyEnd,
      });
    }

    for (let period = 1; period <= count; period++) {
      const periodEnd = currentTime + duration;
      const nextBreak = preparedBreaks[breakIndex];

      if (nextBreak && nextBreak.startMinutes < periodEnd) {
        setMessage(
          `${nextBreak.name} must start at a period boundary. It currently falls inside Period ${period} or before it.`
        );
        setSchedule([]); return;
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
        `${preparedBreaks[breakIndex].name} does not fit within the teaching periods. Increase the number of periods or adjust the break time.`
      );
      setSchedule([]); return;
    }

    setSchedule(generated);
    setMessage("Bell schedule generated successfully.");
  };

  const closingTime = schedule.length > 0 ? schedule[schedule.length - 1].end : "";

  const printBellSchedule = () => {
    const card = document.querySelector(".bell-print-card");
    if (!card) { alert("Please generate the Bell Schedule first."); return; }
    const printWindow = window.open("", "_blank");
    if (!printWindow) { alert("Please allow pop-ups to print."); return; }

    printWindow.document.write(`
      <!DOCTYPE html><html><head><title>School Bell Schedule</title>
      <style>
        @page { size: A4 portrait; margin: 12mm; }
        body { font-family: Arial, sans-serif; color: #111; margin: 0; }
        .bell-print-header { display: block; text-align: center; margin-bottom: 20px; }
        .bell-print-header h1 { font-size: 20px; }
        .bell-print-header h2 { font-size: 16px; }
        .bell-summary { display: flex; gap: 12px; margin-bottom: 15px; }
        .bell-summary div { flex: 1; padding: 10px; border: 1px solid #ddd; }
        .bell-summary span, .bell-summary strong { display: block; margin-bottom: 5px; }
        .bell-table { width: 100%; border-collapse: collapse; }
        .bell-table th, .bell-table td { border: 1px solid #555; padding: 9px; font-size: 11px; text-align: left; }
        .bell-table th { background: #eee; }
        .break-row { background: #fff5df; font-weight: bold; }
        .assembly-row { background: #eef2ff; font-weight: bold; }
        .bell-valid, .bell-no-print { display: none !important; }
      </style></head><body>${card.innerHTML}</body></html>
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
          <label>School Opening Time
            <input type="time" value={schoolStart} onChange={(e) => setSchoolStart(e.target.value)} />
          </label>
          <label>First Period Starting Time
            <input type="time" value={firstPeriodStart} onChange={(e) => setFirstPeriodStart(e.target.value)} />
          </label>
        </div>
        <div className="bell-checkbox">
          <input type="checkbox" checked={assemblyEnabled} onChange={(e) => setAssemblyEnabled(e.target.checked)} id="assemblyEnabled" />
          <label htmlFor="assemblyEnabled">Include Assembly / Prayer</label>
        </div>
        {assemblyEnabled && (
          <div className="bell-grid">
            <label>Assembly Starting Time
              <input type="time" value={assemblyStart} onChange={(e) => setAssemblyStart(e.target.value)} />
            </label>
            <label>Assembly Ending Time
              <input type="time" value={assemblyEnd} onChange={(e) => setAssemblyEnd(e.target.value)} />
            </label>
          </div>
        )}
      </section>

      <section className="bell-card">
        <h2>2. Period Configuration</h2>
        <div className="bell-grid">
          <label>Duration of Each Period (minutes)
            <input type="number" min="1" value={periodDuration} onChange={(e) => setPeriodDuration(e.target.value)} />
          </label>
          <label>Number of Teaching Periods
            <input type="number" min="1" max="20" value={periodCount} onChange={(e) => setPeriodCount(e.target.value)} />
          </label>
        </div>
      </section>

      <section className="bell-card">
        <div className="bell-section-heading">
          <h2>3. Break Configuration</h2>
          <button className="bell-secondary-btn" onClick={addBreak}>+ Add Break</button>
        </div>
        {breaks.map((item, index) => (
          <div className="break-item" key={item.id}>
            <div className="break-item-heading">
              <strong>Break {index + 1}</strong>
              <button className="bell-remove-btn" onClick={() => removeBreak(item.id)}>Remove</button>
            </div>
            <div className="bell-grid">
              <label>Break Name
                <input type="text" value={item.name} onChange={(e) => updateBreak(item.id, "name", e.target.value)} />
              </label>
              <label>Break Starting Time
                <input type="time" value={item.start} onChange={(e) => updateBreak(item.id, "start", e.target.value)} />
              </label>
              <label>Duration (minutes)
                <input type="number" min="1" value={item.duration} onChange={(e) => updateBreak(item.id, "duration", e.target.value)} />
              </label>
            </div>
          </div>
        ))}
        {breaks.length === 0 && <p className="bell-muted">No breaks added yet.</p>}
      </section>

      <button className="bell-generate-btn" onClick={generateSchedule}>Generate Bell Schedule</button>

      {message && (
        <div className={`bell-message ${schedule.length > 0 ? "success" : "error"}`}>{message}</div>
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
            <div><span>Teaching Periods</span><strong>{periodCount}</strong></div>
            <div><span>Breaks</span><strong>{breaks.length}</strong></div>
            <div><span>School Closing</span><strong>{displayTime(closingTime)}</strong></div>
          </div>
          <div className="bell-table-wrap">
            <table className="bell-table">
              <thead>
                <tr><th>Slot</th><th>Starting Time</th><th>Ending Time</th><th>Duration</th></tr>
              </thead>
              <tbody>
                {schedule.map((item, index) => (
                  <tr key={index} className={
                    item.type === "break" ? "break-row" :
                    item.type === "assembly" ? "assembly-row" : ""
                  }>
                    <td>{item.name}</td>
                    <td>{displayTime(item.start)}</td>
                    <td>{displayTime(item.end)}</td>
                    <td>
                      {toMinutes(item.end) >= toMinutes(item.start)
                        ? toMinutes(item.end) - toMinutes(item.start)
                        : 0} min
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="bell-secondary-btn bell-no-print" onClick={printBellSchedule}>
            Print Bell Schedule
          </button>
        </section>
      )}
    </div>
  );
}

export default BellSchedule;