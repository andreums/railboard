const EVENT_TYPES = {
  TRAIN_ANNOUNCEMENT: "TRAIN_ANNOUNCEMENT",
  COMPACT_SERVICE_ANNOUNCEMENT: "COMPACT_SERVICE_ANNOUNCEMENT",
  TRAIN_APPROACHING: "TRAIN_APPROACHING",
  TRAIN_ARRIVING: "TRAIN_ARRIVING",
  TRAIN_AT_PLATFORM: "TRAIN_AT_PLATFORM",
  TRAIN_STANDING_BY: "TRAIN_STANDING_BY",
  TRAIN_READY_FOR_BOARDING: "TRAIN_READY_FOR_BOARDING",
  TRAIN_BOARDING: "TRAIN_BOARDING",
  TRAIN_READY_TO_DEPART: "TRAIN_READY_TO_DEPART",
  TRAIN_IMMINENT_DEPARTURE: "TRAIN_IMMINENT_DEPARTURE",
  TRAIN_DEPARTING: "TRAIN_DEPARTING",
  TRAIN_DEPARTED: "TRAIN_DEPARTED",
  PLATFORM_CHANGE: "PLATFORM_CHANGE",
  TRAIN_DELAYED: "TRAIN_DELAYED",
  TRAIN_CANCELLED: "TRAIN_CANCELLED",
  TRAIN_TERMINATES_HERE: "TRAIN_TERMINATES_HERE",
  SERVICE_DISRUPTION: "SERVICE_DISRUPTION",
  GENERAL_INFORMATION: "GENERAL_INFORMATION",
  LONG_DISTANCE_DEPARTURE_ANNOUNCEMENT: "LONG_DISTANCE_DEPARTURE_ANNOUNCEMENT",
  LONG_DISTANCE_BOARDING: "LONG_DISTANCE_BOARDING",
  LONG_DISTANCE_READY_TO_DEPART: "LONG_DISTANCE_READY_TO_DEPART",
  LONG_DISTANCE_IMMINENT_DEPARTURE: "LONG_DISTANCE_IMMINENT_DEPARTURE",
};

const EVENT_PRIORITIES = {
  TRAIN_ANNOUNCEMENT: "NORMAL",
  COMPACT_SERVICE_ANNOUNCEMENT: "NORMAL",
  TRAIN_APPROACHING: "NORMAL",
  TRAIN_ARRIVING: "NORMAL",
  TRAIN_AT_PLATFORM: "NORMAL",
  TRAIN_STANDING_BY: "LOW",
  TRAIN_READY_FOR_BOARDING: "NORMAL",
  TRAIN_BOARDING: "NORMAL",
  TRAIN_READY_TO_DEPART: "NORMAL",
  TRAIN_IMMINENT_DEPARTURE: "HIGH",
  TRAIN_DEPARTING: "NORMAL",
  TRAIN_DEPARTED: "NORMAL",
  PLATFORM_CHANGE: "HIGH",
  TRAIN_DELAYED: "NORMAL",
  TRAIN_CANCELLED: "HIGH",
  TRAIN_TERMINATES_HERE: "NORMAL",
  SERVICE_DISRUPTION: "HIGH",
  GENERAL_INFORMATION: "LOW",
  LONG_DISTANCE_DEPARTURE_ANNOUNCEMENT: "NORMAL",
  LONG_DISTANCE_BOARDING: "NORMAL",
  LONG_DISTANCE_READY_TO_DEPART: "NORMAL",
  LONG_DISTANCE_IMMINENT_DEPARTURE: "HIGH",
};

const isLongDistance = (train) => /^(AVE|ALVIA|EUROMED|INTERCITY|IC|AVLO|IRYO|OUIGO|LARGA\s*DISTANCIA)/i.test(train.type_code || train.type_name || "");

