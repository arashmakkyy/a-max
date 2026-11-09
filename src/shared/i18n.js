/*!
 * A.max — Bilingual Localization Dictionary (Persian Primary / English Ready)
 * Created by Arash Makki | Released under the MIT License
 */
(function (global) {
  'use strict';

  const AMTool = (global.AMTool = global.AMTool || {});

  const DICTIONARY = {
    fa: {
      appName: 'A.max',
      appTagline: 'جعبه ابزار جامع هوش مصنوعی — خروجی چت، محافظ پرامپت و اصلاح متن فارسی',
      creatorCredit: 'ساخته‌شده توسط Arash Makki (لایسنس MIT)',
      creatorName: 'Arash Makki',
      licenseBadge: 'متن‌باز — MIT License',

      'tab.export': 'خروجی گفتگو',
      'tab.prompts': 'محافظ پرامپت',
      'tab.persian': 'اصلاح فارسی',
      'tab.sites': 'سایت‌های هوش مصنوعی',

      'export.quickTitle': 'خروجی سریع کل گفتگو',
      'export.customSelect': 'بازکردن استودیو پیش‌نمایش',
      'export.customSelectDesc': 'فیلتر پیام‌ها، انتخاب بازه، تغییر تم و خروجی سفارشی',
      'export.pdf': 'PDF',
      'export.word': 'Word',
      'export.markdown': 'Markdown',
      'export.image': 'تصویر یکپارچه',
      'export.json': 'داده JSON',
      'export.text': 'متن ساده',
      'export.html': 'صفحه وب (HTML)',
      'export.csv': 'جدول (CSV)',
      'export.copyMd': 'کپی Markdown',
      'export.copyJson': 'کپی JSON',
      'export.copyText': 'کپی متن',
      'export.addToSidepanel': 'افزودن به پنل تجمیع چت‌ها',
      'export.openSidepanel': 'پنل کناری (تجمیع چت‌ها)',
      'export.openPreview': 'استودیو پیش‌نمایش و طراحی',
      'export.openOptions': 'تنظیمات پیشرفته',
      'export.singleMessageBtn': 'خروجی این پیام با A.max',

      'single.menuTitle': 'خروجی این پاسخ',
      'single.roleAssistant': 'پاسخ',
      'single.roleUser': 'پرسش',
      'single.pdf': 'سند PDF',
      'single.word': 'سند Word',
      'single.markdown': 'فایل Markdown',
      'single.image': 'تصویر یکپارچه',
      'single.copyImage': 'کپی تصویر این پاسخ',
      'single.copy': 'کپی Markdown با اصلاح راست‌چین',
      'single.sidepanel': 'افزودن به پنل تجمیع',
      'single.notIdentified': 'این پیام شناسایی نشد؛ از استودیو انتخاب کنید.',

      'dock.expand': 'بازکردن داک',
      'dock.collapse': 'جمع کردن داک',
      'dock.close': 'بستن داک',
      'dock.dragHint': 'برای جابه‌جایی بکشید',
      'dock.preview': 'استودیو و خروجی',
      'dock.previewTitle': 'بازکردن استودیوی پیش‌نمایش و خروجی',
      'dock.bidi': 'راست‌چین',
      'dock.bidiTitle': 'اصلاح جهت و فاصله‌های متن صفحه',
      'dock.input': 'نیم‌فاصله',
      'dock.inputTitle': 'اصلاح نیم‌فاصله و ی/ک کادر پرامپت',
      'dock.closed': 'داک بسته شد؛ برای نمایش دوباره از پاپ‌آپ A.max استفاده کنید.',

      'history.fetching': 'در حال دریافت کامل گفتگو از سرور…',

      'select.all': 'انتخاب همه',
      'select.none': 'لغو انتخاب',
      'select.onlyPrompts': 'فقط پرسش‌های من',
      'select.onlyResponses': 'فقط پاسخ‌های هوش مصنوعی',
      'select.range': 'انتخاب بازه‌ای',
      'select.selectedCount': '{selected} از {total} پیام انتخاب شده',
      'select.searchPlaceholder': 'جستجو در متن گفتگو...',

      'promptGuard.statusActive': 'ذخیره خودکار پرامپت فعال است (ضد قطع برق)',
      'promptGuard.statusSaved': 'ذخیره خودکار انجام شد • {time}',
      'promptGuard.liveDraftTitle': 'پرامپت در حال تایپ (ذخیره لحظه‌ای)',
      'promptGuard.noLiveDraft': 'در حال حاضر متنی در کادر ورودی تایپ نشده است. به محض شروع تایپ در هر یک از ۱۸+ هوش مصنوعی، متن شما بدون نیاز به کلیک، لحظه‌ای ذخیره می‌شود.',
      'promptGuard.restoreBtn': 'بازگردانی به کادر پیام',
      'promptGuard.copyBtn': 'کپی متن',
      'promptGuard.deleteBtn': 'حذف',
      'promptGuard.historyTitle': 'تاریخچه خودکار پرامپت‌ها و پیش‌نویس‌های نجات‌یافته',
      'promptGuard.historyEmpty': 'هنوز پرامپتی ثبت نشده است. تمامی پرامپت‌های در حال تایپ و ارسال‌شده به صورت خودکار اینجا نگهداری می‌شوند.',
      'promptGuard.templatesTitle': 'بانک پرامپت‌های آماده',
      'promptGuard.addTemplate': 'افزودن قالب پرامپت جدید',
      'promptGuard.templateTitlePlaceholder': 'عنوان پرامپت (مثلاً: بازنویسی رسمی ایمیل)',
      'promptGuard.templateBodyPlaceholder': 'متن پرامپت را وارد کنید...',
      'promptGuard.saveTemplateBtn': 'ذخیره در بانک پرامپت',
      'promptGuard.recoveryBannerMsg': 'پرامپت ناتمام شما از نشست قبلی پیدا شد ({time}):',
      'promptGuard.recoveryRestore': 'بازگردانی در کادر ورودی',
      'promptGuard.recoveryDismiss': 'بستن',
      'promptGuard.clearHistory': 'پاکسازی تاریخچه',
      'promptGuard.exportBackup': 'دانلود فایل پشتیبان پرامپت‌ها (JSON)',
      'promptGuard.typeDraft': 'پیش‌نویس نجات‌یافته',
      'promptGuard.typeSent': 'ارسال‌شده',

      'persian.title': 'موتور هوشمند راست‌چین و دوجهته (RTL & BiDi)',
      'persian.autoFixToggle': 'اصلاح خودکار به‌هم‌ریختگی فارسی و انگلیسی در صفحه',
      'persian.autoFixDesc': 'تشخیص خودکار جملات فارسی حاوی کلمات انگلیسی (React, API, Python و...)، ایزوله‌سازی تگ‌های کد درون‌خطی و حفظ چپ‌چین بودن بلوک‌های کد',
      'persian.inputDirToggle': 'راست‌چین خودکار کادر نوشتن پرامپت',
      'persian.fontToggle': 'اعمال فونت استاندارد فارسی (وزیرمتن / تاهوما) روی پیام‌ها',
      'persian.autoNormalizeInput': 'اصلاح خودکار «ی/ک» عربی و نیم‌فاصله هنگام تایپ',
      'persian.fixNowBtn': 'اجرای فوری اصلاح راست‌چین روی کل صفحه',
      'persian.normalizeBoxTitle': 'ابزار سریع ویرایش و استانداردسازی متن فارسی',
      'persian.normalizePlaceholder': 'متن فارسی یا دوجهته خود را اینجا قرار دهید یا مستقیم کادر پرامپت صفحه را اصلاح کنید...',
      'persian.btnFixYeKe': 'اصلاح ی و ک فارسی',
      'persian.btnFixZwnj': 'اصلاح نیم‌فاصله‌ها (می‌شود، پرامپت‌ها...)',
      'persian.btnDigitsFa': 'اعداد به فارسی (۱۲۳)',
      'persian.btnDigitsEn': 'اعداد به انگلیسی (123)',
      'persian.btnFixCurrentInput': 'اصلاح متن داخل کادر هوش مصنوعی فعلی',

      'preview.studioTitle': 'استودیو پیش‌نمایش و سفارشی‌سازی خروجی — A.max',
      'preview.conversationTitle': 'عنوان گفتگو',
      'preview.theme': 'پوسته ظاهری (Theme)',
      'preview.theme.light': 'روشن (Light)',
      'preview.theme.dark': 'تیره (Dark)',
      'preview.theme.note': 'دفترچه یادداشت (Note)',
      'preview.theme.old_paper': 'کاغذ کاهی (Old Paper)',
      'preview.theme.sakura': 'شکوفه (Sakura)',
      'preview.theme.blue_mist': 'مه آبی (Blue Mist)',
      'preview.theme.fresh_green': 'سبز ملایم (Fresh Green)',
      'preview.theme.lavender': 'اسطوخودوس (Lavender)',
      'preview.fontSize': 'اندازه قلم',
      'preview.fontSize.small': 'کوچک',
      'preview.fontSize.medium': 'متوسط',
      'preview.fontSize.large': 'بزرگ',
      'preview.width': 'عرض صفحه',
      'preview.tableStyle': 'سبک جدول‌ها',
      'preview.table.solid': 'خط ممتد',
      'preview.table.dashed': 'خط‌چین',
      'preview.table.none': 'بدون کادر',
      'preview.includeThinking': 'نمایش بخش تفکر مدل (Thinking)',
      'preview.includeTimestamp': 'نمایش زمان پیام‌ها',
      'preview.includeSourceUrl': 'درج لینک منبع گفتگو',
      'preview.includeBranding': 'درج امضای پایانی',
      'preview.pdfPageSize': 'اندازه برگه PDF',
      'preview.pdfOrientation': 'جهت برگه',
      'preview.pdfPortrait': 'عمودی (Portrait)',
      'preview.pdfLandscape': 'افقی (Landscape)',
      'preview.watermarkText': 'متن واترمارک / پاورقی سفارشی',

      'sidepanel.title': 'پنل کناری A.max — تجمیع چت‌ها و گنجینه پرامپت',
      'sidepanel.tabAggregation': 'تجمیع چند گفتگو ({count})',
      'sidepanel.tabPrompts': 'پرامپت‌های ذخیره‌شده',
      'sidepanel.tabCache': 'کش گفتگوها',
      'sidepanel.emptyAggregation': 'هنوز گفتگویی به لیست تجمیع اضافه نشده است. از دکمه «افزودن به پنل تجمیع» در پاپ‌آپ یا کنار پیام‌های هر هوش مصنوعی استفاده کنید تا چت‌های چند سایت مختلف را یکجا خروجی بگیرید.',
      'sidepanel.exportCombinedPdf': 'خروجی PDF یکپارچه',
      'sidepanel.exportCombinedMd': 'خروجی Markdown یکپارچه',
      'sidepanel.exportCombinedWord': 'خروجی Word یکپارچه',
      'sidepanel.exportCombinedJson': 'خروجی JSON یکپارچه',
      'sidepanel.clearAggregation': 'پاک کردن لیست تجمیع',

      'options.title': 'تنظیمات جامع افزونه A.max',
      'options.navGeneral': 'تنظیمات عمومی و زبان',
      'options.navExport': 'قالب خروجی و PDF',
      'options.navPromptGuard': 'محافظ خودکار پرامپت (ضد خاموشی)',
      'options.navPersian': 'تنظیمات راست‌چین و نگارش فارسی',
      'options.navPlatforms': 'پلتفرم‌های تحت پوشش (۲۰ سایت)',
      'options.navCache': 'مدیریت کش و داده‌های محلی',
      'options.navAbout': 'درباره سازنده و لایسنس MIT',

      'toast.copied': 'با موفقیت در کلیپ‌بورد کپی شد',
      'toast.exported': 'فایل خروجی با موفقیت ساخته شد',
      'toast.noMessages': 'پیامی در این صفحه برای خروجی یافت نشد',
      'toast.restored': 'پرامپت با موفقیت به کادر ورودی بازگردانده شد',
      'toast.rtlFixed': 'اصلاح راست‌چین و دوجهته (BiDi) روی صفحه اعمال شد',
      'toast.addedToSidepanel': 'گفتگو به پنل تجمیع کناری اضافه شد',
      'toast.imageCopied': 'تصویر در کلیپ‌بورد کپی شد',
      'toast.copyImageMulti': 'این گفتگو برای یک تصویر کلیپ‌بورد بیش از حد بلند است؛ PNG را دانلود کنید.',
      'toast.copyImageFailed': 'کپی تصویر ممکن نشد؛ PNG را دانلود کنید.',
      'toast.draftSaveFailed': 'ذخیره پیش‌نویس ناموفق بود؛ متن خود را کپی کنید.',
      'toast.noInput': 'کادر ورودی پرامپت در این صفحه یافت نشد.',
      'toast.inputFixed': 'متن پرامپت (ی/ک و نیم‌فاصله‌ها) اصلاح و راست‌چین شد.',
      'toast.exportFailed': 'خروجی ناموفق بود',
      'toast.pdfOpened': 'پیش‌نمایش چاپ باز شد — «Save as PDF» را انتخاب کنید',
      'toast.actionFailed': 'عملیات ناموفق بود',
      'toast.savedSettings': 'تنظیمات ذخیره شد',

      'common.aiConversation': 'گفتگوی هوش مصنوعی',

      'confirm.replaceInput': 'کادر ورودی متن دیگری دارد. متن فعلی جایگزین شود؟',

      'role.user': 'کاربر',
      'role.assistant': 'هوش مصنوعی'
    },
    en: {
      appName: 'A.max',
      appTagline: 'All-in-One AI Chat Exporter, Crash-Proof Prompt Guard & Persian BiDi Fixer',
      creatorCredit: 'Created by Arash Makki (MIT License)',
      creatorName: 'Arash Makki',
      licenseBadge: 'Open Source — MIT License',

      'tab.export': 'Chat Export',
      'tab.prompts': 'Prompt Guard',
      'tab.persian': 'RTL & BiDi Fix',
      'tab.sites': 'AI Platforms',

      'export.quickTitle': 'Quick Full-Chat Export',
      'export.customSelect': 'Open Preview Studio',
      'export.customSelectDesc': 'Filter turns, select ranges, switch themes, and customize layout',
      'export.pdf': 'PDF',
      'export.word': 'Word',
      'export.markdown': 'Markdown',
      'export.image': 'Full image',
      'export.json': 'JSON data',
      'export.text': 'Plain text',
      'export.html': 'Web Archive (HTML)',
      'export.csv': 'Table (CSV)',
      'export.copyMd': 'Copy Markdown',
      'export.copyJson': 'Copy JSON',
      'export.copyText': 'Copy Text',
      'export.addToSidepanel': 'Add to SidePanel Aggregation',
      'export.openSidepanel': 'Side Panel (Aggregation)',
      'export.openPreview': 'Preview & Style Studio',
      'export.openOptions': 'Advanced Settings',
      'export.singleMessageBtn': 'Export turn with A.max',

      'single.menuTitle': 'Export this reply',
      'single.roleAssistant': 'Reply',
      'single.roleUser': 'Prompt',
      'single.pdf': 'PDF document',
      'single.word': 'Word document',
      'single.markdown': 'Markdown file',
      'single.image': 'Full image',
      'single.copyImage': 'Copy this reply as image',
      'single.copy': 'Copy RTL-safe Markdown',
      'single.sidepanel': 'Add to SidePanel',
      'single.notIdentified': 'This message could not be identified; choose it in Studio.',

      'dock.expand': 'Expand dock',
      'dock.collapse': 'Collapse dock',
      'dock.close': 'Close dock',
      'dock.dragHint': 'Drag to move',
      'dock.preview': 'Studio & export',
      'dock.previewTitle': 'Open the preview and export studio',
      'dock.bidi': 'Fix RTL',
      'dock.bidiTitle': 'Fix text direction and spacing on this page',
      'dock.input': 'Fix spaces',
      'dock.inputTitle': 'Normalise ZWNJ and Arabic Ye/Ke in the prompt box',
      'dock.closed': 'Dock closed. Re-enable it from the A.max popup.',

      'history.fetching': 'Fetching the complete conversation from the server…',

      'select.all': 'Select All',
      'select.none': 'Clear',
      'select.onlyPrompts': 'Only Prompts',
      'select.onlyResponses': 'Only Responses',
      'select.range': 'Select Range',
      'select.selectedCount': '{selected} of {total} messages selected',
      'select.searchPlaceholder': 'Search conversation...',

      'promptGuard.statusActive': 'Zero-click Prompt Auto-Save is active (Crash-proof)',
      'promptGuard.statusSaved': 'Auto-saved • {time}',
      'promptGuard.liveDraftTitle': 'Live In-Progress Draft (Real-time)',
      'promptGuard.noLiveDraft': 'No active draft in the current input box. As soon as you type on any of the 18+ supported AI sites, your prompt is saved automatically on every keystroke.',
      'promptGuard.restoreBtn': 'Restore to Input Box',
      'promptGuard.copyBtn': 'Copy',
      'promptGuard.deleteBtn': 'Delete',
      'promptGuard.historyTitle': 'Auto-Saved Drafts & Sent Prompt History',
      'promptGuard.historyEmpty': 'No saved prompts yet. In-progress drafts and submitted prompts are automatically recorded here.',
      'promptGuard.templatesTitle': 'Saved Prompt Templates',
      'promptGuard.addTemplate': 'New Prompt Template',
      'promptGuard.templateTitlePlaceholder': 'Template title (e.g., Code Review Checklist)',
      'promptGuard.templateBodyPlaceholder': 'Enter prompt text...',
      'promptGuard.saveTemplateBtn': 'Save Template',
      'promptGuard.recoveryBannerMsg': 'Unsent prompt recovered from your previous session ({time}):',
      'promptGuard.recoveryRestore': 'Restore to Input',
      'promptGuard.recoveryDismiss': 'Dismiss',
      'promptGuard.clearHistory': 'Clear History',
      'promptGuard.exportBackup': 'Export Prompts Backup (JSON)',
      'promptGuard.typeDraft': 'Recovered Draft',
      'promptGuard.typeSent': 'Submitted',

      'persian.title': 'Persian RTL & Mixed BiDi Text Engine',
      'persian.autoFixToggle': 'Auto-fix mixed Persian/English alignment on page',
      'persian.autoFixDesc': 'Automatically aligns Persian paragraphs containing English words, isolates inline code tags, and keeps code blocks strictly LTR',
      'persian.inputDirToggle': 'Auto-RTL direction for prompt input box',
      'persian.fontToggle': 'Apply Persian Vazirmatn/Tahoma font stack to messages',
      'persian.autoNormalizeInput': 'Auto-normalize Arabic Ye/Ke & ZWNJ while typing',
      'persian.fixNowBtn': 'Re-scan & Fix Entire Page Now',
      'persian.normalizeBoxTitle': 'Persian Text Normalizer & Half-Space Utility',
      'persian.normalizePlaceholder': 'Paste mixed Persian/English text here or normalize the active AI input box directly...',
      'persian.btnFixYeKe': 'Normalize Ye & Ke',
      'persian.btnFixZwnj': 'Fix Half-Spaces (ZWNJ)',
      'persian.btnDigitsFa': 'Persian Digits (۱۲۳)',
      'persian.btnDigitsEn': 'English Digits (123)',
      'persian.btnFixCurrentInput': 'Normalize Active AI Prompt Input',

      'preview.studioTitle': 'A.max — Preview & Style Studio',
      'preview.conversationTitle': 'Conversation Title',
      'preview.theme': 'Visual Theme',
      'preview.theme.light': 'Light',
      'preview.theme.dark': 'Dark',
      'preview.theme.note': 'Note',
      'preview.theme.old_paper': 'Old Paper',
      'preview.theme.sakura': 'Sakura',
      'preview.theme.blue_mist': 'Blue Mist',
      'preview.theme.fresh_green': 'Fresh Green',
      'preview.theme.lavender': 'Lavender',
      'preview.fontSize': 'Font Size',
      'preview.fontSize.small': 'Small',
      'preview.fontSize.medium': 'Medium',
      'preview.fontSize.large': 'Large',
      'preview.width': 'Page Width',
      'preview.tableStyle': 'Table Borders',
      'preview.table.solid': 'Solid',
      'preview.table.dashed': 'Dashed',
      'preview.table.none': 'None',
      'preview.includeThinking': 'Include Model Thinking Process',
      'preview.includeTimestamp': 'Show Message Timestamps',
      'preview.includeSourceUrl': 'Include Conversation Source URL',
      'preview.includeBranding': 'Include Footer Signature',
      'preview.pdfPageSize': 'PDF Page Size',
      'preview.pdfOrientation': 'Orientation',
      'preview.pdfPortrait': 'Portrait',
      'preview.pdfLandscape': 'Landscape',
      'preview.watermarkText': 'Custom Footer / Watermark Text',

      'sidepanel.title': 'A.max SidePanel — Chat Aggregation & Prompt Vault',
      'sidepanel.tabAggregation': 'Aggregated Chats ({count})',
      'sidepanel.tabPrompts': 'Prompt Vault',
      'sidepanel.tabCache': 'Cached Chats',
      'sidepanel.emptyAggregation': 'No chats aggregated yet. Click "Add to SidePanel Aggregation" in the popup or message action bar on any AI site to combine multiple chats into one export.',
      'sidepanel.exportCombinedPdf': 'Export Combined PDF',
      'sidepanel.exportCombinedMd': 'Export Combined Markdown',
      'sidepanel.exportCombinedWord': 'Export Combined Word',
      'sidepanel.exportCombinedJson': 'Export Combined JSON',
      'sidepanel.clearAggregation': 'Clear List',

      'options.title': 'A.max — Extension Settings',
      'options.navGeneral': 'General & Language',
      'options.navExport': 'Export & PDF Settings',
      'options.navPromptGuard': 'Crash-Proof Prompt Guard',
      'options.navPersian': 'Persian RTL & BiDi Engine',
      'options.navPlatforms': 'Supported AI Platforms (20)',
      'options.navCache': 'Local Cache & Storage',
      'options.navAbout': 'About Creator & MIT License',

      'toast.copied': 'Copied to clipboard',
      'toast.exported': 'Export completed successfully',
      'toast.noMessages': 'No conversation messages found on this page',
      'toast.restored': 'Prompt restored to input box',
      'toast.rtlFixed': 'Persian RTL & BiDi alignment applied to page',
      'toast.addedToSidepanel': 'Conversation added to SidePanel aggregation',
      'toast.imageCopied': 'Image copied to clipboard',
      'toast.copyImageMulti': 'This conversation is too long for one clipboard image; download the PNG instead.',
      'toast.copyImageFailed': 'Could not copy the image; download the PNG instead.',
      'toast.draftSaveFailed': 'Could not save the draft; copy your text manually.',
      'toast.noInput': 'No prompt input box was found on this page.',
      'toast.inputFixed': 'Prompt text normalised (ZWNJ and Arabic Ye/Ke) and aligned right.',
      'toast.exportFailed': 'The export failed',
      'toast.pdfOpened': 'Print preview opened — choose “Save as PDF”.',
      'toast.actionFailed': 'The action failed',
      'toast.savedSettings': 'Settings saved',

      'common.aiConversation': 'AI conversation',

      'confirm.replaceInput': 'The input box already contains other text. Replace it?',

      'role.user': 'User',
      'role.assistant': 'Assistant'
    }
  };

  let currentLang = 'fa';

  function t(key, params) {
    const table = DICTIONARY[currentLang] || DICTIONARY.fa;
    let str = table[key] !== undefined ? table[key] : (DICTIONARY.fa[key] || DICTIONARY.en[key] || key);
    if (params && typeof params === 'object') {
      Object.keys(params).forEach((k) => {
        str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), String(params[k]));
      });
    }
    return str;
  }

  function setLanguage(lang) {
    currentLang = lang === 'en' ? 'en' : 'fa';
    return currentLang;
  }

  function getLanguage() {
    return currentLang;
  }

  function getDirection() {
    return currentLang === 'fa' ? 'rtl' : 'ltr';
  }

  function translateDocument(root) {
    const container = root || document;
    if (container === document && document.documentElement) {
      document.documentElement.lang = currentLang;
      document.documentElement.dir = getDirection();
    }
    container.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    });
    container.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) el.setAttribute('placeholder', t(key));
    });
    container.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      if (key) el.setAttribute('title', t(key));
    });
  }

  AMTool.i18n = {
    DICTIONARY,
    t,
    setLanguage,
    getLanguage,
    getDirection,
    translateDocument
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
