/**
 * Seed demo multistation services
 * Creates sample services with multiple stops across stations
 * Tests delay propagation and state management
 */

import { db, services, serviceStops, serviceEvents, places, operators, trainTypes, stations } from "../src/db.js";

console.log("🌱 Seeding multistation services demo...\n");

// Get or create demo data
const ops = operators.list();
const renfe = ops.find(o => o.name === "Renfe") || operators.create({ name: "Renfe" });

const types = trainTypes.list();
const ave = types.find(t => t.code === "AVE") || trainTypes.create({ code: "AVE", name: "AVE", color: "#A50073" });

const placesList = places.list();
const madrid = placesList.find(p => p.name === "Madrid") || places.create({ name: "Madrid" });
const barcelona = placesList.find(p => p.name === "Barcelona") || places.create({ name: "Barcelona" });
const valencia = placesList.find(p => p.name === "Valencia") || places.create({ name: "Valencia" });

const stationsList = stations.list();
const getMadridStation = () => stationsList.find(s => s.name.includes("Puerta")) || stationsList[0];
const getBarcelonaStation = () => stationsList.find(s => s.name.includes("Barcelona")) || stationsList[0];
const getValenciaStation = () => stationsList.find(s => s.name.includes("Valencia")) || stationsList[0];

// ========== SERVICE 1: Madrid → Barcelona (AVE) ==========
console.log("📍 Creating Service 1: Madrid → Barcelona (AVE)");
const svc1 = services.create({
    number: "AVE-001",
    operator_id: renfe.id,
    train_type_id: ave.id,
    origin_place_id: madrid.id,
    destination_place_id: barcelona.id,
    notes: "High-speed express service"
});

// Add stops for Service 1
const stops1 = [
    { station_id: getMadridStation().id, stop_number: 1, stop_type: "Origin", arrival_scheduled: "08:00", departure_scheduled: "08:00", platform: "1", sector: "A" },
    { station_id: getBarcelonaStation().id, stop_number: 2, stop_type: "Destination", arrival_scheduled: "11:30", departure_scheduled: null, platform: "5", sector: "B" },
];

stops1.forEach(stopData => {
    const stop = serviceStops.create({
        service_id: svc1.id,
        ...stopData,
        arrival_expected: stopData.arrival_scheduled,
        departure_expected: stopData.departure_scheduled,
    });
    console.log(`  ✓ Stop ${stopData.stop_number}: ${getStationName(stopData.station_id)} (${stopData.platform}/${stopData.sector})`);
});

// ========== SERVICE 2: Barcelona → Valencia (Regional) ==========
console.log("\n📍 Creating Service 2: Barcelona → Valencia (Regional)");
const regional = types.find(t => t.code === "R16") || trainTypes.create({ code: "R16", name: "Regional", color: "#B0003A" });

const svc2 = services.create({
    number: "R16-042",
    operator_id: renfe.id,
    train_type_id: regional.id,
    origin_place_id: barcelona.id,
    destination_place_id: valencia.id,
    notes: "Regional service with multiple stops"
});

const stops2 = [
    { station_id: getBarcelonaStation().id, stop_number: 1, stop_type: "Origin", arrival_scheduled: "09:00", departure_scheduled: "09:00", platform: "7", sector: "C" },
    { station_id: getBarcelonaStation().id, stop_number: 2, stop_type: "Stop", arrival_scheduled: "09:15", departure_scheduled: "09:20", platform: "7", sector: "C" },
    { station_id: getValenciaStation().id, stop_number: 3, stop_type: "Destination", arrival_scheduled: "12:45", departure_scheduled: null, platform: "3", sector: "A" },
];

stops2.forEach(stopData => {
    const stop = serviceStops.create({
        service_id: svc2.id,
        ...stopData,
        arrival_expected: stopData.arrival_scheduled,
        departure_expected: stopData.departure_scheduled,
    });
    console.log(`  ✓ Stop ${stopData.stop_number}: ${getStationName(stopData.station_id)} (${stopData.platform}/${stopData.sector})`);
});

