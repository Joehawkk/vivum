// ─────────────────────────────────────────────
//  VIVUM — i18n  (RU / EN)
// ─────────────────────────────────────────────

export const TRANSLATIONS = {
  ru: {
    windowTitle:'Vivum — Симуляция экосистемы',
    menuFile:'Файл', menuSim:'Симуляция', menuView:'Вид', menuHelp:'Справка',
    tbClear:'Очистить', tbPause:'Пауза', tbResume:'Продолжить', tbSave:'Сохранить',
    grpEarth:'🌍 Земля', grpWater:'💧 Вода', grpFire:'🔥 Огонь',
    grpLife:'🌿 Жизнь', grpCreatures:'🐾 Существа', grpSpecial:'⚗ Особые',
    lblBrush:'Размер кисти',
    stElement:'Элемент', stParticles:'частиц',
    taskTitle:'Vivum — Симуляция...',
    startBtn:'Пуск',
    // element names
    sand:'Песок', stone:'Камень', dirt:'Грязь', dust:'Пыль', wall:'Стена',
    water:'Вода', ice:'Лёд', snow:'Снег', rain:'Дождь', cloud:'Облако',
    fire:'Огонь', lava:'Лава', oil:'Нефть', gas:'Газ',
    seed:'Семя', plant:'Растение', wood:'Дерево', fungus:'Гриб', flower:'Цветок',
    mite:'Клещ', cloner:'Клонер',
    acid:'Кислота', wind:'Ветер', rocket:'Ракета',
    empty:'Пусто',
  },
  en: {
    windowTitle:'Vivum — Ecosystem Simulation',
    menuFile:'File', menuSim:'Simulation', menuView:'View', menuHelp:'Help',
    tbClear:'Clear', tbPause:'Pause', tbResume:'Resume', tbSave:'Save',
    grpEarth:'🌍 Earth', grpWater:'💧 Water', grpFire:'🔥 Fire',
    grpLife:'🌿 Life', grpCreatures:'🐾 Creatures', grpSpecial:'⚗ Special',
    lblBrush:'Brush Size',
    stElement:'Element', stParticles:'particles',
    taskTitle:'Vivum — Simulation...',
    startBtn:'Start',
    sand:'Sand', stone:'Stone', dirt:'Dirt', dust:'Dust', wall:'Wall',
    water:'Water', ice:'Ice', snow:'Snow', rain:'Rain', cloud:'Cloud',
    fire:'Fire', lava:'Lava', oil:'Oil', gas:'Gas',
    seed:'Seed', plant:'Plant', wood:'Wood', fungus:'Fungus', flower:'Flower',
    mite:'Mite', cloner:'Cloner',
    acid:'Acid', wind:'Wind', rocket:'Rocket',
    empty:'Empty',
  },
};

export class I18n {
  constructor(defaultLang = 'ru') {
    this.lang = defaultLang;
    const saved = localStorage.getItem('vivum-lang');
    if (saved === 'ru' || saved === 'en') this.lang = saved;
  }
  t(key) { return TRANSLATIONS[this.lang][key] ?? key; }
  toggle() {
    this.lang = this.lang === 'ru' ? 'en' : 'ru';
    localStorage.setItem('vivum-lang', this.lang);
  }
  applyDOM() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = this.t(el.dataset.i18n);
    });
  }
}
