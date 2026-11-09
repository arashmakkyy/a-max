/* Shared UI theme, language and storage sync for all extension surfaces. */
(function(){'use strict';
  const A=window.AMTool;
  if(!A?.storage) return;
  const apply=async()=>{
    const cfg=await A.storage.getSettings();
    const theme=cfg.uiTheme==='system'?(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):(cfg.uiTheme||'dark');
    document.documentElement.dataset.theme=theme;
    document.documentElement.lang=cfg.language||'fa';
    document.documentElement.dir=cfg.language==='en'?'ltr':'rtl';
    A.i18n?.setLanguage(cfg.language||'fa'); A.i18n?.translateDocument(document);
  };
  document.addEventListener('DOMContentLoaded',()=>{apply().catch(()=>{});});
  if(window.chrome?.storage?.onChanged) chrome.storage.onChanged.addListener((changes,area)=>{
    if(area==='local'&&changes[A.storage.KEYS.SETTINGS])apply().catch(()=>{});
  });
  matchMedia('(prefers-color-scheme:dark)').addEventListener('change',()=>apply().catch(()=>{}));
})();
