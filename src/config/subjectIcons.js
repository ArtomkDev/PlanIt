import { 
  // Точні
  Calculator, FlaskConical, Atom, Dna, Microscope, Ruler, Zap, Thermometer,
  Sigma, Pi, Flame, Magnet, 

  // IT
  Code, Terminal, Cpu, Database, Laptop, BrainCircuit, Wifi, Server, Smartphone,
  Globe, 

  // Мови та Гуманітарні
  BookA, BookOpen, Languages, Landmark, Scale, Scroll, Feather, Library,
  MessageCircle, Quote, PenTool, Gavel,

  // Економіка та Суспільство
  BadgeDollarSign, PieChart, Briefcase, TrendingUp, Presentation,
  Users, Target,

  // Мистецтво
  Palette, Brush, Music, Mic, Headphones, Camera, Clapperboard, 

  // Спорт
  Dumbbell, Trophy, Medal, HeartPulse, Timer, Bike, Footprints,

  // Організаційні / Інше
  GraduationCap, School, ClipboardList, CalendarDays, Clock, Coffee, 
  Lightbulb, Bell, Star, MapPin, Plane
} from 'lucide-react-native';

export const SUBJECT_ICONS = {
  // За замовчуванням
  default: School,

  // Наука
  calc: Calculator,
  math: Sigma,
  pi: Pi,
  physics: Atom,
  magnet: Magnet,
  chemistry: FlaskConical,
  biology: Dna,
  micro: Microscope,
  ruler: Ruler,
  energy: Zap,
  fire: Flame,
  
  // IT
  code: Code,
  terminal: Terminal,
  cpu: Cpu,
  data: Database,
  laptop: Laptop,
  ai: BrainCircuit,
  web: Globe,
  server: Server,
  mobile: Smartphone,
  
  // Мови/Літ
  book: BookA,
  openbook: BookOpen,
  lang: Languages,
  write: Feather,
  scroll: Scroll,
  msg: MessageCircle,
  quote: Quote,

  // Суспільство/Право
  history: Landmark,
  law: Scale,
  justice: Gavel,
  people: Users,
  
  // Економіка
  money: BadgeDollarSign,
  chart: PieChart,
  work: Briefcase,
  grow: TrendingUp,
  target: Target,

  // Арт
  art: Palette,
  draw: Brush,
  design: PenTool,
  music: Music,
  mic: Mic,
  photo: Camera,
  film: Clapperboard,
  
  // Спорт
  gym: Dumbbell,
  win: Trophy,
  medal: Medal,
  health: HeartPulse,
  run: Footprints,
  bike: Bike,

  // Інше
  edu: GraduationCap,
  school: School,
  test: ClipboardList,
  time: Clock,
  date: CalendarDays,
  idea: Lightbulb,
  bell: Bell,
  star: Star,
  loc: MapPin,
  travel: Plane,
};

// 🔥 Якщо ключа немає, повертаємо дефолтну іконку
export function getIconComponent(iconKey) {
  return SUBJECT_ICONS[iconKey] || SUBJECT_ICONS['default'];
}