// =============================================================================
// Enterprise ERP — System Definition Types Registry (التعريفات العامة للمجمّع المرجعي)
//
// Single source of truth for all Generic Reference Data / Lookup Categories.
// Governance Mandate:
//   - System-defined types are immutable in structure.
//   - Ownership boundaries are strictly respected.
//   - Used by HR, Financials, Employee Profile, Org Structure, and Shared Lookups.
// =============================================================================

export interface DefinitionTypeMeta {
  code: string
  numericId: number
  nameAr: string
  nameEn: string
  descriptionAr: string
  descriptionEn: string
  domain: 'HR' | 'ORG' | 'COMMON' | 'FINANCE'
  icon: string
  isSystem: boolean
  initialSeed: {
    code: string
    nameAr: string
    nameEn: string
    descriptionAr?: string
    descriptionEn?: string
    sortOrder: number
  }[]
}

export const SYSTEM_DEFINITION_TYPES: Record<string, DefinitionTypeMeta> = {
  ACCOUNT_GROUP: {
    code: 'ACCOUNT_GROUP',
    numericId: 3,
    nameAr: 'مجموعات الحسابات',
    nameEn: 'Account Groups',
    descriptionAr: 'تصنيفات ومجموعات دليل الحسابات المالي',
    descriptionEn: 'Chart of Accounts grouping categories',
    domain: 'FINANCE',
    icon: 'Layers',
    isSystem: true,
    initialSeed: [
      { code: 'ASSETS', nameAr: 'الأصول', nameEn: 'Assets', sortOrder: 1 },
      { code: 'LIABILITIES', nameAr: 'الالتزامات', nameEn: 'Liabilities', sortOrder: 2 },
      { code: 'EQUITY', nameAr: 'حقوق الملكية', nameEn: 'Equity', sortOrder: 3 },
      { code: 'REVENUE', nameAr: 'الإيرادات', nameEn: 'Revenue', sortOrder: 4 },
      { code: 'EXPENSES', nameAr: 'المصروفات', nameEn: 'Expenses', sortOrder: 5 },
    ],
  },
  COST_CENTER_GROUP: {
    code: 'COST_CENTER_GROUP',
    numericId: 6,
    nameAr: 'مجموعة مركز التكلفة',
    nameEn: 'Cost Center Groups',
    descriptionAr: 'تجميع وتصنيف مراكز التكلفة المحاسبية',
    descriptionEn: 'Grouping and hierarchy of cost centers',
    domain: 'FINANCE',
    icon: 'Network',
    isSystem: true,
    initialSeed: [
      { code: 'ADMIN_CC', nameAr: 'مراكز التكلفة الإدارية', nameEn: 'Administrative Cost Centers', sortOrder: 1 },
      { code: 'OPERATIONAL_CC', nameAr: 'مراكز التكلفة التشغيلية', nameEn: 'Operational Cost Centers', sortOrder: 2 },
      { code: 'SALES_CC', nameAr: 'مراكز التكلفة التسويقية والبيع', nameEn: 'Sales & Marketing Cost Centers', sortOrder: 3 },
    ],
  },
  MARITAL_STATUS: {
    code: 'MARITAL_STATUS',
    numericId: 31,
    nameAr: 'الحالة الاجتماعية',
    nameEn: 'Marital Status',
    descriptionAr: 'الحالة الاجتماعية للموظفين والأفراد (أعزب، متزوج، أعزب…)',
    descriptionEn: 'Marital status classification (Single, Married, Divorced…)',
    domain: 'HR',
    icon: 'Briefcase',
    isSystem: true,
    initialSeed: [
      { code: 'SINGLE', nameAr: 'أعزب / عزباء', nameEn: 'Single', sortOrder: 1 },
      { code: 'MARRIED', nameAr: 'متزوج / متزوجة', nameEn: 'Married', sortOrder: 2 },
      { code: 'DIVORCED', nameAr: 'مطلق / مطلقة', nameEn: 'Divorced', sortOrder: 3 },
      { code: 'WIDOWED', nameAr: 'أرمل / أرملة', nameEn: 'Widowed', sortOrder: 4 },
    ],
  },
  RELIGION: {
    code: 'RELIGION',
    numericId: 32,
    nameAr: 'الديانة',
    nameEn: 'Religion',
    descriptionAr: 'تصنيف الديانة والسجلات الرسمية للموظفين',
    descriptionEn: 'Religion classification for employee records',
    domain: 'COMMON',
    icon: 'BookMarked',
    isSystem: true,
    initialSeed: [
      { code: 'ISLAM', nameAr: 'مسلم', nameEn: 'Islam', sortOrder: 1 },
      { code: 'CHRISTIANITY', nameAr: 'مسيحي', nameEn: 'Christianity', sortOrder: 2 },
      { code: 'OTHER', nameAr: 'أخرى', nameEn: 'Other', sortOrder: 3 },
    ],
  },
  BLOOD_GROUP: {
    code: 'BLOOD_GROUP',
    numericId: 33,
    nameAr: 'فصيلة الدم',
    nameEn: 'Blood Group',
    descriptionAr: 'فصائل الدم للموظفين ولحالات الطوارئ والسلامة',
    descriptionEn: 'Blood groups for employee medical safety profiles',
    domain: 'HR',
    icon: 'HeartPulse',
    isSystem: true,
    initialSeed: [
      { code: 'A_POS', nameAr: 'A+', nameEn: 'A+', sortOrder: 1 },
      { code: 'A_NEG', nameAr: 'A-', nameEn: 'A-', sortOrder: 2 },
      { code: 'B_POS', nameAr: 'B+', nameEn: 'B+', sortOrder: 3 },
      { code: 'B_NEG', nameAr: 'B-', nameEn: 'B-', sortOrder: 4 },
      { code: 'O_POS', nameAr: 'O+', nameEn: 'O+', sortOrder: 5 },
      { code: 'O_NEG', nameAr: 'O-', nameEn: 'O-', sortOrder: 6 },
      { code: 'AB_POS', nameAr: 'AB+', nameEn: 'AB+', sortOrder: 7 },
      { code: 'AB_NEG', nameAr: 'AB-', nameEn: 'AB-', sortOrder: 8 },
    ],
  },
  NATIONALITY: {
    code: 'NATIONALITY',
    numericId: 34,
    nameAr: 'الجنسية',
    nameEn: 'Nationality',
    descriptionAr: 'جنسيات الكوادر البشرية والمتعاملين بالنظام',
    descriptionEn: 'Nationalities for human capital and partners',
    domain: 'COMMON',
    icon: 'FileUser',
    isSystem: true,
    initialSeed: [
      { code: 'YE', nameAr: 'يمني', nameEn: 'Yemeni', sortOrder: 1 },
      { code: 'SA', nameAr: 'سعودي', nameEn: 'Saudi', sortOrder: 2 },
      { code: 'EG', nameAr: 'مصري', nameEn: 'Egyptian', sortOrder: 3 },
      { code: 'AE', nameAr: 'إماراتي', nameEn: 'Emirati', sortOrder: 4 },
      { code: 'JO', nameAr: 'أردني', nameEn: 'Jordanian', sortOrder: 5 },
      { code: 'SD', nameAr: 'سوداني', nameEn: 'Sudanese', sortOrder: 6 },
      { code: 'OTHER_NAT', nameAr: 'جنسية أخرى', nameEn: 'Other Nationality', sortOrder: 7 },
    ],
  },
  GENDER: {
    code: 'GENDER',
    numericId: 35,
    nameAr: 'الجنس',
    nameEn: 'Gender',
    descriptionAr: 'تصنيف الجنس للكوادر والأفراد (ذكر / أنثى)',
    descriptionEn: 'Gender classification (Male / Female)',
    domain: 'COMMON',
    icon: 'FileUser',
    isSystem: true,
    initialSeed: [
      { code: 'MALE', nameAr: 'ذكر', nameEn: 'Male', sortOrder: 1 },
      { code: 'FEMALE', nameAr: 'أنثى', nameEn: 'Female', sortOrder: 2 },
    ],
  },
  TITLE: {
    code: 'TITLE',
    numericId: 40,
    nameAr: 'لقب',
    nameEn: 'Title',
    descriptionAr: 'الألقاب الرسمية والمخاطبات (سعادة، أستاذ، مهندس، دكتور…)',
    descriptionEn: 'Official titles and honorifics (Mr., Mrs., Eng., Dr.…)',
    domain: 'COMMON',
    icon: 'Award',
    isSystem: true,
    initialSeed: [
      { code: 'MR', nameAr: 'السيد / الأستاذ', nameEn: 'Mr.', sortOrder: 1 },
      { code: 'MRS', nameAr: 'السيدة', nameEn: 'Mrs.', sortOrder: 2 },
      { code: 'ENG', nameAr: 'المهندس / المهندسة', nameEn: 'Eng.', sortOrder: 3 },
      { code: 'DR', nameAr: 'الدكتور / الدكتورة', nameEn: 'Dr.', sortOrder: 4 },
      { code: 'SHEIKH', nameAr: 'الشيخ / سعادة', nameEn: 'H.E. / Excellency', sortOrder: 5 },
    ],
  },
  ID_CARD_TYPE: {
    code: 'ID_CARD_TYPE',
    numericId: 41,
    nameAr: 'أنواع بطائق الهوية',
    nameEn: 'ID Card Types',
    descriptionAr: 'أنواع الوثائق الثبوتية الرسمية (بطاقة شخصية، جواز سفر، إقامة…)',
    descriptionEn: 'Official identification document types (National ID, Passport…)',
    domain: 'COMMON',
    icon: 'FileText',
    isSystem: true,
    initialSeed: [
      { code: 'NATIONAL_ID', nameAr: 'بطاقة شخصية / هوية وطنية', nameEn: 'National ID', sortOrder: 1 },
      { code: 'PASSPORT', nameAr: 'جواز سفر رسمي', nameEn: 'Passport', sortOrder: 2 },
      { code: 'RESIDENCE_PERMIT', nameAr: 'إقامة / هوية مقيم', nameEn: 'Residence Permit (Iqama)', sortOrder: 3 },
      { code: 'DRIVING_LICENSE', nameAr: 'رخصة قيادة', nameEn: 'Driving License', sortOrder: 4 },
      { code: 'COMMERCIAL_REG', nameAr: 'سجل تجاري', nameEn: 'Commercial Register', sortOrder: 5 },
    ],
  },
  CALENDAR_CATEGORY: {
    code: 'CALENDAR_CATEGORY',
    numericId: 43,
    nameAr: 'تصنيفات التقويم',
    nameEn: 'Calendar Categories',
    descriptionAr: 'تصنيفات الأنشطة والتقويم والمواشير الإدارية',
    descriptionEn: 'Calendar categories for corporate scheduling and events',
    domain: 'COMMON',
    icon: 'BookMarked',
    isSystem: true,
    initialSeed: [
      { code: 'HOLIDAY', nameAr: 'إجازات رسمية وعطلات', nameEn: 'Official Holidays', sortOrder: 1 },
      { code: 'MEETING', nameAr: 'اجتماعات ولقاءات إدارية', nameEn: 'Corporate Meetings', sortOrder: 2 },
      { code: 'TRAINING', nameAr: 'دورات وورش تدريبية', nameEn: 'Training & Workshops', sortOrder: 3 },
      { code: 'AUDIT_EVENT', nameAr: 'مواعيد التدقيق والمراجعة', nameEn: 'Audit Milestones', sortOrder: 4 },
    ],
  },
  NOTE_CATEGORY: {
    code: 'NOTE_CATEGORY',
    numericId: 44,
    nameAr: 'تصنيفات الملاحظات',
    nameEn: 'Note Categories',
    descriptionAr: 'تصنيفات التعقيب والملاحظات المسجلة على المعاملات',
    descriptionEn: 'Categories for document and workflow notes',
    domain: 'COMMON',
    icon: 'FileText',
    isSystem: true,
    initialSeed: [
      { code: 'GENERAL_NOTE', nameAr: 'ملاحظات عامة', nameEn: 'General Note', sortOrder: 1 },
      { code: 'IMPORTANT_ALERT', nameAr: 'تنبيه هائم ومتابعة', nameEn: 'Critical Alert', sortOrder: 2 },
      { code: 'FINANCIAL_NOTE', nameAr: 'ملاحظة مالية وقانونية', nameEn: 'Financial & Legal Note', sortOrder: 3 },
      { code: 'HR_NOTE', nameAr: 'ملاحظة موارد بشرية', nameEn: 'HR Note', sortOrder: 4 },
    ],
  },
  TAX_TYPE: {
    code: 'TAX_TYPE',
    numericId: 45,
    nameAr: 'نوع الضريبة',
    nameEn: 'Tax Types',
    descriptionAr: 'تصنيفات الأنواع الضريبية المعتمدة (قيمة مضافة، استقطاع، أرباح…)',
    descriptionEn: 'Tax classifications (VAT, Withholding, Corporate Tax…)',
    domain: 'FINANCE',
    icon: 'ShieldCheck',
    isSystem: true,
    initialSeed: [
      { code: 'VAT_STANDARD', nameAr: 'ضريبة القيمة المضافة القياسية (15%)', nameEn: 'Standard VAT (15%)', sortOrder: 1 },
      { code: 'VAT_ZERO', nameAr: 'ضريبة صفرية (0%)', nameEn: 'Zero-Rated VAT (0%)', sortOrder: 2 },
      { code: 'VAT_EXEMPT', nameAr: 'معفى من الضريبة', nameEn: 'Exempt from VAT', sortOrder: 3 },
      { code: 'WITHHOLDING_TAX', nameAr: 'ضريبة الاستقطاع من المصدر', nameEn: 'Withholding Tax', sortOrder: 4 },
    ],
  },
  EMPLOYMENT_TYPE: {
    code: 'EMPLOYMENT_TYPE',
    numericId: 50,
    nameAr: 'نوع التوظيف',
    nameEn: 'Employment Type',
    descriptionAr: 'أنواع دوام وعقود الموظفين المعتمدة بالنظام (دوام كامل، جزئي، عقد…)',
    descriptionEn: 'Approved employee work commitment types (Full-time, Part-time, Contract…)',
    domain: 'HR',
    icon: 'Briefcase',
    isSystem: true,
    initialSeed: [
      { code: 'FULL_TIME', nameAr: 'دوام كامل', nameEn: 'Full-Time', sortOrder: 1 },
      { code: 'PART_TIME', nameAr: 'دوام جزئي', nameEn: 'Part-Time', sortOrder: 2 },
      { code: 'CONTRACT', nameAr: 'عقد مؤقت', nameEn: 'Fixed Contract', sortOrder: 3 },
      { code: 'FREELANCE', nameAr: 'عمل حر / بالقطعة', nameEn: 'Freelance / Task-based', sortOrder: 4 },
      { code: 'TRAINEE', nameAr: 'تدريب على العمل', nameEn: 'Internship / Trainee', sortOrder: 5 },
    ],
  },
  EMPLOYEE_GRADE: {
    code: 'EMPLOYEE_GRADE',
    numericId: 51,
    nameAr: 'الدرجة الوظيفية',
    nameEn: 'Employee Grade',
    descriptionAr: 'الدرجات والسلم الوظيفي المستهدف لربط الهيكل بالتسلسل الإداري والمالي',
    descriptionEn: 'Job grades for administrative and financial progression',
    domain: 'HR',
    icon: 'Award',
    isSystem: true,
    initialSeed: [
      { code: 'GRADE_EXEC', nameAr: 'درجة تنفيذية عليا', nameEn: 'Executive Grade', sortOrder: 1 },
      { code: 'GRADE_SENIOR', nameAr: 'درجة كبار الموظفين (أ)', nameEn: 'Senior Grade A', sortOrder: 2 },
      { code: 'GRADE_MID', nameAr: 'درجة أخصائي (ب)', nameEn: 'Specialist Grade B', sortOrder: 3 },
      { code: 'GRADE_JUNIOR', nameAr: 'درجة مبتدئ (ج)', nameEn: 'Junior Grade C', sortOrder: 4 },
    ],
  },
  QUALIFICATION: {
    code: 'QUALIFICATION',
    numericId: 52,
    nameAr: 'المؤهل العلمي',
    nameEn: 'Educational Qualification',
    descriptionAr: 'المؤهلات والشهادات الأكاديمية للموظفين (بكالوريوس، ماجستير، دبلوم…)',
    descriptionEn: 'Academic degrees and certifications (Bachelor, Master, Diploma…)',
    domain: 'HR',
    icon: 'GraduationCap',
    isSystem: true,
    initialSeed: [
      { code: 'HIGH_SCHOOL', nameAr: 'ثانوية عامة أو ما يعادلها', nameEn: 'High School', sortOrder: 1 },
      { code: 'DIPLOMA', nameAr: 'دبلوم متوسط / فني', nameEn: 'Associate Diploma', sortOrder: 2 },
      { code: 'BACHELOR', nameAr: 'بكالوريوس / ليسانس', nameEn: "Bachelor's Degree", sortOrder: 3 },
      { code: 'MASTER', nameAr: 'ماجستير', nameEn: "Master's Degree", sortOrder: 4 },
      { code: 'PHD', nameAr: 'دكتوراه', nameEn: 'Doctorate (Ph.D.)', sortOrder: 5 },
    ],
  },
  CONTRACT_TYPE: {
    code: 'CONTRACT_TYPE',
    numericId: 53,
    nameAr: 'أنواع العقود الوظيفية',
    nameEn: 'Employment Contract Type',
    descriptionAr: 'التصنيف القانوني لعقود العمل المسجلة',
    descriptionEn: 'Legal classification of employment contracts',
    domain: 'HR',
    icon: 'FileText',
    isSystem: true,
    initialSeed: [
      { code: 'INDEFINITE', nameAr: 'عقد غير محدد المدة (مفتوح)', nameEn: 'Indefinite Contract', sortOrder: 1 },
      { code: 'DEFINITE', nameAr: 'عقد محدد المدة (محدد بسنتين أو أقل)', nameEn: 'Fixed-Term Contract', sortOrder: 2 },
      { code: 'PROJECT_BASED', nameAr: 'عقد مرتبط بإنجاز مشروع معين', nameEn: 'Project-Based Contract', sortOrder: 3 },
    ],
  },
  ORG_STRUCTURE_TYPE: {
    code: 'ORG_STRUCTURE_TYPE',
    numericId: 54,
    nameAr: 'أنواع الوحدات التنظيمية',
    nameEn: 'Org Structure Unit Types',
    descriptionAr: 'التصنيف الهيكلي للوحدات المكونة للهيكل التنظيمي للنظام',
    descriptionEn: 'Structural classification of organizational units',
    domain: 'ORG',
    icon: 'Network',
    isSystem: true,
    initialSeed: [
      { code: 'SECTOR', nameAr: 'قطاع تنفيذي', nameEn: 'Sector / Division', sortOrder: 1 },
      { code: 'GENERAL_DEPT', nameAr: 'إدارة عامة', nameEn: 'General Department', sortOrder: 2 },
      { code: 'DEPARTMENT', nameAr: 'إدارة مستقلة', nameEn: 'Department', sortOrder: 3 },
      { code: 'SECTION', nameAr: 'قسم فرعي', nameEn: 'Section', sortOrder: 4 },
      { code: 'UNIT', nameAr: 'وحدة تشغيلية', nameEn: 'Operational Unit', sortOrder: 5 },
    ],
  },
}

export const STATIC_TYPE_SUMMARIES = Object.values(SYSTEM_DEFINITION_TYPES).map((meta) => ({
  code: meta.code,
  numericId: meta.numericId,
  nameAr: meta.nameAr,
  nameEn: meta.nameEn,
  descriptionAr: meta.descriptionAr,
  descriptionEn: meta.descriptionEn,
  domain: meta.domain,
  icon: meta.icon,
  isSystem: meta.isSystem,
  totalItems: meta.initialSeed.length,
  activeItems: meta.initialSeed.length,
}))

export function getStaticSeedItems(typeCode: string) {
  const meta = SYSTEM_DEFINITION_TYPES[typeCode]
  if (!meta) return []
  return meta.initialSeed.map((s, i) => ({
    id: `seed-${typeCode}-${s.code}`,
    companyId: '*',
    typeCode,
    code: s.code,
    nameAr: s.nameAr,
    nameEn: s.nameEn,
    description: s.descriptionAr || s.descriptionEn || null,
    sortOrder: s.sortOrder || i + 1,
    isSystem: true,
    active: true,
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))
}
