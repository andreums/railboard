import { randomItem } from "../lib/random.js";

export const SUPPORTED_LANGUAGES = new Set(["es", "ca", "en", "fr", "eu", "gl"]);

const OBSERVATION_BANK = {
  es: {
    generic: [
      "Sin incidencias",
      "Servicio habitual",
      "Operación normal",
      "Material revisado",
      "Salida prevista según horario",
      "Servicio reforzado por demanda",
      "Tren con alta ocupación prevista",
      "Circulación con normalidad",
      "Servicio sin novedades",
      "Tren revisado y listo",
      "Personal a bordo completo",
      "Condiciones de viaje habituales",
      "Tren preparado para salida",
      "Conexiones garantizadas",
      "Servicio de temporada activo",
      "Refuerzo de personal en estación",
      "Tren con servicio de cafetería",
    ],
    service: [
      "Por trabajos de mantenimiento en la infraestructura",
      "Debido a obras en el corredor",
      "Servicio sujeto a regulación de tráfico",
      "Afectado por circulación densa en el tramo central",
      "Cambio puntual de material por necesidades operativas",
      "Parada reforzada en estaciones intermedias",
      "Por obras de modernización en la vía",
      "Servicio afectado por obras de electrificación",
      "Por renovación de catenaria en el trayecto",
      "Adaptación temporal por obras estacionales",
      "Por mejora de la accesibilidad en andenes",
      "Cambio de material rodante por mantenimiento programado",
      "Afectado por trabajos de señalización",
      "Por sustitución de traviesas en el tramo",
      "Desvío provisional por obras en la estación",
      "Por obras de soterramiento en el casco urbano",
    ],
    delay: [
      "Retraso por incidencia en la infraestructura",
      "Retraso por acumulación de tráfico ferroviario",
      "Retraso por avería de material",
      "Retraso por maniobras de regulación",
      "Demora por intervención técnica",
      "Retraso por incidencia en la catenaria",
      "Retraso por cruce de trenes en vía única",
      "Demora por operaciones de estacionamiento",
      "Retraso por revisión extraordinaria de seguridad",
      "Retraso por alta densidad de viajeros en origen",
      "Demora por procedimientos de seguridad en estación",
      "Retraso por incidencia en el sistema de bordo",
      "Demora por espera de correspondencia",
      "Retraso por baja visibilidad en el trayecto",
    ],
    platform: [
      "Se confirma vía asignada en panel",
      "Posible cambio de vía por regulación de tráfico",
      "Asignación de vía sujeta a última hora",
      "Vía confirmada por megafonía",
      "Cambio de vía por obras en andén contiguo",
      "Por obras en la vía habitual, acceso por andén alternativo",
      "Estacionamiento en vía provisional por eventos en la estación",
      "Compruebe el panel informativo para posible cambio de vía",
      "Vía asignada momentáneamente por operativa de tráfico",
    ],
    status: [
      "Embarque en curso por puertas 1-4",
      "Última llamada para viajeros con destino a bordo",
      "Puertas de acceso abiertas",
      "Personal de a bordo esperando en andén",
      "Tren listo para recibir viajeros",
      "Cancelado por incidencias técnicas",
      "Cancelado por condiciones meteorológicas adversas",
      "Cancelado por huelga en el sector",
      "Cancelado por obras de emergencia en la vía",
      "Transbordo organizado por carretera",
    ],
    info: [
      "Recuerden validar su billete antes de subir",
      "Atención al llegar a su destino por posible cambio de andén",
      "Mantengan su equipaje controlado en todo momento",
      "Próxima estación con correspondencia de metro",
      "Tren con espacio para bicicletas disponible",
      "Servicio de asistencia disponible para movilidad reducida",
      "Tren con zona de silencio en coches centrales",
      "Se ruega cedan el asiento a personas con movilidad reducida",
    ],
  },
  ca: {
    generic: [
      "Sense incidències",
      "Servei habitual",
      "Operació normal",
      "Material revisat",
      "Sortida prevista segons horari",
      "Servei reforçat per demanda",
      "Tren amb alta ocupació prevista",
      "Circulació amb normalitat",
      "Servei sense novetats",
      "Tren revisat i a punt",
      "Personal a bord complet",
      "Condicions de viatge habituals",
      "Tren preparat per a la sortida",
      "Connexions garantides",
      "Servei de temporada actiu",
      "Reforç de personal a l'estació",
    ],
    service: [
      "Per treballs de manteniment a la infraestructura",
      "A causa d'obres al corredor",
      "Servei sotmès a regulació de trànsit",
      "Afectat per circulació densa al tram central",
      "Canvi puntual de material per necessitats operatives",
      "Parada reforçada en estacions intermèdies",
      "Per obres de modernització a la via",
      "Servei afectat per obres d'electrificació",
      "Per renovació de catenària al trajecte",
      "Adaptació temporal per obres estacionals",
      "Per millora de l'accessibilitat als andanes",
      "Canvi de material rodant per manteniment programat",
      "Afectat per treballs de senyalització",
      "Desviament provisional per obres a l'estació",
    ],
    delay: [
      "Retard per incidència a la infraestructura",
      "Retard per acumulació de trànsit ferroviari",
      "Retard per avaria de material",
      "Retard per maniobres de regulació",
      "Demora per intervenció tècnica",
      "Retard per incidència a la catenària",
      "Retard per encreuament de trens en via única",
      "Demora per operacions d'estacionament",
      "Retard per revisió extraordinària de seguretat",
      "Retard per alta densitat de viatgers a l'origen",
      "Retard per incidència al sistema de bord",
      "Demora per espera de correspondència",
    ],
    platform: [
      "Via assignada confirmada al panell",
      "Possible canvi de via per regulació de trànsit",
      "Assignació de via subjecta a última hora",
      "Via confirmada per megafonia",
      "Canvi de via per obres a l'andana contigua",
      "Per obres a la via habitual, accés per andana alternativa",
      "Comproveu el panell informatiu per a possible canvi de via",
    ],
    status: [
      "Embarque en curs per portes 1-4",
      "Darrera crida per a viatgers amb destinació a bord",
      "Portes d'accés obertes",
      "Personal a bord esperant a l'andana",
      "Cancel·lat per incidències tècniques",
      "Cancel·lat per condicions meteorològiques adverses",
      "Cancel·lat per vaga al sector",
      "Transbord organitzat per carretera",
    ],
    info: [
      "Recordeu validar el vostre bitllet abans de pujar",
      "Mantingueu l'equipatge controlat en tot moment",
      "Tren amb espai per a bicicletes disponible",
      "Servei d'assistència disponible per a mobilitat reduïda",
      "Tren amb zona de silenci en cotxes centrals",
    ],
  },
  en: {
    generic: [
      "No incidents reported",
      "Normal service",
      "Operating as scheduled",
      "Rolling stock checked",
      "Departure expected on time",
      "Service reinforced due to demand",
      "High occupancy expected",
      "Service running smoothly",
      "Train ready for departure",
      "Full crew on board",
      "Standard travel conditions",
      "Seasonal service active",
      "All connections guaranteed",
    ],
    service: [
      "Maintenance work on the infrastructure",
      "Works along the corridor",
      "Service subject to traffic regulation",
      "Affected by heavy traffic on the central section",
      "Temporary rolling stock change for operational needs",
      "Extra intermediate stops in place",
      "Due to track modernisation works",
      "Electrification works affecting service",
      "Catenary renewal in progress",
      "Temporary adaptation for seasonal works",
      "Platform accessibility improvements underway",
      "Rolling stock change for scheduled maintenance",
    ],
    delay: [
      "Delay due to an infrastructure incident",
      "Delay due to rail traffic congestion",
      "Delay due to rolling stock failure",
      "Delay due to traffic management",
      "Delay due to technical intervention",
      "Delay due to a catenary fault",
      "Delay due to single-track crossing operations",
      "Delay due to extraordinary safety inspection",
      "Delay due to high passenger density at origin",
      "Delay due to on-board system fault",
      "Delay waiting for connecting service",
    ],
    platform: [
      "Platform assignment confirmed on the board",
      "Possible platform change due to traffic regulation",
      "Platform assignment may change at short notice",
      "Platform confirmed via announcement",
      "Platform change due to works on adjacent platform",
      "Check information boards for possible platform change",
      "Temporary platform due to station events",
    ],
    status: [
      "Boarding in progress via gates 1-4",
      "Final call for passengers",
      "Boarding gates open",
      "Train crew waiting on platform",
      "Cancelled due to technical issues",
      "Cancelled due to adverse weather conditions",
      "Cancelled due to strike action",
      "Coach transfer organised",
    ],
    info: [
      "Please validate your ticket before boarding",
      "Keep your luggage with you at all times",
      "Next station with underground connection",
      "Bicycle storage available on this service",
      "Assistance available for reduced mobility",
      "Silent zone carriages available",
    ],
  },
  fr: {
    generic: [
      "Aucun incident signalé",
      "Service normal",
      "Exploitation conforme à l'horaire",
      "Matériel vérifié",
      "Départ prévu à l'heure",
      "Service renforcé en fonction de la demande",
      "Fort taux d'occupation attendu",
      "Circulation normale",
      "Train prêt pour le départ",
      "Équipage complet à bord",
      "Service saisonnier actif",
      "Correspondances garanties",
    ],
    service: [
      "Travaux de maintenance sur l'infrastructure",
      "Chantiers sur le corridor",
      "Service soumis à régulation du trafic",
      "Trafic dense sur la section centrale",
      "Changement ponctuel de matériel pour besoins d'exploitation",
      "Arrêts intermédiaires renforcés",
      "Travaux de modernisation de la voie",
      "Travaux d'électrification en cours",
      "Renouvellement de la caténaire",
      "Adaptation temporaire pour travaux saisonniers",
      "Amélioration de l'accessibilité des quais",
    ],
    delay: [
      "Retard dû à un incident d'infrastructure",
      "Retard dû à la congestion ferroviaire",
      "Retard dû à une panne de matériel",
      "Retard dû à une régulation du trafic",
      "Retard dû à une intervention technique",
      "Retard dû à un incident de caténaire",
      "Retard dû au croisement sur voie unique",
      "Retard dû à un contrôle de sécurité extraordinaire",
      "Retard dû à une forte affluence au départ",
      "Retard pour attente de correspondance",
    ],
    platform: [
      "Voie attribuée confirmée sur le panneau",
      "Changement de voie possible selon la régulation",
      "Attribution de voie susceptible de changer à la dernière minute",
      "Voie confirmée par haut-parleur",
      "Changement de voie pour travaux sur quai adjacent",
      "Consultez le panneau pour un éventuel changement de voie",
    ],
    status: [
      "Embarquement en cours portes 1-4",
      "Dernier appel pour les voyageurs",
      "Portes d'accès ouvertes",
      "Personnel à bord attendant en quai",
      "Annulé pour raisons techniques",
      "Annulé en raison des conditions météorologiques",
      "Annulé pour grève dans le secteur",
      "Transfert par car organisé",
    ],
    info: [
      "Pensez à valider votre billet avant de monter",
      "Surveillez vos bagages en tout temps",
      "Prochain gare avec correspondance métro",
      "Espace vélo disponible à bord",
      "Assistance disponible pour mobilité réduite",
    ],
  },
  eu: {
    generic: [
      "Ez da gorabeherarik jakinarazi",
      "Zerbitzu arrunta",
      "Ordutegiaren arabera martxan",
      "Materiala berrikusita",
      "Irteera orduz espero da",
      "Eskariagatik zerbitzu indartua",
      "Gaitasun handia espero da",
      "Zirkulazio normala",
      "Treina prest irteerarako",
      "Langile osoa treinean",
      "Sasoiko zerbitzua aktibatuta",
      "Konexioak bermatuta",
    ],
    service: [
      "Azpiegiturako mantentze lanengatik",
      "Korridorean obrak daudelako",
      "Zirkulazioaren erregulaziopean",
      "Erdiko tarteko zirkulazio trinkoak eraginda",
      "Eragiketa beharretarako material aldaketa puntuala",
      "Tarteko geltokietan geldialdi indartuak",
      "Bidean modernizazio lanengatik",
      "Elektrifikazio lanek zerbitzuan eraginda",
      "Katenaria berritze lanak",
      "Aldi baterako egokitzapena sasoiko lanengatik",
    ],
    delay: [
      "Atzerapena azpiegiturako gorabeheragatik",
      "Atzerapena tren trafikoaren pilaketagatik",
      "Atzerapena materialaren matxuragatik",
      "Atzerapena trafikoaren erregulazioagatik",
      "Atzerapena esku-hartze teknikoagatik",
      "Atzerapena katenariako matxuragatik",
      "Atzerapena bide bakarreko gurutzatzeagatik",
      "Atzerapena segurtasun ikuskapenagatik",
      "Atzerapena jatorrian bidaiari dentsitate handiagatik",
      "Atzerapena barneko sistemaren matxuragatik",
    ],
    platform: [
      "Esleitutako nasaren baieztapena panelean",
      "Nasaren aldaketa posiblea trafikoaren arabera",
      "Nasa azken unean alda daiteke",
      "Nasa baieztatua megafonia bidez",
      "Nasa aldaketa ondoko nasako obrengatik",
      "Egiaztatu informazio panela nasa aldaketa posibleagatik",
    ],
    status: [
      "Ontziratzea martxan 1-4 ateetatik",
      "Azken deia bidaiarientzat",
      "Sarbide ateak irekita",
      "Treineko langileak nasan itxaroten",
      "Bertan behera utzia arrazoi teknikoengatik",
      "Bertan behera utzia eguraldi txarrarengatik",
      "Bertan behera utzia grebarengatik",
      "Autobusez transbordoa antolatuta",
    ],
    info: [
      "Txartela balidatu igo aurretik",
      "Ekipajea uneoro kontrolpean eduki",
      "Hurrengo geltokia metrorako konexioarekin",
      "Bizikleta lekua eskuragarri treinean",
      "Mugikortasun urrikoentzako laguntza eskuragarri",
    ],
  },
  gl: {
    generic: [
      "Sen incidencias",
      "Servizo habitual",
      "Operación normal",
      "Material revisado",
      "Saída prevista segundo horario",
      "Servizo reforzado por demanda",
      "Alta ocupación prevista",
      "Circulación con normalidade",
      "Servizo sen novidades",
      "Tren preparado para a saída",
      "Persoal a bordo completo",
      "Condicións de viaxe habituais",
      "Servizo de tempada activo",
      "Reforzo de personal na estación",
    ],
    service: [
      "Por traballos de mantemento na infraestrutura",
      "Debido a obras no corredor",
      "Servizo suxeito a regulación de tráfico",
      "Afectado por circulación densa no tramo central",
      "Cambio puntual de material por necesidades operativas",
      "Parada reforzada en estacións intermedias",
      "Por obras de modernización na vía",
      "Servizo afectado por obras de electrificación",
      "Por renovación de catenaria no traxecto",
      "Adaptación temporal por obras estacionais",
      "Cambio de material rodante por mantemento programado",
      "Desvío provisional por obras na estación",
    ],
    delay: [
      "Retraso por incidencia na infraestrutura",
      "Retraso por acumulación de tráfico ferroviario",
      "Retraso por avaría de material",
      "Retraso por manobras de regulación",
      "Demora por intervención técnica",
      "Retraso por incidencia na catenaria",
      "Retraso por cruce de trens en vía única",
      "Demora por operacións de estacionamento",
      "Retraso por revisión extraordinaria de seguridade",
      "Retraso por alta densidade de viaxeiros na orixe",
      "Retraso por incidencia no sistema de a bordo",
    ],
    platform: [
      "Vía asignada confirmada no panel",
      "Posible cambio de vía por regulación de tráfico",
      "A asignación de vía pode mudar á última hora",
      "Vía confirmada por megafonía",
      "Cambio de vía por obras no andén contiguo",
      "Por obras na vía habitual, acceso por andén alternativo",
      "Comprobe o panel informativo para posible cambio de vía",
    ],
    status: [
      "Embarque en curso polas portas 1-4",
      "Última chamada para viaxeiros con destino a bordo",
      "Portas de acceso abertas",
      "Persoal de a bordo esperando no andén",
      "Cancelado por incidencias técnicas",
      "Cancelado por condicións meteorolóxicas adversas",
      "Cancelado por folga no sector",
      "Transbordo organizado por estrada",
    ],
    info: [
      "Lembren validar o seu billete antes de subir",
      "Manteñan a súa equipaxe controlada en todo momento",
      "Vindeira estación con correspondencia de metro",
      "Tren con espazo para bicicletas dispoñible",
      "Servizo de asistencia dispoñible para mobilidade reducida",
    ],
  },
};

