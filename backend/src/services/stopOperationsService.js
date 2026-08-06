// Business logic for service-stop operations (arrivals, departures, passes and
// delay propagation). Kept separate from db.js: this module owns the *policy*
// (how delays are computed and propagated, when a service completes), while
// db.js remains a pure data-access layer. Dependencies are injected so the
// service is decoupled from how the data layer is structured.

export default class StopOperationsService {
  constructor({ db, serviceStops, serviceEvents, services }) {
    this.db = db;
    this.serviceStops = serviceStops;
    this.serviceEvents = serviceEvents;
    this.services = services;
  }

  markArrival(id, actualTime, platform) {
    const cur = this.serviceStops.get(id);
    if (!cur) return null;

    const delayMinutes = this._computeDelayMinutes(cur.arrival_scheduled, actualTime);

    this.db.transaction(() => {
      this.db
        .prepare(
          `
          UPDATE service_stops 
          SET state = 'Arrived', arrival_actual = ?, delay_minutes = ?, 
              arrival_expected = ?, platform = ?, updated_at = datetime('now')
          WHERE id = ?
        `,
        )
        .run(actualTime, delayMinutes, actualTime, platform !== undefined ? platform : cur.platform, id);

      if (delayMinutes > 0) {
        this._propagateDelay(cur.service_id, cur.stop_number, delayMinutes);
      }

      this.serviceEvents.log(cur.service_id, id, "stop_arrival", { actual_time: actualTime, delay_minutes: delayMinutes });
    })();

    return this.serviceStops.get(id);
  }

  markDeparture(id, actualTime) {
    const cur = this.serviceStops.get(id);
    if (!cur) return null;

    this.db.transaction(() => {
      this.db
        .prepare(
          `
          UPDATE service_stops 
          SET state = 'Departed', departure_actual = ?, updated_at = datetime('now')
          WHERE id = ?
        `,
        )
        .run(actualTime, id);

      const maxStop = this.db
        .prepare("SELECT MAX(stop_number) as max_num FROM service_stops WHERE service_id = ?")
        .get(cur.service_id);

      if (cur.stop_number === maxStop.max_num) {
        this.services.complete(cur.service_id);
      } else {
        this.db
          .prepare(
            `
            UPDATE services 
            SET status = 'In Progress', started_at = CASE WHEN started_at IS NULL THEN datetime('now') ELSE started_at END
            WHERE id = ?
          `,
          )
          .run(cur.service_id);
      }

      this.serviceEvents.log(cur.service_id, id, "stop_departure", { actual_time: actualTime });
    })();

    return this.serviceStops.get(id);
  }

  markPass(id, actualTime) {
    const cur = this.serviceStops.get(id);
    if (!cur) return null;

    this.db
      .prepare(
        `
        UPDATE service_stops 
        SET state = 'Passed', arrival_actual = ?, departure_actual = ?, updated_at = datetime('now')
        WHERE id = ?
      `,
      )
      .run(actualTime, actualTime, id);

    this.serviceEvents.log(cur.service_id, id, "stop_passed", { actual_time: actualTime });
    return this.serviceStops.get(id);
  }

  addDelay(id, minutes, reason) {
    const cur = this.serviceStops.get(id);
    if (!cur) return null;

    this.db.transaction(() => {
      const newDelay = (cur.delay_minutes || 0) + minutes;
      this.db
        .prepare(
          `
          UPDATE service_stops 
          SET delay_minutes = ?,
              arrival_expected = datetime(arrival_expected, '+' || ? || ' minutes'),
              departure_expected = datetime(departure_expected, '+' || ? || ' minutes'),
              updated_at = datetime('now')
          WHERE id = ?
        `,
        )
        .run(newDelay, minutes, minutes, id);

      if (minutes !== 0) {
        this._propagateDelay(cur.service_id, cur.stop_number, minutes);
      }

      this.serviceEvents.log(cur.service_id, id, "delay_added", { minutes, reason, affected_stops: "see DB" });
    })();

    return this.serviceStops.get(id);
  }

  // ---- helpers ----

  _computeDelayMinutes(scheduledISO, actualTime) {
    if (!scheduledISO) return 0;
    const scheduled = new Date(scheduledISO).getTime();
    const actual = new Date(actualTime).getTime();
    if (Number.isNaN(scheduled) || Number.isNaN(actual)) return 0;
    return Math.max(0, Math.round((actual - scheduled) / 60000));
  }

  // Advances arrival_expected/departure_expected of subsequent (unlocked) stops.
  _propagateDelay(serviceId, stopNumber, minutes) {
    this.db
      .prepare(
        `
        UPDATE service_stops 
        SET delay_minutes = delay_minutes + ?,
            arrival_expected = datetime(arrival_expected, '+' || ? || ' minutes'),
            departure_expected = datetime(departure_expected, '+' || ? || ' minutes'),
            updated_at = datetime('now')
        WHERE service_id = ? 
          AND stop_number > ?
          AND delay_locked = 0
      `,
      )
      .run(minutes, minutes, minutes, serviceId, stopNumber);
  }
}