// ========== SERVICE 3: Valencia → Barcelona (Commuter) ==========
console.log("\n📍 Creating Service 3: Valencia → Barcelona (Commuter)");
const cercanias = types.find(t => t.code === "C-5") || trainTypes.create({ code: "C-5", name: "Cercanías", color: "#00853F" });

const svc3 = services.create({
    number: "C5-128",
    operator_id: renfe.id,
    train_type_id: cercanias.id,
    origin_place_id: valencia.id,
    destination_place_id: barcelona.id,
    notes: "Commuter service - frequent stops"
});

const stops3 = [
    { station_id: getValenciaStation().id, stop_number: 1, stop_type: "Origin", arrival_scheduled: "06:30", departure_scheduled: "06:30", platform: "2", sector: "B" },
    { station_id: getBarcelonaStation().id, stop_number: 2, stop_type: "Destination", arrival_scheduled: "10:15", departure_scheduled: null, platform: "4", sector: "A" },
];

stops3.forEach(stopData => {
    const stop = serviceStops.create({
        service_id: svc3.id,
        ...stopData,
        arrival_expected: stopData.arrival_scheduled,
        departure_expected: stopData.departure_scheduled,
    });
    console.log(`  ✓ Stop ${stopData.stop_number}: ${getStationName(stopData.station_id)} (${stopData.platform}/${stopData.sector})`);
});

// ========== DEMO: Test delay propagation ==========
console.log("\n⏱️  Testing delay propagation...");
const svc1Stops = serviceStops.listByService(svc1.id);
const svc1Stop1 = svc1Stops[0];
console.log(`  Before: Stop 1 delay = ${svc1Stop1.delay_minutes} min`);

serviceStops.addDelay(svc1Stop1.id, 15, "Technical issue at Madrid");
const updated1 = serviceStops.get(svc1Stop1.id);
console.log(`  After:  Stop 1 delay = ${updated1.delay_minutes} min ✓`);

// ========== Display results ==========
console.log("\n" + "=".repeat(60));
console.log("✅ DEMO SERVICES CREATED\n");
console.log(`Service 1 (${svc1.number}): ${svc1.status}`);
console.log(`  ID: ${svc1.id}`);
console.log(`  ${svc1.operator_name} / ${svc1.train_type_name}`);
console.log(`  Stops: ${stops1.length}`);

console.log(`\nService 2 (${svc2.number}): ${svc2.status}`);
console.log(`  ID: ${svc2.id}`);
console.log(`  ${svc2.operator_name} / ${svc2.train_type_name}`);
console.log(`  Stops: ${stops2.length}`);

console.log(`\nService 3 (${svc3.number}): ${svc3.status}`);
console.log(`  ID: ${svc3.id}`);
console.log(`  ${svc3.operator_name} / ${svc3.train_type_name}`);
console.log(`  Stops: ${stops3.length}`);

console.log("\n" + "=".repeat(60));
console.log("Test these with curl or Postman:\n");
console.log("# List all services");
console.log('curl http://localhost:4000/admin/services -u admin:railboard | jq\n');
console.log("# Get service detail with stops");
console.log(`curl http://localhost:4000/admin/services/${svc1.id} -u admin:railboard | jq\n`);
console.log("# Get board for Madrid station");
console.log(`curl http://localhost:4000/stations/${getMadridStation().id}/board?mode=departures -u admin:railboard | jq\n`);
console.log("# Mark arrival at Barcelona");
console.log(`curl -X POST http://localhost:4000/admin/stops/${svc1Stops[1].id}/arrival \\`);
console.log(`  -u admin:railboard \\`);
console.log(`  -H 'Content-Type: application/json' \\`);
console.log(`  -d '{"actual_time":"2025-05-30T11:45:00Z","platform":"5"}' | jq\n`);

console.log("🎉 Ready to test the multistation architecture!");

function getStationName(stationId) {
    const s = stationsList.find(st => st.id === stationId);
    return s ? s.short || s.name : `Station ${stationId}`;
}
