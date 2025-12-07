"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Medicine = {
  name: string;
  dose?: string;
  time: string;
  notes?: string;
};

const STORAGE_KEY = "medicine_reminders_v1";

const formatTime = (time: string) => {
  if (!time) return "";
  const [hourStr, minute] = time.split(":");
  const hour = Number(hourStr);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = ((hour + 11) % 12) + 1;
  return `${displayHour.toString().padStart(2, "0")}:${minute} ${suffix}`;
};

const loadMedicines = (): Medicine[] => {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        name: typeof item.name === "string" ? item.name : "",
        dose: typeof item.dose === "string" ? item.dose : undefined,
        time: typeof item.time === "string" ? item.time : "",
        notes: typeof item.notes === "string" ? item.notes : undefined,
      }))
      .filter((item) => item.name && item.time);
  } catch (error) {
    console.warn("Unable to read medicines from storage, resetting.", error);
    return [];
  }
};

export default function Home() {
  // Do NOT read localStorage during initial render — start with empty array to match SSR.
  const [medicines, setMedicines] = useState<Medicine[]>([]);

  // Track if component has mounted on the client.
  const [mounted, setMounted] = useState(false);

  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Load medicines from localStorage after mount (client-only).
  useEffect(() => {
    const stored = loadMedicines();
    setMedicines(stored);
    setMounted(true);
  }, []);

  // Persist to localStorage only after we've mounted and loaded the real data.
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(medicines));
    } catch (error) {
      console.warn("Unable to persist medicines:", error);
    }
  }, [medicines, mounted]);

  const todaysSchedule = useMemo(
    () => [...medicines].sort((a, b) => a.time.localeCompare(b.time)),
    [medicines]
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedTime = time.trim();

    if (!trimmedName || !trimmedTime) {
      setError("Name and Time are required.");
      return;
    }

    const newMedicine: Medicine = {
      name: trimmedName,
      dose: dose.trim() || undefined,
      time: trimmedTime,
      notes: notes.trim() || undefined,
    };

    setMedicines((prev) => [...prev, newMedicine]);
    setName("");
    setDose("");
    setTime("");
    setNotes("");
    setError(null);
  };

  return (
    <main className="container py-5">
      <div className="text-center text-md-start mb-5">
        <p className="text-uppercase fw-semibold text-primary mb-2 small">
          Medicine Reminder
        </p>
        <h1 className="display-5 fw-semibold mb-2">Keep your doses on track</h1>
        <p className="text-secondary mb-0">
          Add new medicines, check what&apos;s due today, and keep a simple list
          of everything you take.
        </p>
      </div>

      <div className="row g-4">
        <div className="col-12 col-lg-6">
          <div className="card h-100 shadow-sm border-0">
            <div className="card-body">
              <h2 className="h5 fw-semibold mb-3">Add Medicine</h2>
              <form className="row g-3" onSubmit={handleSubmit} noValidate>
                {error && (
                  <div className="col-12">
                    <div className="alert alert-danger mb-0 py-2">{error}</div>
                  </div>
                )}
                <div className="col-sm-6">
                  <label htmlFor="med-name" className="form-label">
                    Name
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="med-name"
                    placeholder="e.g. Aspirin"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="col-sm-6">
                  <label htmlFor="med-dose" className="form-label">
                    Dose
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="med-dose"
                    placeholder="e.g. 75 mg"
                    value={dose}
                    onChange={(e) => setDose(e.target.value)}
                  />
                </div>
                <div className="col-sm-6">
                  <label htmlFor="med-time" className="form-label">
                    Time
                  </label>
                  <input
                    type="time"
                    className="form-control"
                    id="med-time"
                    placeholder="08:00"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required
                  />
                </div>
                <div className="col-sm-6">
                  <label htmlFor="med-notes" className="form-label">
                    Notes
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="med-notes"
                    placeholder="e.g. With food"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <div className="col-12">
                  <button type="submit" className="btn btn-primary px-4">
                    Save medicine
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="card h-100 shadow-sm border-0">
            <div className="card-body">
              <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2 mb-3">
                <h2 className="h5 fw-semibold mb-0">Today&apos;s Schedule</h2>
                <span className="badge bg-success-subtle text-success border border-success-subtle">
                  {todaysSchedule.length} due
                </span>
              </div>
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Dose</th>
                      <th scope="col">Time</th>
                      <th scope="col">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todaysSchedule.map((item) => (
                      <tr key={`${item.name}-${item.time}-${item.notes ?? ""}`}>
                        <td className="fw-semibold">{item.name}</td>
                        <td>{item.dose}</td>
                        <td>{formatTime(item.time)}</td>
                        <td className="text-secondary">{item.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12">
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2 mb-3">
                <h2 className="h5 fw-semibold mb-0">All Medicines</h2>
                <span className="text-secondary small">
                  Quick reference list of everything on file
                </span>
              </div>
              <div className="d-flex flex-wrap gap-2">
                {medicines.map((med) => (
                  <div
                    key={med.name}
                    className="border rounded-3 px-3 py-2 bg-light d-flex flex-column"
                    style={{ minWidth: "170px" }}
                  >
                    <span className="fw-semibold">{med.name}</span>
                    <span className="text-secondary small">{med.dose}</span>
                    <span className="text-secondary small">
                      {med.time ? formatTime(med.time) : ""}
                    </span>
                    <span className="text-secondary small">{med.notes}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
