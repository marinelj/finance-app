const en = {
  common: {
    appName: 'Finance',
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    done: 'Done',
    edit: 'Edit',
    delete: 'Delete',
    add: 'Add',
    continue: 'Continue',
    back: 'Back',
    seeAll: 'See all',
  },
  tabs: {
    home: 'Home',
    credit: 'Credit',
    wealth: 'Wealth',
    settings: 'Me',
  },
  greeting: {
    morning: 'Good morning',
    afternoon: 'Good afternoon',
    evening: 'Good evening',
  },
  home: {
    totalOwed: 'Total owed',
    noProducts: 'No cards or loans yet',
    dueThisMonth: 'Due this month',
    nextDue: 'Next due',
    nothingDue: 'Nothing due',
    bestCardToday: 'Best card to use today',
    bestCardEmpty:
      'Add a credit card and this card will tell you which one gives the longest interest-free days.',
    emptyTitle: 'Let’s map your money',
    emptyMessage:
      'Start with your credit cards and loans, then add income and investments. Everything stays on this phone.',
    hideAmounts: 'Hide amounts',
    showAmounts: 'Show amounts',
  },
  credit: {
    title: 'Credit',
    emptyTitle: 'No cards or loans yet',
    emptyMessage:
      'Credit cards, Huabei, Jiebei, Wangshangdai and other credit products will show up here, sorted by what is due first.',
  },
  wealth: {
    title: 'Wealth',
    emptyTitle: 'Your full financial picture',
    emptyMessage:
      'Income, housing, insurance, bonds and stocks come together here to build your plan.',
  },
  settings: {
    title: 'Me',
    preferences: 'Preferences',
    language: 'Language',
    languageSystem: 'System',
    homeCurrency: 'Home currency',
    hideAmounts: 'Hide amounts',
    hideAmountsHint: 'Masks every balance until you turn it off',
    haptics: 'Haptic feedback',
    about: 'About',
    designSystem: 'Design system',
    designSystemHint: 'Colours, type and components used in the app',
    privacyNote: 'All data stays on this device. No account, no cloud, no analytics.',
    disclaimer: 'This is a planning tool, not licensed financial advice.',
    version: 'Version {{version}}',
  },
  due: {
    overdue_one: 'Overdue {{count}} day',
    overdue_other: 'Overdue {{count}} days',
    today: 'Due today',
    daysLeft_one: '{{count}} day left',
    daysLeft_other: '{{count}} days left',
  },
  a11y: {
    amountHidden: 'Amount hidden',
    percent: '{{percent}} percent',
    tabPosition: '{{label}}, tab {{index}} of {{count}}',
  },
};

export type Translation = typeof en;

export default en;
