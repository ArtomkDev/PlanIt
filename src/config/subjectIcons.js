import { 
  // Точні та Природничі науки (Science & Math)
  MathOperations, PlusMinus, Radical, Calculator, Sigma, Pi, Angle, 
  LineSegments, Polygon, Graph, Atom, Flask, Magnet, Biohazard, 
  Radioactive, Microscope, Ruler, Shapes, Dna, Lightning, Thermometer, Fire,

  // IT та Технології (Dev & Tech)
  Binary, Code, CodeSimple, CodesandboxLogo, GitPullRequest, GitDiff, 
  Terminal, Keyboard, Browsers, Bug, Network, Broadcast, Waveform, 
  Cpu, Database, Laptop, Brain, WifiHigh, HardDrives, DeviceMobile, GlobeHemisphereWest,

  // Гуманітарні науки та Офіс (Humanities & Office)
  Article, Book, BookBookmark, BookOpenText, Books, BookmarksSimple, 
  Translate, TextColumns, TextSuperscript, AlignBottom, Paperclip, 
  Folders, Scroll, Feather, ChatCircleText, Quotes, PenNib, Gavel, Bank, Scales,

  // Бізнес та Управління (Business & Strategy)
  Briefcase, BriefcaseMetal, ChartDonut, ChartPieSlice, Kanban, 
  Strategy, Stack, Money, TrendUp, PresentationChart, Users, Target,

  // Мистецтво та Музика (Arts & Music)
  Palette, PaintBrush, PaintBrushHousehold, Guitar, MusicNote, MusicNotes, 
  VinylRecord, Playlist, Microphone, Headphones, Camera, Clapperboard,

  // Спорт та Здоров'я (Sport & Health)
  Barbell, Basketball, Baseball, PersonSimpleBike, PersonSimpleHike, 
  Asclepius, Trophy, Medal, Heartbeat, Timer, Sneaker, Bicycle,

  // Навчання та Організація (Edu & Org)
  GraduationCap, Student, Chalkboard, ClipboardText, Calendar, CalendarDots, 
  Clock, GridFour, BoundingBox, DiamondsFour, Gradient, Lightbulb, Bell,

  // Природа, Розваги та Інше (Misc & Fun)
  Ghost, PuzzlePiece, FlowerTulip, Grains, Snowflake, Waves, Spiral, 
  YinYang, Star, StarFour, StarAndCrescent, Tent, MapTrifold, MapPin, 
  BowlSteam, Warning, WarningDiamond, SealWarning, Airplane, PaperPlaneTilt
} from 'phosphor-react-native';

