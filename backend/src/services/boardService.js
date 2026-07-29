import { stations, listTrains, getStationDisplayConfig, services, serviceStops, operators, trainTypes, places } from "../db.js";

export function buildStationBoard(stationId, mode = "departures") {
  const station = stations.list().find((s) => s.id === Number(stationId));
  if (!station) return null;

  const stationConfig = getStationDisplayConfig(station.id);

  // Legacy: Get trains from old table
  const trains = listTrains(Number(stationId));

  // New: Get services with stops at this station
  const allServices = services.list();
  const servicesWithStops = allServices
    .map((svc) => {
      const stops = serviceStops.listByService(svc.id);
      return { service: svc, stops };
    })
    .filter(({ stops }) => stops.some((s) => s.station_id === Number(stationId)))
    .map(({ service, stops }) => {
      const stopAtStation = stops.find((s) => s.station_id === Number(stationId));
      return {
        ...service,
        stop_here: stopAtStation,
        all_stops: stops,
      };
    });

  // Filter by mode if provided
  const filtered =
    mode !== "all"
      ? {
          mode,
          trains: trains.filter((t) => t.status !== "Cancelled"),
          services: servicesWithStops.filter((s) => s.status !== "Cancelled"),
        }
      : {
          mode: "all",
          trains,
          services: servicesWithStops,
        };

  // Normalize trains to board row format
  const normalizedTrains = filtered.trains.map((train) => ({
    stopId: train.id,
    serviceId: train.id,
    number: train.number,
    number2: train.number2 || null,
    operatorName: train.operator_name || "",
    operatorLogo: train.operator_logo || null,
    trainTypeCode: train.type_code || "",
    trainTypeName: train.type_name || "",
    trainTypeColor: train.type_color || null,
    trainTypeLogo: train.type_logo || (train.train_type_id ? trainTypes.list().find((t) => t.id === train.train_type_id)?.logo_url : null) || null,
    trainTypeDestinationIcon: train.type_destination_icon || null,
    iconMode: train.icon_mode || "destination",
    customIcon: train.custom_icon_url || null,
    destination: train.destination || "—",
    destination2: train.destination2 || null,
    origin: train.origin || "—",
    stopsText: train.stops && train.stops.length > 0 ? train.stops.join(" · ") : "",
    time: train.scheduled_time || "—",
    expectedTime: train.expected_time || train.scheduled_time || "—",
    delayMinutes: 0,
    platform: train.platform || "?",
    sector: train.sector || "",
    status: train.status || "Scheduled",
    notes: train.observations || "",
    fareRestrictions: train.fare_restrictions || null,
  }));

  // Normalize services to board row format
  const normalizedServices = filtered.services.map((svc) => {
    const stopAtStation = svc.stop_here;
    const stopsText = svc.all_stops
      .sort((a, b) => (a.stop_order || 0) - (b.stop_order || 0))
      .map((s) => {
        const st = stations.list().find((x) => x.id === s.station_id);
        return st?.name || "?";
      })
      .join(" · ");

    const trainType = svc.train_type_id ? trainTypes.list().find((t) => t.id === svc.train_type_id) : null;
    return {
      stopId: svc.id,
      serviceId: svc.id,
      number: svc.number || "?",
      operatorName: svc.operator_id ? operators.list().find((o) => o.id === svc.operator_id)?.name || "" : "",
      operatorLogo: svc.operator_logo || null,
      trainTypeCode: trainType?.code || "",
      trainTypeName: trainType?.name || "",
      trainTypeColor: trainType?.color || null,
      trainTypeLogo: svc.train_type_logo || trainType?.logo_url || null,
      trainTypeDestinationIcon: trainType?.destination_icon_url || null,
      destination: svc.destination_place_id ? places.list().find((p) => p.id === svc.destination_place_id)?.name || "—" : "—",
      origin: svc.origin_place_id ? places.list().find((p) => p.id === svc.origin_place_id)?.name || "—" : "—",
      stopsText: stopsText,
      time: stopAtStation?.scheduled_time || "—",
      expectedTime: stopAtStation?.expected_time || stopAtStation?.scheduled_time || "—",
      platform: stopAtStation?.platform || "?",
      sector: stopAtStation?.sector || "",
      status: svc.status || "Scheduled",
      notes: svc.notes || "",
    };
  });

  return {
    status: "ok",
    station: {
      id: station.id,
      name: station.name,
      displayName: stationConfig?.station_name || station.display_name || station.name,
    },
    mode: filtered.mode,
    timestamp: Date.now(),
    rows: [...normalizedTrains, ...normalizedServices],
  };
}
