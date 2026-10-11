import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { resources } from "./resources";

const LOCALE = "zh-CN";

let initPromise: Promise<typeof i18n> | null = null;

export function initializeI18n() {
  if (!initPromise) {
    initPromise = i18n
      .use(initReactI18next)
      .init({
        resources,
        lng: LOCALE,
        fallbackLng: LOCALE,
        supportedLngs: [LOCALE],
        defaultNS: "translation",
        ns: ["translation"],
        interpolation: {
          escapeValue: false,
        },
        returnEmptyString: false,
        returnNull: false,
      })
      .then(() => i18n);
  }

  return initPromise;
}

export { i18n };

export default i18n;