export const SUBJECT_ICONS = {
  // Дефолтна іконка
  default: Chalkboard,

  // Наука та Математика
  math: Sigma,
  math_ops: MathOperations,
  plus_minus: PlusMinus,
  radical: Radical,
  calc: Calculator,
  pi: Pi,
  angle: Angle,
  lines: LineSegments,
  polygon: Polygon,
  graph: Graph,
  physics: Atom,
  chemistry: Flask,
  magnet: Magnet,
  biohazard: Biohazard,
  radioactive: Radioactive,
  micro: Microscope,
  ruler: Ruler,
  shapes: Shapes,
  energy: Lightning,
  health_science: Asclepius,

  // IT / Програмування
  code: Code,
  code_simple: CodeSimple,
  git_pull: GitPullRequest,
  git_diff: GitDiff,
  sandbox: CodesandboxLogo,
  terminal: Terminal,
  keyboard: Keyboard,
  web: Browsers,
  bug: Bug,
  network: Network,
  broadcast: Broadcast,
  wave: Waveform,
  binary: Binary,
  cpu: Cpu,
  data: Database,
  laptop: Laptop,
  ai: Brain,

  // Мови та Письмо
  article: Article,
  book: Book,
  book_mark: BookBookmark,
  open_book: BookOpenText,
  books: Books,
  bookmarks: BookmarksSimple,
  lang: Translate,
  columns: TextColumns,
  superscript: TextSuperscript,
  write: Feather,
  scroll: Scroll,
  quote: Quotes,

  // Суспільство / Бізнес
  history: Bank,
  law: Scales,
  justice: Gavel,
  work: Briefcase,
  work_alt: BriefcaseMetal,
  chart_donut: ChartDonut,
  chart_pie: ChartPieSlice,
  kanban: Kanban,
  strategy: Strategy,
  stack: Stack,
  money: Money,
  people: Users,
  target: Target,

  // Мистецтво та Музика
  art: Palette,
  draw: PaintBrush,
  guitar: Guitar,
  music: MusicNotes,
  music_single: MusicNote,
  cleaning: PaintBrushHousehold,
  vinyl: VinylRecord,
  playlist: Playlist,
  photo: Camera,
  film: Clapperboard,

  // Спорт
  gym: Barbell,
  basketball: Basketball,
  baseball: Baseball,
  bike: PersonSimpleBike,
  hike: PersonSimpleHike,
  run: Sneaker,
  win: Trophy,
  medal: Medal,

  // Освіта / Організація
  edu: GraduationCap,
  student: Student,
  folders: Folders,
  paperclip: Paperclip,
  test: ClipboardText,
  time: Clock,
  date: Calendar,
  date_dots: CalendarDots,
  grid: GridFour,
  box: BoundingBox,
  diamonds: DiamondsFour,
  gradient: Gradient,
  idea: Lightbulb,
  bell: Bell,

  // Інше / Розваги
  ghost: Ghost,
  puzzle: PuzzlePiece,
  nature: FlowerTulip,
  grains: Grains,
  winter: Snowflake,
  sea: Waves,
  spiral: Spiral,
  zen: YinYang,
  star: Star,
  star_special: StarFour,
  religion: StarAndCrescent,
  camp: Tent,
  map: MapTrifold,
  loc: MapPin,
  food: BowlSteam,
  travel: Airplane,
  warning: Warning,
  danger: WarningDiamond,
  seal_warning: SealWarning,
};


export const ICON_CATEGORIES = [
  {
    id: 'science',
    icons: ['math', 'math_ops', 'plus_minus', 'radical', 'calc', 'pi', 'angle', 'lines', 'polygon', 'graph', 'physics', 'chemistry', 'magnet', 'biohazard', 'radioactive', 'micro', 'ruler', 'shapes', 'energy', 'health_science']
  },
  {
    id: 'tech',
    icons: ['code', 'code_simple', 'git_pull', 'git_diff', 'sandbox', 'terminal', 'keyboard', 'web', 'bug', 'network', 'broadcast', 'wave', 'binary', 'cpu', 'data', 'laptop', 'ai']
  },
  {
    id: 'humanities',
    icons: ['article', 'book', 'book_mark', 'open_book', 'books', 'bookmarks', 'lang', 'columns', 'superscript', 'write', 'scroll', 'quote']
  },
  {
    id: 'business',
    icons: ['history', 'law', 'justice', 'work', 'work_alt', 'chart_donut', 'chart_pie', 'kanban', 'strategy', 'stack', 'money', 'people', 'target']
  },
  {
    id: 'art',
    icons: ['art', 'draw', 'guitar', 'music', 'music_single', 'cleaning', 'vinyl', 'playlist', 'photo']
  },
  {
    id: 'sport',
    icons: ['gym', 'basketball', 'baseball', 'bike', 'hike', 'run', 'win', 'medal']
  },
  {
    id: 'edu',
    icons: ['edu', 'student', 'folders', 'paperclip', 'test', 'time', 'date', 'date_dots', 'grid', 'box', 'diamonds', 'gradient', 'idea', 'bell']
  },
  {
    id: 'misc',
    icons: ['ghost', 'puzzle', 'nature', 'grains', 'winter', 'sea', 'spiral', 'zen', 'star', 'star_special', 'religion', 'camp', 'map', 'loc', 'food', 'travel', 'warning', 'danger', 'seal_warning']
  }
];


export function getIconComponent(iconKey) {
  if (!iconKey) return null; 
  
  return SUBJECT_ICONS[iconKey] || null; 
}