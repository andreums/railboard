import { describe, it, expect } from "vitest";
import { t, i18n } from "../i18n";

describe("i18n", () => {
  it("returns Spanish translation for 'departures'", () => {
    expect(t("departures", "es")).toBe("SALIDAS");
  });

  it("returns English translation for 'departures'", () => {
    expect(t("departures", "en")).toBe("DEPARTURES");
  });

  it("returns Catalan translation for 'departures'", () => {
    expect(t("departures", "ca")).toBe("Sortides");
  });

  it("returns French translation for 'departures'", () => {
    expect(t("departures", "fr")).toBe("DÉPARTS");
  });

  it("returns Basque translation for 'platform'", () => {
    expect(t("platform", "eu")).toBe("Binara");
  });

  it("returns Galician translation for 'platform'", () => {
    expect(t("platform", "gl")).toBe("Vía");
  });

  it("returns the key itself for missing translations", () => {
    expect(t("nonexistent.key", "es")).toBe("nonexistent.key");
  });

  it("has all keys across all languages", () => {
    const langs = ["es", "ca", "en", "fr", "eu", "gl"] as const;
    const esKeys = Object.keys(i18n.es);

    for (const lang of langs) {
      const langKeys = Object.keys(i18n[lang]);
      const missing = esKeys.filter((k) => !langKeys.includes(k));
      expect(missing, `${lang} is missing keys: ${missing.join(", ")}`).toHaveLength(0);
    }
  });

  it("has all language codes", () => {
    expect(i18n.es).toBeDefined();
    expect(i18n.ca).toBeDefined();
    expect(i18n.en).toBeDefined();
    expect(i18n.fr).toBeDefined();
    expect(i18n.eu).toBeDefined();
    expect(i18n.gl).toBeDefined();
  });
});
