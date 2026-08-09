export const supportedLocales = ["en", "es", "ar"];
export const messages = {
  en: { explore: "What do you want to explore?", placeholder: "Morocco", interest: "Interest", continue: "Continue", back: "Back", choose: "Choose topics", build: "Build feed", theme: "Change theme", language: "Language", source: "Source", empty: "Choose at least one topic" },
  es: { explore: "¿Qué quieres explorar?", placeholder: "Marruecos", interest: "Interés", continue: "Continuar", back: "Atrás", choose: "Elige temas", build: "Crear feed", theme: "Cambiar tema", language: "Idioma", source: "Fuente", empty: "Elige al menos un tema" },
  ar: { explore: "ماذا تريد أن تستكشف؟", placeholder: "المغرب", interest: "الاهتمام", continue: "متابعة", back: "رجوع", choose: "اختر المواضيع", build: "إنشاء الخلاصة", theme: "تغيير المظهر", language: "اللغة", source: "المصدر", empty: "اختر موضوعًا واحدًا على الأقل" }
};
export function directionFor(locale) { return locale === "ar" ? "rtl" : "ltr"; }
export function formatItemCount(locale, count) {
  return new Intl.NumberFormat(locale).format(count);
}
