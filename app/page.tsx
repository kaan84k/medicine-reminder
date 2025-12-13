"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Medicine = {
  id: string;
  name: string;
  dose: string | null;
  time: string;
  notes: string | null;
};

type Reminder = {
  id: string;
  medicineId: string;
  date: string;
  status: "Pending" | "Taken";
  medicine: Medicine;
};

const formatTime = (time: string) => {
  if (!time) return "";
  const [hourStr, minute] = time.split(":");
  const hour = Number(hourStr);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = ((hour + 11) % 12) + 1;
  return `${displayHour.toString().padStart(2, "0")}:${minute} ${suffix}`;
};

const statusBadge = (status: Reminder["status"]) =>
  status === "Taken"
    ? "badge bg-success-subtle text-success border border-success-subtle"
    : "badge bg-secondary-subtle text-secondary border border-secondary-subtle";

const normalizeError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unexpected error occurred.";
};

export default function Home() {
  const router = useRouter();
  const [session, setSession] = useState<{ sub: string; email: string } | null>(null);

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const sortedSchedule = useMemo(
    () =>
      [...reminders].sort((a, b) => {
        return a.medicine.time.localeCompare(b.medicine.time);
      }),
    [reminders]
  );

  const isSignedIn = Boolean(session);

  const fetchJson = useCallback(
    async <T,>(input: RequestInfo | URL, init?: RequestInit) => {
      const response = await fetch(input, {
        ...init,
        headers: {
          "content-type": "application/json",
          ...(init?.headers || {}),
        },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const errorMessage =
          typeof body.error === "string" ? body.error : response.statusText;
        throw new Error(errorMessage);
      }

      return (await response.json()) as T;
    },
    []
  );

  const loadSession = useCallback(async () => {
    try {
      const data = await fetchJson<{ session: { sub: string; email: string } }>(
        "/api/auth"
      );
      setSession(data.session);
      return true;
    } catch {
      setSession(null);
      return false;
    }
  }, [fetchJson]);

  const loadData = useCallback(async () => {
    setDataLoading(true);
    setDataError(null);
    try {
      const [medsResp, remindersResp] = await Promise.all([
        fetchJson<{ medicines: Medicine[] }>("/api/medicines"),
        fetchJson<{ date: string; reminders: Reminder[] }>("/api/reminders/today"),
      ]);
      setMedicines(medsResp.medicines);
      setReminders(remindersResp.reminders);
    } catch (error) {
      setDataError(normalizeError(error));
    } finally {
      setDataLoading(false);
    }
  }, [fetchJson]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedTime = time.trim();

    if (!trimmedName || !trimmedTime) {
      setFormError("Name and Time are required.");
      return;
    }

    try {
      await fetchJson("/api/medicines", {
        method: "POST",
        body: JSON.stringify({
          name: trimmedName,
          time: trimmedTime,
          dose: dose.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      setName("");
      setDose("");
      setTime("");
      setNotes("");
      setFormError(null);
      await loadData();
    } catch (error) {
      setFormError(normalizeError(error));
    }
  };

  const toggleStatus = async (reminderId: string) => {
    const reminder = reminders.find((item) => item.id === reminderId);
    if (!reminder) return;
    const nextStatus = reminder.status === "Taken" ? "Pending" : "Taken";
    try {
      const updated = await fetchJson<Reminder>(`/api/reminders/${reminderId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setReminders((prev) =>
        prev.map((item) => (item.id === reminderId ? updated : item))
      );
    } catch (error) {
      setDataError(normalizeError(error));
    }
  };

  const deleteMedicine = async (id: string) => {
    try {
      await fetchJson(`/api/medicines/${id}`, { method: "DELETE" });
      setMedicines((prev) => prev.filter((item) => item.id !== id));
      setReminders((prev) => prev.filter((item) => item.medicineId !== id));
    } catch (error) {
      setDataError(normalizeError(error));
    }
  };

  useEffect(() => {
    (async () => {
      const hasSession = await loadSession();
      if (hasSession) {
        await loadData();
      } else {
        router.replace("/login");
      }
    })();
  }, [loadData, loadSession, router]);

  return (
    <main className="container py-5">
      <div className="text-center text-md-start mb-5">
        <p className="text-uppercase fw-semibold text-primary mb-2 small">
          Medicine Reminder
        </p>
        <h1 className="display-5 fw-semibold mb-2">Keep your doses on track</h1>
        <p className="text-secondary mb-0">
          Add new medicines, check what&apos;s due today, and keep a simple list of
          everything you take.
        </p>
      </div>

      <div className="row g-4">
        <div className="col-12 col-lg-6">
          <div className="card h-100 shadow-sm border-0">
            <div className="card-body">
              <h2 className="h5 fw-semibold mb-3">Add Medicine</h2>
              <form className="row g-3" onSubmit={handleSubmit} noValidate>
                {formError && (
                  <div className="col-12">
                    <div className="alert alert-danger mb-0 py-2" role="alert">
                      {formError}
                    </div>
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
                    autoComplete="off"
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
                    autoComplete="off"
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
                    autoComplete="off"
                  />
                </div>
                <div className="col-12">
                  <button
                    type="submit"
                    className="btn btn-primary px-4 w-100 w-sm-auto"
                    disabled={!isSignedIn}
                  >
                    Save medicine
                  </button>
                </div>
              </form>
              {!isSignedIn && (
                <p className="text-secondary small mb-0 mt-2">
                  You must sign in to add medicines. Redirecting to login...
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="card h-100 shadow-sm border-0">
            <div className="card-body">
              <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2 mb-3">
                <h2 className="h5 fw-semibold mb-0">Today&apos;s Schedule</h2>
                <span className="badge bg-success-subtle text-success border border-success-subtle">
                  {sortedSchedule.length} due
                </span>
              </div>
              {!isSignedIn && (
                <div className="alert alert-warning py-2">
                  Sign in to load today&apos;s reminders.
                </div>
              )}
              {dataError && <div className="alert alert-danger py-2">{dataError}</div>}
              {dataLoading ? (
                <div className="text-secondary">Loading your schedule...</div>
              ) : sortedSchedule.length === 0 ? (
                <div className="text-secondary">No medicines scheduled yet.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th scope="col">Name</th>
                        <th scope="col">Dose</th>
                        <th scope="col">Time</th>
                        <th scope="col">Notes</th>
                        <th scope="col">Status</th>
                        <th scope="col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedSchedule.map((item) => (
                        <tr key={item.id}>
                          <td className="fw-semibold">{item.medicine.name}</td>
                          <td>{item.medicine.dose}</td>
                          <td>{formatTime(item.medicine.time)}</td>
                          <td className="text-secondary">{item.medicine.notes}</td>
                          <td>
                            <span className={statusBadge(item.status)}>
                              {item.status}
                            </span>
                          </td>
                          <td>
                            <div className="d-flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => toggleStatus(item.id)}
                              >
                                {item.status === "Taken" ? "Mark Pending" : "Mark Taken"}
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => deleteMedicine(item.medicineId)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
                {dataLoading ? (
                  <span className="text-secondary">Loading your medicines...</span>
                ) : medicines.length === 0 ? (
                  <span className="text-secondary">
                    Nothing here yet. Add your first medicine to get started.
                  </span>
                ) : (
                  medicines.map((med) => (
                    <div
                      key={med.id}
                      className="border rounded-3 px-3 py-2 bg-light d-flex flex-column"
                      style={{ minWidth: "170px" }}
                    >
                      <span className="fw-semibold">{med.name}</span>
                      <span className="text-secondary small">{med.dose}</span>
                      <span className="text-secondary small">
                        {med.time ? formatTime(med.time) : ""}
                      </span>
                      <span className="text-secondary small">{med.notes}</span>
                      <button
                        type="button"
                        className="btn btn-link text-danger p-0 mt-2 align-self-start"
                        onClick={() => deleteMedicine(med.id)}
                      >
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
