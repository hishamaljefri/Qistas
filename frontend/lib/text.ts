// All interface wording in one place, so copy can be edited without touching components.

export const text = {
  appName: "قسطاس",
  tagline: "مساعد قانوني ذكي لقضايا نظام العمل السعودي",
  nav: { analyze: "تحليل قضية", search: "البحث في النظام" },

  form: {
    title: "صف حالتك العمالية",
    descriptionLabel: "وصف الحالة",
    descriptionHint: "اذكر ما حدث، ومدة خدمتك، ونوع العقد، والأجر، وما تريد معرفته. كلما زادت التفاصيل كان التحليل أدق.",
    descriptionPlaceholder: "مثال: أعمل في شركة منذ 6 سنوات بعقد غير محدد المدة، وراتبي 8000 ريال، وتم فصلي بدون سبب ولا إشعار...",
    genderLabel: "جنس العامل",
    genderHint: "بعض الأحكام تختلف بحسب الجنس، ولا يمكن استنتاجه بعد إخفاء الاسم.",
    genderUnset: "غير محدد",
    male: "ذكر",
    female: "أنثى",
    employeeNameLabel: "اسم العامل (اختياري)",
    employerNameLabel: "اسم صاحب العمل أو المنشأة (اختياري)",
    privacyNote: "يُخفى الاسم ورقم الهوية والجوال والآيبان تلقائياً قبل إرسال الحالة للذكاء الاصطناعي، ولا تُحفظ البيانات الأصلية.",
    submit: "حلّل الحالة",
    submitting: "جارٍ التحليل…",
    waitNote: "قد يستغرق التحليل من 15 ثانية إلى دقيقة ونصف.",
    tooShort: "يرجى كتابة وصف لا يقل عن 30 حرفاً.",
  },

  result: {
    outcome: "النتيجة المتوقعة",
    likelihood: "درجة الترجيح",
    reasoning: "السبب",
    entitlements: "المستحقات المالية",
    entitlementsNote: "محسوبة آلياً وفق مواد النظام، وليست من تقدير الذكاء الاصطناعي.",
    total: "الإجمالي",
    cannotCompute: "لا يمكن الحساب لنقص معلومات",
    facts: "ملخص الوقائع",
    issues: "المسائل القانونية",
    analysis: "التحليل",
    missing: "معلومات تحتاج لتوضيحها",
    steps: "الخطوات المقترحة",
    citations: "المواد النظامية المستند إليها",
    showText: "عرض نص المادة",
    hideText: "إخفاء النص",
    privacy: "ما الذي أُرسل للذكاء الاصطناعي؟",
    maskedCount: "بيانات شخصية تم إخفاؤها",
    kbAsOf: "قاعدة المعرفة محدّثة حتى",
    newCase: "تحليل حالة جديدة",
    warnings: "تنبيهات",
  },

  search: {
    title: "البحث في نظام العمل ولائحته التنفيذية",
    placeholder: "اكتب سؤالاً أو موضوعاً، مثل: إجازة الحج، أو المادة 84",
    submit: "بحث",
    empty: "لا توجد نتائج.",
  },

  article: { back: "رجوع", repealed: "ملغاة", merged: "مدمجة في مادة أخرى", source: "المصدر" },

  status: { repealed: "ملغاة", merged: "مدمجة", in_force: "سارية" } as Record<string, string>,
} as const;
