/** Вставляється в <head>, щоб тема застосувалась до першого малювання сторінки (без блимання). */
export const themeInitScript =
  "try{var t=localStorage.getItem('furia-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}";