export const normalizeLanguage = (value) => {
  const lang = String(value || "")
    .toLowerCase()
    .trim();
  return SUPPORTED_LANGUAGES.has(lang) ? lang : "es";
};

export const normalizeLanguageList = (value, fallbackLanguage = "es") => {
  const rawList = Array.isArray(value)
    ? value
    : typeof value === "string" && value.trim().startsWith("[")
      ? (() => {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [value];
          } catch {
            return [value];
          }
        })()
      : typeof value === "string" && value.includes(",")
        ? value.split(",")
        : value != null
          ? [value]
          : [];

  const unique = [];
  for (const item of rawList) {
    const lang = normalizeLanguage(item);
    if (!unique.includes(lang)) unique.push(lang);
  }
  if (!unique.length) unique.push(normalizeLanguage(fallbackLanguage));
  return unique;
};

export const pickDisplayLanguage = (config) => {
  const languages = normalizeLanguageList(config?.languages, config?.language || "es");
  return languages[Math.floor(Math.random() * languages.length)] || "es";
};

export const pickObservation = ({ language, status }) => {
  const lang = normalizeLanguage(language);
  const bank = OBSERVATION_BANK[lang] || OBSERVATION_BANK.es;

  const parts = [];

  if (status === "Delayed") {
    parts.push(randomItem(bank.delay));
    if (Math.random() < 0.35) parts.push(randomItem(bank.service));
  } else if (status === "Cancelled") {
    parts.push(randomItem(bank.status.filter((s) => s.toLowerCase().includes("cancel"))));
  } else if (status === "Boarding") {
    if (Math.random() < 0.55) parts.push(randomItem(bank.status));
    parts.push(randomItem(bank.generic));
  } else {
    const pool = [...bank.generic, ...bank.service, ...bank.platform, ...bank.info];
    parts.push(randomItem(pool));
    if (Math.random() < 0.25) parts.push(randomItem(pool));
  }

  if (parts.length === 0) {
    parts.push(randomItem(bank.generic));
  }

  return parts.join(" · ");
};