export function detectEvent(train, previousTrain) {
  if (!train) return null;

  const events = [];

  if (isLongDistance(train)) {
    if (!previousTrain) {
      events.push({ eventType: EVENT_TYPES.LONG_DISTANCE_DEPARTURE_ANNOUNCEMENT, train });
    } else if (previousTrain.status !== "Boarding" && train.status === "Boarding") {
      events.push({ eventType: EVENT_TYPES.LONG_DISTANCE_BOARDING, train });
    } else if (previousTrain.status !== "Departed" && train.status === "Departed") {
      events.push({ eventType: EVENT_TYPES.LONG_DISTANCE_IMMINENT_DEPARTURE, train });
    }
  }

  if (train.status === "Cancelled") {
    events.push({ eventType: EVENT_TYPES.TRAIN_CANCELLED, train });
    return events;
  }

  if (previousTrain) {
    if (previousTrain.platform !== train.platform || previousTrain.sector !== train.sector) {
      events.push({ eventType: EVENT_TYPES.PLATFORM_CHANGE, train });
    }

    const prevDelay = previousTrain.delay_minutes || previousTrain.delay || 0;
    const currDelay = train.delay_minutes || train.delay || 0;
    if (currDelay > 0 && currDelay !== prevDelay) {
      events.push({ eventType: EVENT_TYPES.TRAIN_DELAYED, train });
    }

    if (previousTrain.status !== train.status) {
      switch (train.status) {
        case "Approaching":
          events.push({ eventType: EVENT_TYPES.TRAIN_APPROACHING, train });
          break;
        case "Arriving":
          events.push({ eventType: EVENT_TYPES.TRAIN_ARRIVING, train });
          break;
        case "Arrived":
          events.push({ eventType: EVENT_TYPES.TRAIN_AT_PLATFORM, train });
          break;
        case "Standing":
          events.push({ eventType: EVENT_TYPES.TRAIN_STANDING_BY, train });
          break;
        case "Boarding":
          events.push({ eventType: EVENT_TYPES.TRAIN_BOARDING, train });
          break;
        case "ReadyToDepart":
          events.push({ eventType: EVENT_TYPES.TRAIN_READY_TO_DEPART, train });
          break;
        case "ImminentDeparture":
          events.push({ eventType: EVENT_TYPES.TRAIN_IMMINENT_DEPARTURE, train });
          break;
        case "Departing":
          events.push({ eventType: EVENT_TYPES.TRAIN_DEPARTING, train });
          break;
        case "Departed":
          events.push({ eventType: EVENT_TYPES.TRAIN_DEPARTED, train });
          break;
      }
    }
  } else {
    if (train.status === "Boarding" || train.status === "Standing") {
      events.push({ eventType: EVENT_TYPES.TRAIN_STANDING_BY, train });
    } else {
      events.push({ eventType: EVENT_TYPES.TRAIN_ANNOUNCEMENT, train });
    }
  }

  return events;
}

export function detectServiceEvent(service, previousService) {
  if (!service) return null;

  if (service.status === "Cancelled") {
    return { eventType: EVENT_TYPES.TRAIN_CANCELLED, train: service };
  }

  if (previousService && previousService.status !== service.status) {
    if (service.status === "In Progress") {
      return { eventType: EVENT_TYPES.TRAIN_DEPARTED, train: service };
    }
    if (service.status === "Completed") {
      return { eventType: EVENT_TYPES.TRAIN_TERMINATES_HERE, train: service };
    }
  }

  return null;
}

export function detectStopEvent(stop, previousStop) {
  if (!stop) return null;

  if (previousStop && previousStop.state !== stop.state) {
    switch (stop.state) {
      case "Arrived":
        return { eventType: EVENT_TYPES.TRAIN_AT_PLATFORM, train: stop };
      case "Departed":
        return { eventType: EVENT_TYPES.TRAIN_DEPARTED, train: stop };
      case "Cancelled":
        return { eventType: EVENT_TYPES.TRAIN_CANCELLED, train: stop };
    }
  }

  return null;
}

export function getEventPriority(eventType) {
  return EVENT_PRIORITIES[eventType] || "NORMAL";
}

export function getEventTypes() {
  return Object.values(EVENT_TYPES);
}
