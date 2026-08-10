export const supportedLocales = ["en", "es", "ar"];
export const messages = {
  en: {
    explore: "What do you want to explore?", exploreNav: "Explore", search: "Search", settings: "Settings", navigation: "Primary navigation",
    placeholder: "Morocco", interest: "Interest", continue: "Continue", back: "Back", choose: "Choose topics", build: "Build feed",
    theme: "Theme", language: "Language", source: "Source", empty: "Choose at least one topic", saved: "Saved on this device",
    removed: "Removed", details: "Feed details", saveItem: "Save item", removeSave: "Remove save", moreLikeThis: "More like this",
    localDisclosure: "Saved on this device. Clearing browser data removes it. Export a backup anytime.",
    system: "System", light: "Light", dark: "Dark", media: "Media", sources: "Sources", privacy: "Privacy", history: "History",
    largeText: "Larger text", reducedMotion: "Less motion", storage: "Storage", status: "Status", used: "Used", persistence: "Persistence",
    ready: "Ready", limited: "Limited", protected: "Protected", bestEffort: "Best effort", keep: "Keep local", export: "Export",
    import: "Import", clearHistory: "Clear history", resetData: "Reset data", exported: "Export ready", imported: "Import complete",
    importFailed: "Import failed", persistenceOn: "Persistence requested", persistenceLimited: "Browser decides", cleared: "History cleared",
    reset: "Local data reset", savedItems: "Saved", collections: "Collections", provenance: "Provenance", creator: "Creator", license: "License",
    reason: "Why this?", graphPath: "Graph path", graphRoot: "Resolved topic", openBasis: "Verified open source item", sourceHealth: "Source health", whyOpen: "Why open?", attribution: "Attribution",
    downloadRules: "Download", openSourceFile: "Open source file"
  },
  es: {
    explore: "¿Qué quieres explorar?", exploreNav: "Explorar", search: "Buscar", settings: "Ajustes", navigation: "Navegación principal",
    placeholder: "Marruecos", interest: "Interés", continue: "Continuar", back: "Atrás", choose: "Elige temas", build: "Crear feed",
    theme: "Tema", language: "Idioma", source: "Fuente", empty: "Elige al menos un tema", saved: "Guardado en este dispositivo",
    removed: "Eliminado", details: "Detalles del feed", saveItem: "Guardar", removeSave: "Quitar guardado", moreLikeThis: "Más así",
    localDisclosure: "Guardado en este dispositivo. Si borras los datos del navegador, se elimina. Exporta una copia cuando quieras.",
    system: "Sistema", light: "Claro", dark: "Oscuro", media: "Medios", sources: "Fuentes", privacy: "Privacidad", history: "Historial",
    largeText: "Texto grande", reducedMotion: "Menos movimiento", storage: "Almacenamiento", status: "Estado", used: "Uso", persistence: "Persistencia",
    ready: "Listo", limited: "Limitado", protected: "Protegido", bestEffort: "Mejor esfuerzo", keep: "Conservar", export: "Exportar",
    import: "Importar", clearHistory: "Borrar historial", resetData: "Reiniciar datos", exported: "Exportación lista", imported: "Importación completa",
    importFailed: "Importación falló", persistenceOn: "Persistencia solicitada", persistenceLimited: "El navegador decide", cleared: "Historial borrado",
    reset: "Datos locales reiniciados", savedItems: "Guardados", collections: "Colecciones", provenance: "Procedencia", creator: "Creador", license: "Licencia",
    reason: "¿Por qué?", graphPath: "Ruta del grafo", graphRoot: "Tema resuelto", openBasis: "Elemento verificado como abierto", sourceHealth: "Estado de la fuente", whyOpen: "¿Por qué abierto?", attribution: "Atribución",
    downloadRules: "Descarga", openSourceFile: "Abrir archivo fuente"
  },
  ar: {
    explore: "ماذا تريد أن تستكشف؟", exploreNav: "استكشاف", search: "بحث", settings: "الإعدادات", navigation: "التنقل الرئيسي",
    placeholder: "المغرب", interest: "الاهتمام", continue: "متابعة", back: "رجوع", choose: "اختر المواضيع", build: "إنشاء الخلاصة",
    theme: "المظهر", language: "اللغة", source: "المصدر", empty: "اختر موضوعًا واحدًا على الأقل", saved: "حُفظ على هذا الجهاز",
    removed: "أُزيل", details: "تفاصيل الخلاصة", saveItem: "حفظ", removeSave: "إزالة الحفظ", moreLikeThis: "المزيد مثل هذا",
    localDisclosure: "محفوظ على هذا الجهاز. حذف بيانات المتصفح يزيله. يمكنك تصدير نسخة احتياطية في أي وقت.",
    system: "النظام", light: "فاتح", dark: "داكن", media: "الوسائط", sources: "المصادر", privacy: "الخصوصية", history: "السجل",
    largeText: "نص أكبر", reducedMotion: "حركة أقل", storage: "التخزين", status: "الحالة", used: "المستخدم", persistence: "الاستمرار",
    ready: "جاهز", limited: "محدود", protected: "محمي", bestEffort: "أفضل جهد", keep: "حفظ محلي", export: "تصدير",
    import: "استيراد", clearHistory: "مسح السجل", resetData: "إعادة ضبط البيانات", exported: "التصدير جاهز", imported: "اكتمل الاستيراد",
    importFailed: "فشل الاستيراد", persistenceOn: "طُلب الحفظ المستمر", persistenceLimited: "المتصفح يقرر", cleared: "مُسح السجل",
    reset: "أُعيد ضبط البيانات المحلية", savedItems: "المحفوظات", collections: "المجموعات", provenance: "المصدر", creator: "المنشئ", license: "الرخصة",
    reason: "لماذا؟", graphPath: "مسار الرسم", graphRoot: "الموضوع المحدد", openBasis: "عنصر مفتوح موثّق", sourceHealth: "حالة المصدر", whyOpen: "لماذا مفتوح؟", attribution: "النسبة",
    downloadRules: "التنزيل", openSourceFile: "فتح الملف الأصلي"
  }
};
export function directionFor(locale) { return locale === "ar" ? "rtl" : "ltr"; }
export function formatItemCount(locale, count) {
  return new Intl.NumberFormat(locale).format(count);
}
